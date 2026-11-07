import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_full_hierarchy_and_permissions_workflow(async_client: AsyncClient):
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200, sa_login.text
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Super Admin creates Admin
    admin_payload = {
        "email": "admin_test@example.com",
        "full_name": "Regional Admin",
        "password": "Password123!",
        "role": "ADMIN",
    }
    create_admin_res = await async_client.post("/api/v1/users/", json=admin_payload, headers=sa_headers)
    assert create_admin_res.status_code == 201, create_admin_res.text
    admin_id = create_admin_res.json()["id"]

    # Admin logins
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin_test@example.com", "password": "Password123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Admin creates In-charge
    incharge_payload = {
        "email": "incharge_test@example.com",
        "full_name": "Operations In-charge",
        "password": "Password123!",
        "role": "IN_CHARGE",
    }
    create_incharge_res = await async_client.post("/api/v1/users/", json=incharge_payload, headers=admin_headers)
    assert create_incharge_res.status_code == 201, create_incharge_res.text
    incharge_id = create_incharge_res.json()["id"]

    # 4. RESTRICTION: Admin CANNOT create Staff directly (only In-charge)
    forbidden_staff = {
        "email": "illegal_staff@example.com",
        "full_name": "Illegal Staff",
        "password": "Password123!",
        "role": "STAFF",
    }
    admin_create_staff_res = await async_client.post("/api/v1/users/", json=forbidden_staff, headers=admin_headers)
    assert admin_create_staff_res.status_code == 403, "Admin should be restricted from creating Staff directly"

    # In-charge logins
    incharge_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge_test@example.com", "password": "Password123!"},
    )
    assert incharge_login.status_code == 200
    incharge_token = incharge_login.json()["access_token"]
    incharge_headers = {"Authorization": f"Bearer {incharge_token}"}

    # 5. In-charge creates Team Leader and Staff
    tl_payload = {
        "email": "tl_test@example.com",
        "full_name": "Sprint Team Leader",
        "password": "Password123!",
        "role": "TEAM_LEADER",
    }
    create_tl_res = await async_client.post("/api/v1/users/", json=tl_payload, headers=incharge_headers)
    assert create_tl_res.status_code == 201
    tl_id = create_tl_res.json()["id"]

    staff1_payload = {
        "email": "staff1_test@example.com",
        "full_name": "Frontend Staff",
        "password": "Password123!",
        "role": "STAFF",
    }
    create_staff1_res = await async_client.post("/api/v1/users/", json=staff1_payload, headers=incharge_headers)
    assert create_staff1_res.status_code == 201
    staff1_id = create_staff1_res.json()["id"]

    # 6. RESTRICTION: In-charge CANNOT create Admin
    forbidden_admin = {
        "email": "illegal_admin@example.com",
        "full_name": "Illegal Admin",
        "password": "Password123!",
        "role": "ADMIN",
    }
    incharge_create_admin_res = await async_client.post("/api/v1/users/", json=forbidden_admin, headers=incharge_headers)
    assert incharge_create_admin_res.status_code == 403, "In-charge should be restricted from creating Admin"

    # Team Leader logins
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "tl_test@example.com", "password": "Password123!"},
    )
    assert tl_login.status_code == 200
    tl_token = tl_login.json()["access_token"]
    tl_headers = {"Authorization": f"Bearer {tl_token}"}

    # 7. Team Leader creates Staff
    staff2_payload = {
        "email": "staff2_test@example.com",
        "full_name": "Backend Staff",
        "password": "Password123!",
        "role": "STAFF",
    }
    create_staff2_res = await async_client.post("/api/v1/users/", json=staff2_payload, headers=tl_headers)
    assert create_staff2_res.status_code == 201
    staff2_id = create_staff2_res.json()["id"]

    # 8. RESTRICTION: Team Leader CANNOT create Team Leader or In-charge
    forbidden_tl = {
        "email": "illegal_tl@example.com",
        "full_name": "Illegal TL",
        "password": "Password123!",
        "role": "TEAM_LEADER",
    }
    tl_create_tl_res = await async_client.post("/api/v1/users/", json=forbidden_tl, headers=tl_headers)
    assert tl_create_tl_res.status_code == 403

    # Staff logins
    staff1_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1_test@example.com", "password": "Password123!"},
    )
    assert staff1_login.status_code == 200
    staff1_token = staff1_login.json()["access_token"]
    staff1_headers = {"Authorization": f"Bearer {staff1_token}"}

    # 9. RESTRICTION: Staff CANNOT create any user
    staff_create_user_res = await async_client.post("/api/v1/users/", json=forbidden_staff, headers=staff1_headers)
    assert staff_create_user_res.status_code == 403

    # 10. RESTRICTION: User Deletion protections
    # Admin CANNOT delete In-charge
    del_incharge_res = await async_client.delete(f"/api/v1/users/{incharge_id}", headers=admin_headers)
    assert del_incharge_res.status_code == 403, "Admin must be restricted from deleting In-charge"

    # In-charge CANNOT delete Team Leader
    del_tl_res = await async_client.delete(f"/api/v1/users/{tl_id}", headers=incharge_headers)
    assert del_tl_res.status_code == 403, "In-charge must be restricted from deleting Team Leader"

    # Team Leader CANNOT delete Staff
    del_staff_res = await async_client.delete(f"/api/v1/users/{staff2_id}", headers=tl_headers)
    assert del_staff_res.status_code == 403, "Team Leader must be restricted from deleting Staff"

    # 11. TASK CREATION & ASSIGNMENT RULES
    # Team Leader assigns task to Staff1
    tl_task_payload = {
        "title": "Build Authentication Flow",
        "description": "Implement JWT and role checks",
        "priority": "HIGH",
        "assigned_to_id": staff1_id,
        "requires_approval": True,
        "approver_id": tl_id,
        "is_recurring": False,
    }
    create_tl_task_res = await async_client.post("/api/v1/tasks/", json=tl_task_payload, headers=tl_headers)
    assert create_tl_task_res.status_code == 201, create_tl_task_res.text
    task1_id = create_tl_task_res.json()["id"]

    # Staff CANNOT assign task to someone else (only self)
    staff_illegal_assign = {
        "title": "Staff trying to assign to TL",
        "assigned_to_id": tl_id,
        "requires_approval": False,
    }
    staff_assign_res = await async_client.post("/api/v1/tasks/", json=staff_illegal_assign, headers=staff1_headers)
    assert staff_assign_res.status_code == 403

    # Staff creates own task (allowed)
    staff_own_task = {
        "title": "Staff self note task",
        "assigned_to_id": staff1_id,
        "requires_approval": False,
    }
    staff_own_res = await async_client.post("/api/v1/tasks/", json=staff_own_task, headers=staff1_headers)
    assert staff_own_res.status_code == 201

    # 12. TASK EDIT / DELETE RESTRICTIONS
    # In-charge creates task for self
    incharge_task_payload = {
        "title": "Quarterly Operations Review",
        "assigned_to_id": incharge_id,
        "requires_approval": False,
    }
    incharge_task_res = await async_client.post("/api/v1/tasks/", json=incharge_task_payload, headers=incharge_headers)
    assert incharge_task_res.status_code == 201
    incharge_task_id = incharge_task_res.json()["id"]

    # RESTRICTION: Admin CANNOT edit or delete In-charge's tasks
    admin_edit_incharge_task = await async_client.put(
        f"/api/v1/tasks/{incharge_task_id}",
        json={"title": "Admin hacked in-charge task"},
        headers=admin_headers,
    )
    assert admin_edit_incharge_task.status_code == 403, "Admin should be restricted from editing In-charge's task"

    admin_del_incharge_task = await async_client.delete(
        f"/api/v1/tasks/{incharge_task_id}",
        headers=admin_headers,
    )
    assert admin_del_incharge_task.status_code == 403, "Admin should be restricted from deleting In-charge's task"

    # RESTRICTION: In-charge CANNOT edit or delete Team Leader's task
    incharge_edit_tl_task = await async_client.put(
        f"/api/v1/tasks/{task1_id}",
        json={"title": "Incharge hacked TL task"},
        headers=incharge_headers,
    )
    assert incharge_edit_tl_task.status_code == 403, "In-charge should be restricted from editing Team Leader's task"

    # RESTRICTION: Team Leader CANNOT update or delete Staff's task
    staff_task_id = staff_own_res.json()["id"]
    tl_edit_staff_task = await async_client.put(
        f"/api/v1/tasks/{staff_task_id}",
        json={"title": "TL hacked staff task"},
        headers=tl_headers,
    )
    assert tl_edit_staff_task.status_code == 403, "Team Leader should be restricted from updating Staff's task"

    # 13. APPROVAL WORKFLOW & STATUS CLOSE RESTRICTION
    # Staff1 tries to directly mark task1 as COMPLETED when it requires higher-level approval:
    illegal_close_res = await async_client.patch(
        f"/api/v1/tasks/{task1_id}/status",
        json={"status": "COMPLETED"},
        headers=staff1_headers,
    )
    assert illegal_close_res.status_code == 403, "Staff must be restricted from closing task when higher-level approval required"

    # Staff1 submits task1 for approval
    submit_res = await async_client.post(
        f"/api/v1/approvals/{task1_id}/submit",
        json={"comments": "Done with unit tests and code review."},
        headers=staff1_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "PENDING_APPROVAL"

    # Team Leader checks pending approvals
    pending_approvals_res = await async_client.get("/api/v1/approvals/pending", headers=tl_headers)
    assert pending_approvals_res.status_code == 200
    pending_ids = [t["id"] for t in pending_approvals_res.json()]
    assert task1_id in pending_ids

    # Team Leader approves the task
    approve_res = await async_client.post(
        f"/api/v1/approvals/{task1_id}/decision",
        json={"action": "APPROVE", "comments": "Approved. Great job!"},
        headers=tl_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "COMPLETED"

    # 14. RECURRING TASK CREATION & SPAWN
    recurring_task_payload = {
        "title": "Daily Standup & Sync Task",
        "priority": "MEDIUM",
        "assigned_to_id": staff1_id,
        "requires_approval": False,
        "is_recurring": True,
        "recurrence_pattern": "DAILY",
        "recurrence_interval": 1,
    }
    rec_res = await async_client.post("/api/v1/tasks/", json=recurring_task_payload, headers=sa_headers)
    assert rec_res.status_code == 201
    rec_task_id = rec_res.json()["id"]

    # Close recurring task -> next instance spawns
    close_rec_res = await async_client.patch(
        f"/api/v1/tasks/{rec_task_id}/status",
        json={"status": "COMPLETED"},
        headers=sa_headers,
    )
    assert close_rec_res.status_code == 200

    # Verify spawned child task instance
    all_rec_tasks = await async_client.get("/api/v1/tasks/?search=Daily Standup", headers=sa_headers)
    assert all_rec_tasks.status_code == 200
    items = all_rec_tasks.json()["items"]
    assert len(items) >= 2, "Expected new recurrence instance to be generated"

    # 15. HIERARCHY OVERVIEW FOR SUPER ADMIN
    overview_res = await async_client.get("/api/v1/hierarchy/overview", headers=sa_headers)
    assert overview_res.status_code == 200
    overview_data = overview_res.json()
    assert len(overview_data) >= 5
    for user_entry in overview_data:
        assert "task_stats" in user_entry
        assert "total_assigned" in user_entry["task_stats"]

    # 16. DASHBOARD STATS
    stats_res = await async_client.get("/api/v1/stats/dashboard", headers=sa_headers)
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert "user_counts_by_role" in stats_data
    assert "task_counts_by_status" in stats_data


@pytest.mark.asyncio
async def test_comments_and_rejection_workflow(async_client: AsyncClient):
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    sa_headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # Login as Team Leader and Staff
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "tl_test@example.com", "password": "Password123!"},
    )
    tl_headers = {"Authorization": f"Bearer {tl_login.json()['access_token']}"}
    tl_id = tl_login.json()["user"]["id"]

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1_test@example.com", "password": "Password123!"},
    )
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}
    staff_id = staff_login.json()["user"]["id"]

    # 2. Check eligible approvers for Staff1
    approvers_res = await async_client.get(f"/api/v1/users/eligible-approvers?for_user_id={staff_id}", headers=tl_headers)
    assert approvers_res.status_code == 200
    approver_roles = [u["role"] for u in approvers_res.json()]
    # Every eligible approver must have higher authority than STAFF
    assert "STAFF" not in approver_roles
    assert any(r in ["TEAM_LEADER", "IN_CHARGE", "ADMIN", "SUPER_ADMIN"] for r in approver_roles)

    # 3. Create task with approval required
    task_payload = {
        "title": "API Documentation & Validation",
        "description": "Write OpenAPI schemas and test coverage",
        "priority": "MEDIUM",
        "assigned_to_id": staff_id,
        "requires_approval": True,
        "approver_id": tl_id,
        "is_recurring": False,
    }
    create_res = await async_client.post("/api/v1/tasks/", json=task_payload, headers=tl_headers)
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    # 4. Add comment to task
    comment_res = await async_client.post(
        f"/api/v1/tasks/{task_id}/comments",
        json={"content": "I have completed initial draft of endpoints."},
        headers=staff_headers,
    )
    assert comment_res.status_code == 201
    assert comment_res.json()["content"] == "I have completed initial draft of endpoints."

    # 5. Submit for approval
    submit_res = await async_client.post(
        f"/api/v1/approvals/{task_id}/submit",
        json={"comments": "Ready for initial review."},
        headers=staff_headers,
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "PENDING_APPROVAL"

    # 6. Team Leader REJECTS with feedback
    reject_res = await async_client.post(
        f"/api/v1/approvals/{task_id}/decision",
        json={"action": "REJECT", "comments": "Please add test cases for edge cases."},
        headers=tl_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "IN_PROGRESS"

    # 7. Verify comments contain rejection feedback
    comments_list = await async_client.get(f"/api/v1/tasks/{task_id}/comments", headers=staff_headers)
    assert comments_list.status_code == 200
    contents = [c["content"] for c in comments_list.json()]
    assert any("[Rejected]" in c for c in contents)

    # 8. Check audit activities
    activities_list = await async_client.get(f"/api/v1/tasks/{task_id}/activities", headers=staff_headers)
    assert activities_list.status_code == 200
    actions = [a["action"] for a in activities_list.json()]
    assert "CREATED" in actions
    assert "APPROVAL_REQUESTED" in actions
    assert "REJECTED" in actions

