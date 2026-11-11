from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserBrief


class CheckInRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=255, description="Optional check-in note or work location")


class CheckOutRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=255, description="Optional check-out summary or note")


class AttendanceOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    total_hours: float = 0.0
    status: str
    check_in_note: Optional[str] = None
    check_out_note: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceTodayStatus(BaseModel):
    is_checked_in: bool
    is_checked_out: bool
    record: Optional[AttendanceOut] = None
    worked_seconds: int = 0


class AttendanceReportSummary(BaseModel):
    total_records: int = 0
    total_hours: float = 0.0
    average_hours_per_day: float = 0.0
    currently_checked_in: int = 0
    present_count: int = 0
    half_day_count: int = 0


class AttendanceReportResponse(BaseModel):
    items: List[AttendanceOut]
    total: int
    skip: int
    limit: int
    summary: AttendanceReportSummary
