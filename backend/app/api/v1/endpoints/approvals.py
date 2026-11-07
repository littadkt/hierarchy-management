from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.task import Task, TaskStatus
from app.models.user import Role, User
from app.schemas.approval import ApprovalDecision, SubmitForApproval
from app.schemas.task import TaskOut
from app.services.task_service import TaskService

router = APIRouter()


@router.get("/pending", response_model=List[TaskOut])
async def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    List all tasks currently awaiting approval:
    - Super Admin: sees all tasks awaiting approval
    - Approvers: sees tasks where current user is designated approver
    """
    stmt = (
        select(Task)
        .where(
            Task.status == TaskStatus.PENDING_APPROVAL,
            Task.requires_approval == True,
        )
        .options(
            selectinload(Task.created_by),
            selectinload(Task.assigned_to),
            selectinload(Task.approver),
        )
        .order_by(Task.updated_at.desc())
    )

    if current_user.role != Role.SUPER_ADMIN:
        stmt = stmt.where(Task.approver_id == current_user.id)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.post("/{task_id}/submit", response_model=TaskOut)
async def submit_task_for_approval(
    task_id: uuid.UUID,
    submission: SubmitForApproval,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Submit a task for higher-level approval once work is done"""
    return await TaskService.submit_for_approval(session, current_user, task_id, submission)


@router.post("/{task_id}/decision", response_model=TaskOut)
async def decide_approval(
    task_id: uuid.UUID,
    decision: ApprovalDecision,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Approve or reject a task:
    - Only the designated approver or a Super Admin is authorized.
    - If APPROVED: status becomes COMPLETED (closed), and next recurring task instance spawns if recurring.
    - If REJECTED: status is returned to IN_PROGRESS with rejection feedback.
    """
    return await TaskService.process_approval_decision(session, current_user, task_id, decision)

