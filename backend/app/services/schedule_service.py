from datetime import datetime, timezone
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import TimeSchedule
from app.models.user import User
from app.schemas.schedule import TimeScheduleCreate, TimeScheduleOut, TimeScheduleUpdate


class ScheduleService:
    @staticmethod
    async def list_schedules(session: AsyncSession) -> List[TimeScheduleOut]:
        # Fetch schedules along with employee counts
        stmt = (
            select(
                TimeSchedule,
                func.count(User.id).label("employee_count"),
            )
            .outerjoin(User, User.schedule_id == TimeSchedule.id)
            .group_by(TimeSchedule.id)
            .order_by(TimeSchedule.name.asc())
        )
        results = (await session.execute(stmt)).all()

        schedules_out = []
        for sched, count in results:
            out = TimeScheduleOut.model_validate(sched)
            out.employee_count = count
            schedules_out.append(out)
        return schedules_out

    @staticmethod
    async def get_by_id(session: AsyncSession, schedule_id: uuid.UUID) -> Optional[TimeSchedule]:
        stmt = select(TimeSchedule).where(TimeSchedule.id == schedule_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def create_schedule(session: AsyncSession, payload: TimeScheduleCreate) -> TimeScheduleOut:
        # Check uniqueness by name
        stmt = select(TimeSchedule).where(func.lower(TimeSchedule.name) == payload.name.strip().lower())
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time schedule with name '{payload.name}' already exists.",
            )

        schedule = TimeSchedule(
            name=payload.name.strip(),
            check_in_time=payload.check_in_time.strip(),
            check_out_time=payload.check_out_time.strip(),
            buffer_minutes=payload.buffer_minutes,
            monthly_buffer_limit=payload.monthly_buffer_limit,
            description=payload.description.strip() if payload.description else None,
            is_active=True,
        )
        session.add(schedule)
        await session.commit()
        await session.refresh(schedule)

        out = TimeScheduleOut.model_validate(schedule)
        out.employee_count = 0
        return out

    @staticmethod
    async def update_schedule(
        session: AsyncSession, schedule_id: uuid.UUID, payload: TimeScheduleUpdate
    ) -> TimeScheduleOut:
        schedule = await ScheduleService.get_by_id(session, schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Time schedule not found.",
            )

        if payload.name is not None and payload.name.strip().lower() != schedule.name.lower():
            stmt = select(TimeSchedule).where(
                func.lower(TimeSchedule.name) == payload.name.strip().lower(),
                TimeSchedule.id != schedule_id,
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another time schedule with name '{payload.name}' already exists.",
                )
            schedule.name = payload.name.strip()

        if payload.check_in_time is not None:
            schedule.check_in_time = payload.check_in_time.strip()
        if payload.check_out_time is not None:
            schedule.check_out_time = payload.check_out_time.strip()
        if payload.buffer_minutes is not None:
            schedule.buffer_minutes = payload.buffer_minutes
        if payload.monthly_buffer_limit is not None:
            schedule.monthly_buffer_limit = payload.monthly_buffer_limit
        if payload.description is not None:
            schedule.description = payload.description.strip() if payload.description else None
        if payload.is_active is not None:
            schedule.is_active = payload.is_active

        schedule.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(schedule)

        # Count users
        count_stmt = select(func.count(User.id)).where(User.schedule_id == schedule_id)
        count = (await session.execute(count_stmt)).scalar_one() or 0

        out = TimeScheduleOut.model_validate(schedule)
        out.employee_count = count
        return out

    @staticmethod
    async def delete_schedule(session: AsyncSession, schedule_id: uuid.UUID) -> None:
        schedule = await ScheduleService.get_by_id(session, schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Time schedule not found.",
            )

        # Unlink users
        await session.execute(
            select(User).where(User.schedule_id == schedule_id)
        )
        # Delete schedule (users.schedule_id has ondelete="SET NULL")
        await session.delete(schedule)
        await session.commit()
