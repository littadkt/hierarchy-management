import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data
from app.db.session import AsyncSessionLocal
from app.services.task_service import TaskService
from app.models.task import Task, RecurrencePattern, TaskStatus
from app.models.attendance import Attendance, AttendanceStatus
from sqlalchemy import select


@pytest.mark.asyncio
async def test_recurring_task_not_created_on_leave_day(async_client: AsyncClient):
    """
    Verify:
    1. If a user is on leave on a day, recurring tasks are NOT created/assigned for that user on that day.
    2. If a recurring task was pre-spawned and the user is marked on leave for that day,
       the pending recurring task for that day is automatically cleaned up.
    3. Unmarking leave allows subsequent recurring tasks to be created normally.
    """
    await seed_data()

    # Login as Super Admin and Staff 1
    sa_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_res.status_code == 200
    sa_headers = {"Authorization": f"Bearer {sa_res.json()['access_token']}"}

    staff_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_res.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_res.json()['access_token']}"}
    staff_me = (await async_client.get("/api/v1/auth/me", headers=staff_headers)).json()
    staff1_id = staff_me["id"]

    local_now = datetime.now().astimezone()
    today_str = local_now.strftime("%Y-%m-%d")
    tomorrow_str = (local_now + timedelta(days=1)).strftime("%Y-%m-%d")

    # Step 1: Mark Staff 1 on leave for TODAY
    leave_res = await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": True, "leave_date": today_str, "leave_reason": "Flu and fever"},
        headers=sa_headers,
    )
    assert leave_res.status_code == 200
    assert leave_res.json()["is_on_leave"] is True
    assert leave_res.json()["leave_date"] == today_str

    # Step 2: Create a daily recurring task assigned to Staff 1
    # Because Staff 1 is on leave today, the initial task due_date should NOT be today!
    create_rec_res = await async_client.post(
        "/api/v1/tasks/",
        json={
            "title": "Daily Health Check & Ops",
            "priority": "HIGH",
            "assigned_to_id": staff1_id,
            "requires_approval": False,
            "is_recurring": True,
            "recurrence_pattern": "DAILY",
            "recurrence_interval": 1,
        },
        headers=sa_headers,
    )
    assert create_rec_res.status_code == 201
    created_rec = create_rec_res.json()
    rec_due = created_rec.get("due_date")
    assert rec_due is not None
    rec_due_date_str = rec_due[:10]
    # It must NOT be today's date because Staff 1 is on leave today!
    assert rec_due_date_str != today_str, f"Recurring task due date {rec_due_date_str} should not be today ({today_str})"

    # Step 3: Call spawn_due_recurring_tasks explicitly
    async with AsyncSessionLocal() as session:
        spawned = await TaskService.spawn_due_recurring_tasks(session)

    # Verify that NO task instance exists for Staff 1 with due date today
    tasks_today_res = await async_client.get(
        "/api/v1/tasks/?due_date_scope=today",
        headers=staff_headers,
    )
    assert tasks_today_res.status_code == 200
    today_tasks = [t for t in tasks_today_res.json()["items"] if t["assigned_to_id"] == staff1_id]
    # Staff 1 should have NO recurring task for today
    rec_today = [t for t in today_tasks if t.get("is_recurring")]
    assert len(rec_today) == 0, f"Expected 0 recurring tasks for Staff 1 today, found: {rec_today}"

    # Step 4: Test pre-spawned upcoming task cleanup when marked on leave
    # Unmark leave first
    unleave_res = await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": False},
        headers=sa_headers,
    )
    assert unleave_res.status_code == 200
    assert unleave_res.json()["is_on_leave"] is False

    # Spawn recurring tasks now that user is off leave
    async with AsyncSessionLocal() as session:
        await TaskService.spawn_due_recurring_tasks(session)

    # Staff 1 now gets a task for today
    tasks_now_res = await async_client.get(
        "/api/v1/tasks/?due_date_scope=today",
        headers=staff_headers,
    )
    assert tasks_now_res.status_code == 200
    today_tasks_after = [t for t in tasks_now_res.json()["items"] if t["assigned_to_id"] == staff1_id and t.get("is_recurring")]
    assert len(today_tasks_after) >= 1, "Expected recurring task for today after unmarking leave"

    # Now mark Staff 1 on leave for today again: the pending task for today should be cleaned up!
    releave_res = await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": True, "leave_date": today_str, "leave_reason": "Emergency leave"},
        headers=sa_headers,
    )
    assert releave_res.status_code == 200

    # Verify task for today was cleaned up
    tasks_cleaned_res = await async_client.get(
        "/api/v1/tasks/?due_date_scope=today",
        headers=staff_headers,
    )
    assert tasks_cleaned_res.status_code == 200
    today_tasks_cleaned = [t for t in tasks_cleaned_res.json()["items"] if t["assigned_to_id"] == staff1_id and t.get("is_recurring")]
    assert len(today_tasks_cleaned) == 0, f"Expected pending recurring task for today to be removed upon leave, but found: {today_tasks_cleaned}"

    # Clean up leave status and test tasks at the end
    await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": False},
        headers=sa_headers,
    )
    async with AsyncSessionLocal() as session:
        t_stmt = select(Task).where(Task.title.ilike("%Daily Health Check%"))
        for t in (await session.execute(t_stmt)).scalars().all():
            await session.delete(t)
        await session.commit()


@pytest.mark.asyncio
async def test_recurring_task_skips_leave_day_for_specific_user_while_active_user_receives_task(async_client: AsyncClient):
    """
    Test:
    - User A (staff1) is on leave.
    - User B (teamleader) is NOT on leave.
    - Recurring template exists for User A with past due_date (due for today).
    - Recurring template exists for User B with past due_date (due for today).
    - When spawn_due_recurring_tasks runs:
      User A does NOT get a task for today.
      User B DOES get a task for today.
    """
    await seed_data()

    # Login as Super Admin
    sa_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    sa_headers = {"Authorization": f"Bearer {sa_res.json()['access_token']}"}

    # Staff 1
    staff_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff1_id = staff_res.json()["user"]["id"]

    # Team Leader
    tl_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    tl_id = tl_res.json()["user"]["id"]

    local_now = datetime.now().astimezone()
    today_str = local_now.strftime("%Y-%m-%d")
    yesterday = local_now - timedelta(days=2)

    # 1. Create root templates in DB with past due date (2 days ago)
    async with AsyncSessionLocal() as session:
        t_user_a = Task(
            title="User A Daily Checklist",
            priority="MEDIUM",
            status=TaskStatus.COMPLETED,
            due_date=yesterday,
            created_by_id=sa_res.json()["user"]["id"],
            assigned_to_id=staff1_id,
            is_recurring=True,
            recurrence_pattern=RecurrencePattern.DAILY,
            recurrence_interval=1,
            parent_task_id=None,
        )
        t_user_b = Task(
            title="User B Daily Checklist",
            priority="MEDIUM",
            status=TaskStatus.COMPLETED,
            due_date=yesterday,
            created_by_id=sa_res.json()["user"]["id"],
            assigned_to_id=tl_id,
            is_recurring=True,
            recurrence_pattern=RecurrencePattern.DAILY,
            recurrence_interval=1,
            parent_task_id=None,
        )
        session.add(t_user_a)
        session.add(t_user_b)
        await session.commit()
        t_user_a_id = t_user_a.id
        t_user_b_id = t_user_b.id

    # 2. Mark User A on leave for today; User B is not on leave
    leave_res = await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": True, "leave_date": today_str, "leave_reason": "Personal Leave"},
        headers=sa_headers,
    )
    assert leave_res.status_code == 200

    # 3. Trigger spawn_due_recurring_tasks
    async with AsyncSessionLocal() as session:
        spawned = await TaskService.spawn_due_recurring_tasks(session)

    # 4. Verify in DB
    async with AsyncSessionLocal() as session:
        # Check User A child instances for today
        stmt_a = select(Task).where(
            Task.parent_task_id == t_user_a_id,
            Task.assigned_to_id == staff1_id,
        )
        children_a = (await session.execute(stmt_a)).scalars().all()
        # Verify no instance for today
        for ch in children_a:
            if ch.due_date:
                assert ch.due_date.astimezone(local_now.tzinfo).strftime("%Y-%m-%d") != today_str, (
                    f"User A was on leave today ({today_str}) but got child instance with due_date {ch.due_date}"
                )

        # Check User B child instances for today
        stmt_b = select(Task).where(
            Task.parent_task_id == t_user_b_id,
            Task.assigned_to_id == tl_id,
        )
        children_b = (await session.execute(stmt_b)).scalars().all()
        b_today_instances = [
            ch for ch in children_b
            if ch.due_date and ch.due_date.astimezone(local_now.tzinfo).strftime("%Y-%m-%d") == today_str
        ]
        assert len(b_today_instances) >= 1, "User B is not on leave, so their recurring task for today should have spawned!"

    # 5. Clean up leave for staff 1 and clean up test tasks
    await async_client.post(
        f"/api/v1/users/{staff1_id}/leave",
        json={"is_on_leave": False},
        headers=sa_headers,
    )
    async with AsyncSessionLocal() as session:
        t_stmt = select(Task).where(Task.title.in_(["User A Daily Checklist", "User B Daily Checklist"]))
        for t in (await session.execute(t_stmt)).scalars().all():
            await session.delete(t)
        await session.commit()

