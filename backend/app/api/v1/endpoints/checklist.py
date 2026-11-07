from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.checklist import (
    ChecklistCreate,
    ChecklistOut,
    ChecklistToggle,
    ChecklistUpdate,
)
from app.services.checklist_service import ChecklistService

router = APIRouter()


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

