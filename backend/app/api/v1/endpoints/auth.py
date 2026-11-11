from datetime import datetime, timezone
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import login_rate_limiter
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    get_password_hash,
    validate_password_strength,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut
from app.services.permission_service import PermissionService
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter()


class LoginJSONRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


def _get_client_ip(request: Request) -> str:
    """Extract client IP handling reverse proxies on private networks"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.post("/login", response_model=AuthResponse)
async def login_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    OAuth2 compatible token login with rate-limiting and timing attack defense.
    """
    client_ip = _get_client_ip(request)
    normalized_email = form_data.username.strip().lower()

    # 1. Check rate limit / brute-force lockout
    is_locked, remaining_seconds = login_rate_limiter.is_locked(ip=client_ip, email=normalized_email)
    if is_locked:
        logger.warning(
            f"Blocked login attempt for '{normalized_email}' from IP {client_ip}: Account/IP locked for {remaining_seconds}s"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Temporarily locked for security. Please try again in {remaining_seconds // 60 + 1} minute(s).",
            headers={"Retry-After": str(remaining_seconds)},
        )

    # 2. Look up user
    user = await UserService.get_by_email(session, normalized_email)

    # 3. Timing-attack prevention: constant time check even if user doesn't exist
    if not user:
        logger.warning(f"Login failed: User '{normalized_email}' not found from IP {client_ip}")
        verify_password(form_data.password, DUMMY_PASSWORD_HASH)
        remaining_attempts, lockout_sec = login_rate_limiter.record_failure(ip=client_ip, email=normalized_email)
        warning = f" ({remaining_attempts} attempts remaining before temporary lockout)" if remaining_attempts > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect email or password{warning}",
        )

    # 4. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Login failed: Incorrect password for user '{normalized_email}' from IP {client_ip}")
        remaining_attempts, lockout_sec = login_rate_limiter.record_failure(ip=client_ip, email=normalized_email)
        warning = f" ({remaining_attempts} attempts remaining before temporary lockout)" if remaining_attempts > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect email or password{warning}",
        )

    # 5. Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account. Please contact an administrator.",
        )

    # 6. Success: reset rate limiter and issue JWT
    login_rate_limiter.record_success(ip=client_ip, email=normalized_email)
    user = await UserService.record_login(
        session,
        user,
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent"),
    )

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"role": user.role.value, "email": user.email},
    )

    logger.info(f"User '{user.email}' logged in successfully from IP {client_ip}")

    user.permissions = PermissionService.get_user_permissions(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/login/json", response_model=AuthResponse)
async def login_json(
    request: Request,
    body: LoginJSONRequest,
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    JSON credentials login endpoint for web frontends with rate-limiting and timing attack defense.
    """
    client_ip = _get_client_ip(request)
    normalized_email = body.email.strip().lower()

    # 1. Check rate limit / brute-force lockout
    is_locked, remaining_seconds = login_rate_limiter.is_locked(ip=client_ip, email=normalized_email)
    if is_locked:
        logger.warning(
            f"Blocked JSON login attempt for '{normalized_email}' from IP {client_ip}: Account/IP locked for {remaining_seconds}s"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Temporarily locked for security. Please try again in {remaining_seconds // 60 + 1} minute(s).",
            headers={"Retry-After": str(remaining_seconds)},
        )

    # 2. Look up user
    user = await UserService.get_by_email(session, normalized_email)

    # 3. Timing-attack prevention: constant time check even if user doesn't exist
    if not user:
        logger.warning(f"JSON Login failed: User '{normalized_email}' not found from IP {client_ip}")
        verify_password(body.password, DUMMY_PASSWORD_HASH)
        remaining_attempts, lockout_sec = login_rate_limiter.record_failure(ip=client_ip, email=normalized_email)
        warning = f" ({remaining_attempts} attempts remaining before temporary lockout)" if remaining_attempts > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect email or password{warning}",
        )

    # 4. Verify password
    if not verify_password(body.password, user.hashed_password):
        logger.warning(f"JSON Login failed: Incorrect password for user '{normalized_email}' from IP {client_ip}")
        remaining_attempts, lockout_sec = login_rate_limiter.record_failure(ip=client_ip, email=normalized_email)
        warning = f" ({remaining_attempts} attempts remaining before temporary lockout)" if remaining_attempts > 0 else ""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect email or password{warning}",
        )

    # 5. Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account. Please contact an administrator.",
        )

    # 6. Success: reset rate limiter and issue JWT
    login_rate_limiter.record_success(ip=client_ip, email=normalized_email)
    user = await UserService.record_login(
        session,
        user,
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent"),
    )

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"role": user.role.value, "email": user.email},
    )

    logger.info(f"User '{user.email}' logged in successfully via JSON from IP {client_ip}")

    user.permissions = PermissionService.get_user_permissions(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Allows any authenticated user to change their own password securely.
    Enforces password complexity requirements.
    """
    # 1. Verify current password
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # 2. Check if new password is identical to current
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be identical to the current password.",
        )

    # 3. Validate password strength
    is_valid, error_msg = validate_password_strength(body.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # 4. Update password
    current_user.hashed_password = get_password_hash(body.new_password)
    session.add(current_user)
    await session.commit()

    logger.info(f"User '{current_user.email}' changed their password successfully.")

    return {"message": "Password changed successfully."}


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Logs out the authenticated user and logs the session termination.
    """
    logger.info(f"User '{current_user.email}' logged out.")
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserOut)
async def get_me(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Return currently logged-in user profile"""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        is_purchase_manager=current_user.is_purchase_manager,
        can_place_wholesale_orders=current_user.can_place_wholesale_orders,
        branch=current_user.branch,
        department=current_user.department,
        reports_to_id=current_user.reports_to_id,
        created_by_id=current_user.created_by_id,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        last_login_at=current_user.last_login_at,
        today_first_login_at=UserService.get_effective_today_first_login(current_user),
        is_on_leave=current_user.is_on_leave,
        leave_date=current_user.leave_date,
        leave_reason=current_user.leave_reason,
        permissions=PermissionService.get_user_permissions(current_user),
    )
