from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserBrief, UserCreate, UserLeaveUpdate, UserOut, UserUpdate
from app.services.permission_service import PermissionService
from app.services.user_service import UserService

router = APIRouter()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_user(
    user_in: UserCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new user within hierarchy provisions:
    - Super Admin: Can create Super Admin, Admin (and any level below)
    - Admin: Can create In-charge
    - In-charge: Can create Team leader and Staff
    - Team leader: Can create Staff
    - Staff: Restricted from creating users
    """
    return await UserService.create_user(session, current_user, user_in)


@router.get("/assignable", response_model=List[UserBrief])
async def get_assignable_users(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Returns users whom the logged-in user can assign tasks to:
    - Super Admin: Anyone at any level
    - Admin: Up to staff level (In-charge, Team Leader, Staff, Self)
    - In-charge: Up to staff level (Team Leader, Staff, Self)
    - Team Leader: Staff and Self
    - Staff: Self only
    """
    return await UserService.get_assignable_users(session, current_user)


@router.get("/eligible-approvers", response_model=List[UserBrief])
async def get_eligible_approvers(
    for_user_id: uuid.UUID = Query(..., description="ID of the user who is assigned the task"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Populates the 'needs approval from higher level (from whom?)' dropdown.
    Returns all active users whose role level is strictly higher than the target assignee.
    """
    return await UserService.get_eligible_approvers(session, for_user_id)


@router.get("", response_model=List[UserOut])
@router.get("/", response_model=List[UserOut], include_in_schema=False)
async def list_users(
    role: Optional[Role] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List accessible users according to role hierarchy with today's first login times for Super Admin and Admins"""
    users = await UserService.get_manageable_users(session, current_user)

    if role:
        users = [u for u in users if u.role == role]

    can_see_login = current_user.role in [Role.SUPER_ADMIN, Role.ADMIN]
    results = []
    for u in users:
        is_self = u.id == current_user.id
        today_login = (
            UserService.get_effective_today_first_login(u)
            if (can_see_login or is_self)
            else None
        )
        last_login = u.last_login_at if (can_see_login or is_self) else None

        results.append(
            UserOut(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                is_active=u.is_active,
                is_purchase_manager=u.is_purchase_manager,
                can_place_wholesale_orders=u.can_place_wholesale_orders,
                branch=u.branch,
                department=u.department,
                reports_to_id=u.reports_to_id,
                created_by_id=u.created_by_id,
                created_at=u.created_at,
                updated_at=u.updated_at,
                last_login_at=last_login,
                today_first_login_at=today_login,
                is_on_leave=u.is_on_leave,
                leave_date=u.leave_date,
                leave_reason=u.leave_reason,
                permissions=PermissionService.get_user_permissions(u),
            )
        )
    return results


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get user details by ID"""
    user = await UserService.get_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    can_see_login = current_user.role in [Role.SUPER_ADMIN, Role.ADMIN] or current_user.id == user.id
    today_login = UserService.get_effective_today_first_login(user) if can_see_login else None
    last_login = user.last_login_at if can_see_login else None

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_purchase_manager=user.is_purchase_manager,
        can_place_wholesale_orders=user.can_place_wholesale_orders,
        branch=user.branch,
        department=user.department,
        reports_to_id=user.reports_to_id,
        created_by_id=user.created_by_id,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=last_login,
        today_first_login_at=today_login,
        is_on_leave=user.is_on_leave,
        leave_date=user.leave_date,
        leave_reason=user.leave_reason,
        permissions=PermissionService.get_user_permissions(user),
    )


@router.post("/{user_id}/leave", response_model=UserOut)
async def set_user_leave(
    user_id: uuid.UUID,
    payload: UserLeaveUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Mark or unmark user as on leave.
    Provision restricted to Admins and Super Admins.
    """
    user = await UserService.set_user_leave(session, current_user, user_id, payload)
    can_see_login = current_user.role in [Role.SUPER_ADMIN, Role.ADMIN] or current_user.id == user.id
    today_login = UserService.get_effective_today_first_login(user) if can_see_login else None
    last_login = user.last_login_at if can_see_login else None
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_purchase_manager=user.is_purchase_manager,
        can_place_wholesale_orders=user.can_place_wholesale_orders,
        branch=user.branch,
        department=user.department,
        reports_to_id=user.reports_to_id,
        created_by_id=user.created_by_id,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=last_login,
        today_first_login_at=today_login,
        is_on_leave=user.is_on_leave,
        leave_date=user.leave_date,
        leave_reason=user.leave_reason,
        permissions=PermissionService.get_user_permissions(user),
    )


@router.put("/{user_id}", response_model=UserOut)
@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update user details respecting hierarchy restrictions:
    - Admin CANNOT edit In-charge
    - In-charge CANNOT edit Team Leader
    - Team Leader CANNOT edit Staff
    - Staff CANNOT edit others
    """
    return await UserService.update_user(session, current_user, user_id, user_in)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete user respecting hierarchy restrictions:
    - Admin CANNOT delete In-charge
    - In-charge CANNOT delete Team Leader
    - Team Leader CANNOT delete Staff
    - Staff CANNOT delete anyone
    """
    await UserService.delete_user(session, current_user, user_id)

