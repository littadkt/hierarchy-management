from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserBrief


class ChecklistCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    target_user_id: Optional[uuid.UUID] = None


class ChecklistUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    due_date: Optional[datetime] = None
    target_user_id: Optional[uuid.UUID] = None


class ChecklistToggle(BaseModel):
    is_completed: bool


class ChecklistOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    is_completed: bool
    due_date: Optional[datetime] = None
    order_index: int = 0
    target_user_id: Optional[uuid.UUID] = None
    target_user: Optional[UserBrief] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistReorderRequest(BaseModel):
    item_ids: List[uuid.UUID]


