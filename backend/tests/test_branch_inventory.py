import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_separate_inventory_per_branch(async_client: AsyncClient):
    await seed_data()

    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # 2. Get list of branches
    branches_res = await async_client.get("/api/v1/branches", headers=sa_headers)
    assert branches_res.status_code == 200
    branches = branches_res.json()
    assert len(branches) >= 2
    branch1_id = branches[0]["id"]
    branch2_id = branches[1]["id"]
    branch1_name = branches[0]["name"]
    branch2_name = branches[1]["name"]

    test_barcode = "BAR-BRANCH-SPLIT-99"

    # 3. Add item with test_barcode into Branch 1
    create_b1 = await async_client.post(
        "/api/v1/inventory",
        json={
            "code": test_barcode,
            "name": f"Office Projector - {branch1_name}",
            "rate": 45000.0,
            "category": "Electronics",
            "quantity": 10,
            "branch_id": branch1_id,
        },
        headers=sa_headers,
    )
    assert create_b1.status_code == 201
    item_b1 = create_b1.json()
    assert item_b1["code"] == test_barcode
    assert item_b1["branch_id"] == branch1_id
    assert item_b1["quantity"] == 10

    # 4. Add item with SAME test_barcode into Branch 2 (Must succeed!)
    create_b2 = await async_client.post(
        "/api/v1/inventory",
        json={
            "code": test_barcode,
            "name": f"Office Projector - {branch2_name}",
            "rate": 48000.0,
            "category": "Electronics",
            "quantity": 4,
            "branch_id": branch2_id,
        },
        headers=sa_headers,
    )
    assert create_b2.status_code == 201
    item_b2 = create_b2.json()
    assert item_b2["code"] == test_barcode
    assert item_b2["branch_id"] == branch2_id
    assert item_b2["quantity"] == 4

    # 5. Duplicate in the SAME branch must fail (400)
    dup_res = await async_client.post(
        "/api/v1/inventory",
        json={
            "code": test_barcode,
            "name": "Duplicate Projector",
            "quantity": 2,
            "branch_id": branch1_id,
        },
        headers=sa_headers,
    )
    assert dup_res.status_code == 400

    # 6. Query inventory filtered by branch_id
    list_b1 = await async_client.get(
        f"/api/v1/inventory?branch_id={branch1_id}&search={test_barcode}",
        headers=sa_headers,
    )
    assert list_b1.status_code == 200
    b1_items = list_b1.json()["items"]
    assert len(b1_items) == 1
    assert b1_items[0]["quantity"] == 10
    assert b1_items[0]["branch_id"] == branch1_id

    list_b2 = await async_client.get(
        f"/api/v1/inventory?branch_id={branch2_id}&search={test_barcode}",
        headers=sa_headers,
    )
    assert list_b2.status_code == 200
    b2_items = list_b2.json()["items"]
    assert len(b2_items) == 1
    assert b2_items[0]["quantity"] == 4
    assert b2_items[0]["branch_id"] == branch2_id

    # 7. Lookup by barcode with branch_id
    lookup_b1 = await async_client.get(
        f"/api/v1/inventory/by-code/{test_barcode}?branch_id={branch1_id}",
        headers=sa_headers,
    )
    assert lookup_b1.status_code == 200
    assert lookup_b1.json()["quantity"] == 10

    lookup_b2 = await async_client.get(
        f"/api/v1/inventory/by-code/{test_barcode}?branch_id={branch2_id}",
        headers=sa_headers,
    )
    assert lookup_b2.status_code == 200
    assert lookup_b2.json()["quantity"] == 4
