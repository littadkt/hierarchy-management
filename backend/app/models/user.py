import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.task_activity import TaskActivity
    from app.models.task_comment import TaskComment
    from app.models.checklist import ChecklistItem


class Role(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    IN_CHARGE = "IN_CHARGE"
    TEAM_LEADER = "TEAM_LEADER"
    STAFF = "STAFF"

    @property
    def level(self) -> int:
        """Numerical hierarchy level: 1 (highest) to 5 (lowest)"""
        levels = {
            "SUPER_ADMIN": 1,
            "ADMIN": 2,
            "IN_CHARGE": 3,
            "TEAM_LEADER": 4,
            "STAFF": 5,
        }
        return levels[self.value]


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_purchase_manager: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    can_place_wholesale_orders: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    # Organizational Categorization
    branch: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Reporting / Lineage Hierarchy
    reports_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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

    # Login tracking fields
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    today_first_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    today_first_login_date: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        index=True,
    )

    # Leave tracking fields
    is_on_leave: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    leave_date: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
        index=True,
    )
    leave_reason: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Window permissions overrides: {"window_id": {"add": bool, "display": bool, "edit": bool, "delete": bool}}
    permissions: Mapped[Optional[dict]] = mapped_column(
        JSON,
        default=dict,
        nullable=True,
    )

    # Self-referential relationships
    manager: Mapped[Optional["User"]] = relationship(
        "User",
        remote_side=[id],
        foreign_keys=[reports_to_id],
        back_populates="subordinates",
    )
    subordinates: Mapped[List["User"]] = relationship(
        "User",
        foreign_keys=[reports_to_id],
        back_populates="manager",
    )

    creator: Mapped[Optional["User"]] = relationship(
        "User",
        remote_side=[id],
        foreign_keys=[created_by_id],
        back_populates="created_users",
    )
    created_users: Mapped[List["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="creator",
    )

    # Tasks relationships
    created_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.created_by_id",
        back_populates="created_by",
        cascade="all, delete-orphan",
    )
    assigned_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.assigned_to_id",
        back_populates="assigned_to",
    )
    approval_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.approver_id",
        back_populates="approver",
    )

    # Activities & Comments
    activities: Mapped[List["TaskActivity"]] = relationship(
        "TaskActivity",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    comments: Mapped[List["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    checklist_items: Mapped[List["ChecklistItem"]] = relationship(
        "ChecklistItem",
        back_populates="user",
        foreign_keys="[ChecklistItem.user_id]",
        cascade="all, delete-orphan",
        order_by="desc(ChecklistItem.created_at)",
    )
    login_records: Mapped[List["UserLoginRecord"]] = relationship(
        "UserLoginRecord",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="desc(UserLoginRecord.login_at)",
    )


class UserLoginRecord(Base):
    __tablename__ = "user_login_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="login_records")

