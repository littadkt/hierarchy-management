import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.branch import Branch


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    branch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    code: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False, comment="Barcode"
    )
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="", index=True)
    rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="", index=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="")
    vendor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

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
    branch: Mapped[Optional["Branch"]] = relationship(
        "Branch",
        back_populates="inventory_items",
        lazy="joined",
    )

    @property
    def branch_name(self) -> Optional[str]:
        return self.branch.name if self.branch else None


