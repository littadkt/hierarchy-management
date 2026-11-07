import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_subtasks_full_lifecycle(async_client: AsyncClient):
    await seed_data()

    # Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # 1. Create a parent task
    create_task_res = await async_client.post(
        "/api/v1/tasks/",
        headers=headers,
        json={
            "title": "Prepare Annual Financial Audit",
            "description": "Coordinate across departments for audit submission",
            "priority": "HIGH",
            "assigned_to_id": sa_login.json()["user"]["id"],
            "requires_approval": False,
        },
    )
    assert create_task_res.status_code == 201
    task = create_task_res.json()
    task_id = task["id"]

    # 2. Add Subtask 1
    create_sub1 = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={
            "title": "Collect Bank Statements",
            "description": "Download PDF and CSV from all active bank accounts",
        },
    )
    assert create_sub1.status_code == 201
    sub1 = create_sub1.json()
    assert sub1["title"] == "Collect Bank Statements"
    assert sub1["is_completed"] is False
    sub1_id = sub1["id"]

    # 3. Add Subtask 2
    create_sub2 = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={
            "title": "Reconcile Petty Cash Receipts",
            "description": "Match physical receipts against ledger records",
        },
    )
    assert create_sub2.status_code == 201
    sub2_id = create_sub2.json()["id"]

    # 4. List Subtasks
    list_subs = await async_client.get(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
    )
    assert list_subs.status_code == 200
    subs_list = list_subs.json()
    assert len(subs_list) == 2

    # 5. Toggle Subtask 1 completion
    toggle_res = await async_client.patch(
        f"/api/v1/tasks/{task_id}/subtasks/{sub1_id}/toggle",
        headers=headers,
        json={"is_completed": True},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_completed"] is True

    # 6. Edit Subtask 2 (Title & Description)
    edit_res = await async_client.put(
        f"/api/v1/tasks/{task_id}/subtasks/{sub2_id}",
        headers=headers,
        json={
            "title": "Reconcile Petty Cash Receipts (Completed Q1-Q4)",
            "description": "All receipts verified with accountant stamp",
            "is_completed": True,
        },
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["title"] == "Reconcile Petty Cash Receipts (Completed Q1-Q4)"
    assert edit_res.json()["is_completed"] is True

    # 7. Get Task Detail and verify subtasks and progress stats
    task_detail_res = await async_client.get(
        f"/api/v1/tasks/{task_id}",
        headers=headers,
    )
    assert task_detail_res.status_code == 200
    detail = task_detail_res.json()
    assert len(detail["subtasks"]) == 2
    assert detail["subtasks_count"] == 2
    assert detail["completed_subtasks_count"] == 2

    # 8. Delete Subtask 2
    del_res = await async_client.delete(
        f"/api/v1/tasks/{task_id}/subtasks/{sub2_id}",
        headers=headers,
    )
    assert del_res.status_code == 204

    # 9. Verify Subtask 2 is deleted and Task Detail reflects 1 subtask
    list_after_del = await async_client.get(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
    )
    assert list_after_del.status_code == 200
    assert len(list_after_del.json()) == 1
    assert list_after_del.json()[0]["id"] == sub1_id


@pytest.mark.asyncio
async def test_task_and_subtask_edit_delete_creator_only(async_client: AsyncClient):
    # 1. Login as Team Leader (Creator)
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    assert tl_login.status_code == 200
    tl_headers = {"Authorization": f"Bearer {tl_login.json()['access_token']}"}

    # 2. Login as Staff 1 (Assignee)
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_id = staff_login.json()["user"]["id"]
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}

    # 3. Login as Admin (Not creator)
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 4. Team Leader creates a task assigned to Staff 1
    create_task_res = await async_client.post(
        "/api/v1/tasks/",
        headers=tl_headers,
        json={
            "title": "Quarterly Store Inspection",
            "description": "Inspect inventory aisles and stock levels",
            "priority": "MEDIUM",
            "assigned_to_id": staff_id,
            "requires_approval": False,
        },
    )
    assert create_task_res.status_code == 201
    task_id = create_task_res.json()["id"]

    # 5. Team Leader adds a subtask
    create_sub_res = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=tl_headers,
        json={
            "title": "Check Aisle 4 Electronics",
            "description": "Verify barcodes and tags",
        },
    )
    assert create_sub_res.status_code == 201
    sub_id = create_sub_res.json()["id"]

    # 6. Staff1 (Assignee, not creator) attempts to EDIT parent task title -> 403 Forbidden
    staff_edit_task = await async_client.put(
        f"/api/v1/tasks/{task_id}",
        headers=staff_headers,
        json={"title": "Hacked Title by Staff"},
    )
    assert staff_edit_task.status_code == 403

    # 7. Staff1 (Assignee, not creator) attempts to DELETE parent task -> 403 Forbidden
    staff_del_task = await async_client.delete(
        f"/api/v1/tasks/{task_id}",
        headers=staff_headers,
    )
    assert staff_del_task.status_code == 403

    # 8. Staff1 (Assignee, not creator) attempts to EDIT subtask -> 403 Forbidden
    staff_edit_sub = await async_client.put(
        f"/api/v1/tasks/{task_id}/subtasks/{sub_id}",
        headers=staff_headers,
        json={"title": "Hacked Subtask Title"},
    )
    assert staff_edit_sub.status_code == 403

    # 9. Staff1 (Assignee, not creator) attempts to DELETE subtask -> 403 Forbidden
    staff_del_sub = await async_client.delete(
        f"/api/v1/tasks/{task_id}/subtasks/{sub_id}",
        headers=staff_headers,
    )
    assert staff_del_sub.status_code == 403

    # 10. Staff1 CAN toggle subtask completion -> 200 OK
    staff_toggle_sub = await async_client.patch(
        f"/api/v1/tasks/{task_id}/subtasks/{sub_id}/toggle",
        headers=staff_headers,
        json={"is_completed": True},
    )
    assert staff_toggle_sub.status_code == 200
    assert staff_toggle_sub.json()["is_completed"] is True

    # 11. Admin (Not creator) attempts to edit or delete task -> 403 Forbidden
    admin_edit_task = await async_client.put(
        f"/api/v1/tasks/{task_id}",
        headers=admin_headers,
        json={"title": "Admin Trying to Edit Non-Created Task"},
    )
    assert admin_edit_task.status_code == 403

    admin_del_task = await async_client.delete(
        f"/api/v1/tasks/{task_id}",
        headers=admin_headers,
    )
    assert admin_del_task.status_code == 403

    # 12. Team Leader (The Creator) CAN edit the task -> 200 OK
    tl_edit_task = await async_client.put(
        f"/api/v1/tasks/{task_id}",
        headers=tl_headers,
        json={"title": "Quarterly Store Inspection - Updated by TL"},
    )
    assert tl_edit_task.status_code == 200
    assert tl_edit_task.json()["title"] == "Quarterly Store Inspection - Updated by TL"

    # 13. Team Leader (The Creator) CAN edit the subtask -> 200 OK
    tl_edit_sub = await async_client.put(
        f"/api/v1/tasks/{task_id}/subtasks/{sub_id}",
        headers=tl_headers,
        json={"title": "Check Aisle 4 Electronics - Verified by TL"},
    )
    assert tl_edit_sub.status_code == 200
    assert tl_edit_sub.json()["title"] == "Check Aisle 4 Electronics - Verified by TL"

    # 14. Team Leader (The Creator) CAN delete the subtask -> 204 No Content
    tl_del_sub = await async_client.delete(
        f"/api/v1/tasks/{task_id}/subtasks/{sub_id}",
        headers=tl_headers,
    )
    assert tl_del_sub.status_code == 204

    # 15. Team Leader (The Creator) CAN delete the task -> 204 No Content
    tl_del_task = await async_client.delete(
        f"/api/v1/tasks/{task_id}",
        headers=tl_headers,
    )
    assert tl_del_task.status_code == 204


