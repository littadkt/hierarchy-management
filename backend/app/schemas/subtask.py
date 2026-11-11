from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.attachment import AttachmentOut
from app.schemas.user import UserBrief


class SubtaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[uuid.UUID] = None


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    due_date: Optional[datetime] = None
    assigned_to_id: Optional[uuid.UUID] = None


class SubtaskToggle(BaseModel):
    is_completed: bool


class SubtaskOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    description: Optional[str] = None
    is_completed: bool
    due_date: Optional[datetime] = None
    order_index: int = 0
    assigned_to_id: Optional[uuid.UUID] = None
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    assigned_to: Optional[UserBrief] = None
    created_by: Optional[UserBrief] = None
    attachments: List[AttachmentOut] = []
    attachments_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class SubtaskReorderRequest(BaseModel):
    subtask_ids: List[uuid.UUID]


