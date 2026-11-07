from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subtask import Subtask
from app.models.task import Task, TaskStatus
from app.models.task_activity import ActivityAction, TaskActivity
from app.models.user import Role, User
from app.schemas.subtask import SubtaskCreate, SubtaskUpdate
from app.services.task_service import TaskService


class SubtaskService:
    @staticmethod
    async def list_subtasks(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
    ) -> List[Subtask]:
        task = await TaskService.get_by_id(session, task_id, current_user=current_user)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        stmt = (
            select(Subtask)
            .where(Subtask.task_id == task_id)
            .options(
                selectinload(Subtask.assigned_to),
                selectinload(Subtask.created_by),
            )
            .order_by(Subtask.created_at.asc())
        )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_subtask_by_id(
        session: AsyncSession,
        subtask_id: uuid.UUID,
    ) -> Optional[Subtask]:
        stmt = (
            select(Subtask)
            .where(Subtask.id == subtask_id)
            .options(
                selectinload(Subtask.task),
                selectinload(Subtask.assigned_to),
                selectinload(Subtask.created_by),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_subtask(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        subtask_in: SubtaskCreate,
    ) -> Subtask:
        task = await TaskService.get_by_id(session, task_id, current_user=current_user)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        # Validate assignee if provided
        if subtask_in.assigned_to_id:
            assignee_stmt = select(User).where(User.id == subtask_in.assigned_to_id)
            assignee = (await session.execute(assignee_stmt)).scalar_one_or_none()
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user not found",
                )

        subtask = Subtask(
            task_id=task_id,
            title=subtask_in.title.strip(),
            description=subtask_in.description.strip() if subtask_in.description else None,
            due_date=subtask_in.due_date,
            assigned_to_id=subtask_in.assigned_to_id,
            created_by_id=current_user.id,
            is_completed=False,
        )
        session.add(subtask)

        # If this task belongs to a recurring series, sync the subtask to:
        # 1. The root template (so all future recurring instances inherit it)
        # 2. All active/upcoming child instances in this series (e.g. today's and tomorrow's tasks)
        if task.is_recurring or task.parent_task_id:
            root_parent_id = task.parent_task_id if task.parent_task_id else task.id
            root_parent = await session.get(Task, root_parent_id) if task.parent_task_id else task

            if root_parent:
                # 1. Sync to root template if current task is a child instance
                if root_parent.id != task.id:
                    existing_root_sub = (
                        await session.execute(
                            select(Subtask).where(
                                Subtask.task_id == root_parent.id,
                                func.lower(func.trim(Subtask.title)) == subtask.title.lower(),
                            )
                        )
                    ).scalar_one_or_none()
                    if not existing_root_sub:
                        root_sub = Subtask(
                            task_id=root_parent.id,
                            title=subtask.title,
                            description=subtask.description,
                            due_date=root_parent.due_date,
                            assigned_to_id=subtask.assigned_to_id or root_parent.assigned_to_id,
                            created_by_id=current_user.id,
                            is_completed=False,
                        )
                        session.add(root_sub)

                # 2. Sync to all other active/upcoming instances in this recurring series
                series_instances_stmt = select(Task).where(
                    Task.parent_task_id == root_parent.id,
                    Task.id != task.id,
                    Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
                )
                series_instances = (await session.execute(series_instances_stmt)).scalars().all()
                for inst in series_instances:
                    existing_inst_sub = (
                        await session.execute(
                            select(Subtask).where(
                                Subtask.task_id == inst.id,
                                func.lower(func.trim(Subtask.title)) == subtask.title.lower(),
                            )
                        )
                    ).scalar_one_or_none()
                    if not existing_inst_sub:
                        inst_sub = Subtask(
                            task_id=inst.id,
                            title=subtask.title,
                            description=subtask.description,
                            due_date=inst.due_date,
                            assigned_to_id=subtask.assigned_to_id or inst.assigned_to_id,
                            created_by_id=current_user.id,
                            is_completed=False,
                        )
                        session.add(inst_sub)

        # Log task activity
        activity = TaskActivity(
            task_id=task.id,
            user_id=current_user.id,
            action=ActivityAction.UPDATED,
            details=f"Added subtask: '{subtask.title}'",
        )
        session.add(activity)

        await session.commit()
        return await SubtaskService.get_subtask_by_id(session, subtask.id)

    @staticmethod
    async def update_subtask(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        subtask_id: uuid.UUID,
        subtask_in: SubtaskUpdate,
    ) -> Subtask:
        subtask = await SubtaskService.get_subtask_by_id(session, subtask_id)
        if not subtask or subtask.task_id != task_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subtask not found for this task",
            )

        task = subtask.task
        TaskService.check_can_view_task(current_user, task)

        is_creator = (
            current_user.role == Role.SUPER_ADMIN
            or current_user.id in [task.created_by_id, subtask.created_by_id]
        )

        is_editing_content = (
            subtask_in.title is not None
            or subtask_in.description is not None
            or subtask_in.due_date is not None
            or subtask_in.assigned_to_id is not None
        )

        if is_editing_content and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the user who created the task can edit subtasks.",
            )

        # For toggling status only, allow assignee or creator
        if not is_creator and current_user.id not in [
            task.assigned_to_id,
            subtask.assigned_to_id,
        ]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this subtask.",
            )

        status_changed = False
        old_title = subtask.title
        if subtask_in.title is not None:
            subtask.title = subtask_in.title.strip()
        if subtask_in.description is not None:
            subtask.description = (
                subtask_in.description.strip() if subtask_in.description else None
            )
        if subtask_in.due_date is not None:
            subtask.due_date = subtask_in.due_date
        if subtask_in.assigned_to_id is not None:
            subtask.assigned_to_id = subtask_in.assigned_to_id
        if (
            subtask_in.is_completed is not None
            and subtask_in.is_completed != subtask.is_completed
        ):
            subtask.is_completed = subtask_in.is_completed
            status_changed = True

        # If editing content on a recurring series, propagate changes to template & active instances
        if is_editing_content and (task.is_recurring or task.parent_task_id):
            root_parent_id = task.parent_task_id if task.parent_task_id else task.id
            series_instances_stmt = select(Task.id).where(
                or_(
                    Task.id == root_parent_id,
                    Task.parent_task_id == root_parent_id,
                ),
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            )
            series_ids = (await session.execute(series_instances_stmt)).scalars().all()
            if series_ids:
                matching_subs_stmt = select(Subtask).where(
                    Subtask.task_id.in_(series_ids),
                    Subtask.id != subtask.id,
                    func.lower(func.trim(Subtask.title)) == old_title.strip().lower(),
                    Subtask.is_completed == False,
                )
                matching_subs = (await session.execute(matching_subs_stmt)).scalars().all()
                for ms in matching_subs:
                    if subtask_in.title is not None:
                        ms.title = subtask.title
                    if subtask_in.description is not None:
                        ms.description = subtask.description
                    if subtask_in.assigned_to_id is not None:
                        ms.assigned_to_id = subtask.assigned_to_id

        if status_changed:
            state_text = "completed" if subtask.is_completed else "marked as pending"
            activity = TaskActivity(
                task_id=task.id,
                user_id=current_user.id,
                action=ActivityAction.STATUS_CHANGED,
                details=f"Subtask '{subtask.title}' {state_text}",
            )
            session.add(activity)

        await session.commit()
        return await SubtaskService.get_subtask_by_id(session, subtask.id)

    @staticmethod
    async def toggle_subtask(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        subtask_id: uuid.UUID,
        is_completed: bool,
    ) -> Subtask:
        return await SubtaskService.update_subtask(
            session=session,
            current_user=current_user,
            task_id=task_id,
            subtask_id=subtask_id,
            subtask_in=SubtaskUpdate(is_completed=is_completed),
        )

    @staticmethod
    async def delete_subtask(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        subtask_id: uuid.UUID,
    ) -> None:
        subtask = await SubtaskService.get_subtask_by_id(session, subtask_id)
        if not subtask or subtask.task_id != task_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subtask not found for this task",
            )

        task = subtask.task
        TaskService.check_can_view_task(current_user, task)

        # Deletion permission: only who created the task (or subtask, or Super Admin)
        can_delete = (
            current_user.role == Role.SUPER_ADMIN
            or current_user.id in [subtask.created_by_id, task.created_by_id]
        )
        if not can_delete:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the user who created the task can delete subtasks.",
            )

        title = subtask.title
        await session.delete(subtask)

        # If recurring task series, also remove this uncompleted subtask from root template and active instances
        if task.is_recurring or task.parent_task_id:
            root_parent_id = task.parent_task_id if task.parent_task_id else task.id
            series_instances_stmt = select(Task.id).where(
                or_(
                    Task.id == root_parent_id,
                    Task.parent_task_id == root_parent_id,
                ),
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS]),
            )
            series_ids = (await session.execute(series_instances_stmt)).scalars().all()
            if series_ids:
                matching_subs_stmt = select(Subtask).where(
                    Subtask.task_id.in_(series_ids),
                    Subtask.id != subtask.id,
                    func.lower(func.trim(Subtask.title)) == title.strip().lower(),
                    Subtask.is_completed == False,
                )
                matching_subs = (await session.execute(matching_subs_stmt)).scalars().all()
                for ms in matching_subs:
                    await session.delete(ms)

        # Log deletion activity
        activity = TaskActivity(
            task_id=task.id,
            user_id=current_user.id,
            action=ActivityAction.UPDATED,
            details=f"Deleted subtask: '{title}'",
        )
        session.add(activity)

        await session.commit()

