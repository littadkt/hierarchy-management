from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.task import RecurrencePattern, TaskPriority, TaskStatus
from app.schemas.subtask import SubtaskCreate, SubtaskOut
from app.schemas.user import UserBrief


class TaskBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[datetime] = None

    # Approval config
    requires_approval: bool = False
    approver_id: Optional[uuid.UUID] = None

    # Recurrence config
    is_recurring: bool = False
    recurrence_pattern: RecurrencePattern = RecurrencePattern.NONE
    recurrence_interval: int = Field(default=1, ge=1)
    recurrence_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    recurrence_days_of_week: Optional[List[int]] = None
    recurrence_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurrence_end_date: Optional[datetime] = None

    @field_validator("recurrence_days_of_week")
    @classmethod
    def validate_days_of_week(cls, v):
        if v is not None:
            return sorted(list(set(int(x) for x in v if 0 <= int(x) <= 6)))
        return v

    @model_validator(mode="after")
    def validate_rules(self) -> "TaskBase":
        if self.requires_approval and not self.approver_id:
            raise ValueError("An approver must be selected when higher-level approval is required.")

        if self.is_recurring and self.recurrence_pattern == RecurrencePattern.NONE:
            raise ValueError("A recurrence pattern must be selected for recurring tasks.")

        return self


class TaskCreate(TaskBase):
    assigned_to_id: uuid.UUID
    subtasks: Optional[List[SubtaskCreate]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[uuid.UUID] = None
    requires_approval: Optional[bool] = None
    approver_id: Optional[uuid.UUID] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[RecurrencePattern] = None
    recurrence_interval: Optional[int] = Field(None, ge=1)
    recurrence_day_of_week: Optional[int] = Field(None, ge=0, le=6)
    recurrence_days_of_week: Optional[List[int]] = None
    recurrence_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurrence_end_date: Optional[datetime] = None

    @field_validator("recurrence_days_of_week")
    @classmethod
    def validate_days_of_week(cls, v):
        if v is not None:
            return sorted(list(set(int(x) for x in v if 0 <= int(x) <= 6)))
        return v


class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    comment: Optional[str] = None


class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime] = None

    created_by_id: uuid.UUID
    assigned_to_id: uuid.UUID
    requires_approval: bool
    approver_id: Optional[uuid.UUID] = None

    is_recurring: bool
    recurrence_pattern: RecurrencePattern
    recurrence_interval: int
    recurrence_day_of_week: Optional[int] = None
    recurrence_days_of_week: Optional[List[int]] = None
    recurrence_day_of_month: Optional[int] = None
    recurrence_end_date: Optional[datetime] = None
    next_run_date: Optional[datetime] = None
    parent_task_id: Optional[uuid.UUID] = None

    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    created_by: Optional[UserBrief] = None
    assigned_to: Optional[UserBrief] = None
    approver: Optional[UserBrief] = None

    subtasks_count: int = 0
    completed_subtasks_count: int = 0

    @field_validator("recurrence_days_of_week", mode="before")
    @classmethod
    def parse_recurrence_days_of_week(cls, v):
        if isinstance(v, str):
            if not v.strip():
                return None
            return [int(x.strip()) for x in v.split(",") if x.strip().isdigit()]
        return v

    model_config = ConfigDict(from_attributes=True)


class TaskDetailOut(TaskOut):
    comments_count: int = 0
    activities_count: int = 0
    subtasks: List[SubtaskOut] = []


class BulkDeleteTasks(BaseModel):
    task_ids: List[uuid.UUID]


