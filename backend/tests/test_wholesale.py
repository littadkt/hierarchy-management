import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_wholesale_full_workflow(async_client: AsyncClient):
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
    incharge_headers = {"Authorization": f"Bearer {incharge_login.json()['access_token']}"}

    # Login as Team Leader (initially unpermitted)
    tl_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "teamleader@example.com", "password": "TeamLeader@123"},
    )
    assert tl_login.status_code == 200
    tl_token = tl_login.json()["access_token"]
    tl_id = tl_login.json()["user"]["id"]
    tl_headers = {"Authorization": f"Bearer {tl_token}"}

    # Login as Staff (Emma)
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}

    # --- 2. WHOLESALE CUSTOMERS ---
    custs_res = await async_client.get("/api/v1/wholesale/customers", headers=staff_headers)
    assert custs_res.status_code == 200
    custs_data = custs_res.json()["items"]
    assert len(custs_data) >= 1
    sample_cust = custs_data[0]

    # Create new customer
    new_cust_res = await async_client.post(
        "/api/v1/wholesale/customers",
        json={
            "name": "Zenith Retail Solutions",
            "place": "Kolkata",
            "contact_number": "+91 98300 44556",
            "email": "zenith@kolkataretail.com",
            "address": "Park Street Commercial Block, Kolkata",
        },
        headers=staff_headers,
    )
    assert new_cust_res.status_code == 201
    created_cust = new_cust_res.json()
    assert created_cust["name"] == "Zenith Retail Solutions"
    assert created_cust["place"] == "Kolkata"

    # --- 3. WHOLESALE PRODUCTS ---
    prods_res = await async_client.get("/api/v1/wholesale/products", headers=staff_headers)
    assert prods_res.status_code == 200
    prods_data = prods_res.json()["items"]
    assert len(prods_data) >= 1
    sample_prod = prods_data[0]

    # Barcode lookup for wholesale product
    barcode_res = await async_client.get(
        f"/api/v1/wholesale/products/by-code/{sample_prod['code']}",
        headers=staff_headers,
    )
    assert barcode_res.status_code == 200
    assert barcode_res.json()["name"] == sample_prod["name"]

    # --- 4. SUPER ADMIN PERMISSION ENFORCEMENT ---
    # Team Leader tries to place order without permission -> 403 Forbidden
    order_attempt = {
        "customer_id": sample_cust["id"],
        "product_id": sample_prod["id"],
        "quantity": 2,
        "notes": "Urgent wholesale dispatch",
    }
    forbidden_res = await async_client.post(
        "/api/v1/wholesale/orders",
        json=order_attempt,
        headers=tl_headers,
    )
    assert forbidden_res.status_code == 403
    assert "not authorized" in forbidden_res.json()["detail"].lower()

    # Admin tries to grant permission to Team Leader -> 403 Forbidden
    admin_grant_res = await async_client.post(
        "/api/v1/wholesale/permissions",
        json={"user_id": tl_id, "can_place_wholesale_orders": True},
        headers=admin_headers,
    )
    assert admin_grant_res.status_code == 403

    # Super Admin grants order placement permission to Team Leader -> 200 OK
    sa_grant_res = await async_client.post(
        "/api/v1/wholesale/permissions",
        json={"user_id": tl_id, "can_place_wholesale_orders": True},
        headers=sa_headers,
    )
    assert sa_grant_res.status_code == 200
    assert sa_grant_res.json()["can_place_wholesale_orders"] is True

    # --- 5. PLACE ORDER ---
    # Team Leader now has permission and places order
    order_create_res = await async_client.post(
        "/api/v1/wholesale/orders",
        json=order_attempt,
        headers=tl_headers,
    )
    assert order_create_res.status_code == 201
    order_data = order_create_res.json()
    assert order_data["customer_name"] == sample_cust["name"]
    assert order_data["place"] == sample_cust["place"]
    assert order_data["contact_number"] == sample_cust["contact_number"]
    assert order_data["product_name"] == sample_prod["name"]
    assert order_data["quantity"] == 2
    assert order_data["unit_rate"] == sample_prod["rate"]
    assert order_data["total_amount"] == sample_prod["rate"] * 2
    assert order_data["status"] == "PENDING"
    assert order_data["order_number"].startswith("WO-")
    created_order_id = order_data["id"]

    # --- 6. VISIBILITY OF PLACED ORDERS ---
    # "placed orders are to be shown to in-charges , admins and for superadmins"
    # 6a. In-Charge view
    incharge_orders = await async_client.get(
        "/api/v1/wholesale/orders",
        headers=incharge_headers,
    )
    assert incharge_orders.status_code == 200
    assert any(o["id"] == created_order_id for o in incharge_orders.json()["items"])

    # 6b. Admin view
    admin_orders = await async_client.get(
        "/api/v1/wholesale/orders",
        headers=admin_headers,
    )
    assert admin_orders.status_code == 200
    assert any(o["id"] == created_order_id for o in admin_orders.json()["items"])

    # 6c. Super Admin view
    sa_orders = await async_client.get(
        "/api/v1/wholesale/orders",
        headers=sa_headers,
    )
    assert sa_orders.status_code == 200
    assert any(o["id"] == created_order_id for o in sa_orders.json()["items"])

    # --- 7. ORDER STATUS UPDATES ---
    # In-Charge confirms order
    confirm_res = await async_client.patch(
        f"/api/v1/wholesale/orders/{created_order_id}/status",
        json={"status": "CONFIRMED"},
        headers=incharge_headers,
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "CONFIRMED"

    # Admin marks order as dispatched
    dispatch_res = await async_client.patch(
        f"/api/v1/wholesale/orders/{created_order_id}/status",
        json={"status": "DISPATCHED"},
        headers=admin_headers,
    )
    assert dispatch_res.status_code == 200
    assert dispatch_res.json()["status"] == "DISPATCHED"

    # Team Leader cannot change status -> 403 Forbidden
    tl_status_res = await async_client.patch(
        f"/api/v1/wholesale/orders/{created_order_id}/status",
        json={"status": "DELIVERED"},
        headers=tl_headers,
    )
    assert tl_status_res.status_code == 403

    # --- 8. MULTI-PRODUCT ORDER PLACEMENT ---
    # Fetch at least 2 wholesale products
    all_prods_res = await async_client.get("/api/v1/wholesale/products", headers=sa_headers)
    assert all_prods_res.status_code == 200
    catalog = all_prods_res.json()["items"]
    assert len(catalog) >= 2
    prod1, prod2 = catalog[0], catalog[1]

    multi_order_payload = {
        "customer_id": sample_cust["id"],
        "place": "Bangalore Central Hub",
        "contact_number": "+91 99001 22334",
        "notes": "Bulk multi-product dispatch",
        "items": [
            {"product_id": prod1["id"], "quantity": 3},
            {"product_id": prod2["id"], "quantity": 2},
        ],
    }

    multi_order_res = await async_client.post(
        "/api/v1/wholesale/orders",
        json=multi_order_payload,
        headers=tl_headers,
    )
    assert multi_order_res.status_code == 201
    multi_orders_data = multi_order_res.json()
    assert isinstance(multi_orders_data, list)
    assert len(multi_orders_data) == 2
    assert multi_orders_data[0]["product_id"] == prod1["id"]
    assert multi_orders_data[0]["quantity"] == 3
    assert multi_orders_data[1]["product_id"] == prod2["id"]
    assert multi_orders_data[1]["quantity"] == 2
    # Check that they share the base order sequence
    base_prefix = multi_orders_data[0]["order_number"].rsplit("-", 1)[0]
    assert multi_orders_data[1]["order_number"].startswith(base_prefix)

    # --- 9. STOCK INDEPENDENCE & NEGATIVE STOCK PLACEMENT ---
    # Create product with 1 unit of stock
    limited_prod_res = await async_client.post(
        "/api/v1/wholesale/products",
        json={
            "code": "NEG-STOCK-001",
            "name": "Limited Edition Test Widget",
            "rate": 1500.0,
            "category": "Electronics",
            "brand": "TestBrand",
            "vendor": "TestVendor",
            "quantity": 1,
        },
        headers=sa_headers,
    )
    assert limited_prod_res.status_code == 201
    limited_prod = limited_prod_res.json()

    # Place wholesale order for 5 units (4 units more than available -> negative stock -4)
    neg_order_res = await async_client.post(
        "/api/v1/wholesale/orders",
        json={
            "customer_id": sample_cust["id"],
            "product_id": limited_prod["id"],
            "quantity": 5,
        },
        headers=tl_headers,
    )
    assert neg_order_res.status_code == 201
    neg_order = neg_order_res.json()
    assert neg_order["quantity"] == 5

    # Verify that the product's stock is now negative (-4)
    updated_prod_res = await async_client.get(
        f"/api/v1/wholesale/products/by-code/NEG-STOCK-001",
        headers=sa_headers,
    )
    assert updated_prod_res.status_code == 200
    assert updated_prod_res.json()["quantity"] == -4

    # --- 10. BULK DELETE WHOLESALE PRODUCTS (SUPER ADMIN & ADMIN ONLY) ---
    # Create two temporary products for deletion test
    del_prod1_res = await async_client.post(
        "/api/v1/wholesale/products",
        json={
            "code": "BULK-DEL-001",
            "name": "Bulk Delete Candidate 1",
            "rate": 200.0,
            "category": "Testing",
            "brand": "BulkBrand",
            "vendor": "BulkVendor",
            "quantity": 10,
        },
        headers=sa_headers,
    )
    assert del_prod1_res.status_code == 201
    del_prod1 = del_prod1_res.json()

    del_prod2_res = await async_client.post(
        "/api/v1/wholesale/products",
        json={
            "code": "BULK-DEL-002",
            "name": "Bulk Delete Candidate 2",
            "rate": 350.0,
            "category": "Testing",
            "brand": "BulkBrand",
            "vendor": "BulkVendor",
            "quantity": 20,
        },
        headers=admin_headers,
    )
    assert del_prod2_res.status_code == 201
    del_prod2 = del_prod2_res.json()

    # Permission check: Non-admin users (Staff, Team Leader, In-Charge) CANNOT bulk delete
    staff_bulk_res = await async_client.post(
        "/api/v1/wholesale/products/bulk-delete",
        json={"product_ids": [del_prod1["id"], del_prod2["id"]]},
        headers=staff_headers,
    )
    assert staff_bulk_res.status_code == 403

    incharge_bulk_res = await async_client.post(
        "/api/v1/wholesale/products/bulk-delete",
        json={"product_ids": [del_prod1["id"], del_prod2["id"]]},
        headers=incharge_headers,
    )
    assert incharge_bulk_res.status_code == 403

    # Admin bulk deletes del_prod1 and del_prod2
    admin_bulk_res = await async_client.post(
        "/api/v1/wholesale/products/bulk-delete",
        json={"product_ids": [del_prod1["id"], del_prod2["id"]]},
        headers=admin_headers,
    )
    assert admin_bulk_res.status_code == 200
    res_data = admin_bulk_res.json()
    assert res_data["deleted_count"] == 2
    assert res_data["failed_count"] == 0

    # Verify both products are now gone
    check_del1 = await async_client.get(
        "/api/v1/wholesale/products/by-code/BULK-DEL-001",
        headers=sa_headers,
    )
    assert check_del1.status_code == 404
    check_del2 = await async_client.get(
        "/api/v1/wholesale/products/by-code/BULK-DEL-002",
        headers=sa_headers,
    )
    assert check_del2.status_code == 404
