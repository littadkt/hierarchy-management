from datetime import datetime, time, timezone
from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

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
    sort_by: Optional[str] = Query(None, description="Sort field: 'approver', 'date', 'due_date', 'created_at', 'updated_at'"),
    order: Optional[str] = Query("desc", description="Sort direction: 'asc' or 'desc'"),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD): matches submission date, due date, or created date"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    List all tasks currently awaiting approval:
    - Super Admin: sees all tasks awaiting approval
    - Approvers: sees tasks where current user is designated approver
    Supports sorting by designated approver and date, and filtering by date.
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
    )

    if current_user.role != Role.SUPER_ADMIN:
        stmt = stmt.where(Task.approver_id == current_user.id)

    if date and date.strip():
        try:
            target_d = datetime.strptime(date.strip(), "%Y-%m-%d").date()
            start_dt = datetime.combine(target_d, time.min).replace(tzinfo=timezone.utc)
            end_dt = datetime.combine(target_d, time.max).replace(tzinfo=timezone.utc)
            stmt = stmt.where(
                or_(
                    and_(Task.updated_at >= start_dt, Task.updated_at <= end_dt),
                    and_(Task.created_at >= start_dt, Task.created_at <= end_dt),
                    and_(Task.due_date >= start_dt, Task.due_date <= end_dt),
                )
            )
        except ValueError:
            pass

    is_asc = (order or "desc").lower() == "asc"

    if sort_by == "approver":
        approver_alias = aliased(User)
        stmt = stmt.outerjoin(approver_alias, Task.approver_id == approver_alias.id)
        if is_asc:
            stmt = stmt.order_by(approver_alias.full_name.asc().nulls_last(), Task.updated_at.desc())
        else:
            stmt = stmt.order_by(approver_alias.full_name.desc().nulls_last(), Task.updated_at.desc())
    elif sort_by == "due_date":
        if is_asc:
            stmt = stmt.order_by(Task.due_date.asc().nulls_last(), Task.updated_at.desc())
        else:
            stmt = stmt.order_by(Task.due_date.desc().nulls_last(), Task.updated_at.desc())
    elif sort_by == "created_at":
        if is_asc:
            stmt = stmt.order_by(Task.created_at.asc())
        else:
            stmt = stmt.order_by(Task.created_at.desc())
    else:  # default: sort by date (updated_at)
        if is_asc:
            stmt = stmt.order_by(Task.updated_at.asc())
        else:
            stmt = stmt.order_by(Task.updated_at.desc())

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

