from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import Role, User
from app.schemas.schedule import TimeScheduleCreate, TimeScheduleOut, TimeScheduleUpdate
from app.services.schedule_service import ScheduleService

router = APIRouter()


@router.get("", response_model=List[TimeScheduleOut])
async def list_time_schedules(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """List all available time schedules / shifts"""
    return await ScheduleService.list_schedules(session)


@router.post("", response_model=TimeScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_time_schedule(
    payload: TimeScheduleCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a new time schedule (Super Admin and Admin only)"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can create time schedules.",
        )
    return await ScheduleService.create_schedule(session, payload)


@router.put("/{schedule_id}", response_model=TimeScheduleOut)
async def update_time_schedule(
    schedule_id: uuid.UUID,
    payload: TimeScheduleUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Update an existing time schedule (Super Admin and Admin only)"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can update time schedules.",
        )
    return await ScheduleService.update_schedule(session, schedule_id, payload)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_schedule(
    schedule_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a time schedule (Super Admin and Admin only)"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can delete time schedules.",
        )
    await ScheduleService.delete_schedule(session, schedule_id)
