import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationOut
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def get_my_notifications(
    limit: int = Query(50, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Retrieve notifications for the current authenticated user."""
    return await NotificationService.list_for_user(
        session=session,
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Mark a specific notification as read."""
    notif = await NotificationService.mark_as_read(
        session=session,
        user_id=current_user.id,
        notification_id=notification_id,
    )
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notif


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Mark all unread notifications for the current user as read."""
    count = await NotificationService.mark_all_as_read(
        session=session,
        user_id=current_user.id,
    )
    return {"message": "All notifications marked as read", "count": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Delete a specific notification."""
    success = await NotificationService.delete(
        session=session,
        user_id=current_user.id,
        notification_id=notification_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"message": "Notification deleted successfully"}
