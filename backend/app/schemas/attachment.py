from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserBrief


class AttachmentOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    subtask_id: Optional[uuid.UUID] = None
    filename: str
    file_size: int
    content_type: Optional[str] = None
    uploaded_by_id: uuid.UUID
    created_at: datetime
    uploaded_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)
