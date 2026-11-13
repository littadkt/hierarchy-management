from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserBrief
from app.schemas.schedule import BufferStatusOut


class CheckInRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=255, description="Optional check-in note or work location")
    latitude: Optional[float] = Field(None, description="GPS Latitude captured at check-in")
    longitude: Optional[float] = Field(None, description="GPS Longitude captured at check-in")
    accuracy: Optional[float] = Field(None, description="GPS accuracy in meters")
    wifi_ssid: Optional[str] = Field(None, max_length=100, description="Connected Wi-Fi SSID name")


class CheckOutRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=255, description="Optional check-out summary or note")


class CheckInApprovalDecision(BaseModel):
    reason: Optional[str] = Field(None, max_length=255, description="Optional explanation or rejection reason")


class AttendanceOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    total_hours: float = 0.0
    status: str
    is_buffer_used: bool = False
    is_late: bool = False
    late_minutes: int = 0
    schedule_check_in: Optional[str] = None
    schedule_check_out: Optional[str] = None
    check_in_note: Optional[str] = None
    check_out_note: Optional[str] = None
    ip_address: Optional[str] = None
    approval_status: str = "APPROVED"
    requires_approval: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    wifi_ssid: Optional[str] = None
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: Optional[UserBrief] = None
    approved_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceTodayStatus(BaseModel):
    is_checked_in: bool
    is_checked_out: bool
    record: Optional[AttendanceOut] = None
    worked_seconds: int = 0
    buffer_status: Optional[BufferStatusOut] = None
    scheduled_check_in: Optional[str] = None
    scheduled_check_out: Optional[str] = None


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
