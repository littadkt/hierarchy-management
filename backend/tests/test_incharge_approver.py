import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_incharge_eligible_approver_flow(async_client: AsyncClient):
    """
    Test suite for In-Charge Eligible Approver:
    1. Staff taking approval can see:
       - Team Leader (same dept/branch)
       - In-Charge (same branch/dept/reporting line)
       - Admin (same branch)
       - Super Admin
    2. Team Leader taking approval can see:
       - In-Charge (same branch/dept/reporting line)
       - Admin (same branch)
       - Super Admin
    3. Tasks requiring approval can designate In-Charge, and In-Charge can approve them.
    """
    await seed_data()

    # 1. Login Accounts
    # Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # Admin (Kochi Branch)
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    admin_id = admin_login.json()["user"]["id"]

    # In-Charge (Kochi Branch, Operations Dept)
    incharge_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge@example.com", "password": "InCharge@123"},
    )
    assert incharge_login.status_code == 200
    incharge_headers = {"Authorization": f"Bearer {incharge_login.json()['access_token']}"}
    incharge_id = incharge_login.json()["user"]["id"]

    # Team Leader (Kochi Branch, Engineering Dept)
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    assert tl_login.status_code == 200
    tl_headers = {"Authorization": f"Bearer {tl_login.json()['access_token']}"}
    tl_id = tl_login.json()["user"]["id"]

    # Staff 1 (Kochi Branch, Engineering Dept, reports to Team Leader)
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}
    staff_id = staff_login.json()["user"]["id"]

    # --- TEST 1: STAFF ELIGIBLE APPROVERS INCLUDES IN-CHARGE ---
    staff_approvers_res = await async_client.get(
        f"/api/v1/users/eligible-approvers?for_user_id={staff_id}",
        headers=staff_headers,
    )
    assert staff_approvers_res.status_code == 200
    staff_approvers = staff_approvers_res.json()
    staff_approver_roles = {a["role"] for a in staff_approvers}
    staff_approver_ids = {a["id"] for a in staff_approvers}

    # Must contain Team Leader, In-Charge, Admin, Super Admin
    assert "TEAM_LEADER" in staff_approver_roles
    assert "IN_CHARGE" in staff_approver_roles
    assert "ADMIN" in staff_approver_roles
    assert "SUPER_ADMIN" in staff_approver_roles
    assert incharge_id in staff_approver_ids
    assert tl_id in staff_approver_ids
    assert admin_id in staff_approver_ids

    # --- TEST 2: TEAM LEADER ELIGIBLE APPROVERS INCLUDES IN-CHARGE ---
    tl_approvers_res = await async_client.get(
        f"/api/v1/users/eligible-approvers?for_user_id={tl_id}",
        headers=tl_headers,
    )
    assert tl_approvers_res.status_code == 200
    tl_approvers = tl_approvers_res.json()
    tl_approver_roles = {a["role"] for a in tl_approvers}
    tl_approver_ids = {a["id"] for a in tl_approvers}

    # Must contain In-Charge, Admin, Super Admin (no Team Leader)
    assert "IN_CHARGE" in tl_approver_roles
    assert "ADMIN" in tl_approver_roles
    assert "SUPER_ADMIN" in tl_approver_roles
    assert "TEAM_LEADER" not in tl_approver_roles
    assert incharge_id in tl_approver_ids
    assert admin_id in tl_approver_ids

    # --- TEST 3: TEAM LEADER CREATES TASK REQUIRING IN-CHARGE APPROVAL ---
    tl_task_payload = {
        "title": "Engineering Roadmap Review",
        "description": "Requires sign-off from branch In-Charge",
        "assigned_to_id": tl_id,
        "requires_approval": True,
        "approver_id": incharge_id,
        "priority": "HIGH",
    }
    create_task_res = await async_client.post(
        "/api/v1/tasks",
        json=tl_task_payload,
        headers=tl_headers,
    )
    assert create_task_res.status_code == 201
    task_data = create_task_res.json()
    assert task_data["approver_id"] == incharge_id
    assert task_data["status"] == "PENDING"
    task_id = task_data["id"]

    # Complete task to move to PENDING_APPROVAL
    update_status_res = await async_client.patch(
        f"/api/v1/tasks/{task_id}/status",
        json={"status": "PENDING_APPROVAL"},
        headers=tl_headers,
    )
    assert update_status_res.status_code == 200
    assert update_status_res.json()["status"] == "PENDING_APPROVAL"

    # In-Charge approves the task
    approve_res = await async_client.post(
        f"/api/v1/approvals/{task_id}/decision",
        json={"action": "APPROVE", "comment": "Approved by In-Charge."},
        headers=incharge_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "COMPLETED"
