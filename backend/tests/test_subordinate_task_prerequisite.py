import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_subordinate_task_prerequisite_hierarchy(async_client: AsyncClient):
    """
    Test hierarchy restriction:
    If a staff didn't complete or submit for approval today's recurring task or task with today's due date,
    the team leader couldn't complete their task or submit their task for approval,
    and so on for all the top levels.
    """
    await seed_data()

    # Login helpers
    async def get_token(email: str, password: str):
        res = await async_client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert res.status_code == 200, res.text
        return res.json()["access_token"]

    sa_token = await get_token("superadmin@example.com", "SuperAdmin@123")
    incharge_token = await get_token("incharge@example.com", "InCharge@123")
    tl_token = await get_token("teamleader@example.com", "TeamLeader@123")
    staff_token = await get_token("staff1@example.com", "Staff@123")

    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    incharge_headers = {"Authorization": f"Bearer {incharge_token}"}
    tl_headers = {"Authorization": f"Bearer {tl_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Get user IDs
    tl_me = (await async_client.get("/api/v1/auth/me", headers=tl_headers)).json()
    staff_me = (await async_client.get("/api/v1/auth/me", headers=staff_headers)).json()
    incharge_me = (await async_client.get("/api/v1/auth/me", headers=incharge_headers)).json()

    tl_id = tl_me["id"]
    staff_id = staff_me["id"]
    incharge_id = incharge_me["id"]

    # 1. Staff check: Staff has no subordinates; GET /tasks/subordinates/today-status returns can_complete_or_submit: True
    staff_status = await async_client.get("/api/v1/tasks/subordinates/today-status", headers=staff_headers)
    assert staff_status.status_code == 200
    assert staff_status.json()["can_complete_or_submit"] is True

    # 2. Staff creates a task with today's due date
    now = datetime.now(timezone.utc)
    today_due = now.isoformat()

    staff_task_res = await async_client.post(
        "/api/v1/tasks",
        headers=staff_headers,
        json={
            "title": "Staff Daily Checklist Job",
            "priority": "HIGH",
            "assigned_to_id": staff_id,
            "due_date": today_due,
        },
    )
    assert staff_task_res.status_code == 201
    staff_task_id = staff_task_res.json()["id"]

    # 3. Team Leader creates a task assigned to Team Leader
    tl_task_res = await async_client.post(
        "/api/v1/tasks",
        headers=tl_headers,
        json={
            "title": "Team Leader Review Task",
            "priority": "MEDIUM",
            "assigned_to_id": tl_id,
            "due_date": today_due,
        },
    )
    assert tl_task_res.status_code == 201
    tl_task_id = tl_task_res.json()["id"]

    # 4. Check Team Leader's subordinate status: should be can_complete_or_submit: False because staff_task is PENDING
    tl_status_res = await async_client.get("/api/v1/tasks/subordinates/today-status", headers=tl_headers)
    assert tl_status_res.status_code == 200
    tl_status = tl_status_res.json()
    assert tl_status["can_complete_or_submit"] is False
    assert tl_status["pending_tasks_count"] >= 1
    assert any(p["id"] == staff_task_id for p in tl_status["pending_tasks"])

    # 5. Team Leader attempts to complete their task -> MUST FAIL with 403 Forbidden
    tl_complete_res = await async_client.patch(
        f"/api/v1/tasks/{tl_task_id}/status",
        headers=tl_headers,
        json={"status": "COMPLETED"},
    )
    assert tl_complete_res.status_code == 403
    assert "Hierarchy Restriction" in tl_complete_res.json()["detail"]
    assert "Staff Daily Checklist Job" in tl_complete_res.json()["detail"]

    # 6. Team Leader attempts to submit for approval a task requiring approval -> MUST ALSO FAIL with 403
    tl_approval_task_res = await async_client.post(
        "/api/v1/tasks",
        headers=tl_headers,
        json={
            "title": "Team Leader Approval Required Task",
            "priority": "HIGH",
            "assigned_to_id": tl_id,
            "requires_approval": True,
            "approver_id": incharge_id,
            "due_date": today_due,
        },
    )
    assert tl_approval_task_res.status_code == 201
    tl_approval_task_id = tl_approval_task_res.json()["id"]

    tl_submit_res = await async_client.post(
        f"/api/v1/approvals/{tl_approval_task_id}/submit",
        headers=tl_headers,
        json={"comments": "Ready for approval"},
    )
    assert tl_submit_res.status_code == 403
    assert "Hierarchy Restriction" in tl_submit_res.json()["detail"]

    # 7. Staff user completes their task (or submits it for approval)
    staff_complete_res = await async_client.patch(
        f"/api/v1/tasks/{staff_task_id}/status",
        headers=staff_headers,
        json={"status": "COMPLETED"},
    )
    assert staff_complete_res.status_code == 200
    assert staff_complete_res.json()["status"] == "COMPLETED"

    # 8. Now Team Leader checks status: can_complete_or_submit should now be True!
    tl_status_res2 = await async_client.get("/api/v1/tasks/subordinates/today-status", headers=tl_headers)
    assert tl_status_res2.status_code == 200
    assert tl_status_res2.json()["can_complete_or_submit"] is True

    # 9. Now Team Leader can complete their task successfully!
    tl_complete_success = await async_client.patch(
        f"/api/v1/tasks/{tl_task_id}/status",
        headers=tl_headers,
        json={"status": "COMPLETED"},
    )
    assert tl_complete_success.status_code == 200
    assert tl_complete_success.json()["status"] == "COMPLETED"

    # 10. Team Leader can also submit their approval task successfully!
    tl_submit_success = await async_client.post(
        f"/api/v1/approvals/{tl_approval_task_id}/submit",
        headers=tl_headers,
        json={"comments": "Submitted after all staff completed their tasks"},
    )
    assert tl_submit_success.status_code == 200
    assert tl_submit_success.json()["status"] == "PENDING_APPROVAL"

    # 11. In-Charge can approve Team Leader's submitted task
    incharge_approve = await async_client.post(
        f"/api/v1/approvals/{tl_approval_task_id}/decision",
        headers=incharge_headers,
        json={"action": "APPROVE", "comments": "Approved work."},
    )
    assert incharge_approve.status_code == 200
    assert incharge_approve.json()["status"] == "COMPLETED"

    # 12. Test Future Task: A task due tomorrow does NOT block Team Leader
    from datetime import timedelta
    tomorrow = (now + timedelta(days=1)).isoformat()
    staff_future_task = await async_client.post(
        "/api/v1/tasks",
        headers=staff_headers,
        json={
            "title": "Staff Tomorrow Task",
            "priority": "LOW",
            "assigned_to_id": staff_id,
            "due_date": tomorrow,
        },
    )
    assert staff_future_task.status_code == 201

    # Team Leader creates and completes another task
    tl_task2 = await async_client.post(
        "/api/v1/tasks",
        headers=tl_headers,
        json={
            "title": "Team Leader Another Task",
            "priority": "LOW",
            "assigned_to_id": tl_id,
            "due_date": today_due,
        },
    )
    assert tl_task2.status_code == 201
    tl_task2_id = tl_task2.json()["id"]

    # Since staff_future_task is due tomorrow, Team Leader is NOT blocked!
    tl_task2_complete = await async_client.patch(
        f"/api/v1/tasks/{tl_task2_id}/status",
        headers=tl_headers,
        json={"status": "COMPLETED"},
    )
    assert tl_task2_complete.status_code == 200
    assert tl_task2_complete.json()["status"] == "COMPLETED"

    # 13. Test Cascading to In-Charge and Admin:
    # If Staff has a new today task pending, In-Charge and Admin are blocked from completing their tasks!
    staff_task_today2 = await async_client.post(
        "/api/v1/tasks",
        headers=staff_headers,
        json={
            "title": "Staff Pending Task 2",
            "priority": "MEDIUM",
            "assigned_to_id": staff_id,
            "due_date": today_due,
        },
    )
    assert staff_task_today2.status_code == 201
    staff_task_today2_id = staff_task_today2.json()["id"]

    # In-Charge creates task assigned to In-Charge
    incharge_task = await async_client.post(
        "/api/v1/tasks",
        headers=incharge_headers,
        json={
            "title": "In-Charge Task",
            "priority": "HIGH",
            "assigned_to_id": incharge_id,
            "due_date": today_due,
        },
    )
    assert incharge_task.status_code == 201
    incharge_task_id = incharge_task.json()["id"]

    # In-Charge attempts to complete their task -> FAILS with 403 because Staff has pending task!
    incharge_complete_fail = await async_client.patch(
        f"/api/v1/tasks/{incharge_task_id}/status",
        headers=incharge_headers,
        json={"status": "COMPLETED"},
    )
    assert incharge_complete_fail.status_code == 403
    assert "Hierarchy Restriction" in incharge_complete_fail.json()["detail"]

    # 14. When Staff submits that task for approval (PENDING_APPROVAL), requirement is SATISFIED!
    # Update staff task to require approval and submit
    await async_client.put(
        f"/api/v1/tasks/{staff_task_today2_id}",
        headers=staff_headers,
        json={"requires_approval": True, "approver_id": tl_id},
    )
    staff_submit = await async_client.post(
        f"/api/v1/approvals/{staff_task_today2_id}/submit",
        headers=staff_headers,
        json={"comments": "Done and submitted for approval"},
    )
    assert staff_submit.status_code == 200
    assert staff_submit.json()["status"] == "PENDING_APPROVAL"

    # Now In-Charge can complete their task!
    incharge_complete_ok = await async_client.patch(
        f"/api/v1/tasks/{incharge_task_id}/status",
        headers=incharge_headers,
        json={"status": "COMPLETED"},
    )
    assert incharge_complete_ok.status_code == 200
    assert incharge_complete_ok.json()["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_mark_user_leave_and_hierarchy_exemption(async_client: AsyncClient):
    """
    Test leave provision for Admins and Super Admins:
    - Only Admins and Super Admins can mark users on leave.
    - If a staff is marked on leave, their pending tasks DO NOT restrict team leaders or top hierarchy.
    - When leave is removed, restriction applies again.
    """
    await seed_data()

    async def get_token(email: str, password: str):
        res = await async_client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert res.status_code == 200, res.text
        return res.json()["access_token"]

    sa_token = await get_token("superadmin@example.com", "SuperAdmin@123")
    admin_token = await get_token("admin@example.com", "Admin@123")
    tl_token = await get_token("teamleader@example.com", "TeamLeader@123")
    staff_token = await get_token("staff1@example.com", "Staff@123")

    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    tl_headers = {"Authorization": f"Bearer {tl_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    staff_me = (await async_client.get("/api/v1/auth/me", headers=staff_headers)).json()
    tl_me = (await async_client.get("/api/v1/auth/me", headers=tl_headers)).json()
    staff_id = staff_me["id"]
    tl_id = tl_me["id"]

    # 1. Staff cannot mark users on leave (403)
    staff_mark_res = await async_client.post(
        f"/api/v1/users/{staff_id}/leave",
        headers=staff_headers,
        json={"is_on_leave": True},
    )
    assert staff_mark_res.status_code == 403

    # 2. Team Leader cannot mark users on leave (403)
    tl_mark_res = await async_client.post(
        f"/api/v1/users/{staff_id}/leave",
        headers=tl_headers,
        json={"is_on_leave": True},
    )
    assert tl_mark_res.status_code == 403

    # 3. Staff creates a task due today
    now = datetime.now(timezone.utc)
    today_due = now.isoformat()
    today_str = now.strftime("%Y-%m-%d")

    task_res = await async_client.post(
        "/api/v1/tasks",
        headers=staff_headers,
        json={
            "title": "Staff On-Duty Task",
            "priority": "HIGH",
            "assigned_to_id": staff_id,
            "due_date": today_due,
        },
    )
    assert task_res.status_code == 201

    # Team Leader creates a task for themselves
    tl_task_res = await async_client.post(
        "/api/v1/tasks",
        headers=tl_headers,
        json={
            "title": "TL Daily Task",
            "priority": "MEDIUM",
            "assigned_to_id": tl_id,
            "due_date": today_due,
        },
    )
    assert tl_task_res.status_code == 201
    tl_task_id = tl_task_res.json()["id"]

    # Team Leader tries to complete -> blocked because staff has pending task
    tl_block = await async_client.patch(
        f"/api/v1/tasks/{tl_task_id}/status",
        headers=tl_headers,
        json={"status": "COMPLETED"},
    )
    assert tl_block.status_code == 403

    # 4. Admin marks Staff as on leave
    admin_leave_res = await async_client.post(
        f"/api/v1/users/{staff_id}/leave",
        headers=admin_headers,
        json={"is_on_leave": True, "leave_date": today_str, "leave_reason": "Medical leave"},
    )
    assert admin_leave_res.status_code == 200
    assert admin_leave_res.json()["is_on_leave"] is True
    assert admin_leave_res.json()["leave_date"] == today_str

    # 5. Check Team Leader status: now can_complete_or_submit is True because Staff is on leave!
    tl_status = await async_client.get("/api/v1/tasks/subordinates/today-status", headers=tl_headers)
    assert tl_status.status_code == 200
    assert tl_status.json()["can_complete_or_submit"] is True

    # 6. Team Leader completes task successfully!
    tl_ok = await async_client.patch(
        f"/api/v1/tasks/{tl_task_id}/status",
        headers=tl_headers,
        json={"status": "COMPLETED"},
    )
    assert tl_ok.status_code == 200
    assert tl_ok.json()["status"] == "COMPLETED"

    # 7. Super Admin unmarks Staff leave
    sa_unleave = await async_client.post(
        f"/api/v1/users/{staff_id}/leave",
        headers=sa_headers,
        json={"is_on_leave": False},
    )
    assert sa_unleave.status_code == 200
    assert sa_unleave.json()["is_on_leave"] is False


