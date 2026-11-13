import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class TimeSchedule(Base):
    __tablename__ = "time_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    check_in_time: Mapped[str] = mapped_column(
        String(8), nullable=False, comment="HH:MM (24-hour format, e.g. 09:00)"
    )
    check_out_time: Mapped[str] = mapped_column(
        String(8), nullable=False, comment="HH:MM (24-hour format, e.g. 18:00)"
    )
    buffer_minutes: Mapped[int] = mapped_column(
        Integer, default=10, nullable=False, comment="Grace buffer period in minutes"
    )
    monthly_buffer_limit: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False, comment="Maximum grace buffer days allowed per month"
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User", back_populates="schedule", foreign_keys="User.schedule_id"
    )
