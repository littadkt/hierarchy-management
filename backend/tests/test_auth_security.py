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

