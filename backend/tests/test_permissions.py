import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_accessible_windows_permissions_system(async_client: AsyncClient):
    await seed_data()

    # Login helpers
    async def get_token(email: str, password: str):
        res = await async_client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
        )
        assert res.status_code == 200, res.text
        return res.json()["access_token"], res.json()["user"]

    sa_token, sa_user = await get_token("superadmin@example.com", "SuperAdmin@123")
    admin_token, admin_user = await get_token("admin@example.com", "Admin@123")
    staff_token, staff_user = await get_token("staff1@example.com", "Staff@123")

    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    staff_id = staff_user["id"]
    sa_id = sa_user["id"]

    # 1. Non-admin (staff) cannot view /windows
    staff_windows_res = await async_client.get(
        "/api/v1/permissions/windows",
        headers=staff_headers,
    )
    assert staff_windows_res.status_code == 403

    # 2. Super Admin can view /windows
    windows_res = await async_client.get(
        "/api/v1/permissions/windows",
        headers=sa_headers,
    )
    assert windows_res.status_code == 200
    windows_list = windows_res.json()
    assert len(windows_list) > 10
    window_ids = [w["id"] for w in windows_list]
    assert "operations" in window_ids
    assert "tasks" in window_ids
    assert "inventory" in window_ids
    assert "warranty" in window_ids
    assert "attendance" in window_ids
    assert "purchases" in window_ids
    assert "users" in window_ids
    assert "branches" in window_ids
    assert "departments" in window_ids
    assert "backup" in window_ids

    # 3. Admin can view staff permissions
    staff_perms_res = await async_client.get(
        f"/api/v1/permissions/users/{staff_id}",
        headers=admin_headers,
    )
    assert staff_perms_res.status_code == 200
    staff_perms = staff_perms_res.json()
    assert "tasks" in staff_perms
    assert "display" in staff_perms["tasks"]

    # 4. Admin updates staff permissions (grant delete on tasks, revoke display on wholesale)
    new_perms = dict(staff_perms)
    new_perms["tasks"] = {"add": True, "display": True, "edit": True, "delete": True}
    new_perms["wholesale"] = {"add": False, "display": False, "edit": False, "delete": False}

    update_res = await async_client.put(
        f"/api/v1/permissions/users/{staff_id}",
        headers=admin_headers,
        json={"permissions": new_perms},
    )
    assert update_res.status_code == 200
    updated_perms = update_res.json()
    assert updated_perms["tasks"]["delete"] is True
    assert updated_perms["wholesale"]["display"] is False

    # 5. Admin cannot modify Super Admin permissions
    admin_modify_sa = await async_client.put(
        f"/api/v1/permissions/users/{sa_id}",
        headers=admin_headers,
        json={"permissions": new_perms},
    )
    assert admin_modify_sa.status_code == 403
    assert "Super Admin" in admin_modify_sa.json()["detail"]

    # 6. Non-admin (staff) cannot modify permissions
    staff_modify_res = await async_client.put(
        f"/api/v1/permissions/users/{staff_id}",
        headers=staff_headers,
        json={"permissions": new_perms},
    )
    assert staff_modify_res.status_code == 403

    # 7. Super Admin resets staff permissions back to defaults
    reset_res = await async_client.post(
        f"/api/v1/permissions/users/{staff_id}/reset",
        headers=sa_headers,
    )
    assert reset_res.status_code == 200
    reset_perms = reset_res.json()
    assert reset_perms["tasks"]["delete"] is False  # default for staff is False
