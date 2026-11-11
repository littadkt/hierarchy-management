from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.attendance import Attendance
from app.models.task import Task, TaskStatus
from app.models.user import Role, User
from app.schemas.stats import DashboardStats, TaskPerformanceStats
from app.services.task_service import TaskService
from app.services.user_service import UserService
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    # 1. User counts by role
    users_stmt = select(User.role, func.count(User.id)).group_by(User.role)
    users_res = await session.execute(users_stmt)
    user_counts = {role.value: count for role, count in users_res.all()}
    for r in Role:
        if r.value not in user_counts:
            user_counts[r.value] = 0

    # 2. Task counts by status
    tasks_stmt = select(Task.status, func.count(Task.id)).group_by(Task.status)
    tasks_res = await session.execute(tasks_stmt)
    task_counts = {st.value: count for st, count in tasks_res.all()}
    for s in TaskStatus:
        if s.value not in task_counts:
            task_counts[s.value] = 0

    # 3. My tasks count
    my_tasks_stmt = select(func.count(Task.id)).where(Task.assigned_to_id == current_user.id)
    my_tasks_count = (await session.execute(my_tasks_stmt)).scalar() or 0

    # 4. My pending approvals count
    my_approvals_stmt = select(func.count(Task.id)).where(
        Task.status == TaskStatus.PENDING_APPROVAL,
        Task.approver_id == current_user.id,
    )
    my_pending_approvals = (await session.execute(my_approvals_stmt)).scalar() or 0

    # 5. Recurring tasks count
    rec_stmt = select(func.count(Task.id)).where(Task.is_recurring == True)
    rec_count = (await session.execute(rec_stmt)).scalar() or 0

    # 6. Today's check-in stats for Super Admin and Admin
    now = datetime.now(timezone.utc)
    today_str = now.astimezone().strftime("%Y-%m-%d")
    today_utc_str = now.strftime("%Y-%m-%d")
    today_logins = []
    today_logged_in_count = 0

    if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN]:
        att_stmt = (
            select(Attendance)
            .join(User, Attendance.user_id == User.id)
            .options(selectinload(Attendance.user))
            .where(Attendance.date.in_([today_str, today_utc_str]))
            .order_by(desc(Attendance.check_in_time))
        )
        if current_user.role == Role.ADMIN:
            att_stmt = att_stmt.where(User.role != Role.SUPER_ADMIN)
        att_res = await session.execute(att_stmt)
        att_records = att_res.scalars().all()
        today_logged_in_count = len(att_records)
        for rec in att_records:
            u = rec.user
            if not u:
                continue
            today_logins.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "branch": u.branch,
                "department": u.department,
                "today_first_login_at": rec.check_in_time.isoformat() if rec.check_in_time else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "check_out_time": rec.check_out_time.isoformat() if rec.check_out_time else None,
                "status": rec.status.value if hasattr(rec.status, "value") else str(rec.status),
            })

    # 7. Task & Subtask Performance Analytics
    task_performance = await TaskService.get_performance_stats(session, current_user)

    return {
        "user_counts_by_role": user_counts,
        "task_counts_by_status": task_counts,
        "my_tasks_count": my_tasks_count,
        "my_pending_approvals_count": my_pending_approvals,
        "recurring_tasks_count": rec_count,
        "today_logged_in_count": today_logged_in_count,
        "today_logins": today_logins,
        "task_performance": task_performance,
    }


@router.get("/performance", response_model=TaskPerformanceStats)
async def get_task_performance(
    user_id: Optional[uuid.UUID] = Query(None, description="Filter performance for a specific user"),
    branch: Optional[str] = Query(None, description="Filter performance for a specific branch"),
    department: Optional[str] = Query(None, description="Filter performance for a specific department"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get detailed task and subtask performance metrics including:
    - Task completion rate, on-time delivery rate, overdue count
    - Subtask checklist completion rate, total subtasks, pending subtasks
    - Combined overall performance score (0 - 100%)
    - Subordinate team member performance leaderboard
    """
    return await TaskService.get_performance_stats(
        session=session,
        current_user=current_user,
        user_id=user_id,
        branch=branch,
        department=department,
    )


