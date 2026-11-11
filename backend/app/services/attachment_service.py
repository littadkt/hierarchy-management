from datetime import datetime, timezone
import os
from pathlib import Path
import re
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.core.config import settings
from app.models.attachment import TaskAttachment
from app.models.subtask import Subtask
from app.models.task import Task
from app.models.task_activity import ActivityAction, TaskActivity
from app.models.user import Role, User
from app.services.task_service import TaskService


# 50 MB max file size limit per attachment
MAX_FILE_SIZE = 50 * 1024 * 1024


def sanitize_filename(filename: str) -> str:
    """Sanitize original filename to prevent path traversal or filesystem issues"""
    base = os.path.basename(filename.strip())
    # Replace any character that is not alphanumeric, dash, underscore, space, or dot
    clean = re.sub(r"[^\w\s\.\-]", "_", base)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean if clean else "attachment"


class AttachmentService:
    @staticmethod
    async def save_uploaded_file(
        task_id: uuid.UUID,
        file: UploadFile,
    ) -> Tuple[str, str, str, int, Optional[str]]:
        """
        Saves file chunk-by-chunk to the attachments folder.
        Returns (original_filename, stored_filename, relative_file_path, file_size, content_type)
        """
        original_name = sanitize_filename(file.filename or "attachment")
        unique_prefix = uuid.uuid4().hex[:12]
        stored_name = f"{unique_prefix}_{original_name}"

        # Target directory: uploads/attachments/<task_id>/
        task_dir = settings.ABSOLUTE_ATTACHMENTS_DIR / str(task_id)
        task_dir.mkdir(parents=True, exist_ok=True)

        target_path = task_dir / stored_name
        relative_path = f"{task_id}/{stored_name}"

        total_size = 0
        try:
            with open(target_path, "wb") as out_file:
                while chunk := await file.read(64 * 1024):
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        out_file.close()
                        if target_path.exists():
                            target_path.unlink()
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="File size exceeds maximum allowed limit of 50MB.",
                        )
                    out_file.write(chunk)
        except Exception:
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:
                    pass
            raise

        content_type = file.content_type or "application/octet-stream"
        return original_name, stored_name, relative_path, total_size, content_type

    @staticmethod
    async def upload_attachment(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        file: UploadFile,
        subtask_id: Optional[uuid.UUID] = None,
    ) -> TaskAttachment:
        task = await TaskService.get_by_id(session, task_id, current_user=current_user)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        subtask: Optional[Subtask] = None
        if subtask_id:
            subtask_stmt = (
                select(Subtask)
                .where(Subtask.id == subtask_id, Subtask.task_id == task_id)
            )
            subtask_res = await session.execute(subtask_stmt)
            subtask = subtask_res.scalar_one_or_none()
            if not subtask:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subtask not found for this task",
                )

        original_name, stored_name, relative_path, file_size, content_type = (
            await AttachmentService.save_uploaded_file(task_id, file)
        )

        attachment = TaskAttachment(
            task_id=task_id,
            subtask_id=subtask_id,
            filename=original_name,
            stored_filename=stored_name,
            file_path=relative_path,
            file_size=file_size,
            content_type=content_type,
            uploaded_by_id=current_user.id,
        )
        session.add(attachment)

        # Log TaskActivity
        if subtask:
            activity_detail = f"Attached file '{original_name}' to subtask '{subtask.title}'"
        else:
            activity_detail = f"Attached file: '{original_name}'"

        activity = TaskActivity(
            task_id=task_id,
            user_id=current_user.id,
            action=ActivityAction.UPDATED,
            details=activity_detail,
        )
        session.add(activity)

        await session.commit()
        await session.refresh(attachment)

        # Re-fetch with uploaded_by relationship loaded
        stmt = (
            select(TaskAttachment)
            .where(TaskAttachment.id == attachment.id)
            .options(selectinload(TaskAttachment.uploaded_by))
        )
        res = await session.execute(stmt)
        refreshed = res.scalar_one()

        await broadcaster.broadcast("TASK_ATTACHMENT_ADDED", {
            "task_id": str(task_id),
            "subtask_id": str(subtask_id) if subtask_id else None,
            "attachment_id": str(refreshed.id),
            "filename": refreshed.filename,
        })

        return refreshed

    @staticmethod
    async def upload_attachments_batch(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        files: List[UploadFile],
        subtask_id: Optional[uuid.UUID] = None,
    ) -> List[TaskAttachment]:
        results: List[TaskAttachment] = []
        for f in files:
            att = await AttachmentService.upload_attachment(
                session=session,
                current_user=current_user,
                task_id=task_id,
                file=f,
                subtask_id=subtask_id,
            )
            results.append(att)
        return results

    @staticmethod
    async def list_attachments(
        session: AsyncSession,
        current_user: User,
        task_id: uuid.UUID,
        subtask_id: Optional[uuid.UUID] = None,
    ) -> List[TaskAttachment]:
        task = await TaskService.get_by_id(session, task_id, current_user=current_user)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )

        stmt = select(TaskAttachment).where(TaskAttachment.task_id == task_id)
        if subtask_id:
            stmt = stmt.where(TaskAttachment.subtask_id == subtask_id)
        else:
            stmt = stmt.where(TaskAttachment.subtask_id.is_(None))

        stmt = stmt.options(selectinload(TaskAttachment.uploaded_by)).order_by(
            TaskAttachment.created_at.desc()
        )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_attachment_file(
        session: AsyncSession,
        current_user: User,
        attachment_id: uuid.UUID,
    ) -> Tuple[TaskAttachment, Path]:
        stmt = (
            select(TaskAttachment)
            .where(TaskAttachment.id == attachment_id)
            .options(
                selectinload(TaskAttachment.task).selectinload(Task.created_by),
                selectinload(TaskAttachment.task).selectinload(Task.assigned_to),
                selectinload(TaskAttachment.uploaded_by),
            )
        )
        res = await session.execute(stmt)
        attachment = res.scalar_one_or_none()
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found",
            )

        # Check task visibility
        TaskService.check_can_view_task(current_user, attachment.task)

        # Check file on disk
        target_path = settings.ABSOLUTE_ATTACHMENTS_DIR / attachment.file_path
        if not target_path.exists() or not target_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment file could not be found on server disk.",
            )

        return attachment, target_path

    @staticmethod
    async def delete_attachment(
        session: AsyncSession,
        current_user: User,
        attachment_id: uuid.UUID,
    ) -> None:
        stmt = (
            select(TaskAttachment)
            .where(TaskAttachment.id == attachment_id)
            .options(
                selectinload(TaskAttachment.task),
                selectinload(TaskAttachment.subtask),
            )
        )
        res = await session.execute(stmt)
        attachment = res.scalar_one_or_none()
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found",
            )

        task = attachment.task
        TaskService.check_can_view_task(current_user, task)

        # Permission check: Super admin, task creator, or uploader
        can_delete = (
            current_user.role == Role.SUPER_ADMIN
            or current_user.id == attachment.uploaded_by_id
            or current_user.id == task.created_by_id
        )
        if not can_delete:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this attachment.",
            )

        # Delete physical file
        target_path = settings.ABSOLUTE_ATTACHMENTS_DIR / attachment.file_path
        if target_path.exists():
            try:
                target_path.unlink()
            except Exception:
                pass

        filename = attachment.filename
        task_id = attachment.task_id
        subtask_id = attachment.subtask_id

        await session.delete(attachment)

        # Log TaskActivity
        subtask_info = f" from subtask '{attachment.subtask.title}'" if attachment.subtask else ""
        activity = TaskActivity(
            task_id=task_id,
            user_id=current_user.id,
            action=ActivityAction.UPDATED,
            details=f"Deleted attachment: '{filename}'{subtask_info}",
        )
        session.add(activity)

        await session.commit()

        await broadcaster.broadcast("TASK_ATTACHMENT_DELETED", {
            "task_id": str(task_id),
            "subtask_id": str(subtask_id) if subtask_id else None,
            "attachment_id": str(attachment_id),
        })
