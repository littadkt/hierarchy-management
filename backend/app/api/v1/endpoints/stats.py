from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.task import Task, TaskStatus
from app.models.user import Role, User

router = APIRouter()


class DashboardStats(BaseModel):
    user_counts_by_role: Dict[str, int]
    task_counts_by_status: Dict[str, int]
    my_tasks_count: int
    my_pending_approvals_count: int
    recurring_tasks_count: int
    today_logged_in_count: int = 0
    today_logins: List[Dict[str, Any]] = []


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

    # 6. Today's login stats for Super Admin and Admin
    now = datetime.now(timezone.utc)
    today_str = now.astimezone().strftime("%Y-%m-%d")
    today_utc_str = now.strftime("%Y-%m-%d")
    today_logins = []
    today_logged_in_count = 0

    if current_user.role in [Role.SUPER_ADMIN, Role.ADMIN]:
        logins_stmt = (
            select(User)
            .where(User.today_first_login_date.in_([today_str, today_utc_str]))
            .order_by(desc(User.today_first_login_at))
        )
        if current_user.role == Role.ADMIN:
            logins_stmt = logins_stmt.where(User.role != Role.SUPER_ADMIN)
        logins_res = await session.execute(logins_stmt)
        login_users = logins_res.scalars().all()
        today_logged_in_count = len(login_users)
        for u in login_users:
            effective_time = UserService.get_effective_today_first_login(u)
            today_logins.append({
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role.value,
                "branch": u.branch,
                "department": u.department,
                "today_first_login_at": effective_time.isoformat() if effective_time else (u.today_first_login_at.isoformat() if u.today_first_login_at else None),
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            })

    return {
        "user_counts_by_role": user_counts,
        "task_counts_by_status": task_counts,
        "my_tasks_count": my_tasks_count,
        "my_pending_approvals_count": my_pending_approvals,
        "recurring_tasks_count": rec_count,
        "today_logged_in_count": today_logged_in_count,
        "today_logins": today_logins,
    }

