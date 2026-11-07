import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_branch_and_department_hierarchy_and_approval_scoping(async_client: AsyncClient):
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200, sa_login.text
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Create Two Admins for Two Branches: "Kochi" and "Calicut"
    admin_kochi_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "admin_kochi@example.com",
            "full_name": "Kochi Admin",
            "password": "Password123!",
            "role": "ADMIN",
            "branch": "Kochi",
        },
        headers=sa_headers,
    )
    assert admin_kochi_res.status_code == 201, admin_kochi_res.text
    admin_kochi_id = admin_kochi_res.json()["id"]
    assert admin_kochi_res.json()["branch"] == "Kochi"

    admin_calicut_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "admin_calicut@example.com",
            "full_name": "Calicut Admin",
            "password": "Password123!",
            "role": "ADMIN",
            "branch": "Calicut",
        },
        headers=sa_headers,
    )
    assert admin_calicut_res.status_code == 201, admin_calicut_res.text
    admin_calicut_id = admin_calicut_res.json()["id"]
    assert admin_calicut_res.json()["branch"] == "Calicut"

    # 3. Test Updating Admin branch via edit endpoint
    update_admin_res = await async_client.put(
        f"/api/v1/users/{admin_kochi_id}",
        json={"branch": "Kochi Main Branch"},
        headers=sa_headers,
    )
    assert update_admin_res.status_code == 200
    assert update_admin_res.json()["branch"] == "Kochi Main Branch"

    # Set it back to Kochi for clean matching
    await async_client.put(
        f"/api/v1/users/{admin_kochi_id}",
        json={"branch": "Kochi"},
        headers=sa_headers,
    )

    # 4. Login as Kochi Admin to create In-Charges in different departments: "Accounts" and "Logistics"
    admin_kochi_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin_kochi@example.com", "password": "Password123!"},
    )
    assert admin_kochi_login.status_code == 200
    admin_kochi_headers = {"Authorization": f"Bearer {admin_kochi_login.json()['access_token']}"}

    # In-Charge 1: Kochi branch, Accounts department
    incharge_acc_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "incharge_acc@example.com",
            "full_name": "Accounts In-Charge",
            "password": "Password123!",
            "role": "IN_CHARGE",
            "department": "Accounts",
            "branch": "Kochi",
        },
        headers=admin_kochi_headers,
    )
    assert incharge_acc_res.status_code == 201, incharge_acc_res.text
    incharge_acc_id = incharge_acc_res.json()["id"]
    assert incharge_acc_res.json()["department"] == "Accounts"
    assert incharge_acc_res.json()["branch"] == "Kochi"

    # In-Charge 2: Kochi branch, Logistics department
    incharge_log_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "incharge_log@example.com",
            "full_name": "Logistics In-Charge",
            "password": "Password123!",
            "role": "IN_CHARGE",
            "department": "Logistics",
            "branch": "Kochi",
        },
        headers=admin_kochi_headers,
    )
    assert incharge_log_res.status_code == 201
    incharge_log_id = incharge_log_res.json()["id"]

    # 5. Test Updating In-Charge department
    update_incharge_res = await async_client.put(
        f"/api/v1/users/{incharge_acc_id}",
        json={"department": "Finance & Accounts"},
        headers=sa_headers,
    )
    assert update_incharge_res.status_code == 200
    assert update_incharge_res.json()["department"] == "Finance & Accounts"

    # Revert to Accounts
    await async_client.put(
        f"/api/v1/users/{incharge_acc_id}",
        json={"department": "Accounts"},
        headers=sa_headers,
    )

    # 6. In-Charge (Accounts) creates Team Leaders:
    # Team Leader 1: Accounts department, Kochi branch
    incharge_acc_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge_acc@example.com", "password": "Password123!"},
    )
    assert incharge_acc_login.status_code == 200
    incharge_acc_headers = {"Authorization": f"Bearer {incharge_acc_login.json()['access_token']}"}

    tl_acc_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "tl_acc@example.com",
            "full_name": "Accounts Team Leader",
            "password": "Password123!",
            "role": "TEAM_LEADER",
            "department": "Accounts",
            "branch": "Kochi",
        },
        headers=incharge_acc_headers,
    )
    assert tl_acc_res.status_code == 201
    tl_acc_id = tl_acc_res.json()["id"]

    # Team Leader 2: Logistics department, Kochi branch (created under Logistics In-charge)
    incharge_log_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge_log@example.com", "password": "Password123!"},
    )
    assert incharge_log_login.status_code == 200
    incharge_log_headers = {"Authorization": f"Bearer {incharge_log_login.json()['access_token']}"}

    tl_log_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "tl_log@example.com",
            "full_name": "Logistics Team Leader",
            "password": "Password123!",
            "role": "TEAM_LEADER",
            "department": "Logistics",
            "branch": "Kochi",
        },
        headers=incharge_log_headers,
    )
    assert tl_log_res.status_code == 201
    tl_log_id = tl_log_res.json()["id"]

    # 7. Create Staff Member under Accounts Department at Kochi Branch
    staff_acc_res = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "staff_acc@example.com",
            "full_name": "Accounts Staff",
            "password": "Password123!",
            "role": "STAFF",
            "department": "Accounts",
            "branch": "Kochi",
        },
        headers=incharge_acc_headers,
    )
    assert staff_acc_res.status_code == 201
    staff_acc_id = staff_acc_res.json()["id"]

    # 8. VERIFY APPROVAL SCOPING:
    # "if a staff requesting for a approval , that staff only can see the team leaders and in charges
    #  belong to their department and admin belongs to their branch"
    approvers_res = await async_client.get(
        f"/api/v1/users/eligible-approvers?for_user_id={staff_acc_id}",
        headers=sa_headers,
    )
    assert approvers_res.status_code == 200, approvers_res.text
    approvers = approvers_res.json()
    approver_emails = [a["email"] for a in approvers]

    # SHOULD BE INCLUDED:
    # - Accounts Team Leader (same department "Accounts")
    assert "tl_acc@example.com" in approver_emails
    # - Accounts In-Charge (same department "Accounts")
    assert "incharge_acc@example.com" in approver_emails
    # - Kochi Admin (same branch "Kochi")
    assert "admin_kochi@example.com" in approver_emails
    # - Super Admin (Level 1 universal authority)
    assert "superadmin@example.com" in approver_emails

    # MUST NOT BE INCLUDED:
    # - Logistics Team Leader (different department "Logistics")
    assert "tl_log@example.com" not in approver_emails
    # - Logistics In-Charge (different department "Logistics")
    assert "incharge_log@example.com" not in approver_emails
    # - Calicut Admin (different branch "Calicut")
    assert "admin_calicut@example.com" not in approver_emails

    # 9. Verify task creation with scoped approver:
    # Creating task for staff with legitimate approver (Accounts In-Charge) -> SUCCESS
    valid_task_res = await async_client.post(
        "/api/v1/tasks/",
        json={
            "title": "Quarterly Tax Audit",
            "assigned_to_id": staff_acc_id,
            "requires_approval": True,
            "approver_id": incharge_acc_id,
        },
        headers=incharge_acc_headers,
    )
    assert valid_task_res.status_code == 201, valid_task_res.text

    # Attempting to set approver from another branch (Calicut Admin) for Kochi staff -> FORBIDDEN
    cross_branch_task_res = await async_client.post(
        "/api/v1/tasks/",
        json={
            "title": "Illegal Cross Branch Task",
            "assigned_to_id": staff_acc_id,
            "requires_approval": True,
            "approver_id": admin_calicut_id,
        },
        headers=sa_headers,
    )
    assert cross_branch_task_res.status_code == 403, "Should reject cross-branch admin approver"

    # Attempting to set approver from another department (Logistics In-Charge) for Accounts staff -> FORBIDDEN
    cross_dept_task_res = await async_client.post(
        "/api/v1/tasks/",
        json={
            "title": "Illegal Cross Dept Task",
            "assigned_to_id": staff_acc_id,
            "requires_approval": True,
            "approver_id": incharge_log_id,
        },
        headers=sa_headers,
    )
    assert cross_dept_task_res.status_code == 403, "Should reject cross-department in-charge approver"

