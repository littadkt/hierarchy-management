import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_attendance_checkin_checkout_and_report_flow(async_client: AsyncClient):
    await seed_data()

    # 1. Login as Staff
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    staff_id = staff_login.json()["user"]["id"]

    # 2. Check today's status initially (should not be checked in)
    initial_status = await async_client.get("/api/v1/attendance/today", headers=staff_headers)
    assert initial_status.status_code == 200
    assert initial_status.json()["is_checked_in"] is False
    assert initial_status.json()["is_checked_out"] is False

    # 3. Perform Check-In
    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "Office desk work at Kochi"},
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    check_in_data = check_in_res.json()
    assert check_in_data["status"] == "CHECKED_IN"
    assert check_in_data["check_in_time"] is not None
    assert check_in_data["check_out_time"] is None
    assert "Office desk work" in check_in_data["check_in_note"]

    # 4. Attempt duplicate check-in (should fail with 400)
    dup_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "Duplicate check-in"},
        headers=staff_headers,
    )
    assert dup_res.status_code == 400

    # 5. Check today's status (should now be checked in)
    status_mid = await async_client.get("/api/v1/attendance/today", headers=staff_headers)
    assert status_mid.status_code == 200
    assert status_mid.json()["is_checked_in"] is True
    assert status_mid.json()["is_checked_out"] is False

    # 6. Perform Check-Out
    check_out_res = await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Completed daily tasks and sprint review"},
        headers=staff_headers,
    )
    assert check_out_res.status_code == 200
    check_out_data = check_out_res.json()
    assert check_out_data["check_out_time"] is not None
    assert check_out_data["total_hours"] >= 0.0
    assert check_out_data["status"] in ["PRESENT", "HALF_DAY"]
    assert "Completed daily tasks" in check_out_data["check_out_note"]

    # 7. Check today's status after checkout
    status_final = await async_client.get("/api/v1/attendance/today", headers=staff_headers)
    assert status_final.status_code == 200
    assert status_final.json()["is_checked_in"] is True
    assert status_final.json()["is_checked_out"] is True

    # 8. Check personal attendance history
    my_hist = await async_client.get("/api/v1/attendance/my-history", headers=staff_headers)
    assert my_hist.status_code == 200
    hist_json = my_hist.json()
    assert hist_json["total"] >= 1
    assert hist_json["items"][0]["user_id"] == staff_id

    # 9. Login as Super Admin to verify attendance report and Excel export
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    report_res = await async_client.get("/api/v1/attendance/report", headers=sa_headers)
    assert report_res.status_code == 200
    rep_json = report_res.json()
    assert rep_json["total"] >= 1
    assert "summary" in rep_json
    assert rep_json["summary"]["total_records"] >= 1

    # 10. Test Excel Export
    export_res = await async_client.get("/api/v1/attendance/export", headers=sa_headers)
    assert export_res.status_code == 200
    assert "spreadsheetml" in export_res.headers["content-type"]
    assert len(export_res.content) > 100
