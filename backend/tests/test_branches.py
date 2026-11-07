import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_branch_management_and_admin_branch_update(async_client: AsyncClient):
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200, sa_login.text
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Super Admin creates a Staff user
    create_staff = await async_client.post(
        "/api/v1/users/",
        json={
            "email": "test_staff_branch@example.com",
            "full_name": "Test Staff",
            "password": "Password123!",
            "role": "STAFF",
        },
        headers=sa_headers,
    )
    assert create_staff.status_code == 201, create_staff.text

    # Login as Staff
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "test_staff_branch@example.com", "password": "Password123!"},
    )
    assert staff_login.status_code == 200, staff_login.text
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 3. List branches
    list_res = await async_client.get("/api/v1/branches", headers=sa_headers)
    assert list_res.status_code == 200, list_res.text
    branches = list_res.json()
    assert len(branches) >= 1

    # Staff can also read branches (needed for select dropdowns)
    staff_list_res = await async_client.get("/api/v1/branches", headers=staff_headers)
    assert staff_list_res.status_code == 200

    # 4. Staff cannot create a branch (403 Forbidden)
    forbidden_res = await async_client.post(
        "/api/v1/branches",
        json={"name": "Unauthorized Branch"},
        headers=staff_headers,
    )
    assert forbidden_res.status_code == 403

    # 5. Super Admin creates a new branch
    new_branch_payload = {
        "name": "Kottayam Tech Park",
        "code": "KTM",
        "city": "Kottayam",
        "address": "Baker Junction, Kottayam",
        "is_active": True,
    }
    create_branch_res = await async_client.post(
        "/api/v1/branches",
        json=new_branch_payload,
        headers=sa_headers,
    )
    assert create_branch_res.status_code == 201, create_branch_res.text
    branch_data = create_branch_res.json()
    branch_id = branch_data["id"]
    assert branch_data["name"] == "Kottayam Tech Park"
    assert branch_data["code"] == "KTM"

    # Duplicate branch name prevented (400)
    dup_res = await async_client.post(
        "/api/v1/branches",
        json={"name": "Kottayam Tech Park"},
        headers=sa_headers,
    )
    assert dup_res.status_code == 400

    # 6. Create an Admin assigned to this branch
    admin_payload = {
        "email": "ktm_admin@example.com",
        "full_name": "KTM Admin Officer",
        "password": "Password123!",
        "role": "ADMIN",
        "branch": "Kottayam Tech Park",
    }
    admin_res = await async_client.post("/api/v1/users/", json=admin_payload, headers=sa_headers)
    assert admin_res.status_code == 201, admin_res.text
    admin_user = admin_res.json()
    admin_id = admin_user["id"]
    assert admin_user["branch"] == "Kottayam Tech Park"

    # 7. Edit Admin's branch to another branch (e.g. Calicut Branch)
    edit_admin_res = await async_client.put(
        f"/api/v1/users/{admin_id}",
        json={"full_name": "KTM Admin Officer", "email": "ktm_admin@example.com", "branch": "Calicut Branch"},
        headers=sa_headers,
    )
    assert edit_admin_res.status_code == 200, edit_admin_res.text
    assert edit_admin_res.json()["branch"] == "Calicut Branch"

    # Verify GET user returns updated branch
    get_admin_res = await async_client.get(f"/api/v1/users/{admin_id}", headers=sa_headers)
    assert get_admin_res.status_code == 200
    assert get_admin_res.json()["branch"] == "Calicut Branch"

    # 8. Re-assign admin back to "Kottayam Tech Park" using PATCH
    patch_admin_res = await async_client.patch(
        f"/api/v1/users/{admin_id}",
        json={"branch": "Kottayam Tech Park"},
        headers=sa_headers,
    )
    assert patch_admin_res.status_code == 200
    assert patch_admin_res.json()["branch"] == "Kottayam Tech Park"

    # 9. Update branch details and verify cascading user update
    update_branch_res = await async_client.put(
        f"/api/v1/branches/{branch_id}",
        json={"name": "Kottayam Central Branch", "city": "Kottayam District"},
        headers=sa_headers,
    )
    assert update_branch_res.status_code == 200
    assert update_branch_res.json()["name"] == "Kottayam Central Branch"

    # Verify that the admin's branch reference was cascaded to the new branch name
    refreshed_admin = await async_client.get(f"/api/v1/users/{admin_id}", headers=sa_headers)
    assert refreshed_admin.json()["branch"] == "Kottayam Central Branch"

    # 10. Attempt to delete branch with assigned user fails with 400
    delete_fail_res = await async_client.delete(f"/api/v1/branches/{branch_id}", headers=sa_headers)
    assert delete_fail_res.status_code == 400
    assert "user(s) are currently assigned" in delete_fail_res.text

    # 11. Delete admin user first, then delete branch succeeds
    await async_client.delete(f"/api/v1/users/{admin_id}", headers=sa_headers)
    delete_ok_res = await async_client.delete(f"/api/v1/branches/{branch_id}", headers=sa_headers)
    assert delete_ok_res.status_code == 204
