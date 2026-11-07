import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_department_management_and_cascading_updates(async_client: AsyncClient):
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
            "email": "test_dept_staff@example.com",
            "full_name": "Test Dept Staff",
            "password": "Password123!",
            "role": "STAFF",
        },
        headers=sa_headers,
    )
    assert create_staff.status_code == 201, create_staff.text

    # Login as Staff
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "test_dept_staff@example.com", "password": "Password123!"},
    )
    assert staff_login.status_code == 200, staff_login.text
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 3. List departments (accessible by Super Admin and Staff)
    sa_list = await async_client.get("/api/v1/departments", headers=sa_headers)
    assert sa_list.status_code == 200, sa_list.text
    depts = sa_list.json()
    assert len(depts) >= 1

    staff_list = await async_client.get("/api/v1/departments", headers=staff_headers)
    assert staff_list.status_code == 200

    # 4. Staff cannot create a department (403 Forbidden)
    forbidden_res = await async_client.post(
        "/api/v1/departments",
        json={"name": "Unauthorized Dept"},
        headers=staff_headers,
    )
    assert forbidden_res.status_code == 403

    # 5. Super Admin creates a new department
    new_dept_payload = {
        "name": "Quality Assurance",
        "code": "QA",
        "description": "Software QA & Testing Division",
        "is_active": True,
    }
    create_dept_res = await async_client.post(
        "/api/v1/departments",
        json=new_dept_payload,
        headers=sa_headers,
    )
    assert create_dept_res.status_code == 201, create_dept_res.text
    dept_data = create_dept_res.json()
    dept_id = dept_data["id"]
    assert dept_data["name"] == "Quality Assurance"
    assert dept_data["code"] == "QA"

    # Duplicate department name prevented (400)
    dup_res = await async_client.post(
        "/api/v1/departments",
        json={"name": "Quality Assurance"},
        headers=sa_headers,
    )
    assert dup_res.status_code == 400

    # 6. Assign a team leader to this department
    tl_payload = {
        "email": "qa_tl@example.com",
        "full_name": "QA Team Leader",
        "password": "Password123!",
        "role": "TEAM_LEADER",
        "department": "Quality Assurance",
    }
    tl_res = await async_client.post("/api/v1/users/", json=tl_payload, headers=sa_headers)
    assert tl_res.status_code == 201, tl_res.text
    tl_user = tl_res.json()
    tl_id = tl_user["id"]
    assert tl_user["department"] == "Quality Assurance"

    # 7. Edit TL's department to "Engineering"
    edit_tl_res = await async_client.put(
        f"/api/v1/users/{tl_id}",
        json={"full_name": "QA Team Leader", "email": "qa_tl@example.com", "department": "Engineering"},
        headers=sa_headers,
    )
    assert edit_tl_res.status_code == 200, edit_tl_res.text
    assert edit_tl_res.json()["department"] == "Engineering"

    # Re-assign back to "Quality Assurance" using PATCH
    patch_tl_res = await async_client.patch(
        f"/api/v1/users/{tl_id}",
        json={"department": "Quality Assurance"},
        headers=sa_headers,
    )
    assert patch_tl_res.status_code == 200
    assert patch_tl_res.json()["department"] == "Quality Assurance"

    # 8. Update department name and verify cascading user update
    update_dept_res = await async_client.put(
        f"/api/v1/departments/{dept_id}",
        json={"name": "QA & Automation", "description": "Automated Testing Division"},
        headers=sa_headers,
    )
    assert update_dept_res.status_code == 200
    assert update_dept_res.json()["name"] == "QA & Automation"

    # Verify that the team leader's department reference was cascaded
    refreshed_tl = await async_client.get(f"/api/v1/users/{tl_id}", headers=sa_headers)
    assert refreshed_tl.json()["department"] == "QA & Automation"

    # 9. Attempt to delete department with assigned user fails with 400
    delete_fail = await async_client.delete(f"/api/v1/departments/{dept_id}", headers=sa_headers)
    assert delete_fail.status_code == 400
    assert "user(s) are currently assigned" in delete_fail.text

    # 10. Delete user first, then delete department succeeds
    await async_client.delete(f"/api/v1/users/{tl_id}", headers=sa_headers)
    delete_ok = await async_client.delete(f"/api/v1/departments/{dept_id}", headers=sa_headers)
    assert delete_ok.status_code == 204

