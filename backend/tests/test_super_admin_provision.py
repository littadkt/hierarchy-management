import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_super_admin_can_create_new_super_admin(async_client: AsyncClient):
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200, sa_login.text
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Super Admin creates a new Super Admin
    new_sa_payload = {
        "email": "secondary_superadmin@example.com",
        "full_name": "Secondary Super Admin",
        "password": "NewSuperAdmin123!",
        "role": "SUPER_ADMIN",
    }
    create_res = await async_client.post("/api/v1/users/", json=new_sa_payload, headers=sa_headers)
    assert create_res.status_code == 201, create_res.text
    created_sa = create_res.json()
    assert created_sa["email"] == "secondary_superadmin@example.com"
    assert created_sa["role"] == "SUPER_ADMIN"
    assert created_sa["is_active"] is True
    assert created_sa["can_place_wholesale_orders"] is True
    assert created_sa["reports_to_id"] is None
    new_sa_id = created_sa["id"]

    # 3. Newly created Super Admin can log in successfully
    new_sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "secondary_superadmin@example.com", "password": "NewSuperAdmin123!"},
    )
    assert new_sa_login.status_code == 200, new_sa_login.text
    new_sa_token = new_sa_login.json()["access_token"]
    new_sa_headers = {"Authorization": f"Bearer {new_sa_token}"}

    # 4. Newly created Super Admin has full Super Admin powers:
    # 4a. Can create an Admin
    admin_payload = {
        "email": "admin_from_second_sa@example.com",
        "full_name": "Admin Under Second SA",
        "password": "Password123!",
        "role": "ADMIN",
    }
    create_admin_res = await async_client.post("/api/v1/users/", json=admin_payload, headers=new_sa_headers)
    assert create_admin_res.status_code == 201, create_admin_res.text

    # 4b. Can create yet another Super Admin (tertiary)
    third_sa_payload = {
        "email": "tertiary_superadmin@example.com",
        "full_name": "Tertiary Super Admin",
        "password": "SuperAdmin3Pass123!",
        "role": "SUPER_ADMIN",
    }
    create_third_sa_res = await async_client.post("/api/v1/users/", json=third_sa_payload, headers=new_sa_headers)
    assert create_third_sa_res.status_code == 201, create_third_sa_res.text

    # 4c. Can view hierarchy overview and see all Super Admins
    overview_res = await async_client.get("/api/v1/hierarchy/overview", headers=new_sa_headers)
    assert overview_res.status_code == 200
    overview_users = overview_res.json()
    sa_emails = [u["email"] for u in overview_users if u["role"] == "SUPER_ADMIN"]
    assert "superadmin@example.com" in sa_emails
    assert "secondary_superadmin@example.com" in sa_emails
    assert "tertiary_superadmin@example.com" in sa_emails

    # 5. Non-Super Admin roles cannot create a Super Admin
    # Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin_from_second_sa@example.com", "password": "Password123!"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    illegal_sa_payload = {
        "email": "illegal_sa@example.com",
        "full_name": "Illegal Super Admin",
        "password": "Password123!",
        "role": "SUPER_ADMIN",
    }
    illegal_res = await async_client.post("/api/v1/users/", json=illegal_sa_payload, headers=admin_headers)
    assert illegal_res.status_code == 403, "Admin must NOT be allowed to create a Super Admin"

    # 6. Super Admin can edit another Super Admin
    update_res = await async_client.put(
        f"/api/v1/users/{new_sa_id}",
        json={"full_name": "Updated Secondary SA Name"},
        headers=sa_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["full_name"] == "Updated Secondary SA Name"

    # 7. Super Admin cannot delete their own account
    # First get primary SA id
    primary_sa_user_res = await async_client.get("/api/v1/users/assignable", headers=sa_headers)
    assert primary_sa_user_res.status_code == 200
    primary_sa = next(u for u in primary_sa_user_res.json() if u["email"] == "superadmin@example.com")
    self_delete_res = await async_client.delete(f"/api/v1/users/{primary_sa['id']}", headers=sa_headers)
    assert self_delete_res.status_code == 403, "Super Admin must not be able to delete self"

    # 8. Super Admin CAN delete another Super Admin
    delete_third_res = await async_client.delete(
        f"/api/v1/users/{create_third_sa_res.json()['id']}",
        headers=sa_headers,
    )
    assert delete_third_res.status_code == 204

