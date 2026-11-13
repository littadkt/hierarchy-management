from datetime import datetime, timezone
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.broadcaster import broadcaster
from app.core.permissions import HierarchyPermissionError
from app.models.branch import Branch
from app.models.inventory import InventoryItem
from app.models.purchase_request import (
    PurchaseRequest,
    PurchaseRequestHistory,
    PurchaseRequestStatus,
)
from app.models.user import Role, User
from app.schemas.purchase_request import (
    PurchaseRequestCreate,
    PurchaseRequestStatusUpdate,
    PurchaseRequestUpdate,
)
from app.services.inventory_service import InventoryService


class PurchaseService:
    @staticmethod
    async def get_active_purchase_manager(session: AsyncSession) -> Optional[User]:
        stmt = (
            select(User)
            .where(
                User.role == Role.IN_CHARGE,
                User.is_purchase_manager == True,
                User.is_active == True,
            )
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_in_charge_users(session: AsyncSession) -> List[User]:
        stmt = (
            select(User)
            .where(User.role == Role.IN_CHARGE, User.is_active == True)
            .order_by(User.full_name.asc())
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_all_purchase_managers(session: AsyncSession) -> List[User]:
        """
        Returns all users who act as PM or TL:
        - Active Team Leaders (TEAM_LEADER)
        - Active In-Charges (IN_CHARGE)
        - Users designated as is_purchase_manager == True
        - Any user who has purchase requests assigned to them as purchase_manager_id
        """
        stmt = (
            select(User)
            .where(
                User.is_active == True,
                or_(
                    User.role.in_([Role.TEAM_LEADER, Role.IN_CHARGE]),
                    User.is_purchase_manager == True,
                ),
            )
            .order_by(User.full_name.asc())
        )
        result = await session.execute(stmt)
        managers = list(result.scalars().all())

        # Include any additional manager referenced in existing requests
        pm_ids_stmt = (
            select(PurchaseRequest.purchase_manager_id)
            .distinct()
            .where(PurchaseRequest.purchase_manager_id.isnot(None))
        )
        pm_ids_res = await session.execute(pm_ids_stmt)
        pm_ids = set(pm_ids_res.scalars().all())

        existing_ids = {u.id for u in managers}
        missing_ids = pm_ids - existing_ids
        if missing_ids:
            extra_stmt = select(User).where(User.id.in_(missing_ids)).order_by(User.full_name.asc())
            extra_res = await session.execute(extra_stmt)
            managers.extend(extra_res.scalars().all())

        return managers

    @staticmethod
    async def get_default_purchase_manager_for_user(
        session: AsyncSession, requester: User
    ) -> Optional[User]:
        """
        Default purchase manager resolution:
        - For Staff:
          Defaults to their Team Leader (first checks reports_to, then team leader in same department/branch).
        - For other roles (Team Leader, In-Charge, Admin, Super Admin):
          They don't have an external purchase manager (managed by themselves).
        """
        if requester.role != Role.STAFF:
            return None

        # 1. If staff has a reports_to user who is an active TEAM_LEADER
        if requester.reports_to_id:
            reports_to_stmt = select(User).where(
                User.id == requester.reports_to_id,
                User.role == Role.TEAM_LEADER,
                User.is_active == True,
            )
            reports_to_res = await session.execute(reports_to_stmt)
            tl = reports_to_res.scalar_one_or_none()
            if tl:
                return tl

        # 2. Look for active Team Leader in the staff's department (and branch if specified)
        if requester.department:
            dept_tl_stmt = select(User).where(
                User.role == Role.TEAM_LEADER,
                User.department == requester.department,
                User.is_active == True,
            )
            if requester.branch:
                # Prefer same branch + department
                branch_dept_stmt = dept_tl_stmt.where(User.branch == requester.branch)
                res = await session.execute(branch_dept_stmt)
                tl = res.scalars().first()
                if tl:
                    return tl

            res = await session.execute(dept_tl_stmt)
            tl = res.scalars().first()
            if tl:
                return tl

        # 3. Fallback: Any active Team Leader in same branch
        if requester.branch:
            branch_tl_stmt = select(User).where(
                User.role == Role.TEAM_LEADER,
                User.branch == requester.branch,
                User.is_active == True,
            )
            res = await session.execute(branch_tl_stmt)
            tl = res.scalars().first()
            if tl:
                return tl

        # 4. Fallback: Any active Team Leader in the organization
        any_tl_stmt = select(User).where(
            User.role == Role.TEAM_LEADER,
            User.is_active == True,
        )
        res = await session.execute(any_tl_stmt)
        return res.scalars().first()

    @staticmethod
    async def assign_purchase_manager(
        session: AsyncSession, operator: User, incharge_user_id: uuid.UUID
    ) -> User:
        """
        Super Admin provision:
        Pick an In-Charge user and assign them as Purchase Manager.
        """
        if operator.role != Role.SUPER_ADMIN:
            raise HierarchyPermissionError(
                "Only Super Admin has the provision to assign an In-Charge user as Purchase Manager."
            )

        stmt = select(User).where(User.id == incharge_user_id)
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if target.role != Role.IN_CHARGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only users with 'IN_CHARGE' role can be designated as Purchase Manager. Selected user has role '{target.role.value}'.",
            )

        # Clear previous purchase managers
        await session.execute(
            update(User)
            .where(User.is_purchase_manager == True)
            .values(is_purchase_manager=False)
        )

        # Assign new purchase manager
        target.is_purchase_manager = True
        await session.commit()
        await session.refresh(target)
        return target

    @staticmethod
    async def create_purchase_request(
        session: AsyncSession, requester: User, request_in: PurchaseRequestCreate
    ) -> PurchaseRequest:
        """
        All user types have the provision to submit a purchase request
        to the designated purchase manager.
        """
        # 1. Resolve requester branch and look up item in branch inventory
        requester_branch_id = None
        if requester.branch:
            b_stmt = select(Branch.id).where(Branch.name.ilike(requester.branch.strip()))
            requester_branch_id = (await session.execute(b_stmt)).scalar_one_or_none()

        inventory_item = await InventoryService.get_by_code(session, request_in.code, branch_id=requester_branch_id)
        if not inventory_item:
            # Fallback to any branch if not found in requester branch
            inventory_item = await InventoryService.get_by_code(session, request_in.code)

        # 2. Determine Purchase Manager according to hierarchy rules:
        # - Staff: defaults to their Team Leader (changing option not allowed for staff)
        # - Team Leader, In-Charge, Admin, Super Admin: no external purchase manager, managed by themselves only
        if requester.role == Role.STAFF:
            assigned_pm = await PurchaseService.get_default_purchase_manager_for_user(session, requester)
            pm_id = assigned_pm.id if assigned_pm else None
            initial_remarks = (
                f"Purchase request submitted by Staff {requester.full_name}. "
                f"Assigned Purchase Manager: {assigned_pm.full_name if assigned_pm else 'Department Team Leader'}."
            )
        else:
            # Managed by themselves only
            pm_id = requester.id
            initial_remarks = (
                f"Purchase order submitted by {requester.full_name} ({requester.role.value}). "
                "Managed directly by self."
            )

        # 3. Create purchase request (fallback to inventory item properties)
        name = (request_in.name.strip() if request_in.name else "") or (inventory_item.name if inventory_item and inventory_item.name else "")
        vendor = (request_in.vendor.strip() if request_in.vendor else "") or (inventory_item.vendor if inventory_item and inventory_item.vendor else "")
        rate = request_in.rate if (request_in.rate is not None and request_in.rate > 0) else (inventory_item.rate if inventory_item and inventory_item.rate is not None else 0.0)
        category = (request_in.category.strip() if request_in.category else "") or (inventory_item.category if inventory_item and inventory_item.category else "")
        brand = (request_in.brand.strip() if request_in.brand else "") or (inventory_item.brand if inventory_item and inventory_item.brand else "")

        pr = PurchaseRequest(
            inventory_item_id=inventory_item.id if inventory_item else None,
            code=request_in.code,
            name=name,
            rate=float(rate or 0.0),
            category=category,
            brand=brand,
            vendor=vendor,
            quantity=request_in.quantity,
            requested_by_id=requester.id,
            purchase_manager_id=pm_id,
            status=PurchaseRequestStatus.OPEN,
            notes=request_in.notes,
        )
        session.add(pr)
        await session.flush()

        # 4. Log initial history
        history = PurchaseRequestHistory(
            purchase_request_id=pr.id,
            changed_by_id=requester.id,
            old_status=None,
            new_status=PurchaseRequestStatus.OPEN,
            remarks=initial_remarks,
        )
        session.add(history)

        await session.commit()
        created_pr = await PurchaseService.get_by_id(session, pr.id)
        broadcaster.broadcast_sync({
            "type": "PURCHASE_CREATED",
            "data": {
                "purchase_id": str(pr.id),
                "code": pr.code,
                "name": pr.name,
                "status": pr.status.value if hasattr(pr.status, "value") else pr.status,
                "requested_by_id": str(pr.requested_by_id),
                "purchase_manager_id": str(pr.purchase_manager_id) if pr.purchase_manager_id else None,
            },
        })
        return created_pr

    @staticmethod
    async def get_by_id(
        session: AsyncSession, request_id: uuid.UUID
    ) -> Optional[PurchaseRequest]:
        stmt = (
            select(PurchaseRequest)
            .where(PurchaseRequest.id == request_id)
            .options(
                selectinload(PurchaseRequest.requested_by).selectinload(User.manager),
                selectinload(PurchaseRequest.purchase_manager).selectinload(User.manager),
                selectinload(PurchaseRequest.inventory_item),
                selectinload(PurchaseRequest.history).selectinload(
                    PurchaseRequestHistory.changed_by
                ),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_purchase_requests(
        session: AsyncSession,
        current_user: User,
        status_filter: Optional[PurchaseRequestStatus] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = "desc",
        date_filter: Optional[str] = None,
        pm_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[PurchaseRequest], int]:
        """
        Visibility rules:
        - Super Admin & Admin: See all purchase requests and histories.
        - Team Leader:
          - Requests placed by themselves (managed by self)
          - Requests where they are the assigned purchase manager
          - Requests placed by staff in their department
        - In-Charge:
          - Requests placed by themselves (managed by self)
          - Requests where they are assigned purchase manager
          - Requests placed by staff under their department/branch or reporting line
        - Staff:
          - Only see their own submitted requests (managed by their Team Leader)
        """
        stmt = select(PurchaseRequest).options(
            selectinload(PurchaseRequest.requested_by).selectinload(User.manager),
            selectinload(PurchaseRequest.purchase_manager).selectinload(User.manager),
            selectinload(PurchaseRequest.inventory_item),
            selectinload(PurchaseRequest.history).selectinload(
                PurchaseRequestHistory.changed_by
            ),
        )

        if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN]:
            # Universal visibility
            pass
        elif current_user.role == Role.TEAM_LEADER:
            # Team leader sees own orders + staff orders they manage
            conditions = [
                PurchaseRequest.requested_by_id == current_user.id,
                PurchaseRequest.purchase_manager_id == current_user.id,
            ]
            if current_user.department:
                conditions.append(
                    PurchaseRequest.requested_by.has(
                        (User.role == Role.STAFF) & (User.department == current_user.department)
                    )
                )
            stmt = stmt.where(or_(*conditions))
        elif current_user.role == Role.IN_CHARGE:
            # In-Charge sees:
            # 1. Orders placed by themselves
            # 2. Orders where they are designated as purchase manager
            # 3. Orders placed by Staff under their supervision:
            #    - Staff in the same department (and branch if configured)
            #    - Staff in the same branch (if In-Charge has no department configured)
            #    - Staff directly or indirectly reporting to this In-Charge
            #    - Orders managed by a Team Leader who reports to this In-Charge
            conditions = [
                PurchaseRequest.requested_by_id == current_user.id,
                PurchaseRequest.purchase_manager_id == current_user.id,
            ]

            staff_scope = (User.role == Role.STAFF)
            if current_user.department:
                staff_scope = staff_scope & (User.department == current_user.department)
            if current_user.branch:
                staff_scope = staff_scope & (User.branch == current_user.branch)

            conditions.append(PurchaseRequest.requested_by.has(staff_scope))
            conditions.append(
                PurchaseRequest.requested_by.has(
                    (User.role == Role.STAFF) & (User.reports_to_id == current_user.id)
                )
            )
            conditions.append(
                PurchaseRequest.purchase_manager.has(User.reports_to_id == current_user.id)
            )

            if current_user.department or current_user.branch:
                pm_filter = (User.role == Role.TEAM_LEADER)
                if current_user.department:
                    pm_filter = pm_filter & (User.department == current_user.department)
                if current_user.branch:
                    pm_filter = pm_filter & (User.branch == current_user.branch)
                conditions.append(
                    PurchaseRequest.purchase_manager.has(pm_filter)
                    & PurchaseRequest.requested_by.has(User.role == Role.STAFF)
                )

            stmt = stmt.where(or_(*conditions))
        elif current_user.is_purchase_manager:
            # Designated global purchase manager sees all
            pass
        else:
            # Staff or non-PM sees only their own requests
            stmt = stmt.where(PurchaseRequest.requested_by_id == current_user.id)

        if status_filter:
            stmt = stmt.where(PurchaseRequest.status == status_filter)

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    PurchaseRequest.code.ilike(search_term),
                    PurchaseRequest.name.ilike(search_term),
                    PurchaseRequest.category.ilike(search_term),
                    PurchaseRequest.brand.ilike(search_term),
                    PurchaseRequest.vendor.ilike(search_term),
                )
            )

        if date_filter and date_filter.strip():
            stmt = stmt.where(func.to_char(PurchaseRequest.created_at, "YYYY-MM-DD") == date_filter.strip())

        if pm_filter and pm_filter.strip():
            pm_val = pm_filter.strip()
            if pm_val == "PM_MANAGED":
                # Orders placed by Staff that are managed by assigned PM/TL
                stmt = stmt.where(PurchaseRequest.requested_by.has(User.role == Role.STAFF))
            elif pm_val == "SELF_MANAGED":
                # Orders placed by non-staff (TL, In-Charge, Admin, Super Admin), self-managed
                stmt = stmt.where(PurchaseRequest.requested_by.has(User.role != Role.STAFF))
            else:
                try:
                    target_pm_id = uuid.UUID(pm_val)
                    stmt = stmt.where(
                        or_(
                            PurchaseRequest.purchase_manager_id == target_pm_id,
                            PurchaseRequest.requested_by.has(
                                (User.role == Role.STAFF) & (User.reports_to_id == target_pm_id)
                            ),
                            (PurchaseRequest.requested_by_id == target_pm_id) & PurchaseRequest.requested_by.has(User.role != Role.STAFF),
                        )
                    )
                except (ValueError, TypeError):
                    pass

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        is_asc = (order or "desc").lower() == "asc"
        if sort_by in ["managed_by", "manager", "purchase_manager"]:
            pm_alias = aliased(User)
            req_alias = aliased(User)
            stmt = (
                stmt
                .outerjoin(pm_alias, PurchaseRequest.purchase_manager_id == pm_alias.id)
                .outerjoin(req_alias, PurchaseRequest.requested_by_id == req_alias.id)
            )
            manager_name_expr = func.coalesce(pm_alias.full_name, req_alias.full_name, "")
            if is_asc:
                stmt = stmt.order_by(manager_name_expr.asc(), desc(PurchaseRequest.created_at))
            else:
                stmt = stmt.order_by(manager_name_expr.desc(), desc(PurchaseRequest.created_at))
        elif sort_by == "user":
            user_alias = aliased(User)
            stmt = stmt.outerjoin(user_alias, PurchaseRequest.requested_by_id == user_alias.id)
            if is_asc:
                stmt = stmt.order_by(user_alias.full_name.asc().nulls_last(), desc(PurchaseRequest.created_at))
            else:
                stmt = stmt.order_by(user_alias.full_name.desc().nulls_last(), desc(PurchaseRequest.created_at))
        elif sort_by == "total":
            if is_asc:
                stmt = stmt.order_by((PurchaseRequest.rate * PurchaseRequest.quantity).asc(), desc(PurchaseRequest.created_at))
            else:
                stmt = stmt.order_by((PurchaseRequest.rate * PurchaseRequest.quantity).desc(), desc(PurchaseRequest.created_at))
        elif sort_by in ["date", "created_at"]:
            if is_asc:
                stmt = stmt.order_by(PurchaseRequest.created_at.asc())
            else:
                stmt = stmt.order_by(desc(PurchaseRequest.created_at))
        elif sort_by == "name":
            if is_asc:
                stmt = stmt.order_by(PurchaseRequest.name.asc(), desc(PurchaseRequest.created_at))
            else:
                stmt = stmt.order_by(PurchaseRequest.name.desc(), desc(PurchaseRequest.created_at))
        else:
            stmt = stmt.order_by(desc(PurchaseRequest.created_at))

        stmt = stmt.offset(skip).limit(limit)
        result = await session.execute(stmt)
        requests = result.scalars().all()

        return requests, total

    @staticmethod
    async def update_status(
        session: AsyncSession,
        operator: User,
        request_id: uuid.UUID,
        status_update: PurchaseRequestStatusUpdate,
    ) -> PurchaseRequest:
        """
        Status update rules:
        - Super Admin: Universal permission to update.
        - Non-Staff (Team Leader, In-Charge, Admin, Super Admin):
          "if they place any purchase order that order only by managed by them self only"
          Only the requester themselves can update their order status.
        - Staff:
          "set sup purchase manager of each staffs to their team leader as default , changing option is not allowed for staffs"
          Only their assigned Team Leader (or Team Leader in their department) can update status.
          Staff CANNOT update their own status.
        """
        pr = await PurchaseService.get_by_id(session, request_id)
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found",
            )

        requester = pr.requested_by
        is_super_admin = operator.role == Role.SUPER_ADMIN

        can_manage = False

        if is_super_admin:
            can_manage = True
        elif requester.role != Role.STAFF:
            # Non-staff order: managed by themselves only!
            can_manage = (operator.id == pr.requested_by_id)
        else:
            # Staff order: managed by their Team Leader or supervising In-Charge
            is_team_leader = (
                operator.role == Role.TEAM_LEADER
                and (
                    (requester.department and operator.department == requester.department)
                    or operator.id == requester.reports_to_id
                )
            )
            is_in_charge = (
                operator.role == Role.IN_CHARGE
                and (
                    (operator.id == pr.purchase_manager_id)
                    or (operator.id == requester.reports_to_id)
                    or (requester.manager and requester.manager.reports_to_id == operator.id)
                    or (pr.purchase_manager and pr.purchase_manager.reports_to_id == operator.id)
                    or (
                        (not operator.department or operator.department == requester.department)
                        and (not operator.branch or operator.branch == requester.branch)
                    )
                )
            )
            can_manage = (
                operator.id == pr.purchase_manager_id
                or is_team_leader
                or is_in_charge
            )

        if not can_manage:
            if requester.role != Role.STAFF:
                raise HierarchyPermissionError(
                    f"This purchase order was placed by {requester.full_name} ({requester.role.value}) and can only be managed by themselves."
                )
            else:
                raise HierarchyPermissionError(
                    "Only the designated Team Leader, supervising In-Charge, or Super Admin can manage and update this staff purchase request."
                )

        old_status = pr.status
        new_status = status_update.status

        pr.status = new_status
        if new_status == PurchaseRequestStatus.RECEIVED:
            pr.completed_at = datetime.now(timezone.utc)

            # Resolve target branch from requester
            target_branch_id = None
            if pr.requested_by and pr.requested_by.branch:
                b_stmt = select(Branch.id).where(Branch.name.ilike(pr.requested_by.branch.strip()))
                target_branch_id = (await session.execute(b_stmt)).scalar_one_or_none()

            # Auto-update inventory stock for that branch or create new item
            inv_item = await InventoryService.get_by_code(session, pr.code, branch_id=target_branch_id)
            if inv_item:
                inv_item.quantity += pr.quantity
            else:
                # Add product into branch inventory
                new_inv = InventoryItem(
                    branch_id=target_branch_id,
                    code=pr.code,
                    name=pr.name,
                    rate=pr.rate,
                    category=pr.category,
                    brand=pr.brand,
                    vendor=pr.vendor,
                    quantity=pr.quantity,
                )
                session.add(new_inv)
                await session.flush()
                pr.inventory_item_id = new_inv.id

        # Log status transition history
        history = PurchaseRequestHistory(
            purchase_request_id=pr.id,
            changed_by_id=operator.id,
            old_status=old_status,
            new_status=new_status,
            remarks=status_update.remarks
            or f"Status updated to {new_status.value} by {operator.full_name} ({operator.role.value}).",
        )
        session.add(history)

        await session.commit()
        updated_pr = await PurchaseService.get_by_id(session, pr.id)
        broadcaster.broadcast_sync({
            "type": "PURCHASE_STATUS_UPDATED",
            "data": {
                "purchase_id": str(pr.id),
                "old_status": old_status.value if hasattr(old_status, "value") else old_status,
                "new_status": new_status.value if hasattr(new_status, "value") else new_status,
                "status": new_status.value if hasattr(new_status, "value") else new_status,
                "requested_by_id": str(pr.requested_by_id),
                "purchase_manager_id": str(pr.purchase_manager_id) if pr.purchase_manager_id else None,
                "operator_id": str(operator.id),
            },
        })
        return updated_pr

    @staticmethod
    async def get_history(
        session: AsyncSession, operator: User, request_id: uuid.UUID
    ) -> List[PurchaseRequestHistory]:
        pr = await PurchaseService.get_by_id(session, request_id)
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found",
            )

        is_admin_or_super = operator.role in [Role.SUPER_ADMIN, Role.ADMIN]
        is_pm = operator.is_purchase_manager or pr.purchase_manager_id == operator.id
        is_requester = pr.requested_by_id == operator.id
        is_team_leader_manager = (
            operator.role == Role.TEAM_LEADER
            and pr.requested_by.role == Role.STAFF
            and (
                (pr.requested_by.department and operator.department == pr.requested_by.department)
                or operator.id == pr.requested_by.reports_to_id
            )
        )
        is_incharge_manager = (
            operator.role == Role.IN_CHARGE
            and pr.requested_by.role == Role.STAFF
            and (
                (operator.id == pr.purchase_manager_id)
                or (operator.id == pr.requested_by.reports_to_id)
                or (pr.requested_by.manager and pr.requested_by.manager.reports_to_id == operator.id)
                or (pr.purchase_manager and pr.purchase_manager.reports_to_id == operator.id)
                or (
                    (not operator.department or operator.department == pr.requested_by.department)
                    and (not operator.branch or operator.branch == pr.requested_by.branch)
                )
            )
        )

        if not (is_admin_or_super or is_pm or is_requester or is_team_leader_manager or is_incharge_manager):
            raise HierarchyPermissionError(
                "You are not authorized to view the history for this purchase request."
            )

        stmt = (
            select(PurchaseRequestHistory)
            .where(PurchaseRequestHistory.purchase_request_id == request_id)
            .options(selectinload(PurchaseRequestHistory.changed_by))
            .order_by(desc(PurchaseRequestHistory.created_at))
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def update_purchase_request(
        session: AsyncSession,
        operator: User,
        request_id: uuid.UUID,
        req_in: PurchaseRequestUpdate,
    ) -> PurchaseRequest:
        pr = await PurchaseService.get_by_id(session, request_id)
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found",
            )

        is_elevated = operator.role in [Role.SUPER_ADMIN, Role.ADMIN] or operator.is_purchase_manager
        is_requester = pr.requested_by_id == operator.id
        if not is_elevated and not (is_requester and pr.status == PurchaseRequestStatus.OPEN):
            raise HierarchyPermissionError(
                "You do not have permission to edit this purchase request."
            )

        if req_in.name is not None:
            pr.name = req_in.name.strip()
        if req_in.rate is not None:
            pr.rate = req_in.rate
        if req_in.category is not None:
            pr.category = req_in.category.strip() if req_in.category else ""
        if req_in.brand is not None:
            pr.brand = req_in.brand.strip() if req_in.brand else ""
        if req_in.vendor is not None:
            pr.vendor = req_in.vendor.strip()
        if req_in.quantity is not None:
            pr.quantity = req_in.quantity
        if req_in.notes is not None:
            pr.notes = req_in.notes

        await session.commit()
        updated_pr = await PurchaseService.get_by_id(session, pr.id)
        broadcaster.broadcast_sync({
            "type": "PURCHASE_UPDATED",
            "data": {
                "purchase_id": str(pr.id),
                "status": pr.status.value if hasattr(pr.status, "value") else pr.status,
                "requested_by_id": str(pr.requested_by_id),
                "purchase_manager_id": str(pr.purchase_manager_id) if pr.purchase_manager_id else None,
            },
        })
        return updated_pr

    @staticmethod
    async def delete_purchase_request(
        session: AsyncSession,
        operator: User,
        request_id: uuid.UUID,
    ) -> None:
        pr = await PurchaseService.get_by_id(session, request_id)
        if not pr:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase request not found",
            )

        is_elevated = operator.role in [Role.SUPER_ADMIN, Role.ADMIN] or operator.is_purchase_manager
        is_requester = pr.requested_by_id == operator.id
        if not is_elevated and not (is_requester and pr.status == PurchaseRequestStatus.OPEN):
            raise HierarchyPermissionError(
                "You do not have permission to delete this purchase request."
            )

        # Delete history records first
        stmt = select(PurchaseRequestHistory).where(PurchaseRequestHistory.purchase_request_id == request_id)
        histories = (await session.execute(stmt)).scalars().all()
        for h in histories:
            await session.delete(h)

        await session.delete(pr)
        await session.commit()
        broadcaster.broadcast_sync({
            "type": "PURCHASE_DELETED",
            "data": {
                "purchase_id": str(request_id),
                "requested_by_id": str(pr.requested_by_id),
            },
        })


