from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.checklist import (
    ChecklistCreate,
    ChecklistOut,
    ChecklistReorderRequest,
    ChecklistToggle,
    ChecklistUpdate,
)
from app.schemas.user import UserBrief
from app.services.checklist_service import ChecklistService

router = APIRouter()


@router.get("/users", response_model=List[UserBrief])
async def get_checklist_selectable_users(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get active users directory for optional user selection in checklist items.
    Accessible to all users.
    """
    stmt = (
        select(User)
        .where(User.is_active == True)
        .order_by(User.role, User.full_name)
    )
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("", response_model=List[ChecklistOut])
@router.get("/", response_model=List[ChecklistOut], include_in_schema=False)
async def list_checklist_items(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get personal checklist / quick tasks for the current user.
    Accessible to all user roles (Super Admin, Admin, In-Charge, Team Leader, Staff).
    """
    return await ChecklistService.list_items(session, current_user)


@router.post("", response_model=ChecklistOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ChecklistOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_checklist_item(
    item_in: ChecklistCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new personal quick task to checklist"""
    return await ChecklistService.create_item(session, current_user, item_in)


@router.delete("/clear-completed", status_code=status.HTTP_200_OK)
async def clear_completed_checklist_items(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Remove all completed checklist items for current user"""
    count = await ChecklistService.clear_completed(session, current_user)
    return {"cleared_count": count}


@router.patch("/reorder", status_code=status.HTTP_200_OK)
async def reorder_checklist_items(
    payload: ChecklistReorderRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Rearrange order of checklist items"""
    await ChecklistService.reorder_items(session, current_user, payload.item_ids)
    return {"message": "Checklist items reordered successfully"}


@router.put("/{item_id}", response_model=ChecklistOut)
async def update_checklist_item(
    item_id: uuid.UUID,
    item_in: ChecklistUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Edit personal checklist item"""
    return await ChecklistService.update_item(session, current_user, item_id, item_in)


@router.patch("/{item_id}/toggle", response_model=ChecklistOut)
async def toggle_checklist_item(
    item_id: uuid.UUID,
    payload: ChecklistToggle,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Quickly check or uncheck checklist item"""
    return await ChecklistService.toggle_item(
        session, current_user, item_id, payload.is_completed
    )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete personal checklist item"""
    await ChecklistService.delete_item(session, current_user, item_id)

