import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.broadcaster import broadcaster
from app.models.notification import Notification
from app.schemas.notification import NotificationListResponse, NotificationOut

logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    async def create(
        session: AsyncSession,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: str = "SYSTEM",
        link: Optional[str] = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            link=link,
            is_read=False,
        )
        session.add(notification)
        await session.commit()
        await session.refresh(notification)

        # Broadcast via realtime SSE
        try:
            notif_data = {
                "id": str(notification.id),
                "user_id": str(notification.user_id),
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "link": notification.link,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat(),
            }
            await broadcaster.broadcast(
                "NOTIFICATION_RECEIVED",
                {
                    "user_id": str(user_id),
                    "notification": notif_data,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast notification: {e}")

        return notification

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        limit: int = 50,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)

        stmt = stmt.limit(limit)
        res = await session.execute(stmt)
        items = list(res.scalars().all())

        # Unread count
        unread_stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        unread_res = await session.execute(unread_stmt)
        unread_count = unread_res.scalar_one() or 0

        # Total count
        total_stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
        )
        total_res = await session.execute(total_stmt)
        total = total_res.scalar_one() or 0

        return NotificationListResponse(
            items=[NotificationOut.model_validate(it) for it in items],
            total=total,
            unread_count=unread_count,
        )

    @staticmethod
    async def mark_as_read(
        session: AsyncSession,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> Optional[Notification]:
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        res = await session.execute(stmt)
        notification = res.scalar_one_or_none()
        if not notification:
            return None

        notification.is_read = True
        await session.commit()
        await session.refresh(notification)

        # Notify realtime
        await broadcaster.broadcast(
            "NOTIFICATION_UPDATED",
            {"user_id": str(user_id), "notification_id": str(notification_id), "is_read": True},
        )
        return notification

    @staticmethod
    async def mark_all_as_read(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        res = await session.execute(stmt)
        await session.commit()

        await broadcaster.broadcast(
            "NOTIFICATION_UPDATED",
            {"user_id": str(user_id), "all_read": True},
        )
        return res.rowcount

    @staticmethod
    async def delete(
        session: AsyncSession,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
    ) -> bool:
        stmt = delete(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        res = await session.execute(stmt)
        await session.commit()
        return res.rowcount > 0
