import pytest
from httpx import AsyncClient
from app.core.rate_limit import login_rate_limiter


@pytest.mark.asyncio
async def test_security_headers(async_client: AsyncClient):
    """Verify OWASP security headers are present in responses"""
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("x-frame-options") == "SAMEORIGIN"
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-xss-protection") == "1; mode=block"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_timing_attack_nonexistent_user(async_client: AsyncClient):
    """Verify non-existent email returns generic 400 and does not leak existence"""
    login_rate_limiter.reset()
    res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "nonexistent_employee_123@example.com", "password": "WrongPassword123!"},
    )
    assert res.status_code == 400
    assert "Incorrect email or password" in res.json()["detail"]


@pytest.mark.asyncio
async def test_login_rate_limiting_lockout(async_client: AsyncClient):
    """Verify brute-force rate limiter blocks attacker after 5 failed attempts"""
    login_rate_limiter.reset()
    target_email = "brute_target@example.com"

    # Send 5 failed attempts
    for i in range(5):
        res = await async_client.post(
            "/api/v1/auth/login",
            data={"username": target_email, "password": f"BadPassword{i}!"},
        )
        assert res.status_code == 400

    # 6th attempt should be blocked by rate limiter with 429
    blocked_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": target_email, "password": "AnotherBadPassword!"},
    )
    assert blocked_res.status_code == 429
    assert "Temporarily locked for security" in blocked_res.json()["detail"]
    assert "retry-after" in blocked_res.headers

    # Reset limiter for other tests
    login_rate_limiter.reset()


@pytest.mark.asyncio
async def test_change_password_workflow(async_client: AsyncClient):
    """Verify change-password endpoint requires strong password and works correctly"""
    login_rate_limiter.reset()

    # 1. Login as Super Admin
    login_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Try changing with wrong current password
    fail_res = await async_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongCurrentPassword!", "new_password": "NewSecretPass123!"},
        headers=headers,
    )
    assert fail_res.status_code == 400
    assert "Current password is incorrect" in fail_res.json()["detail"]

    # 3. Try changing with weak new password (too short or missing number)
    weak_res = await async_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "SuperAdmin@123", "new_password": "weak"},
        headers=headers,
    )
    assert weak_res.status_code == 422 or weak_res.status_code == 400

    # 4. Successfully change password
    change_res = await async_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "SuperAdmin@123", "new_password": "UpdatedSuperAdmin456!"},
        headers=headers,
    )
    assert change_res.status_code == 200
    assert "successfully" in change_res.json()["message"]

    # 5. Old password no longer works
    old_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert old_login.status_code == 400

    # 6. New password works
    new_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "UpdatedSuperAdmin456!"},
    )
    assert new_login.status_code == 200
    new_token = new_login.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # 7. Revert back to SuperAdmin@123 for other tests
    revert_res = await async_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "UpdatedSuperAdmin456!", "new_password": "SuperAdmin@123"},
        headers=new_headers,
    )
    assert revert_res.status_code == 200


@pytest.mark.asyncio
async def test_single_active_session_enforcement(async_client: AsyncClient):
    """
    Verify single active session policy:
    1. Login from Session 1 -> works.
    2. Login from Session 2 (another device/tab) -> Session 2 works.
    3. Session 1 is superseded and gets 401.
    4. Explicit logout clears active session so even the last token is terminated.
    """
    login_rate_limiter.reset()

    # 1. Login Session 1 (e.g. Browser 1 / Tab 1)
    res_1 = await async_client.post(
        "/api/v1/auth/login/json",
        json={"email": "staff1@example.com", "password": "Staff@123"},
    )
    assert res_1.status_code == 200
    data_1 = res_1.json()
    token_1 = data_1["access_token"]
    sid_1 = data_1.get("session_id")
    assert sid_1 is not None

    headers_1 = {"Authorization": f"Bearer {token_1}"}

    # Verify Session 1 works
    me_1 = await async_client.get("/api/v1/auth/me", headers=headers_1)
    assert me_1.status_code == 200
    assert me_1.json()["email"] == "staff1@example.com"

    # 2. Login Session 2 (e.g. Browser 2 / Tab 2 / another system)
    res_2 = await async_client.post(
        "/api/v1/auth/login/json",
        json={"email": "staff1@example.com", "password": "Staff@123"},
    )
    assert res_2.status_code == 200
    data_2 = res_2.json()
    token_2 = data_2["access_token"]
    sid_2 = data_2.get("session_id")
    assert sid_2 is not None
    assert sid_2 != sid_1, "Each new login session must generate a distinct session_id"

    headers_2 = {"Authorization": f"Bearer {token_2}"}

    # Verify Session 2 works
    me_2 = await async_client.get("/api/v1/auth/me", headers=headers_2)
    assert me_2.status_code == 200
    assert me_2.json()["email"] == "staff1@example.com"

    # 3. Session 1 MUST be rejected with 401 because it was superseded
    me_1_superseded = await async_client.get("/api/v1/auth/me", headers=headers_1)
    assert me_1_superseded.status_code == 401
    assert "superseded" in me_1_superseded.json()["detail"].lower()

    # 4. Explicit logout with Session 2
    logout_res = await async_client.post("/api/v1/auth/logout", headers=headers_2)
    assert logout_res.status_code == 200

    # 5. Session 2 is now terminated and should also be rejected with 401
    me_2_terminated = await async_client.get("/api/v1/auth/me", headers=headers_2)
    assert me_2_terminated.status_code == 401


