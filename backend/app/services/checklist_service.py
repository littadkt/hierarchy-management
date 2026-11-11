from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.checklist import ChecklistItem
from app.models.user import User
from app.schemas.checklist import ChecklistCreate, ChecklistUpdate


class ChecklistService:
    @staticmethod
    async def list_items(
        session: AsyncSession,
        current_user: User,
    ) -> List[ChecklistItem]:
        """
        List checklist items strictly belonging to current user.
        Ordered with pending items first, followed by completed items.
        """
        stmt = (
            select(ChecklistItem)
            .options(selectinload(ChecklistItem.target_user))
            .where(ChecklistItem.user_id == current_user.id)
            .order_by(ChecklistItem.is_completed.asc(), ChecklistItem.order_index.asc(), ChecklistItem.created_at.desc())
        )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_item(
        session: AsyncSession,
        current_user: User,
        item_id: uuid.UUID,
    ) -> ChecklistItem:
        stmt = (
            select(ChecklistItem)
            .options(selectinload(ChecklistItem.target_user))
            .where(
                ChecklistItem.id == item_id,
                ChecklistItem.user_id == current_user.id,
            )
        )
        res = await session.execute(stmt)
        item = res.scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Checklist item not found.",
            )
        return item

    @staticmethod
    async def create_item(
        session: AsyncSession,
        current_user: User,
        item_in: ChecklistCreate,
    ) -> ChecklistItem:
        """Create a private quick checklist item for the current user"""
        item = ChecklistItem(
            user_id=current_user.id,
            title=item_in.title.strip(),
            description=item_in.description.strip() if item_in.description else None,
            due_date=item_in.due_date,
            is_completed=False,
            target_user_id=item_in.target_user_id,
        )
        session.add(item)
        await session.commit()
        return await ChecklistService.get_item(session, current_user, item.id)

    @staticmethod
    async def update_item(
        session: AsyncSession,
        current_user: User,
        item_id: uuid.UUID,
        item_in: ChecklistUpdate,
    ) -> ChecklistItem:
        item = await ChecklistService.get_item(session, current_user, item_id)
        if item_in.title is not None:
            item.title = item_in.title.strip()
        if item_in.description is not None:
            item.description = item_in.description.strip() if item_in.description else None
        if item_in.due_date is not None:
            item.due_date = item_in.due_date
        if item_in.is_completed is not None:
            item.is_completed = item_in.is_completed
        if "target_user_id" in item_in.model_fields_set:
            item.target_user_id = item_in.target_user_id

        await session.commit()
        return await ChecklistService.get_item(session, current_user, item.id)

    @staticmethod
    async def toggle_item(
        session: AsyncSession,
        current_user: User,
        item_id: uuid.UUID,
        is_completed: bool,
    ) -> ChecklistItem:
        item = await ChecklistService.get_item(session, current_user, item_id)
        item.is_completed = is_completed
        await session.commit()
        return await ChecklistService.get_item(session, current_user, item.id)

    @staticmethod
    async def delete_item(
        session: AsyncSession,
        current_user: User,
        item_id: uuid.UUID,
    ) -> None:
        item = await ChecklistService.get_item(session, current_user, item_id)
        await session.delete(item)
        await session.commit()

    @staticmethod
    async def clear_completed(
        session: AsyncSession,
        current_user: User,
    ) -> int:
        stmt = delete(ChecklistItem).where(
            ChecklistItem.user_id == current_user.id,
            ChecklistItem.is_completed == True,
        )
        res = await session.execute(stmt)
        await session.commit()
        return res.rowcount or 0

    @staticmethod
    async def reorder_items(
        session: AsyncSession,
        current_user: User,
        item_ids: List[uuid.UUID],
    ) -> None:
        """Rearrange the display order of checklist items for current user"""
        if not item_ids:
            return
        for index, item_id in enumerate(item_ids):
            stmt = select(ChecklistItem).where(
                ChecklistItem.id == item_id,
                ChecklistItem.user_id == current_user.id,
            )
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if item:
                item.order_index = index
        await session.commit()


