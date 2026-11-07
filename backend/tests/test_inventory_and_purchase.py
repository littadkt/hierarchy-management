import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_inventory_and_purchase_manager_flow(async_client: AsyncClient):
    await seed_data()

    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Login as In-Charge
    incharge_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "incharge@example.com", "password": "InCharge@123"},
    )
    assert incharge_login.status_code == 200
    incharge_token = incharge_login.json()["access_token"]
    incharge_headers = {"Authorization": f"Bearer {incharge_token}"}
    incharge_id = incharge_login.json()["user"]["id"]

    # Login as Team Leader (Staff's designated Purchase Manager)
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    assert tl_login.status_code == 200
    tl_token = tl_login.json()["access_token"]
    tl_headers = {"Authorization": f"Bearer {tl_token}"}

    # Login as Staff
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    staff_id = staff_login.json()["user"]["id"]

    # 2. INVENTORY SCAN / LOOKUP BY BARCODE
    # Existing item
    inv_res = await async_client.get(
        "/api/v1/inventory/by-code/8901030383921", headers=staff_headers
    )
    assert inv_res.status_code == 200
    inv_item = inv_res.json()
    assert inv_item["name"] == 'Dell UltraSharp 27" 4K USB-C Monitor'
    assert inv_item["rate"] == 34999.0

    # Non-existing item returns 404
    missing_res = await async_client.get(
        "/api/v1/inventory/by-code/0000000000000", headers=staff_headers
    )
    assert missing_res.status_code == 404

    # 3. SUPER ADMIN PROVISION: Pick In-Charge user and assign as Purchase Manager
    assign_pm_res = await async_client.post(
        "/api/v1/purchase-requests/assign-manager",
        json={"user_id": incharge_id},
        headers=sa_headers,
    )
    assert assign_pm_res.status_code == 200
    assert assign_pm_res.json()["is_purchase_manager"] is True

    # Restriction: Admin CANNOT assign purchase manager (Super Admin provision only)
    admin_assign_res = await async_client.post(
        "/api/v1/purchase-requests/assign-manager",
        json={"user_id": incharge_id},
        headers=admin_headers,
    )
    assert admin_assign_res.status_code == 403

    # Restriction: Cannot assign a Staff member as Purchase Manager (only In-Charge)
    illegal_pm_res = await async_client.post(
        "/api/v1/purchase-requests/assign-manager",
        json={"user_id": staff_id},
        headers=sa_headers,
    )
    assert illegal_pm_res.status_code == 400

    # 4. ALL USERS PROVISION: Scan barcode and submit purchase request to Purchase Manager
    # Case A: Existing product scanned by Staff
    pr_existing = {
        "code": "8901030383921",
        "name": 'Dell UltraSharp 27" 4K USB-C Monitor',
        "rate": 34999.0,
        "category": "Monitors",
        "brand": "Dell",
        "vendor": "TechSource Solutions",
        "quantity": 3,
        "notes": "Urgent requirement for workstation expansion",
    }
    create_pr1_res = await async_client.post(
        "/api/v1/purchase-requests/", json=pr_existing, headers=staff_headers
    )
    assert create_pr1_res.status_code == 201
    pr1 = create_pr1_res.json()
    assert pr1["status"] == "OPEN"
    assert pr1["quantity"] == 3
    assert pr1["inventory_item_id"] is not None
    pr1_id = pr1["id"]

    # Case B: Product not in database, entered by Staff
    pr_new_product = {
        "code": "7778889991112",
        "name": "Custom Dual Monitor Arm Mount",
        "rate": 5400.0,
        "category": "Ergonomics",
        "brand": "ErgoTech",
        "vendor": "ErgoTech Direct",
        "quantity": 2,
        "notes": "New accessory not yet in inventory",
    }
    create_pr2_res = await async_client.post(
        "/api/v1/purchase-requests/", json=pr_new_product, headers=staff_headers
    )
    assert create_pr2_res.status_code == 201
    pr2 = create_pr2_res.json()
    assert pr2["status"] == "OPEN"
    pr2_id = pr2["id"]

    # Case C: Product submitted WITHOUT category and brand (category and brand are now optional)
    pr_no_category_brand = {
        "code": "4445556667778",
        "name": "Generic HDMI Cable 3m",
        "rate": 450.0,
        "vendor": "Local Cable Vendor",
        "quantity": 5,
        "notes": "Submitted with empty/omitted category and brand",
    }
    create_pr3_res = await async_client.post(
        "/api/v1/purchase-requests/", json=pr_no_category_brand, headers=staff_headers
    )
    assert create_pr3_res.status_code == 201
    pr3 = create_pr3_res.json()
    assert pr3["status"] == "OPEN"
    assert pr3["category"] in ("", None)
    assert pr3["brand"] in ("", None)

    # 5. PURCHASE MANAGER & ADMIN/SUPER ADMIN VISIBILITY
    # In-Charge (Purchase Manager) can see all requests
    pm_list_res = await async_client.get(
        "/api/v1/purchase-requests/", headers=incharge_headers
    )
    assert pm_list_res.status_code == 200
    pm_requests = pm_list_res.json()["items"]
    assert any(r["id"] == pr1_id for r in pm_requests)
    assert any(r["id"] == pr2_id for r in pm_requests)

    # Super Admin and Admin can also see all requests
    admin_list_res = await async_client.get(
        "/api/v1/purchase-requests/", headers=admin_headers
    )
    assert admin_list_res.status_code == 200
    assert len(admin_list_res.json()["items"]) >= 2

    # 6. PURCHASE MANAGER STATUS UPDATES (ORDERED, NOT_IN_STOCK, RECEIVED)
    # Mark PR1 as ORDERED (Team Leader is Staff1's default purchase manager)
    order_res = await async_client.patch(
        f"/api/v1/purchase-requests/{pr1_id}/status",
        json={"status": "ORDERED", "remarks": "PO #9921 placed with TechSource."},
        headers=tl_headers,
    )
    assert order_res.status_code == 200
    assert order_res.json()["status"] == "ORDERED"

    # Mark PR1 as RECEIVED (completed)
    received_res = await async_client.patch(
        f"/api/v1/purchase-requests/{pr1_id}/status",
        json={"status": "RECEIVED", "remarks": "Delivered to warehouse dock."},
        headers=tl_headers,
    )
    assert received_res.status_code == 200
    assert received_res.json()["status"] == "RECEIVED"
    assert received_res.json()["completed_at"] is not None

    # Mark PR2 (new product) as RECEIVED -> verifies it auto-creates inventory item!
    receive_new_res = await async_client.patch(
        f"/api/v1/purchase-requests/{pr2_id}/status",
        json={"status": "RECEIVED", "remarks": "New product received and added to inventory."},
        headers=tl_headers,
    )
    assert receive_new_res.status_code == 200
    # Check that new product is now present in inventory!
    new_inv_check = await async_client.get(
        "/api/v1/inventory/by-code/7778889991112", headers=staff_headers
    )
    assert new_inv_check.status_code == 200
    assert new_inv_check.json()["quantity"] == 2

    # 7. HISTORY VISIBILITY
    # Full history shown to Super Admin and Admin
    history_res = await async_client.get(
        f"/api/v1/purchase-requests/{pr1_id}/history", headers=admin_headers
    )
    assert history_res.status_code == 200
    histories = history_res.json()
    assert len(histories) >= 3  # OPEN -> ORDERED -> RECEIVED
    statuses = [h["new_status"] for h in histories]
    assert "OPEN" in statuses
    assert "ORDERED" in statuses
    assert "RECEIVED" in statuses

    # Restriction: Staff CANNOT update status directly
    staff_update_res = await async_client.patch(
        f"/api/v1/purchase-requests/{pr2_id}/status",
        json={"status": "ORDERED"},
        headers=staff_headers,
    )
    assert staff_update_res.status_code == 403

    # 8. ADD INVENTORY ITEM WITH ALL FIELDS OPTIONAL / EMPTY
    # Submit completely empty payload {}
    create_empty_res = await async_client.post(
        "/api/v1/inventory/",
        json={},
        headers=admin_headers,
    )
    assert create_empty_res.status_code == 201
    empty_item = create_empty_res.json()
    assert empty_item["code"].startswith("INV-")
    assert empty_item["name"] == ""
    assert empty_item["rate"] == 0.0
    assert empty_item["category"] == ""
    assert empty_item["brand"] == ""
    assert empty_item["vendor"] == ""
    assert empty_item["quantity"] == 0

    # Submit second item with empty strings - should succeed with another unique barcode
    create_blank_res = await async_client.post(
        "/api/v1/inventory/",
        json={"code": "", "name": "", "category": "", "brand": "", "vendor": ""},
        headers=admin_headers,
    )
    assert create_blank_res.status_code == 201
    blank_item = create_blank_res.json()
    assert blank_item["code"].startswith("INV-")
    assert blank_item["code"] != empty_item["code"]

    # Update item with empty values - should not collide or crash
    update_res = await async_client.put(
        f"/api/v1/inventory/{blank_item['id']}",
        json={"name": "Now Updated", "code": ""},
        headers=admin_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Now Updated"
    assert update_res.json()["code"] == blank_item["code"]  # preserved barcode

    # 9. BULK DELETE INVENTORY ITEMS (SUPER ADMIN & ADMIN ONLY)
    # Create two test inventory items
    inv_del1_res = await async_client.post(
        "/api/v1/inventory/",
        json={"code": "INV-BULK-001", "name": "Bulk Del Item 1", "rate": 150.0, "quantity": 10},
        headers=sa_headers,
    )
    assert inv_del1_res.status_code == 201
    inv_del1 = inv_del1_res.json()

    inv_del2_res = await async_client.post(
        "/api/v1/inventory/",
        json={"code": "INV-BULK-002", "name": "Bulk Del Item 2", "rate": 250.0, "quantity": 5},
        headers=admin_headers,
    )
    assert inv_del2_res.status_code == 201
    inv_del2 = inv_del2_res.json()

    # Permission check: Staff and In-Charge CANNOT bulk delete inventory
    staff_bulk_inv = await async_client.post(
        "/api/v1/inventory/bulk-delete",
        json={"item_ids": [inv_del1["id"], inv_del2["id"]]},
        headers=staff_headers,
    )
    assert staff_bulk_inv.status_code == 403

    incharge_bulk_inv = await async_client.post(
        "/api/v1/inventory/bulk-delete",
        json={"item_ids": [inv_del1["id"], inv_del2["id"]]},
        headers=incharge_headers,
    )
    assert incharge_bulk_inv.status_code == 403

    # Admin bulk deletes inv_del1 and inv_del2
    admin_bulk_inv = await async_client.post(
        "/api/v1/inventory/bulk-delete",
        json={"item_ids": [inv_del1["id"], inv_del2["id"]]},
        headers=admin_headers,
    )
    assert admin_bulk_inv.status_code == 200
    bulk_inv_data = admin_bulk_inv.json()
    assert bulk_inv_data["deleted_count"] == 2
    assert bulk_inv_data["failed_count"] == 0

    # Verify both inventory items are now gone
    check_inv1 = await async_client.get(
        "/api/v1/inventory/by-code/INV-BULK-001",
        headers=sa_headers,
    )
    assert check_inv1.status_code == 404
    check_inv2 = await async_client.get(
        "/api/v1/inventory/by-code/INV-BULK-002",
        headers=sa_headers,
    )
    assert check_inv2.status_code == 404
