import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.inventory import InventoryItem


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True, index=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    allowed_wifi_ips: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="Comma-separated allowed IP/CIDR addresses")
    wifi_ssid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="Office Wi-Fi SSID")
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

    # Relationships
    inventory_items: Mapped[List["InventoryItem"]] = relationship(
        "InventoryItem",
        back_populates="branch",
        cascade="all, delete-orphan",
    )
