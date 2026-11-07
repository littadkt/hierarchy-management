import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_purchase_manager_hierarchy_rules(async_client: AsyncClient):
    """
    Test suite for Purchase Manager Hierarchy Rules:
    1. For Staff:
       - Default purchase manager is their Team Leader.
       - Staff CANNOT change or update status of their request.
       - Assigned Team Leader CAN update the request status.
       - GET /api/v1/purchase-requests/my-manager returns their Team Leader.
    2. For Non-Staff (Team Leader, In-Charge, Admin, Super Admin):
       - No external purchase manager; orders are managed by themselves only (purchase_manager_id == requester.id).
       - GET /api/v1/purchase-requests/my-manager returns None.
       - Only the requester themselves (or Super Admin) can update status.
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

    # In-Charge (Operations Dept)
    incharge_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge@example.com", "password": "InCharge@123"},
    )
    assert incharge_login.status_code == 200
    incharge_headers = {"Authorization": f"Bearer {incharge_login.json()['access_token']}"}
    incharge_id = incharge_login.json()["user"]["id"]

    # Team Leader (Engineering Dept)
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    assert tl_login.status_code == 200
    tl_headers = {"Authorization": f"Bearer {tl_login.json()['access_token']}"}
    tl_id = tl_login.json()["user"]["id"]

    # Staff 1 (Engineering Dept, reports to Team Leader)
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}
    staff_id = staff_login.json()["user"]["id"]

    # --- RULE 1: STAFF GET /my-manager RETURNS THEIR TEAM LEADER ---
    staff_mgr_res = await async_client.get(
        "/api/v1/purchase-requests/my-manager",
        headers=staff_headers,
    )
    assert staff_mgr_res.status_code == 200
    staff_mgr = staff_mgr_res.json()
    assert staff_mgr is not None
    assert staff_mgr["id"] == tl_id
    assert staff_mgr["role"] == "TEAM_LEADER"

    # --- RULE 2: NON-STAFF GET /my-manager RETURNS NONE (SELF-MANAGED) ---
    for non_staff_headers in [tl_headers, incharge_headers, admin_headers, sa_headers]:
        ns_res = await async_client.get(
            "/api/v1/purchase-requests/my-manager",
            headers=non_staff_headers,
        )
        assert ns_res.status_code == 200
        assert ns_res.json() is None

    # --- RULE 3: STAFF CREATES PURCHASE REQUEST -> AUTOMATICALLY ASSIGNED TO TEAM LEADER ---
    pr_payload_staff = {
        "code": "8901030383921",
        "name": "Dell 4K Monitor for Staff",
        "rate": 34999.0,
        "quantity": 2,
        "notes": "Workstation requirement",
    }
    staff_create_res = await async_client.post(
        "/api/v1/purchase-requests",
        json=pr_payload_staff,
        headers=staff_headers,
    )
    assert staff_create_res.status_code == 201
    staff_pr = staff_create_res.json()
    assert staff_pr["requested_by_id"] == staff_id
    assert staff_pr["purchase_manager_id"] == tl_id
    assert staff_pr["status"] == "OPEN"
    staff_pr_id = staff_pr["id"]

    # --- VERIFY VISIBILITY IN PURCHASE DESK OF IN-CHARGE ---
    # When a staff sets purchase request to Team Leader, it must be visible in the purchase desk of In-Charge as well
    incharge_list_res = await async_client.get(
        "/api/v1/purchase-requests",
        headers=incharge_headers,
    )
    assert incharge_list_res.status_code == 200
    incharge_prs = incharge_list_res.json()["items"]
    incharge_pr_ids = [r["id"] for r in incharge_prs]
    assert staff_pr_id in incharge_pr_ids, "Staff purchase request set to Team Leader must be visible in In-Charge purchase desk"

    # In-Charge can also view history of staff's purchase request
    incharge_hist_res = await async_client.get(
        f"/api/v1/purchase-requests/{staff_pr_id}/history",
        headers=incharge_headers,
    )
    assert incharge_hist_res.status_code == 200

    # --- RULE 4: STAFF CANNOT UPDATE STATUS OF THEIR OWN PURCHASE REQUEST ---
    staff_update_res = await async_client.patch(
        f"/api/v1/purchase-requests/{staff_pr_id}/status",
        json={"status": "ORDERED", "remarks": "Trying to approve myself"},
        headers=staff_headers,
    )
    assert staff_update_res.status_code == 403

    # --- RULE 5: TEAM LEADER CAN UPDATE STATUS OF STAFF'S PURCHASE REQUEST ---
    tl_update_res = await async_client.patch(
        f"/api/v1/purchase-requests/{staff_pr_id}/status",
        json={"status": "ORDERED", "remarks": "Approved and PO placed by Team Leader"},
        headers=tl_headers,
    )
    assert tl_update_res.status_code == 200
    assert tl_update_res.json()["status"] == "ORDERED"

    # Team leader marks as RECEIVED
    tl_received_res = await async_client.patch(
        f"/api/v1/purchase-requests/{staff_pr_id}/status",
        json={"status": "RECEIVED", "remarks": "Received by Team Leader"},
        headers=tl_headers,
    )
    assert tl_received_res.status_code == 200
    assert tl_received_res.json()["status"] == "RECEIVED"

    # --- RULE 6: TEAM LEADER CREATES PURCHASE REQUEST -> MANAGED BY THEMSELVES ONLY ---
    tl_order_payload = {
        "code": "8901234567890",
        "name": "MacBook Pro for Team Leader",
        "rate": 189999.0,
        "quantity": 1,
        "notes": "Direct order by Team Leader",
    }
    tl_create_res = await async_client.post(
        "/api/v1/purchase-requests",
        json=tl_order_payload,
        headers=tl_headers,
    )
    assert tl_create_res.status_code == 201
    tl_pr = tl_create_res.json()
    assert tl_pr["requested_by_id"] == tl_id
    assert tl_pr["purchase_manager_id"] == tl_id  # Managed by self!
    tl_pr_id = tl_pr["id"]

    # Team Leader can update their own status
    tl_self_update = await async_client.patch(
        f"/api/v1/purchase-requests/{tl_pr_id}/status",
        json={"status": "ORDERED", "remarks": "Ordered directly by Team Leader"},
        headers=tl_headers,
    )
    assert tl_self_update.status_code == 200
    assert tl_self_update.json()["status"] == "ORDERED"

    # Other non-super-admin user (e.g. In-Charge) CANNOT update Team Leader's order
    incharge_tamper_res = await async_client.patch(
        f"/api/v1/purchase-requests/{tl_pr_id}/status",
        json={"status": "RECEIVED", "remarks": "In-charge trying to manage TL order"},
        headers=incharge_headers,
    )
    assert incharge_tamper_res.status_code == 403

    # --- RULE 7: IN-CHARGE, ADMIN, SUPER ADMIN ARE ALSO SELF-MANAGED ---
    # Admin order
    admin_order_payload = {
        "code": "8909876543210",
        "name": "Logitech MX Master for Admin",
        "rate": 8999.0,
        "quantity": 1,
    }
    admin_create_res = await async_client.post(
        "/api/v1/purchase-requests",
        json=admin_order_payload,
        headers=admin_headers,
    )
    assert admin_create_res.status_code == 201
    admin_pr = admin_create_res.json()
    assert admin_pr["requested_by_id"] == admin_id
    assert admin_pr["purchase_manager_id"] == admin_id  # Managed by self!

    # Admin updates their own order status
    admin_self_update = await async_client.patch(
        f"/api/v1/purchase-requests/{admin_pr['id']}/status",
        json={"status": "RECEIVED", "remarks": "Received by Admin"},
        headers=admin_headers,
    )
    assert admin_self_update.status_code == 200
    assert admin_self_update.json()["status"] == "RECEIVED"

