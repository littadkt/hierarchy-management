import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TimeScheduleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Schedule name, e.g. General Shift")
    check_in_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="Check-in time in HH:MM format (24-hour)")
    check_out_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="Check-out time in HH:MM format (24-hour)")
    buffer_minutes: int = Field(10, ge=0, le=60, description="Grace buffer minutes allowed for check-in")
    monthly_buffer_limit: int = Field(3, ge=0, le=31, description="Max allowed buffer days per calendar month")
    description: Optional[str] = Field(None, max_length=255)


class TimeScheduleCreate(TimeScheduleBase):
    pass


class TimeScheduleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    check_in_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    check_out_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    buffer_minutes: Optional[int] = Field(None, ge=0, le=60)
    monthly_buffer_limit: Optional[int] = Field(None, ge=0, le=31)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class TimeScheduleOut(TimeScheduleBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    employee_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class BufferStatusOut(BaseModel):
    buffer_days_used: int
    monthly_limit: int
    buffer_minutes: int
    remaining_days: int
    scheduled_check_in: Optional[str] = None
    scheduled_check_out: Optional[str] = None
    schedule_name: Optional[str] = None
    month_name: str
