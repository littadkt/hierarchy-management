import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class WarrantyStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    SEND_TO_COMPANY = "SEND_TO_COMPANY"
    WARRANTY_COMPLETED = "WARRANTY_COMPLETED"
    REJECTED = "REJECTED"
    DELIVERED = "DELIVERED"


class WarrantyServiceType(Base):
    __tablename__ = "warranty_service_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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


class WarrantyStaff(Base):
    __tablename__ = "warranty_staff"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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


class WarrantyBrand(Base):
    __tablename__ = "warranty_brands"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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


class WarrantyModel(Base):
    __tablename__ = "warranty_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    brand_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warranty_brands.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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

    brand: Mapped[Optional["WarrantyBrand"]] = relationship("WarrantyBrand", lazy="selectin")


class WarrantyJob(Base):
    __tablename__ = "warranty_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )

    # 1. Customer details
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    customer_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 2. Service type
    service_type_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warranty_service_types.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    service_type_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 3. Staff
    staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warranty_staff.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    staff_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    # 4. Product details
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    serial_number: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    brand_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warranty_brands.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    brand_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warranty_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 5. Work description & Status
    work_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WarrantyStatus] = mapped_column(
        Enum(WarrantyStatus, name="warranty_status_enum", native_enum=False),
        default=WarrantyStatus.RECEIVED,
        nullable=False,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Dates
    received_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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
    service_type: Mapped[Optional[WarrantyServiceType]] = relationship(
        "WarrantyServiceType", lazy="selectin"
    )
    staff: Mapped[Optional[WarrantyStaff]] = relationship(
        "WarrantyStaff", lazy="selectin"
    )
    brand: Mapped[Optional[WarrantyBrand]] = relationship(
        "WarrantyBrand", lazy="selectin"
    )
    model_rel: Mapped[Optional[WarrantyModel]] = relationship(
        "WarrantyModel", lazy="selectin"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", lazy="selectin", foreign_keys=[created_by_id]
    )
