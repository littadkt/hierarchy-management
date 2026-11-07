from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import (
    HierarchyPermissionError,
    is_eligible_approver,
    validate_approver_scope,
    validate_can_assign_task,
    validate_can_edit_or_delete_task,
    validate_status_transition,
)
from app.models.task import RecurrencePattern, Task, TaskPriority, TaskStatus
from app.models.task_activity import ActivityAction, TaskActivity
from app.models.task_comment import TaskComment
from app.models.subtask import Subtask
from app.models.user import Role, User
from app.schemas.approval import ApprovalAction, ApprovalDecision, SubmitForApproval
from app.schemas.task import TaskCreate, TaskStatusUpdate, TaskUpdate
from app.services.recurrence_service import calculate_next_run_date, parse_days_of_week, should_spawn_recurrence
from app.services.user_service import UserService
from app.core.broadcaster import broadcaster


class TaskService:
    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        task_id: uuid.UUID,
        current_user: Optional[User] = None,
    ) -> Optional[Task]:
        stmt = (
            select(Task)
            .where(Task.id == task_id)
            .options(
                selectinload(Task.created_by),
                selectinload(Task.assigned_to),
                selectinload(Task.approver),
                selectinload(Task.activities).selectinload(TaskActivity.user),
                selectinload(Task.comments).selectinload(TaskComment.user),
                selectinload(Task.subtasks).selectinload(Subtask.assigned_to),
                selectinload(Task.subtasks).selectinload(Subtask.created_by),
            )
        )
        result = await session.execute(stmt)
        task = result.scalar_one_or_none()

        if task and current_user:
            TaskService.check_can_view_task(current_user, task)

        return task

    @staticmethod
    def check_can_view_task(current_user: User, task: Task) -> None:
        """
        Visibility checks:
        - Super Admin: all tasks
        - Admin: all tasks except perhaps strictly protected scope, but Admin has wide visibility
        - In-charge: Staff, Team Leader, and own tasks
        - Team Leader: Staff tasks and own tasks
        - Staff: tasks assigned to or created by self
        """
        if current_user.role == Role.SUPER_ADMIN:
            return

        if current_user.role == Role.ADMIN:
            # Super Admin tasks not visible unless assigned to Admin or created by Admin
            if task.created_by.role == Role.SUPER_ADMIN and task.assigned_to_id != current_user.id:
                # Still Admin can view org tasks if subordinate
                pass
            return

        if current_user.role == Role.IN_CHARGE:
            if (
                task.assigned_to_id == current_user.id
                or task.created_by_id == current_user.id
                or task.approver_id == current_user.id
                or (task.assigned_to and task.assigned_to.role in [Role.TEAM_LEADER, Role.STAFF])
            ):
                return
            raise HierarchyPermissionError("You do not have permission to view this task.")

        if current_user.role == Role.TEAM_LEADER:
            if (
                task.assigned_to_id == current_user.id
                or task.created_by_id == current_user.id
                or task.approver_id == current_user.id
                or (task.assigned_to and task.assigned_to.role == Role.STAFF)
            ):
                return
            raise HierarchyPermissionError("You do not have permission to view this task.")

        if current_user.role == Role.STAFF:
            if task.assigned_to_id == current_user.id or task.created_by_id == current_user.id:
                return
            raise HierarchyPermissionError("Staff can only view tasks assigned to or created by them.")

    @staticmethod
    async def create_task(
        session: AsyncSession,
        creator: User,
        task_in: TaskCreate,
    ) -> Task:
        # 1. Fetch assignee
        assignee = await UserService.get_by_id(session, task_in.assigned_to_id)
        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found",
            )

        # 2. Check assignment permission
        validate_can_assign_task(creator, assignee)

        # 3. Check approval configuration
        approver = None
        if task_in.requires_approval:
            if not task_in.approver_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An approver must be designated when 'requires_approval' is enabled.",
                )
            approver = await UserService.get_by_id(session, task_in.approver_id)
            if not approver:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Designated approver not found",
                )
            if not is_eligible_approver(assignee.role, approver.role):
                raise HierarchyPermissionError(
                    f"Selected approver '{approver.full_name}' ({approver.role.value}) must be higher in "
                    f"the hierarchy than the assignee '{assignee.full_name}' ({assignee.role.value})."
                )
            validate_approver_scope(assignee, approver)

        # 4. Check recurrence configuration
        next_run = None
        effective_due_date = task_in.due_date
        days_str = None
        if task_in.recurrence_days_of_week is not None:
            days_str = (
                ",".join(str(d) for d in task_in.recurrence_days_of_week)
                if task_in.recurrence_days_of_week
                else None
            )
        elif task_in.recurrence_day_of_week is not None:
            days_str = str(task_in.recurrence_day_of_week)

        if task_in.is_recurring and task_in.recurrence_pattern != RecurrencePattern.NONE:
            base_date = task_in.due_date or datetime.now(timezone.utc)
            if not effective_due_date:
                effective_due_date = base_date
            next_run = calculate_next_run_date(
                pattern=task_in.recurrence_pattern,
                interval=task_in.recurrence_interval,
                base_date=base_date,
                day_of_week=task_in.recurrence_day_of_week,
                day_of_month=task_in.recurrence_day_of_month,
                days_of_week=task_in.recurrence_days_of_week or days_str,
            )

        task = Task(
            title=task_in.title,
            description=task_in.description,
            priority=task_in.priority,
            status=TaskStatus.PENDING,
            due_date=effective_due_date,
            created_by_id=creator.id,
            assigned_to_id=assignee.id,
            requires_approval=task_in.requires_approval,
            approver_id=task_in.approver_id if task_in.requires_approval else None,
            is_recurring=task_in.is_recurring,
            recurrence_pattern=task_in.recurrence_pattern,
            recurrence_interval=task_in.recurrence_interval,
            recurrence_day_of_week=task_in.recurrence_day_of_week,
            recurrence_days_of_week=days_str,
            recurrence_day_of_month=task_in.recurrence_day_of_month,
            recurrence_end_date=task_in.recurrence_end_date,
            next_run_date=next_run,
        )
        session.add(task)
        await session.flush()

        # Add initial subtasks if provided
        if task_in.subtasks:
            for st_in in task_in.subtasks:
                sub = Subtask(
                    task_id=task.id,
                    title=st_in.title.strip(),
                    description=st_in.description.strip() if st_in.description else None,
                    due_date=st_in.due_date or task.due_date,
                    assigned_to_id=st_in.assigned_to_id or task.assigned_to_id,
                    created_by_id=creator.id,
                    is_completed=False,
                )
                session.add(sub)
            await session.flush()

        # Log creation activity
        activity = TaskActivity(
            task_id=task.id,
            user_id=creator.id,
            action=ActivityAction.CREATED,
            details=f"Task created and assigned to {assignee.full_name} ({assignee.role.value}).",
        )
        session.add(activity)

        await session.commit()

        if task.is_recurring:
            try:
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        created_task = await TaskService.get_by_id(session, task.id)
        await broadcaster.broadcast("TASK_CREATED", {
            "task_id": str(task.id),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
            "status": str(task.status.value if hasattr(task.status, "value") else task.status),
        })
        return created_task

    @staticmethod
    async def list_tasks(
        session: AsyncSession,
        current_user: User,
        status_filter: Optional[TaskStatus] = None,
        priority_filter: Optional[TaskPriority] = None,
        assigned_to_id: Optional[uuid.UUID] = None,
        created_by_id: Optional[uuid.UUID] = None,
        is_recurring: Optional[bool] = None,
        requires_approval: Optional[bool] = None,
        search: Optional[str] = None,
        due_date_scope: Optional[str] = None,
        user_scope: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Task], int]:
        # Ensure due recurring tasks for today are spawned and premature future ones cleaned
        try:
            await TaskService.spawn_due_recurring_tasks(session)
        except Exception:
            pass

        stmt = select(Task).options(
            selectinload(Task.created_by),
            selectinload(Task.assigned_to),
            selectinload(Task.approver),
        )

        # Role-based visibility scoping
        if current_user.role == Role.STAFF:
            stmt = stmt.where(
                or_(
                    Task.assigned_to_id == current_user.id,
                    Task.created_by_id == current_user.id,
                )
            )
        elif current_user.role == Role.TEAM_LEADER:
            # Can see own tasks, tasks created by them, tasks assigned to them, tasks where they are approver,
            # and tasks assigned to staff under their department
            tl_dept = (current_user.department or "").strip()
            tl_branch = (current_user.branch or "").strip()
            staff_ids_stmt = select(User.id).where(User.role == Role.STAFF)
            if tl_dept:
                staff_ids_stmt = staff_ids_stmt.where(
                    or_(
                        func.lower(func.trim(User.department)) == tl_dept.lower(),
                        User.reports_to_id == current_user.id,
                    )
                )
                if tl_branch:
                    staff_ids_stmt = staff_ids_stmt.where(
                        or_(
                            User.branch == None,
                            func.lower(func.trim(User.branch)) == tl_branch.lower(),
                            User.reports_to_id == current_user.id,
                        )
                    )
            else:
                staff_ids_stmt = staff_ids_stmt.where(User.reports_to_id == current_user.id)

            stmt = stmt.where(
                or_(
                    Task.assigned_to_id == current_user.id,
                    Task.created_by_id == current_user.id,
                    Task.approver_id == current_user.id,
                    Task.assigned_to_id.in_(staff_ids_stmt),
                )
            )
        elif current_user.role == Role.IN_CHARGE:
            # Subordinates (Team Leader, Staff in department) and own
            ic_dept = (current_user.department or "").strip()
            ic_branch = (current_user.branch or "").strip()
            sub_ids_stmt = select(User.id).where(User.role.in_([Role.TEAM_LEADER, Role.STAFF]))
            if ic_dept:
                sub_ids_stmt = sub_ids_stmt.where(
                    or_(
                        func.lower(func.trim(User.department)) == ic_dept.lower(),
                        User.reports_to_id == current_user.id,
                    )
                )
                if ic_branch:
                    sub_ids_stmt = sub_ids_stmt.where(
                        or_(
                            User.branch == None,
                            func.lower(func.trim(User.branch)) == ic_branch.lower(),
                            User.reports_to_id == current_user.id,
                        )
                    )
            else:
                sub_ids_stmt = sub_ids_stmt.where(User.reports_to_id == current_user.id)

            stmt = stmt.where(
                or_(
                    Task.assigned_to_id == current_user.id,
                    Task.created_by_id == current_user.id,
                    Task.approver_id == current_user.id,
                    Task.assigned_to_id.in_(sub_ids_stmt),
                )
            )
        # Admin and Super Admin have broad query access

        # Apply user filters
        if status_filter:
            stmt = stmt.where(Task.status == status_filter)
        if priority_filter:
            stmt = stmt.where(Task.priority == priority_filter)
        if assigned_to_id:
            stmt = stmt.where(Task.assigned_to_id == assigned_to_id)
        if created_by_id:
            stmt = stmt.where(Task.created_by_id == created_by_id)
        if is_recurring is not None:
            stmt = stmt.where(Task.is_recurring == is_recurring)
        if requires_approval is not None:
            stmt = stmt.where(Task.requires_approval == requires_approval)
        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    Task.title.ilike(search_term),
                    Task.description.ilike(search_term),
                )
            )

        # Due Date Scoping (calculated using local server timezone)
        local_now = datetime.now().astimezone()
        start_of_today = datetime(local_now.year, local_now.month, local_now.day, 0, 0, 0, tzinfo=local_now.tzinfo)
        end_of_today = datetime(local_now.year, local_now.month, local_now.day, 23, 59, 59, 999999, tzinfo=local_now.tzinfo)

        is_today = or_(
            and_(Task.due_date >= start_of_today, Task.due_date <= end_of_today),
            and_(Task.due_date == None, Task.created_at >= start_of_today, Task.created_at <= end_of_today),
        )
        is_overdue = or_(
            and_(
                Task.due_date < start_of_today,
                Task.status.notin_([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
            ),
            and_(
                Task.due_date == None,
                Task.created_at < start_of_today,
                Task.status.notin_([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
            ),
        )

        if due_date_scope == "today":
            stmt = stmt.where(is_today)
        elif due_date_scope == "overdue":
            stmt = stmt.where(is_overdue)
        elif due_date_scope == "upcoming":
            stmt = stmt.where(Task.due_date > end_of_today)

        # User / Team Scope Filtering (e.g. 'me', 'subordinates')
        if user_scope == "me":
            stmt = stmt.where(Task.assigned_to_id == current_user.id)
        elif user_scope == "subordinates":
            if current_user.role == Role.STAFF:
                # Staff has no subordinates
                stmt = stmt.where(False)
            elif current_user.role == Role.TEAM_LEADER:
                stmt = stmt.where(Task.assigned_to_id.in_(staff_ids_stmt))
            elif current_user.role == Role.IN_CHARGE:
                stmt = stmt.where(Task.assigned_to_id.in_(sub_ids_stmt))
            elif current_user.role == Role.ADMIN:
                admin_branch = (current_user.branch or "").strip()
                admin_sub_stmt = select(User.id).where(User.role.in_([Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]))
                if admin_branch:
                    admin_sub_stmt = admin_sub_stmt.where(
                        or_(
                            User.branch == None,
                            func.lower(func.trim(User.branch)) == admin_branch.lower(),
                            User.reports_to_id == current_user.id,
                        )
                    )
                stmt = stmt.where(Task.assigned_to_id.in_(admin_sub_stmt))
            elif current_user.role == Role.SUPER_ADMIN:
                stmt = stmt.where(Task.assigned_to_id != current_user.id)

        # Count query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count = (await session.execute(count_stmt)).scalar() or 0

        # Pagination & sorting
        stmt = stmt.order_by(desc(Task.created_at)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        tasks = result.scalars().all()

        return tasks, total_count

    @staticmethod
    async def update_task(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
        task_in: TaskUpdate,
    ) -> Task:
        task = await TaskService.get_by_id(session, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        validate_can_edit_or_delete_task(operator, task, action="edit")

        changes = []

        if task_in.title is not None and task_in.title != task.title:
            changes.append(f"Title changed from '{task.title}' to '{task_in.title}'")
            task.title = task_in.title

        if task_in.description is not None:
            task.description = task_in.description

        if task_in.priority is not None and task_in.priority != task.priority:
            changes.append(f"Priority changed from '{task.priority.value}' to '{task_in.priority.value}'")
            task.priority = task_in.priority

        if task_in.due_date is not None:
            task.due_date = task_in.due_date

        # Re-assignment
        if task_in.assigned_to_id is not None and task_in.assigned_to_id != task.assigned_to_id:
            new_assignee = await UserService.get_by_id(session, task_in.assigned_to_id)
            if not new_assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="New assignee not found",
                )
            validate_can_assign_task(operator, new_assignee)
            changes.append(f"Reassigned to {new_assignee.full_name} ({new_assignee.role.value})")
            task.assigned_to_id = new_assignee.id

        # Approval updates
        if task_in.requires_approval is not None:
            task.requires_approval = task_in.requires_approval
            changes.append(f"Requires approval set to {task_in.requires_approval}")

        if task_in.approver_id is not None:
            approver = await UserService.get_by_id(session, task_in.approver_id)
            if not approver:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Approver not found",
                )
            assignee = await UserService.get_by_id(session, task.assigned_to_id)
            if not is_eligible_approver(assignee.role, approver.role):
                raise HierarchyPermissionError(
                    f"Approver '{approver.full_name}' must be higher in hierarchy than assignee '{assignee.full_name}'."
                )
            validate_approver_scope(assignee, approver)
            task.approver_id = task_in.approver_id
            changes.append(f"Approver set to {approver.full_name}")

        # Recurrence updates
        root_parent_id = task.parent_task_id if task.parent_task_id else task.id
        root_parent = await session.get(Task, root_parent_id) if task.parent_task_id else task

        if task_in.is_recurring is not None or task_in.recurrence_pattern is not None:
            # Only task creator (or Super Admin) can modify recurrence settings
            if task.created_by_id != operator.id and operator.role != Role.SUPER_ADMIN:
                raise HierarchyPermissionError("Only the creator of the task can modify recurrence settings.")

        if task_in.is_recurring is not None:
            if task_in.is_recurring != task.is_recurring:
                changes.append(f"Recurrence {'enabled' if task_in.is_recurring else 'disabled'}")
            task.is_recurring = task_in.is_recurring
            if root_parent:
                root_parent.is_recurring = task_in.is_recurring

            if not task_in.is_recurring:
                task.next_run_date = None
                if root_parent:
                    root_parent.next_run_date = None
                # Clean up future unstarted pending child instances for this recurring series
                local_now = datetime.now().astimezone()
                end_of_today = datetime(local_now.year, local_now.month, local_now.day, 23, 59, 59, 999999, tzinfo=local_now.tzinfo)
                future_instances_stmt = select(Task).where(
                    Task.parent_task_id == root_parent_id,
                    Task.due_date > end_of_today,
                    Task.status == TaskStatus.PENDING,
                )
                future_instances = (await session.execute(future_instances_stmt)).scalars().all()
                for fi in future_instances:
                    await session.delete(fi)

        if task_in.recurrence_pattern is not None:
            task.recurrence_pattern = task_in.recurrence_pattern
            if root_parent:
                root_parent.recurrence_pattern = task_in.recurrence_pattern
        if task_in.recurrence_interval is not None:
            task.recurrence_interval = task_in.recurrence_interval
            if root_parent:
                root_parent.recurrence_interval = task_in.recurrence_interval
        if task_in.recurrence_day_of_week is not None:
            task.recurrence_day_of_week = task_in.recurrence_day_of_week
            if root_parent:
                root_parent.recurrence_day_of_week = task_in.recurrence_day_of_week
        if task_in.recurrence_days_of_week is not None:
            days_str = (
                ",".join(str(d) for d in task_in.recurrence_days_of_week)
                if task_in.recurrence_days_of_week
                else None
            )
            task.recurrence_days_of_week = days_str
            if root_parent:
                root_parent.recurrence_days_of_week = days_str
            if task_in.recurrence_days_of_week:
                task.recurrence_day_of_week = task_in.recurrence_days_of_week[0]
                if root_parent:
                    root_parent.recurrence_day_of_week = task_in.recurrence_days_of_week[0]

            # If active days of week were modified, delete any unstarted pending future instances
            # that fall on newly avoided days
            if task_in.recurrence_days_of_week:
                allowed_set = set(task_in.recurrence_days_of_week)
                local_now = datetime.now().astimezone()
                future_instances_stmt = select(Task).where(
                    Task.parent_task_id == root_parent_id,
                    Task.due_date > local_now,
                    Task.status == TaskStatus.PENDING,
                )
                future_instances = (await session.execute(future_instances_stmt)).scalars().all()
                for fi in future_instances:
                    if fi.due_date and fi.due_date.astimezone().weekday() not in allowed_set:
                        await session.delete(fi)

        if task_in.recurrence_day_of_month is not None:
            task.recurrence_day_of_month = task_in.recurrence_day_of_month
            if root_parent:
                root_parent.recurrence_day_of_month = task_in.recurrence_day_of_month
        if task_in.recurrence_end_date is not None:
            task.recurrence_end_date = task_in.recurrence_end_date
            if root_parent:
                root_parent.recurrence_end_date = task_in.recurrence_end_date

        if task.is_recurring and task.recurrence_pattern != RecurrencePattern.NONE:
            base_date = (root_parent.due_date if root_parent else None) or task.due_date or datetime.now(timezone.utc)
            next_run = calculate_next_run_date(
                pattern=task.recurrence_pattern,
                interval=task.recurrence_interval,
                base_date=base_date,
                day_of_week=task.recurrence_day_of_week,
                day_of_month=task.recurrence_day_of_month,
                days_of_week=task.recurrence_days_of_week,
            )
            task.next_run_date = next_run
            if root_parent:
                root_parent.next_run_date = next_run

        if changes:
            activity = TaskActivity(
                task_id=task.id,
                user_id=operator.id,
                action=ActivityAction.UPDATED,
                details="; ".join(changes),
            )
            session.add(activity)

        await session.commit()

        if task.is_recurring:
            try:
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        updated_task = await TaskService.get_by_id(session, task.id)
        await broadcaster.broadcast("TASK_UPDATED", {
            "task_id": str(task.id),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
            "status": str(task.status.value if hasattr(task.status, "value") else task.status),
        })
        return updated_task

    @staticmethod
    async def delete_task(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
    ) -> None:
        task = await TaskService.get_by_id(session, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        validate_can_edit_or_delete_task(operator, task, action="delete")

        await session.delete(task)
        await session.commit()
        await broadcaster.broadcast("TASK_DELETED", {
            "task_id": str(task_id),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        })

    @staticmethod
    async def bulk_delete_tasks(
        session: AsyncSession,
        operator: User,
        task_ids: List[uuid.UUID],
    ) -> int:
        if not task_ids:
            return 0

        stmt = select(Task).where(Task.id.in_(task_ids))
        res = await session.execute(stmt)
        tasks = res.scalars().all()

        deleted_count = 0
        for task in tasks:
            try:
                validate_can_edit_or_delete_task(operator, task, action="delete")
                await session.delete(task)
                deleted_count += 1
                await broadcaster.broadcast("TASK_DELETED", {
                    "task_id": str(task.id),
                    "created_by_id": str(task.created_by_id) if task.created_by_id else None,
                    "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
                })
            except Exception:
                continue

        if deleted_count > 0:
            await session.commit()

        return deleted_count

    @staticmethod
    async def update_task_status(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
        status_update: TaskStatusUpdate,
    ) -> Task:
        task = await TaskService.get_by_id(session, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        # Validate permission for status transition
        validate_status_transition(operator, task, status_update.status)

        old_status = task.status
        new_status = status_update.status

        task.status = new_status
        if new_status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now(timezone.utc)
            # Spawn next recurring instance if applicable
            await TaskService._handle_recurring_spawn(session, task)

        # Record activity
        activity = TaskActivity(
            task_id=task.id,
            user_id=operator.id,
            action=ActivityAction.STATUS_CHANGED,
            old_value=old_status.value,
            new_value=new_status.value,
            details=status_update.comment or f"Status changed to {new_status.value}",
        )
        session.add(activity)

        if status_update.comment:
            comment = TaskComment(
                task_id=task.id,
                user_id=operator.id,
                content=f"Status update note: {status_update.comment}",
            )
            session.add(comment)

        await session.commit()

        if task.is_recurring:
            try:
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        updated_task = await TaskService.get_by_id(session, task.id)
        await broadcaster.broadcast("TASK_STATUS_UPDATED", {
            "task_id": str(task.id),
            "status": str(new_status.value if hasattr(new_status, "value") else new_status),
            "old_status": str(old_status.value if hasattr(old_status, "value") else old_status),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        })
        return updated_task

    @staticmethod
    async def submit_for_approval(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
        submission: SubmitForApproval,
    ) -> Task:
        task = await TaskService.get_by_id(session, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        if not task.requires_approval:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This task does not require higher-level approval.",
            )

        if task.status == TaskStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task is already completed.",
            )

        # Assignee or creator or Super Admin can submit for approval
        if operator.id not in [task.assigned_to_id, task.created_by_id] and operator.role != Role.SUPER_ADMIN:
            raise HierarchyPermissionError("Only the assignee, creator, or Super Admin can submit this task for approval.")

        old_status = task.status
        task.status = TaskStatus.PENDING_APPROVAL

        activity = TaskActivity(
            task_id=task.id,
            user_id=operator.id,
            action=ActivityAction.APPROVAL_REQUESTED,
            old_value=old_status.value,
            new_value=TaskStatus.PENDING_APPROVAL.value,
            details=submission.comments or "Submitted task for approval.",
        )
        session.add(activity)

        if submission.comments:
            comment = TaskComment(
                task_id=task.id,
                user_id=operator.id,
                content=f"[Submitted for Approval]: {submission.comments}",
            )
            session.add(comment)

        await session.commit()

        if task.is_recurring:
            try:
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        updated_task = await TaskService.get_by_id(session, task.id)
        await broadcaster.broadcast("TASK_STATUS_UPDATED", {
            "task_id": str(task.id),
            "status": TaskStatus.PENDING_APPROVAL.value,
            "old_status": str(old_status.value if hasattr(old_status, "value") else old_status),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
            "approver_id": str(task.approver_id) if task.approver_id else None,
        })
        await broadcaster.broadcast("APPROVAL_STATUS_UPDATED", {
            "task_id": str(task.id),
            "type": "TASK",
            "status": "PENDING_APPROVAL",
        })
        return updated_task

    @staticmethod
    async def process_approval_decision(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
        decision: ApprovalDecision,
    ) -> Task:
        task = await TaskService.get_by_id(session, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        if not task.requires_approval:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This task does not require approval.",
            )

        if task.status != TaskStatus.PENDING_APPROVAL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Task is in '{task.status.value}' status, not 'PENDING_APPROVAL'.",
            )

        # Check authorization: only the designated approver or a Super Admin
        is_approver = (task.approver_id == operator.id)
        is_super_admin = (operator.role == Role.SUPER_ADMIN)
        if not (is_approver or is_super_admin):
            raise HierarchyPermissionError(
                "Only the designated approver or a Super Admin can approve/reject this task."
            )

        old_status = task.status

        if decision.action == ApprovalAction.APPROVE:
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc)
            action_type = ActivityAction.APPROVED
            details = decision.comments or "Task approved and closed."

            # Spawn next recurring instance if applicable
            await TaskService._handle_recurring_spawn(session, task)
        else:
            # Reject back to IN_PROGRESS
            task.status = TaskStatus.IN_PROGRESS
            action_type = ActivityAction.REJECTED
            details = decision.comments or "Task rejected; returned to In Progress."

        activity = TaskActivity(
            task_id=task.id,
            user_id=operator.id,
            action=action_type,
            old_value=old_status.value,
            new_value=task.status.value,
            details=details,
        )
        session.add(activity)

        if decision.comments:
            prefix = "[Approved]" if decision.action == ApprovalAction.APPROVE else "[Rejected]"
            comment = TaskComment(
                task_id=task.id,
                user_id=operator.id,
                content=f"{prefix}: {decision.comments}",
            )
            session.add(comment)

        await session.commit()

        if task.is_recurring:
            try:
                await TaskService.spawn_due_recurring_tasks(session)
            except Exception:
                pass

        updated_task = await TaskService.get_by_id(session, task.id)
        await broadcaster.broadcast("TASK_STATUS_UPDATED", {
            "task_id": str(task.id),
            "status": str(task.status.value if hasattr(task.status, "value") else task.status),
            "old_status": str(old_status.value if hasattr(old_status, "value") else old_status),
            "created_by_id": str(task.created_by_id) if task.created_by_id else None,
            "assigned_to_id": str(task.assigned_to_id) if task.assigned_to_id else None,
        })
        await broadcaster.broadcast("APPROVAL_STATUS_UPDATED", {
            "task_id": str(task.id),
            "type": "TASK",
            "decision": decision.action.value if hasattr(decision.action, "value") else str(decision.action),
            "status": str(task.status.value if hasattr(task.status, "value") else task.status),
        })
        return updated_task

    @staticmethod
    async def _copy_subtasks_to_recurring_instance(
        session: AsyncSession,
        root_parent: Task,
        target_instance: Task,
    ) -> int:
        """
        Copies all subtasks defined on the recurring task template (or latest instance)
        to the newly spawned recurring task instance, resetting is_completed=False and
        updating the due_date to match the target instance.
        """
        # 1. Fetch subtasks from the root parent template
        subtasks_stmt = (
            select(Subtask)
            .where(Subtask.task_id == root_parent.id)
            .order_by(Subtask.created_at.asc())
        )
        template_subtasks = list((await session.execute(subtasks_stmt)).scalars().all())

        # 2. Check if any previous child instance has additional subtasks not yet in root_parent
        if root_parent.child_instances:
            existing_titles = {s.title.strip().lower() for s in template_subtasks}
            for child in reversed(root_parent.child_instances):
                if child.id == target_instance.id:
                    continue
                child_stmt = (
                    select(Subtask)
                    .where(Subtask.task_id == child.id)
                    .order_by(Subtask.created_at.asc())
                )
                child_subtasks = (await session.execute(child_stmt)).scalars().all()
                for cs in child_subtasks:
                    cs_title = cs.title.strip().lower()
                    if cs_title not in existing_titles:
                        # Also backport these subtasks to the root_parent template for future recurrences
                        backport_sub = Subtask(
                            task_id=root_parent.id,
                            title=cs.title,
                            description=cs.description,
                            due_date=root_parent.due_date,
                            assigned_to_id=cs.assigned_to_id or root_parent.assigned_to_id,
                            created_by_id=cs.created_by_id or root_parent.created_by_id,
                            is_completed=False,
                        )
                        session.add(backport_sub)
                        template_subtasks.append(backport_sub)
                        existing_titles.add(cs_title)

        copied_count = 0
        for s in template_subtasks:
            new_subtask = Subtask(
                task_id=target_instance.id,
                title=s.title,
                description=s.description,
                due_date=target_instance.due_date,
                assigned_to_id=s.assigned_to_id or target_instance.assigned_to_id,
                created_by_id=s.created_by_id or target_instance.created_by_id,
                is_completed=False,
            )
            session.add(new_subtask)
            copied_count += 1

        if copied_count > 0:
            await session.flush()
        return copied_count

    @staticmethod
    async def spawn_due_recurring_tasks(session: AsyncSession) -> List[Task]:
        """
        Ensures that for all active recurring task templates:
        1. An instance exists for TODAY.
        2. Tomorrow's (or next occurrence's) instance is pre-spawned and ready in "Upcoming".
        3. Never blocked by unfinished past tasks.
        4. Subtasks are replicated with is_completed=False.
        """
        local_now = datetime.now().astimezone()
        local_tz = local_now.tzinfo
        today_date = local_now.date()
        tomorrow_date = today_date + timedelta(days=1)

        # Query all active root recurring templates
        stmt = (
            select(Task)
            .where(
                Task.is_recurring == True,
                Task.parent_task_id == None,
            )
            .options(
                selectinload(Task.child_instances),
                selectinload(Task.subtasks),
            )
        )
        result = await session.execute(stmt)
        recurring_templates = result.scalars().all()

        spawned: List[Task] = []
        for template in recurring_templates:
            # Backfill root template due_date if missing
            if template.due_date is None:
                template.due_date = template.created_at or local_now

            # Reference time of day and timezone for instances
            ref_dt = template.due_date or template.created_at or local_now
            ref_local = ref_dt.astimezone(local_tz)
            ref_time = ref_local.time()

            # Gather all existing calendar dates where an instance already exists in this recurring series
            existing_dates = set()
            root_date = template.due_date.astimezone(local_tz).date()
            existing_dates.add(root_date)
            for child in template.child_instances:
                if child.due_date:
                    existing_dates.add(child.due_date.astimezone(local_tz).date())

            # Check if recurrence end date has passed
            if template.recurrence_end_date:
                end_date = template.recurrence_end_date.astimezone(local_tz).date()
                if today_date > end_date:
                    template.is_recurring = False
                    template.next_run_date = None
                    continue

            # Determine active allowed days of week
            allowed_days = parse_days_of_week(template.recurrence_days_of_week)
            if allowed_days is None and template.recurrence_day_of_week is not None and 0 <= template.recurrence_day_of_week <= 6:
                allowed_days = [template.recurrence_day_of_week]

            # 1. Ensure instance for TODAY exists (only if today is an active recurrence day)
            today_weekday = today_date.weekday()  # 0 = Monday ... 6 = Sunday
            should_spawn_today = True
            if allowed_days is not None:
                if today_weekday not in allowed_days:
                    should_spawn_today = False
            elif template.recurrence_pattern == RecurrencePattern.WEEKLY and template.recurrence_day_of_week is not None:
                if today_weekday != template.recurrence_day_of_week:
                    should_spawn_today = False

            if should_spawn_today and today_date not in existing_dates:
                today_due = datetime.combine(today_date, ref_time, tzinfo=local_tz)
                today_task = Task(
                    title=template.title,
                    description=template.description,
                    priority=template.priority,
                    status=TaskStatus.PENDING,
                    due_date=today_due,
                    created_by_id=template.created_by_id,
                    assigned_to_id=template.assigned_to_id,
                    requires_approval=template.requires_approval,
                    approver_id=template.approver_id,
                    is_recurring=True,
                    recurrence_pattern=template.recurrence_pattern,
                    recurrence_interval=template.recurrence_interval,
                    recurrence_day_of_week=template.recurrence_day_of_week,
                    recurrence_days_of_week=template.recurrence_days_of_week,
                    recurrence_day_of_month=template.recurrence_day_of_month,
                    recurrence_end_date=template.recurrence_end_date,
                    parent_task_id=template.id,
                )
                session.add(today_task)
                await session.flush()

                # Replicate subtasks
                await TaskService._copy_subtasks_to_recurring_instance(
                    session=session,
                    root_parent=template,
                    target_instance=today_task,
                )

                activity = TaskActivity(
                    task_id=today_task.id,
                    user_id=template.created_by_id,
                    action=ActivityAction.RECURRENCE_GENERATED,
                    details="Scheduled instance generated for today's run.",
                )
                session.add(activity)
                spawned.append(today_task)
                existing_dates.add(today_date)

            # 2. Ensure upcoming instance exists for the NEXT valid occurrence so it appears in "Upcoming"
            today_dt = datetime.combine(today_date, ref_time, tzinfo=local_tz)
            next_calc = calculate_next_run_date(
                pattern=template.recurrence_pattern,
                interval=template.recurrence_interval,
                base_date=today_dt,
                day_of_week=template.recurrence_day_of_week,
                day_of_month=template.recurrence_day_of_month,
                days_of_week=allowed_days or template.recurrence_days_of_week,
            )
            target_upcoming_date = next_calc.astimezone(local_tz).date() if next_calc else None

            if target_upcoming_date and target_upcoming_date not in existing_dates:
                can_spawn_upcoming = True
                if template.recurrence_end_date:
                    end_date = template.recurrence_end_date.astimezone(local_tz).date()
                    if target_upcoming_date > end_date:
                        can_spawn_upcoming = False

                if can_spawn_upcoming:
                    upcoming_due = datetime.combine(target_upcoming_date, ref_time, tzinfo=local_tz)
                    upcoming_task = Task(
                        title=template.title,
                        description=template.description,
                        priority=template.priority,
                        status=TaskStatus.PENDING,
                        due_date=upcoming_due,
                        created_by_id=template.created_by_id,
                        assigned_to_id=template.assigned_to_id,
                        requires_approval=template.requires_approval,
                        approver_id=template.approver_id,
                        is_recurring=True,
                        recurrence_pattern=template.recurrence_pattern,
                        recurrence_interval=template.recurrence_interval,
                        recurrence_day_of_week=template.recurrence_day_of_week,
                        recurrence_days_of_week=template.recurrence_days_of_week,
                        recurrence_day_of_month=template.recurrence_day_of_month,
                        recurrence_end_date=template.recurrence_end_date,
                        parent_task_id=template.id,
                    )
                    session.add(upcoming_task)
                    await session.flush()

                    await TaskService._copy_subtasks_to_recurring_instance(
                        session=session,
                        root_parent=template,
                        target_instance=upcoming_task,
                    )

                    activity = TaskActivity(
                        task_id=upcoming_task.id,
                        user_id=template.created_by_id,
                        action=ActivityAction.RECURRENCE_GENERATED,
                        details="Upcoming scheduled instance generated for upcoming queue.",
                    )
                    session.add(activity)
                    spawned.append(upcoming_task)
                    existing_dates.add(target_upcoming_date)

            # Update next_run_date to next scheduled run date after the spawned dates
            latest_date = max(existing_dates) if existing_dates else today_date
            latest_dt = datetime.combine(latest_date, ref_time, tzinfo=local_tz)
            template.next_run_date = calculate_next_run_date(
                pattern=template.recurrence_pattern,
                interval=template.recurrence_interval,
                base_date=latest_dt,
                day_of_week=template.recurrence_day_of_week,
                day_of_month=template.recurrence_day_of_month,
                days_of_week=allowed_days or template.recurrence_days_of_week,
            )

        if spawned:
            await session.commit()
            for t in spawned:
                await broadcaster.broadcast("TASK_CREATED", {
                    "task_id": str(t.id),
                    "created_by_id": str(t.created_by_id) if t.created_by_id else None,
                    "assigned_to_id": str(t.assigned_to_id) if t.assigned_to_id else None,
                    "status": str(t.status.value if hasattr(t.status, "value") else t.status),
                })

        return spawned

    @staticmethod
    async def _handle_recurring_spawn(session: AsyncSession, task: Task) -> Optional[Task]:
        """
        When a recurring task is completed (or approved), ensures the recurrence schedule is updated
        and tomorrow's upcoming instance is ready in the upcoming section.
        """
        if not task.is_recurring:
            return None
        spawned = await TaskService.spawn_due_recurring_tasks(session)
        return spawned[0] if spawned else None

    @staticmethod
    async def add_comment(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
        content: str,
    ) -> TaskComment:
        task = await TaskService.get_by_id(session, task_id, current_user=operator)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        comment = TaskComment(
            task_id=task.id,
            user_id=operator.id,
            content=content,
        )
        session.add(comment)
        await session.commit()
        await session.refresh(comment)
        return comment

    @staticmethod
    async def get_comments(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
    ) -> List[TaskComment]:
        task = await TaskService.get_by_id(session, task_id, current_user=operator)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        stmt = (
            select(TaskComment)
            .where(TaskComment.task_id == task_id)
            .options(selectinload(TaskComment.user))
            .order_by(TaskComment.created_at.asc())
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_activities(
        session: AsyncSession,
        operator: User,
        task_id: uuid.UUID,
    ) -> List[TaskActivity]:
        task = await TaskService.get_by_id(session, task_id, current_user=operator)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        stmt = (
            select(TaskActivity)
            .where(TaskActivity.task_id == task_id)
            .options(selectinload(TaskActivity.user))
            .order_by(TaskActivity.created_at.desc())
        )
        result = await session.execute(stmt)
        return result.scalars().all()

