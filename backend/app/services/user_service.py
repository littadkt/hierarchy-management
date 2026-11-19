from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.core.permissions import (
    HierarchyPermissionError,
    validate_can_create_user,
    validate_can_delete_user,
    validate_can_edit_user,
)
from app.core.security import get_password_hash
from app.models.attendance import Attendance, AttendanceStatus
from app.models.schedule import TimeSchedule
from app.models.task import Task, TaskStatus
from app.models.user import Role, User, UserLoginRecord
from app.schemas.user import UserCreate, UserLeaveUpdate, UserTaskStats, UserUpdate, UserWithStats


class UserService:
    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.manager),
                selectinload(User.creator),
                selectinload(User.schedule),
            )
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
        session_id: Optional[str] = None,
    ) -> User:
        """
        Records a user login event:
        - Generates and saves a new active_session_id to enforce single active session.
        - Updates last_login_at to now.
        - Saves an audit record in user_login_records.
        - Broadcasts realtime USER_SESSION_SUPERSEDED and USER_LOGIN events.
        - Note: Does NOT automatically check in the user. Check-in is manual via AttendanceService.
        """
        now = datetime.now(timezone.utc)
        if not session_id:
            session_id = uuid.uuid4().hex

        user.active_session_id = session_id
        user.last_login_at = now

        # Add audit record
        login_log = UserLoginRecord(
            user_id=user.id,
            login_at=now,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(login_log)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Notify other connected clients/tabs that this user logged in elsewhere
        await broadcaster.broadcast({
            "type": "USER_SESSION_SUPERSEDED",
            "data": {
                "user_id": str(user.id),
                "active_session_id": session_id,
            },
        })

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

        schedule_id = user_in.schedule_id
        check_in_time = (
            user_in.check_in_time.strip()
            if user_in.check_in_time and user_in.check_in_time.strip()
            else None
        )
        check_out_time = (
            user_in.check_out_time.strip()
            if user_in.check_out_time and user_in.check_out_time.strip()
            else None
        )
        selected_schedule = None
        if schedule_id:
            selected_schedule = await session.get(TimeSchedule, schedule_id)
            if selected_schedule:
                if not check_in_time:
                    check_in_time = selected_schedule.check_in_time
                if not check_out_time:
                    check_out_time = selected_schedule.check_out_time

        user = User(
            email=user_in.email,
            full_name=user_in.full_name,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role,
            is_active=True,
            can_place_wholesale_orders=can_place_wholesale_orders,
            branch=branch,
            department=department,
            schedule_id=selected_schedule.id if selected_schedule else schedule_id,
            schedule=selected_schedule,
            check_in_time=check_in_time,
            check_out_time=check_out_time,
            reports_to_id=reports_to_id,
            created_by_id=creator.id,
        )
        session.add(user)
        await session.commit()
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

        if "schedule_id" in user_in.model_fields_set:
            if user_in.schedule_id is not None:
                new_schedule = await session.get(TimeSchedule, user_in.schedule_id)
                if not new_schedule:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Selected time schedule does not exist.",
                    )
                target.schedule = new_schedule
                target.schedule_id = new_schedule.id
                if "check_in_time" not in user_in.model_fields_set or not user_in.check_in_time:
                    target.check_in_time = new_schedule.check_in_time
                if "check_out_time" not in user_in.model_fields_set or not user_in.check_out_time:
                    target.check_out_time = new_schedule.check_out_time
            else:
                target.schedule = None
                target.schedule_id = None
                if "check_in_time" not in user_in.model_fields_set:
                    target.check_in_time = None
                if "check_out_time" not in user_in.model_fields_set:
                    target.check_out_time = None

        if "check_in_time" in user_in.model_fields_set and user_in.check_in_time is not None:
            target.check_in_time = user_in.check_in_time.strip() if user_in.check_in_time.strip() else None

        if "check_out_time" in user_in.model_fields_set and user_in.check_out_time is not None:
            target.check_out_time = user_in.check_out_time.strip() if user_in.check_out_time.strip() else None

        if user_in.is_on_leave is not None and operator.role in [Role.SUPER_ADMIN, Role.ADMIN]:
            target.is_on_leave = user_in.is_on_leave
            if user_in.is_on_leave:
                target.leave_date = user_in.leave_date or datetime.now().astimezone().strftime("%Y-%m-%d")
                target.leave_reason = user_in.leave_reason or "Marked on leave"
                await UserService.cleanup_pending_recurring_tasks_on_leave(session, target.id, target.leave_date)
            else:
                target.leave_date = None
                target.leave_reason = None
                try:
                    from app.services.task_service import TaskService
                    await TaskService.spawn_due_recurring_tasks(session)
                except Exception:
                    pass

        if user_in.permissions is not None and operator.role in [Role.SUPER_ADMIN, Role.ADMIN]:
            target.permissions = user_in.permissions

        await session.commit()
        return target

    @staticmethod
    async def cleanup_pending_recurring_tasks_on_leave(
        session: AsyncSession,
        user_id: uuid.UUID,
        leave_date_str: str,
    ) -> int:
        """
        Removes any auto-spawned child recurring tasks assigned to user that are still PENDING
        and scheduled on the leave date. Also advances any unstarted root recurring template.
        """
        try:
            leave_dt = datetime.strptime(leave_date_str.strip(), "%Y-%m-%d").date()
            local_now = datetime.now().astimezone()
            tz = local_now.tzinfo
            start_of_day = datetime(leave_dt.year, leave_dt.month, leave_dt.day, 0, 0, 0, tzinfo=tz)
            end_of_day = datetime(leave_dt.year, leave_dt.month, leave_dt.day, 23, 59, 59, 999999, tzinfo=tz)

            # 1. Delete child recurring instances assigned to user on leave date
            stmt = (
                select(Task)
                .where(
                    Task.assigned_to_id == user_id,
                    Task.is_recurring == True,
                    Task.parent_task_id != None,
                    Task.status == TaskStatus.PENDING,
                    Task.due_date >= start_of_day,
                    Task.due_date <= end_of_day,
                )
            )
            res = await session.execute(stmt)
            tasks_to_delete = res.scalars().all()
            for t in tasks_to_delete:
                await session.delete(t)

            # 2. Advance any root recurring templates assigned to user due on leave date with no children
            root_stmt = (
                select(Task)
                .where(
                    Task.assigned_to_id == user_id,
                    Task.is_recurring == True,
                    Task.parent_task_id == None,
                    Task.status == TaskStatus.PENDING,
                    Task.due_date >= start_of_day,
                    Task.due_date <= end_of_day,
                )
                .options(selectinload(Task.child_instances))
            )
            root_res = await session.execute(root_stmt)
            for root_task in root_res.scalars().all():
                if not root_task.child_instances:
                    from app.services.recurrence_service import calculate_next_run_date, parse_days_of_week
                    allowed = parse_days_of_week(root_task.recurrence_days_of_week)
                    next_cand = calculate_next_run_date(
                        pattern=root_task.recurrence_pattern,
                        interval=root_task.recurrence_interval,
                        base_date=root_task.due_date,
                        day_of_week=root_task.recurrence_day_of_week,
                        day_of_month=root_task.recurrence_day_of_month,
                        days_of_week=allowed or root_task.recurrence_days_of_week,
                    )
                    if next_cand:
                        root_task.due_date = next_cand

            return len(tasks_to_delete)
        except Exception:
            return 0

    @staticmethod
    async def set_user_leave(
        session: AsyncSession,
        operator: User,
        user_id: uuid.UUID,
        payload: UserLeaveUpdate,
    ) -> User:
        """
        Mark or unmark a user as on leave.
        Provision restricted to Admins and Super Admins.
        """
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
            raise HierarchyPermissionError("Only Admins and Super Admins have provision to mark users on leave.")

        target = await UserService.get_by_id(session, user_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Cannot mark self on leave
        if operator.id == target.id:
            raise HierarchyPermissionError("You cannot mark yourself on leave. This provision is for managing users under you.")

        # Admin cannot mark Super Admin or other Admins on leave (only users under them: In-Charge, Team Leader, Staff)
        if operator.role == Role.ADMIN:
            if target.role in [Role.SUPER_ADMIN, Role.ADMIN]:
                raise HierarchyPermissionError("Admins can only mark users under them in the hierarchy (In-Charge, Team Leader, Staff) on leave.")
            if operator.branch and target.branch and target.branch.strip().lower() != operator.branch.strip().lower():
                raise HierarchyPermissionError(f"Admins can only manage leave for users under their branch ('{operator.branch}').")

        local_now = datetime.now().astimezone()
        today_str = local_now.strftime("%Y-%m-%d")

        target.is_on_leave = payload.is_on_leave
        if payload.is_on_leave:
            target.leave_date = payload.leave_date or today_str
            target.leave_reason = payload.leave_reason or "Marked on leave"
        else:
            target.leave_date = None
            target.leave_reason = None

        # Synchronize with Attendance records
        target_date = target.leave_date or today_str
        att_stmt = select(Attendance).where(
            Attendance.user_id == target.id,
            Attendance.date == target_date,
        )
        att = (await session.execute(att_stmt)).scalar_one_or_none()

        if payload.is_on_leave:
            if not att:
                att = Attendance(
                    user_id=target.id,
                    date=target_date,
                    check_in_time=datetime.now(timezone.utc),
                    status=AttendanceStatus.ON_LEAVE,
                    check_in_note=f"[ON LEAVE] {target.leave_reason}",
                )
                session.add(att)
            else:
                att.status = AttendanceStatus.ON_LEAVE
                att.check_in_note = f"[ON LEAVE] {target.leave_reason}"

            # Clean up any recurring tasks scheduled on leave date
            await UserService.cleanup_pending_recurring_tasks_on_leave(session, target.id, target_date)
        else:
            if att and att.status == AttendanceStatus.ON_LEAVE:
                await session.delete(att)

        await session.commit()
        await session.refresh(target)

        if not payload.is_on_leave:
            try:
                from app.services.task_service import TaskService
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        await broadcaster.broadcast("USER_LEAVE_UPDATED", {
            "user_id": str(target.id),
            "is_on_leave": target.is_on_leave,
            "leave_date": target.leave_date,
            "leave_reason": target.leave_reason,
        })
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

            # Identify team leaders under In-Charge (direct reports or within department/branch)
            tl_ids = set()
            for u in all_active:
                if u.role == Role.TEAM_LEADER:
                    if u.reports_to_id == current_user.id:
                        tl_ids.add(u.id)
                    elif ic_dept and (u.department or "").strip().lower() == ic_dept:
                        if not ic_branch or not u.branch or (u.branch or "").strip().lower() == ic_branch:
                            tl_ids.add(u.id)

            allowed = []
            for u in all_active:
                if u.id == current_user.id:
                    allowed.append(u)
                    continue
                if u.role in [Role.TEAM_LEADER, Role.STAFF]:
                    u_dept = (u.department or "").strip().lower()
                    u_branch = (u.branch or "").strip().lower()
                    is_direct = (u.reports_to_id == current_user.id)
                    is_under_tl = (u.reports_to_id in tl_ids)
                    dept_match = (u_dept == ic_dept) if (ic_dept and u_dept) else (not ic_dept)
                    branch_match = (u_branch == ic_branch) if (ic_branch and u_branch) else True
                    if is_direct or is_under_tl or (dept_match and branch_match):
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
            .options(
                selectinload(User.manager),
                selectinload(User.creator),
                selectinload(User.schedule),
            )
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

            tl_conds = [User.role == Role.TEAM_LEADER]
            if ic_dept:
                dept_or_direct = (func.lower(func.trim(User.department)) == ic_dept.lower()) | (User.reports_to_id == current_user.id)
                if ic_branch:
                    tl_conds.append(
                        dept_or_direct & (
                            (User.branch == None)
                            | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                            | (User.reports_to_id == current_user.id)
                        )
                    )
                else:
                    tl_conds.append(dept_or_direct)
            else:
                tl_conds.append(User.reports_to_id == current_user.id)

            tl_subquery = select(User.id).where(and_(*tl_conds))

            dept_branch_match = (
                (func.lower(func.trim(User.department)) == ic_dept.lower())
                & (
                    (User.branch == None)
                    | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                )
            ) if ic_dept and ic_branch else (
                (func.lower(func.trim(User.department)) == ic_dept.lower()) if ic_dept else False
            )

            scoped_conds = [
                User.role.in_([Role.TEAM_LEADER, Role.STAFF]),
                or_(
                    User.reports_to_id == current_user.id,
                    User.reports_to_id.in_(tl_subquery),
                    dept_branch_match,
                ),
            ]
            sub_filter = and_(*scoped_conds)
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
                .options(
                    selectinload(User.manager),
                    selectinload(User.creator),
                    selectinload(User.schedule),
                )
                .order_by(User.role, User.full_name)
            )
        elif current_user.role == Role.ADMIN:
            stmt = (
                select(User)
                .where(
                    (User.role.in_([Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]))
                    | (User.id == current_user.id)
                )
                .options(
                    selectinload(User.manager),
                    selectinload(User.creator),
                    selectinload(User.schedule),
                )
                .order_by(User.role, User.full_name)
            )
        elif current_user.role == Role.IN_CHARGE:
            ic_dept = (current_user.department or (current_user.manager.department if current_user.manager else "") or "").strip()
            ic_branch = (current_user.branch or (current_user.manager.branch if current_user.manager else "") or "").strip()

            # In-Charge provision: can see Team Leaders under them AND the staff level users under those Team Leaders
            tl_conds = [User.role == Role.TEAM_LEADER]
            if ic_dept:
                dept_or_direct = (func.lower(func.trim(User.department)) == ic_dept.lower()) | (User.reports_to_id == current_user.id)
                if ic_branch:
                    tl_conds.append(
                        dept_or_direct & (
                            (User.branch == None)
                            | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                            | (User.reports_to_id == current_user.id)
                        )
                    )
                else:
                    tl_conds.append(dept_or_direct)
            else:
                tl_conds.append(User.reports_to_id == current_user.id)

            tl_subquery = select(User.id).where(and_(*tl_conds))

            dept_branch_match = (
                (func.lower(func.trim(User.department)) == ic_dept.lower())
                & (
                    (User.branch == None)
                    | (func.lower(func.trim(User.branch)) == ic_branch.lower())
                )
            ) if ic_dept and ic_branch else (
                (func.lower(func.trim(User.department)) == ic_dept.lower()) if ic_dept else False
            )

            scoped_conds = [
                User.role.in_([Role.TEAM_LEADER, Role.STAFF]),
                or_(
                    User.reports_to_id == current_user.id,
                    User.reports_to_id.in_(tl_subquery),
                    dept_branch_match,
                ),
            ]
            sub_filter = and_(*scoped_conds)
            stmt = (
                select(User)
                .where(sub_filter | (User.id == current_user.id))
                .options(
                    selectinload(User.manager),
                    selectinload(User.creator),
                    selectinload(User.schedule),
                )
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
                .options(
                    selectinload(User.manager),
                    selectinload(User.creator),
                    selectinload(User.schedule),
                )
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
                    schedule_id=u.schedule_id,
                    check_in_time=u.check_in_time,
                    check_out_time=u.check_out_time,
                    schedule_name=u.schedule_name,
                    reports_to_id=u.reports_to_id,
                    created_by_id=u.created_by_id,
                    created_at=u.created_at,
                    updated_at=u.updated_at,
                    last_login_at=last_login,
                    today_first_login_at=today_login,
                    is_on_leave=u.is_on_leave,
                    leave_date=u.leave_date,
                    leave_reason=u.leave_reason,
                    task_stats=user_stats_map[u.id],
                    manager_name=u.manager.full_name if u.manager else None,
                    creator_name=u.creator.full_name if u.creator else None,
                )
            )

        return response

