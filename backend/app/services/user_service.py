from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.core.permissions import (
    validate_can_create_user,
    validate_can_delete_user,
    validate_can_edit_user,
)
from app.core.security import get_password_hash
from app.models.task import Task, TaskStatus
from app.models.user import Role, User, UserLoginRecord
from app.schemas.user import UserCreate, UserTaskStats, UserUpdate, UserWithStats


class UserService:
    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.manager), selectinload(User.creator))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def get_effective_today_first_login(u: User) -> Optional[datetime]:
        """Returns today's first login datetime if it occurred today, else None."""
        if not u.today_first_login_at:
            return None
        now = datetime.now(timezone.utc)
        today_str = now.astimezone().strftime("%Y-%m-%d")
        today_utc_str = now.strftime("%Y-%m-%d")
        if u.today_first_login_date in (today_str, today_utc_str):
            return u.today_first_login_at
        try:
            if u.today_first_login_at.astimezone().strftime("%Y-%m-%d") == today_str:
                return u.today_first_login_at
            if u.today_first_login_at.strftime("%Y-%m-%d") == today_utc_str:
                return u.today_first_login_at
        except Exception:
            pass
        return None

    @staticmethod
    async def record_login(
        session: AsyncSession,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        """
        Records a user login event:
        - Updates last_login_at to now.
        - Sets today_first_login_at to now if this is the user's first login today.
        - Saves an audit record in user_login_records.
        - Broadcasts a realtime USER_LOGIN event.
        """
        now = datetime.now(timezone.utc)
        today_str = now.astimezone().strftime("%Y-%m-%d")

        user.last_login_at = now
        if not user.today_first_login_date or user.today_first_login_date != today_str or user.today_first_login_at is None:
            user.today_first_login_at = now
            user.today_first_login_date = today_str

        # Add audit record
        login_log = UserLoginRecord(
            user_id=user.id,
            login_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(login_log)
        await session.commit()
        await session.refresh(user)

        await broadcaster.broadcast({
            "type": "USER_LOGIN",
            "data": {
                "user_id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "branch": user.branch,
                "department": user.department,
                "today_first_login_at": user.today_first_login_at.isoformat() if user.today_first_login_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            },
        })
        return user

    @staticmethod
    async def create_user(
        session: AsyncSession,
        creator: User,
        user_in: UserCreate,
    ) -> User:
        # Check permission to create target role
        validate_can_create_user(creator.role, user_in.role)

        # Check existing email
        existing = await UserService.get_by_email(session, user_in.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{user_in.email}' already exists.",
            )

        # Reports-to & wholesale permission logic:
        # Super Admin is at the top of the hierarchy (Level 1) and does not report to anyone by default
        if user_in.role == Role.SUPER_ADMIN:
            reports_to_id = user_in.reports_to_id  # None by default unless explicitly provided
            can_place_wholesale_orders = True
        else:
            reports_to_id = user_in.reports_to_id or creator.id
            can_place_wholesale_orders = False

        # Branch and department inheritance / assignment:
        branch = (
            user_in.branch.strip()
            if user_in.branch and user_in.branch.strip()
            else (creator.branch if creator.branch else None)
        )
        department = (
            user_in.department.strip()
            if user_in.department and user_in.department.strip()
            else (creator.department if creator.department else None)
        )

        user = User(
            email=user_in.email,
            full_name=user_in.full_name,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role,
            is_active=True,
            can_place_wholesale_orders=can_place_wholesale_orders,
            branch=branch,
            department=department,
            reports_to_id=reports_to_id,
            created_by_id=creator.id,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    @staticmethod
    async def update_user(
        session: AsyncSession,
        operator: User,
        user_id: uuid.UUID,
        user_in: UserUpdate,
    ) -> User:
        target = await UserService.get_by_id(session, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        validate_can_edit_user(operator, target)

        if user_in.email is not None and user_in.email != target.email:
            existing = await UserService.get_by_email(session, user_in.email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with email '{user_in.email}' already exists.",
                )
            target.email = user_in.email

        if user_in.full_name is not None:
            target.full_name = user_in.full_name

        if user_in.password is not None:
            target.hashed_password = get_password_hash(user_in.password)

        if user_in.is_active is not None and operator.role == Role.SUPER_ADMIN:
            target.is_active = user_in.is_active

        if user_in.role is not None and operator.role == Role.SUPER_ADMIN:
            target.role = user_in.role

        if user_in.can_place_wholesale_orders is not None and operator.role == Role.SUPER_ADMIN:
            target.can_place_wholesale_orders = user_in.can_place_wholesale_orders

        if user_in.reports_to_id is not None and operator.role == Role.SUPER_ADMIN:
            target.reports_to_id = user_in.reports_to_id

        if user_in.branch is not None:
            target.branch = user_in.branch.strip() if user_in.branch and user_in.branch.strip() else None

        if user_in.department is not None:
            target.department = user_in.department.strip() if user_in.department and user_in.department.strip() else None

        await session.commit()
        await session.refresh(target)
        return target

    @staticmethod
    async def delete_user(
        session: AsyncSession,
        operator: User,
        user_id: uuid.UUID,
    ) -> None:
        target = await UserService.get_by_id(session, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        validate_can_delete_user(operator, target)

        await session.delete(target)
        await session.commit()

    @staticmethod
    async def get_eligible_approvers(
        session: AsyncSession,
        for_user_id: uuid.UUID,
    ) -> List[User]:
        """
        Returns active users whose role level is strictly higher than the target user's role level,
        scoped by branch and department:
        - Staff requesting approval:
          - Team Leaders and In-Charges: must belong to staff's department.
          - Admins: must belong to staff's branch.
          - Super Admins: oversee all (level 1).
        - Team Leader requesting approval:
          - In-Charges: must belong to team leader's department.
          - Admins: must belong to team leader's branch.
          - Super Admins: oversee all.
        - In-Charge requesting approval:
          - Admins: must belong to in-charge's branch.
          - Super Admins: oversee all.
        - Admin requesting approval:
          - Super Admins: oversee all.
        """
        target_user = await UserService.get_by_id(session, for_user_id)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee user not found",
            )

        # Resolve effective branch and department (with manager fallback if not set directly)
        target_branch = (target_user.branch or "").strip()
        target_dept = (target_user.department or "").strip()

        if not target_branch and target_user.manager:
            target_branch = (target_user.manager.branch or "").strip()
        if not target_dept and target_user.manager:
            target_dept = (target_user.manager.department or "").strip()

        target_level = target_user.role.level
        stmt = select(User).where(User.is_active == True)
        result = await session.execute(stmt)
        all_users = result.scalars().all()

        eligible: List[User] = []
        for u in all_users:
            if u.id == target_user.id:
                continue
            if u.role.level >= target_level:
                continue

            # Super Admin is always eligible
            if u.role == Role.SUPER_ADMIN:
                eligible.append(u)
                continue

            u_branch = (u.branch or "").strip()
            u_dept = (u.department or "").strip()

            if u.role == Role.ADMIN:
                # Admin must belong to user's branch
                if target_branch and u_branch:
                    if u_branch.lower() == target_branch.lower():
                        eligible.append(u)
                elif not target_branch:
                    # Fallback if target user has no branch set
                    eligible.append(u)

            elif u.role == Role.IN_CHARGE:
                # In-Charge can approve for Team Leader (level 4) and Staff (level 5)
                # Eligible if in same branch & same department, or direct/indirect reporting line
                is_direct_mgr = (u.id == target_user.reports_to_id)
                is_indirect_mgr = bool(target_user.manager and target_user.manager.reports_to_id == u.id)
                dept_match = (u_dept.lower() == target_dept.lower()) if (target_dept and u_dept) else True
                branch_match = (u_branch.lower() == target_branch.lower()) if (target_branch and u_branch) else True

                if is_direct_mgr or is_indirect_mgr or (dept_match and branch_match):
                    eligible.append(u)

            elif u.role == Role.TEAM_LEADER:
                # Team Leader can only approve for Staff (level 5)
                if target_level <= Role.TEAM_LEADER.level:
                    continue

                is_direct_mgr = (u.id == target_user.reports_to_id)
                dept_match = (u_dept.lower() == target_dept.lower()) if (target_dept and u_dept) else True
                branch_match = (u_branch.lower() == target_branch.lower()) if (target_branch and u_branch) else True

                if is_direct_mgr or (dept_match and branch_match):
                    eligible.append(u)

        # Sort by hierarchy level (Super Admin 1 < Admin 2 < In-charge 3 < Team Leader 4) and full name
        eligible.sort(key=lambda u: (u.role.level, u.full_name))
        return eligible

    @staticmethod
    async def get_assignable_users(
        session: AsyncSession,
        current_user: User,
    ) -> List[User]:
        """
        Returns all users that current_user is authorized to assign tasks to:
        - Super Admin: All users
        - Admin: In-charge, Team Leader, Staff, and self
        - In-charge: Team Leader, Staff, and self
        - Team Leader: Staff, and self
        - Staff: Self only
        """
        stmt = select(User).where(User.is_active == True)
        result = await session.execute(stmt)
        all_active = result.scalars().all()

        if current_user.role == Role.SUPER_ADMIN:
            return sorted(all_active, key=lambda u: (u.role.level, u.full_name))

        if current_user.role == Role.ADMIN:
            allowed = [
                u
                for u in all_active
                if u.role in [Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]
                or u.id == current_user.id
            ]
            return sorted(allowed, key=lambda u: (u.role.level, u.full_name))

        if current_user.role == Role.IN_CHARGE:
            ic_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip().lower()
            ic_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip().lower()
            allowed = []
            for u in all_active:
                if u.id == current_user.id:
                    allowed.append(u)
                    continue
                if u.role in [Role.TEAM_LEADER, Role.STAFF]:
                    u_dept = (u.department or "").strip().lower()
                    u_branch = (u.branch or "").strip().lower()
                    is_direct = (u.reports_to_id == current_user.id)
                    dept_match = (u_dept == ic_dept) if (ic_dept and u_dept) else (not ic_dept)
                    branch_match = (u_branch == ic_branch) if (ic_branch and u_branch) else True
                    if is_direct or (dept_match and branch_match):
                        allowed.append(u)
            return sorted(allowed, key=lambda u: (u.role.level, u.full_name))

        if current_user.role == Role.TEAM_LEADER:
            tl_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip().lower()
            tl_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip().lower()
            allowed = []
            for u in all_active:
                if u.id == current_user.id:
                    allowed.append(u)
                    continue
                if u.role == Role.STAFF:
                    u_dept = (u.department or "").strip().lower()
                    u_branch = (u.branch or "").strip().lower()
                    is_direct = (u.reports_to_id == current_user.id)
                    dept_match = (u_dept == tl_dept) if (tl_dept and u_dept) else (not tl_dept)
                    branch_match = (u_branch == tl_branch) if (tl_branch and u_branch) else True
                    if is_direct or (dept_match and branch_match):
                        allowed.append(u)
            return sorted(allowed, key=lambda u: (u.role.level, u.full_name))

        # Staff can only assign to self
        return [current_user]

    @staticmethod
    async def get_manageable_users(
        session: AsyncSession,
        current_user: User,
    ) -> List[User]:
        """
        Returns accessible users for user management (Users page):
        - Super Admin: All users (active and inactive)
        - Admin: All users except Super Admin (plus self)
        - In-Charge: Team Leaders, Staff under department, and self
        - Team Leader: Staff under their department, and self
        - Staff: Self
        """
        stmt = (
            select(User)
            .options(selectinload(User.manager), selectinload(User.creator))
            .order_by(User.role, User.full_name)
        )
        if current_user.role == Role.SUPER_ADMIN:
            res = await session.execute(stmt)
            return list(res.scalars().all())

        if current_user.role == Role.ADMIN:
            stmt = stmt.where((User.role != Role.SUPER_ADMIN) | (User.id == current_user.id))
            res = await session.execute(stmt)
            return list(res.scalars().all())

        if current_user.role == Role.IN_CHARGE:
            ic_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip()
            ic_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip()
            sub_filter = User.role.in_([Role.TEAM_LEADER, Role.STAFF])
            if ic_dept:
                sub_filter = sub_filter & (
                    (func.lower(func.trim(User.department)) == ic_dept.lower())
                    | (User.reports_to_id == current_user.id)
                )
                if ic_branch:
                    sub_filter = sub_filter & (
                        (User.branch == None)
                        | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                        | (User.reports_to_id == current_user.id)
                    )
            else:
                sub_filter = sub_filter & (User.reports_to_id == current_user.id)
            stmt = stmt.where(sub_filter | (User.id == current_user.id))
            res = await session.execute(stmt)
            return list(res.scalars().all())

        if current_user.role == Role.TEAM_LEADER:
            tl_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip()
            tl_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip()
            staff_filter = (User.role == Role.STAFF)
            if tl_dept:
                staff_filter = staff_filter & (
                    (func.lower(func.trim(User.department)) == tl_dept.lower())
                    | (User.reports_to_id == current_user.id)
                )
                if tl_branch:
                    staff_filter = staff_filter & (
                        (User.branch == None)
                        | (func.lower(func.trim(User.branch)) == tl_branch.lower())
                        | (User.reports_to_id == current_user.id)
                    )
            else:
                staff_filter = staff_filter & (User.reports_to_id == current_user.id)
            stmt = stmt.where(staff_filter | (User.id == current_user.id))
            res = await session.execute(stmt)
            return list(res.scalars().all())

        stmt = stmt.where(User.id == current_user.id)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_hierarchy_users_with_task_stats(
        session: AsyncSession,
        current_user: User,
    ) -> List[UserWithStats]:
        """
        Returns users with their task details and aggregated status counts.
        - Super Admin: "View all admins, in-charge team leaders and staff with their task details"
        - Admin / In-charge / Team Leader: Subordinates in hierarchy scope plus self
        - Staff: Self only
        """
        # Determine accessible users
        if current_user.role == Role.SUPER_ADMIN:
            stmt = (
                select(User)
                .options(selectinload(User.manager), selectinload(User.creator))
                .order_by(User.role, User.full_name)
            )
        elif current_user.role == Role.ADMIN:
            stmt = (
                select(User)
                .where(
                    (User.role.in_([Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]))
                    | (User.id == current_user.id)
                )
                .options(selectinload(User.manager), selectinload(User.creator))
                .order_by(User.role, User.full_name)
            )
        elif current_user.role == Role.IN_CHARGE:
            ic_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip()
            ic_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip()
            sub_filter = User.role.in_([Role.TEAM_LEADER, Role.STAFF])
            if ic_dept:
                sub_filter = sub_filter & (
                    (func.lower(func.trim(User.department)) == ic_dept.lower())
                    | (User.reports_to_id == current_user.id)
                )
                if ic_branch:
                    sub_filter = sub_filter & (
                        (User.branch == None)
                        | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                        | (User.reports_to_id == current_user.id)
                    )
            else:
                sub_filter = sub_filter & (User.reports_to_id == current_user.id)
            stmt = (
                select(User)
                .where(sub_filter | (User.id == current_user.id))
                .options(selectinload(User.manager), selectinload(User.creator))
                .order_by(User.role, User.full_name)
            )
        elif current_user.role == Role.TEAM_LEADER:
            tl_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip()
            tl_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip()
            staff_filter = (User.role == Role.STAFF)
            if tl_dept:
                staff_filter = staff_filter & (
                    (func.lower(func.trim(User.department)) == tl_dept.lower())
                    | (User.reports_to_id == current_user.id)
                )
                if tl_branch:
                    staff_filter = staff_filter & (
                        (User.branch == None)
                        | (func.lower(func.trim(User.branch)) == tl_branch.lower())
                        | (User.reports_to_id == current_user.id)
                    )
            else:
                staff_filter = staff_filter & (User.reports_to_id == current_user.id)
            stmt = (
                select(User)
                .where(staff_filter | (User.id == current_user.id))
                .options(selectinload(User.manager), selectinload(User.creator))
                .order_by(User.role, User.full_name)
            )
        else:
            stmt = (
                select(User)
                .where(User.id == current_user.id)
                .options(selectinload(User.manager), selectinload(User.creator))
            )

        users_result = await session.execute(stmt)
        users = users_result.scalars().all()

        user_ids = [u.id for u in users]
        if not user_ids:
            return []

        # Aggregate task stats per user
        stats_stmt = (
            select(
                Task.assigned_to_id,
                Task.status,
                func.count(Task.id),
            )
            .where(Task.assigned_to_id.in_(user_ids))
            .group_by(Task.assigned_to_id, Task.status)
        )
        stats_result = await session.execute(stats_stmt)
        stats_data = stats_result.all()

        # Map counts per user
        user_stats_map = {uid: UserTaskStats() for uid in user_ids}
        for uid, task_status, count in stats_data:
            stats_obj = user_stats_map[uid]
            stats_obj.total_assigned += count
            if task_status == TaskStatus.PENDING:
                stats_obj.pending += count
            elif task_status == TaskStatus.IN_PROGRESS:
                stats_obj.in_progress += count
            elif task_status == TaskStatus.PENDING_APPROVAL:
                stats_obj.pending_approval += count
            elif task_status == TaskStatus.COMPLETED:
                stats_obj.completed += count
            elif task_status == TaskStatus.CANCELLED:
                stats_obj.cancelled += count

        can_see_login = current_user.role in [Role.SUPER_ADMIN, Role.ADMIN]
        response: List[UserWithStats] = []
        for u in users:
            is_self = u.id == current_user.id
            today_login = (
                UserService.get_effective_today_first_login(u)
                if (can_see_login or is_self)
                else None
            )
            last_login = u.last_login_at if (can_see_login or is_self) else None

            response.append(
                UserWithStats(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=u.role,
                    is_active=u.is_active,
                    branch=u.branch,
                    department=u.department,
                    reports_to_id=u.reports_to_id,
                    created_by_id=u.created_by_id,
                    created_at=u.created_at,
                    updated_at=u.updated_at,
                    last_login_at=last_login,
                    today_first_login_at=today_login,
                    task_stats=user_stats_map[u.id],
                    manager_name=u.manager.full_name if u.manager else None,
                    creator_name=u.creator.full_name if u.creator else None,
                )
            )

        return response

