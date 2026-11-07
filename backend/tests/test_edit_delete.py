import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data
from app.models.user import Role


@pytest.mark.asyncio
async def test_edit_and_delete_features(async_client: AsyncClient):
    await seed_data()

    # Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    super_headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Login as Staff
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}

    client = async_client

    # 1. Inventory Item: Create, Edit, Edit Quantity, Delete
    inv_code = "89099990001"
    create_inv = await client.post(
        "/api/v1/inventory/",
        headers=super_headers,
        json={
            "code": inv_code,
            "name": "Test Item for Edit",
            "rate": 150.0,
            "category": "Test Cat",
            "brand": "Test Brand",
            "vendor": "Test Vendor",
            "quantity": 10,
        },
    )
    assert create_inv.status_code == 201
    inv_id = create_inv.json()["id"]

    # 1a. Edit full details
    edit_inv = await client.put(
        f"/api/v1/inventory/{inv_id}",
        headers=super_headers,
        json={"name": "Updated Test Item", "rate": 175.0},
    )
    assert edit_inv.status_code == 200
    assert edit_inv.json()["name"] == "Updated Test Item"
    assert edit_inv.json()["rate"] == 175.0

    # 1b. Quantity edit specifically
    qty_edit = await client.patch(
        f"/api/v1/inventory/{inv_id}/quantity",
        headers=super_headers,
        json={"quantity": 42},
    )
    assert qty_edit.status_code == 200
    assert qty_edit.json()["quantity"] == 42

    # Staff restricted from deleting inventory
    del_forbidden = await client.delete(f"/api/v1/inventory/{inv_id}", headers=staff_headers)
    assert del_forbidden.status_code == 403

    # Delete inventory item as Super Admin
    del_inv = await client.delete(f"/api/v1/inventory/{inv_id}", headers=super_headers)
    assert del_inv.status_code == 204

    # 2. Wholesale Customer: Create, Edit, Delete
    create_cust = await client.post(
        "/api/v1/wholesale/customers",
        headers=super_headers,
        json={
            "name": "Test Customer Inc",
            "place": "Pune",
            "contact_number": "+91 9999988888",
            "email": "cust@example.com",
            "address": "123 Business Park",
        },
    )
    assert create_cust.status_code == 201
    cust_id = create_cust.json()["id"]

    # Edit Customer
    edit_cust = await client.put(
        f"/api/v1/wholesale/customers/{cust_id}",
        headers=super_headers,
        json={"place": "Mumbai South", "contact_number": "+91 9876543210"},
    )
    assert edit_cust.status_code == 200
    assert edit_cust.json()["place"] == "Mumbai South"

    # Delete Customer
    del_cust = await client.delete(f"/api/v1/wholesale/customers/{cust_id}", headers=super_headers)
    assert del_cust.status_code == 204

    # 3. Wholesale Product: Create, Edit, Delete
    prod_code = "89099990002"
    create_prod = await client.post(
        "/api/v1/wholesale/products",
        headers=super_headers,
        json={
            "code": prod_code,
            "name": "Test Wholesale Prod",
            "rate": 500.0,
            "category": "Electronics",
            "brand": "BrandX",
            "vendor": "VendorY",
            "quantity": 100,
        },
    )
    assert create_prod.status_code == 201
    prod_id = create_prod.json()["id"]

    # Edit Product
    edit_prod = await client.put(
        f"/api/v1/wholesale/products/{prod_id}",
        headers=super_headers,
        json={"rate": 480.0, "quantity": 120},
    )
    assert edit_prod.status_code == 200
    assert edit_prod.json()["rate"] == 480.0
    assert edit_prod.json()["quantity"] == 120

    # 4. Wholesale Order: Create, Edit, Delete with Stock adjustment
    # Need a customer
    c_res = await client.post(
        "/api/v1/wholesale/customers",
        headers=super_headers,
        json={"name": "Order Cust", "place": "Delhi", "contact_number": "1122334455"},
    )
    c_id = c_res.json()["id"]

    # Place order for 20 units
    order_res = await client.post(
        "/api/v1/wholesale/orders",
        headers=super_headers,
        json={
            "customer_id": c_id,
            "product_id": prod_id,
            "quantity": 20,
            "notes": "Urgent wholesale order",
        },
    )
    assert order_res.status_code == 201
    order_id = order_res.json()["id"]
    assert order_res.json()["quantity"] == 20

    # Verify product stock reduced from 120 to 100
    check_prod = await client.get(f"/api/v1/wholesale/products/{prod_id}", headers=super_headers)
    assert check_prod.json()["quantity"] == 100

    # Edit order quantity to 30 (additional 10 units)
    edit_order = await client.put(
        f"/api/v1/wholesale/orders/{order_id}",
        headers=super_headers,
        json={"quantity": 30, "notes": "Updated note"},
    )
    assert edit_order.status_code == 200
    assert edit_order.json()["quantity"] == 30
    assert edit_order.json()["total_amount"] == 480.0 * 30

    # Verify product stock reduced to 90
    check_prod2 = await client.get(f"/api/v1/wholesale/products/{prod_id}", headers=super_headers)
    assert check_prod2.json()["quantity"] == 90

    # Delete Order: should restore the 30 units back to product stock
    del_order = await client.delete(f"/api/v1/wholesale/orders/{order_id}", headers=super_headers)
    assert del_order.status_code == 204

    # Verify stock restored to 120
    check_prod3 = await client.get(f"/api/v1/wholesale/products/{prod_id}", headers=super_headers)
    assert check_prod3.json()["quantity"] == 120

    # Clean up product and customer
    del_prod = await client.delete(f"/api/v1/wholesale/products/{prod_id}", headers=super_headers)
    assert del_prod.status_code == 204
    del_c = await client.delete(f"/api/v1/wholesale/customers/{c_id}", headers=super_headers)
    assert del_c.status_code == 204

    # 5. Purchase Request: Create, Edit, Delete
    create_pr = await client.post(
        "/api/v1/purchase-requests/",
        headers=staff_headers,
        json={
            "code": "89012345678",
            "name": "PR Test Item",
            "rate": 200.0,
            "category": "Stationery",
            "brand": "StBrand",
            "vendor": "StVendor",
            "quantity": 5,
            "notes": "Initial note",
        },
    )
    assert create_pr.status_code == 201
    pr_id = create_pr.json()["id"]

    # Edit Purchase Request
    edit_pr = await client.put(
        f"/api/v1/purchase-requests/{pr_id}",
        headers=staff_headers,
        json={"quantity": 15, "notes": "Updated quantity to 15"},
    )
    assert edit_pr.status_code == 200
    assert edit_pr.json()["quantity"] == 15

    # Delete Purchase Request
    del_pr = await client.delete(f"/api/v1/purchase-requests/{pr_id}", headers=staff_headers)
    assert del_pr.status_code == 204
