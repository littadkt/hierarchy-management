import enum
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.task_activity import TaskActivity
    from app.models.task_comment import TaskComment
    from app.models.subtask import Subtask
    from app.models.attachment import TaskAttachment


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class RecurrencePattern(str, enum.Enum):
    NONE = "NONE"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    CUSTOM = "CUSTOM"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status_enum", native_enum=False),
        default=TaskStatus.PENDING,
        nullable=False,
        index=True,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority, name="task_priority_enum", native_enum=False),
        default=TaskPriority.MEDIUM,
        nullable=False,
        index=True,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Assignment & Creator
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_to_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Approval Settings
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    approver_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Recurrence Settings
    is_recurring: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )
    recurrence_pattern: Mapped[RecurrencePattern] = mapped_column(
        Enum(RecurrencePattern, name="recurrence_pattern_enum", native_enum=False),
        default=RecurrencePattern.NONE,
        nullable=False,
    )
    recurrence_interval: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False
    )
    recurrence_day_of_week: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 0 = Monday ... 6 = Sunday (legacy single day)
    recurrence_days_of_week: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # Comma-separated active days of week, e.g. "0,1,2,3,4,5" (0 = Mon, 6 = Sun)
    recurrence_day_of_month: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 1 to 31
    recurrence_end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_run_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Recurrence Lineage (Parent Recurring Template <-> Child Instances)
    parent_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    order_index: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, index=True
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
    created_by: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_tasks",
    )
    assigned_to: Mapped["User"] = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        back_populates="assigned_tasks",
    )
    approver: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[approver_id],
        back_populates="approval_tasks",
    )

    parent_task: Mapped[Optional["Task"]] = relationship(
        "Task",
        remote_side=[id],
        foreign_keys=[parent_task_id],
        back_populates="child_instances",
    )
    child_instances: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys=[parent_task_id],
        back_populates="parent_task",
    )

    activities: Mapped[List["TaskActivity"]] = relationship(
        "TaskActivity",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="desc(TaskActivity.created_at)",
    )
    comments: Mapped[List["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="asc(TaskComment.created_at)",
    )
    subtasks: Mapped[List["Subtask"]] = relationship(
        "Subtask",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="asc(Subtask.order_index), asc(Subtask.created_at)",
    )
    attachments: Mapped[List["TaskAttachment"]] = relationship(
        "TaskAttachment",
        primaryjoin="and_(Task.id==TaskAttachment.task_id, TaskAttachment.subtask_id==None)",
        cascade="all, delete-orphan",
        order_by="desc(TaskAttachment.created_at)",
        overlaps="all_attachments,task",
    )
    all_attachments: Mapped[List["TaskAttachment"]] = relationship(
        "TaskAttachment",
        foreign_keys="[TaskAttachment.task_id]",
        back_populates="task",
        cascade="all, delete-orphan",
        overlaps="attachments",
    )

    @property
    def attachments_count(self) -> int:
        return len(self.attachments) if "attachments" in self.__dict__ else 0

    @property
    def comments_count(self) -> int:
        return len(self.comments) if "comments" in self.__dict__ else 0

    @property
    def activities_count(self) -> int:
        return len(self.activities) if "activities" in self.__dict__ else 0

    @property
    def subtasks_count(self) -> int:
        return len(self.subtasks) if "subtasks" in self.__dict__ else 0

    @property
    def completed_subtasks_count(self) -> int:
        if "subtasks" in self.__dict__:
            return sum(1 for s in self.subtasks if s.is_completed)
        return 0

