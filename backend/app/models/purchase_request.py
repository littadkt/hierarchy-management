import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.inventory import InventoryItem
    from app.models.user import User


class PurchaseRequestStatus(str, enum.Enum):
    OPEN = "OPEN"
    ORDERED = "ORDERED"
    NOT_IN_STOCK = "NOT_IN_STOCK"
    RECEIVED = "RECEIVED"


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    inventory_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False, comment="Barcode"
    )
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="")
    rate: Mapped[Optional[float]] = mapped_column(Float, default=0.0, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="")
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="")
    vendor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="")
    quantity: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False, comment="Requested quantity"
    )

    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purchase_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[PurchaseRequestStatus] = mapped_column(
        Enum(
            PurchaseRequestStatus,
            name="purchase_request_status_enum",
            native_enum=False,
        ),
        default=PurchaseRequestStatus.OPEN,
        nullable=False,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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
    requested_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[requested_by_id],
    )
    purchase_manager: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[purchase_manager_id],
    )
    inventory_item: Mapped[Optional["InventoryItem"]] = relationship(
        "InventoryItem",
        foreign_keys=[inventory_item_id],
    )
    history: Mapped[List["PurchaseRequestHistory"]] = relationship(
        "PurchaseRequestHistory",
        back_populates="purchase_request",
        cascade="all, delete-orphan",
        order_by="desc(PurchaseRequestHistory.created_at)",
    )


class PurchaseRequestHistory(Base):
    __tablename__ = "purchase_request_histories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    purchase_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    changed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    old_status: Mapped[Optional[PurchaseRequestStatus]] = mapped_column(
        Enum(
            PurchaseRequestStatus,
            name="purchase_request_status_enum",
            native_enum=False,
        ),
        nullable=True,
    )
    new_status: Mapped[PurchaseRequestStatus] = mapped_column(
        Enum(
            PurchaseRequestStatus,
            name="purchase_request_status_enum",
            native_enum=False,
        ),
        nullable=False,
    )
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    purchase_request: Mapped["PurchaseRequest"] = relationship(
        "PurchaseRequest",
        back_populates="history",
    )
    changed_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[changed_by_id],
    )

