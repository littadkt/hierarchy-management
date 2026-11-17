import pytest
import ipaddress
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data
from app.services.attendance_service import is_ip_in_network, parse_clean_ip
from app.core.ip_utils import clean_ip_str


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
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "103.70.197.110",  # Office Public WAN IP
    }
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


@pytest.mark.asyncio
async def test_off_network_checkin_requires_approval_and_appears_in_approvals(async_client: AsyncClient):
    await seed_data()

    # Login as Staff 2
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff2@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "10.0.0.55",  # Off-network IP
    }

    # Perform off-network check-in
    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={
            "note": "Field site inspection",
            "latitude": 10.8505,
            "longitude": 76.2711,
            "accuracy": 15.0,
        },
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is True
    assert rec["approval_status"] == "PENDING"
    assert rec["latitude"] == 10.8505
    assert rec["longitude"] == 76.2711

    # Login as Super Admin to verify the pending approval appears
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    pending_res = await async_client.get("/api/v1/attendance/pending-approvals", headers=sa_headers)
    assert pending_res.status_code == 200
    pending_items = pending_res.json()
    assert any(item["id"] == rec["id"] for item in pending_items)

    # Approve the check-in
    approve_res = await async_client.post(
        f"/api/v1/attendance/{rec['id']}/approve",
        headers=sa_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["approval_status"] == "APPROVED"


@pytest.mark.asyncio
async def test_office_wifi_public_ip_checkin_does_not_require_approval(async_client: AsyncClient):
    """Scenario 1: Employee connects to office Wi-Fi; CF-Connecting-IP matches office WAN IP -> ON-NETWORK / APPROVED"""
    await seed_data()

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "103.70.197.110",  # Office Public WAN IP
    }

    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "Working at office desk via allowed Wi-Fi"},
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is False
    assert rec["approval_status"] == "APPROVED"
    assert rec["ip_address"] == "103.70.197.110"

    # Checkout
    await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Shift end"},
        headers=staff_headers,
    )


@pytest.mark.asyncio
async def test_personal_mobile_data_checkin_requires_approval(async_client: AsyncClient):
    """Scenario 2: Employee connects using cellular / mobile data -> OFF-NETWORK / PENDING"""
    await seed_data()

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "49.37.10.25",  # Cellular / Mobile carrier public IP
    }

    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={
            "note": "Mobile data punch from road",
            "latitude": 9.9312,
            "longitude": 76.2673,
            "accuracy": 20.0,
        },
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is True
    assert rec["approval_status"] == "PENDING"
    assert rec["ip_address"] == "49.37.10.25"

    # Checkout
    await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Checkout remote"},
        headers=staff_headers,
    )


@pytest.mark.asyncio
async def test_iphone_on_same_office_wifi_ipv6_is_approved(async_client: AsyncClient):
    """Real-world iPhone scenario: User device connects over IPv6 from the same office Wi-Fi -> ON-NETWORK / APPROVED"""
    await seed_data()

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "2403:a080:836:e5e3:542:5a00:e437:d48b",  # iPhone Wi-Fi IPv6
    }

    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "iPhone office Wi-Fi checkin"},
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is False
    assert rec["approval_status"] == "APPROVED"
    assert rec["ip_address"] == "2403:a080:836:e5e3:542:5a00:e437:d48b"

    # Checkout
    await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Checkout iPhone"},
        headers=staff_headers,
    )


@pytest.mark.asyncio
async def test_unauthorized_external_wifi_requires_approval(async_client: AsyncClient):
    """Scenario 3: Employee connects from home/cafe Wi-Fi (unauthorized public WAN) -> OFF-NETWORK / PENDING"""
    await seed_data()

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "117.200.5.12",  # Home broadband ISP public IP
    }

    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "Working from cafe"},
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is True
    assert rec["approval_status"] == "PENDING"
    assert rec["ip_address"] == "117.200.5.12"

    await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Leaving cafe"},
        headers=staff_headers,
    )


@pytest.mark.asyncio
async def test_localhost_ip_never_qualifies_as_office_network(async_client: AsyncClient):
    """Scenario 4: Localhost (127.0.0.1 / ::1) must NEVER qualify as an office network -> fails closed"""
    await seed_data()

    # Direct unit test of is_ip_in_network
    assert is_ip_in_network("127.0.0.1", "192.168.100.0/24") is False
    assert is_ip_in_network("127.0.0.1", "127.0.0.1, 192.168.100.0/24") is False
    assert is_ip_in_network("::1", "127.0.0.1, ::1, 192.168.100.0/24") is False
    assert is_ip_in_network("localhost", "192.168.100.0/24") is False

    # Check-in when headers resolve to loopback
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        # No proxy header provided -> resolves to loopback socket host
    }

    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={"note": "Loopback direct check-in"},
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    assert rec["requires_approval"] is True
    assert rec["approval_status"] == "PENDING"

    # Check out
    await async_client.post(
        "/api/v1/attendance/check-out",
        json={"note": "Checkout loopback"},
        headers=staff_headers,
    )


@pytest.mark.asyncio
async def test_payload_client_ip_spoof_attempt_is_ignored(async_client: AsyncClient):
    """Security: Client cannot spoof allowed IP via JSON body payload"""
    await seed_data()

    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    staff_token = staff_login.json()["access_token"]
    staff_headers = {
        "Authorization": f"Bearer {staff_token}",
        "CF-Connecting-IP": "49.37.10.25",  # Actual mobile client IP
    }

    # Attempt to spoof office public IP in JSON payload
    check_in_res = await async_client.post(
        "/api/v1/attendance/check-in",
        json={
            "note": "Hacker attempt",
            "client_ip": "103.70.197.110",  # Fake payload override
        },
        headers=staff_headers,
    )
    assert check_in_res.status_code == 201
    rec = check_in_res.json()
    # Verification MUST use real network IP (49.37.10.25) and require approval!
    assert rec["requires_approval"] is True
    assert rec["approval_status"] == "PENDING"
    assert rec["ip_address"] == "49.37.10.25"


@pytest.mark.asyncio
async def test_ip_matching_rules_unit():
    """Unit tests for IP matching: CIDR, IPv6, missing/invalid IPs, and fail-closed security"""
    allowed_config = "192.168.100.0/24, 103.70.197.110, 2001:db8:abcd::/48"

    # 1. Valid matches
    assert is_ip_in_network("192.168.100.1", allowed_config) is True
    assert is_ip_in_network("192.168.100.254", allowed_config) is True
    assert is_ip_in_network("103.70.197.110", allowed_config) is True
    assert is_ip_in_network("2001:db8:abcd::1", allowed_config) is True
    assert is_ip_in_network("2001:db8:abcd:ffff::1", allowed_config) is True

    # 2. Non-matches (fail closed)
    assert is_ip_in_network("192.168.101.1", allowed_config) is False
    assert is_ip_in_network("103.70.197.111", allowed_config) is False
    assert is_ip_in_network("49.37.10.25", allowed_config) is False
    assert is_ip_in_network("2001:db8:9999::1", allowed_config) is False

    # 3. Missing / Malformed / Empty
    assert is_ip_in_network(None, allowed_config) is False
    assert is_ip_in_network("", allowed_config) is False
    assert is_ip_in_network("not-an-ip", allowed_config) is False
    assert is_ip_in_network("999.999.999.999", allowed_config) is False
    assert is_ip_in_network("0.0.0.0", allowed_config) is False

    # 4. Loopback never approved
    assert is_ip_in_network("127.0.0.1", allowed_config) is False
    assert is_ip_in_network("::1", allowed_config) is False
    assert is_ip_in_network("127.0.0.5", allowed_config) is False

    # 5. Clean IP utility tests
    assert clean_ip_str(None) is None
    assert clean_ip_str("") is None
    assert clean_ip_str("invalid") is None
    assert clean_ip_str("192.168.1.1:8080") == "192.168.1.1"
    assert clean_ip_str("[2001:db8::1]:443") == "2001:db8::1"
    assert clean_ip_str("::ffff:192.168.1.5") == "192.168.1.5"
