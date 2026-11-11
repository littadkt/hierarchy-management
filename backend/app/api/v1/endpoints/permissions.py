import logging
from typing import Any, Dict, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.permissions import HierarchyPermissionError
from app.models.user import Role, User
from app.schemas.user import UserPermissionsUpdate
from app.services.permission_service import PermissionService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/windows", response_model=List[Dict[str, Any]])
async def get_accessible_windows(
    current_user: User = Depends(get_current_user),
):
    """
    Get the list of accessible windows and features hierarchy.
    Accessible to Admin and Super Admin.
    """
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HierarchyPermissionError("Only Admins and Super Admins can access permissions management.")

    return PermissionService.get_windows()


@router.get("/users/{user_id}", response_model=Dict[str, Dict[str, bool]])
async def get_user_permissions(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get effective permissions for a specific user.
    """
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HierarchyPermissionError("Only Admins and Super Admins can view user permissions.")

    result = await session.execute(select(User).where(User.id == user_id))
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    return PermissionService.get_user_permissions(target_user)


@router.put("/users/{user_id}", response_model=Dict[str, Dict[str, bool]])
async def update_user_permissions(
    user_id: uuid.UUID,
    payload: UserPermissionsUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update permissions for a specific user (Add, Display, Edit, Delete).
    Restricted to Super Admin and Admin.
    """
    # Transform Pydantic model to dict
    perms_dict = {
        k: v.model_dump() for k, v in payload.permissions.items()
    }
    return await PermissionService.update_user_permissions(
        session=session,
        operator=current_user,
        target_user_id=user_id,
        new_permissions=perms_dict,
    )


@router.post("/users/{user_id}/reset", response_model=Dict[str, Dict[str, bool]])
async def reset_user_permissions(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reset permissions for a user back to role defaults.
    """
    return await PermissionService.reset_user_permissions(
        session=session,
        operator=current_user,
        target_user_id=user_id,
    )
