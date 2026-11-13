import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    CHECKED_IN = "CHECKED_IN"
    HALF_DAY = "HALF_DAY"
    LATE = "LATE"
    ON_LEAVE = "ON_LEAVE"


class Attendance(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True, comment="YYYY-MM-DD"
    )
    check_in_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    check_out_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_hours: Mapped[float] = mapped_column(
        Float, default=0.0, nullable=False
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        Enum(
            AttendanceStatus,
            name="attendance_status_enum",
            native_enum=False,
        ),
        default=AttendanceStatus.CHECKED_IN,
        nullable=False,
        index=True,
    )

    # Shift Schedule & Buffer Tracking
    schedule_check_in: Mapped[Optional[str]] = mapped_column(
        String(8), nullable=True, comment="Scheduled check-in time (HH:MM)"
    )
    schedule_check_out: Mapped[Optional[str]] = mapped_column(
        String(8), nullable=True, comment="Scheduled check-out time (HH:MM)"
    )
    is_buffer_used: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Whether 10-min grace buffer was used"
    )
    is_late: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Whether check-in was late"
    )
    late_minutes: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Minutes late past scheduled check-in"
    )

    check_in_note: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    check_out_note: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )

    # Wi-Fi Restriction, Geolocation & Off-Network Approval
    approval_status: Mapped[str] = mapped_column(
        String(30), default="APPROVED", nullable=False, index=True, comment="APPROVED, PENDING, REJECTED"
    )
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True, comment="True if checked in outside designated office Wi-Fi"
    )
    latitude: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="GPS Latitude"
    )
    longitude: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="GPS Longitude"
    )
    accuracy: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True, comment="GPS Accuracy in meters"
    )
    wifi_ssid: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="Connected Wi-Fi SSID reported by client"
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
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
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")
    approved_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[approved_by_id], lazy="joined")
