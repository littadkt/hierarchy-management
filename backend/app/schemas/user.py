from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import Role


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: Role
    branch: Optional[str] = None
    department: Optional[str] = None
    schedule_id: Optional[uuid.UUID] = None
    check_in_time: Optional[str] = Field(None, description="HH:MM (e.g. 09:00)")
    check_out_time: Optional[str] = Field(None, description="HH:MM (e.g. 18:00)")


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    reports_to_id: Optional[uuid.UUID] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    reports_to_id: Optional[uuid.UUID] = None
    can_place_wholesale_orders: Optional[bool] = None
    branch: Optional[str] = None
    department: Optional[str] = None
    schedule_id: Optional[uuid.UUID] = None
    check_in_time: Optional[str] = Field(None, description="HH:MM (e.g. 09:00)")
    check_out_time: Optional[str] = Field(None, description="HH:MM (e.g. 18:00)")
    is_on_leave: Optional[bool] = None
    leave_date: Optional[str] = None
    leave_reason: Optional[str] = None
    permissions: Optional[dict] = None

    @field_validator("password")
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) < 8:
                raise ValueError("Password must be at least 8 characters long")
            if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
                raise ValueError("Password must contain at least one letter and one number")
        return v


class UserLeaveUpdate(BaseModel):
    is_on_leave: bool
    leave_date: Optional[str] = None
    leave_reason: Optional[str] = None


class WindowPermission(BaseModel):
    add: bool = False
    display: bool = False
    edit: bool = False
    delete: bool = False


class UserPermissionsUpdate(BaseModel):
    permissions: dict[str, WindowPermission]


class UserBrief(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: Role
    is_purchase_manager: bool = False
    can_place_wholesale_orders: bool = False
    branch: Optional[str] = None
    department: Optional[str] = None
    schedule_id: Optional[uuid.UUID] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    schedule_name: Optional[str] = None
    reports_to_id: Optional[uuid.UUID] = None
    last_login_at: Optional[datetime] = None
    today_first_login_at: Optional[datetime] = None
    is_on_leave: bool = False
    leave_date: Optional[str] = None
    leave_reason: Optional[str] = None
    permissions: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class UserOut(UserBase):
    id: uuid.UUID
    is_active: bool
    is_purchase_manager: bool = False
    can_place_wholesale_orders: bool = False
    branch: Optional[str] = None
    department: Optional[str] = None
    schedule_id: Optional[uuid.UUID] = None
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    schedule_name: Optional[str] = None
    reports_to_id: Optional[uuid.UUID] = None
    created_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    today_first_login_at: Optional[datetime] = None
    is_on_leave: bool = False
    leave_date: Optional[str] = None
    leave_reason: Optional[str] = None
    permissions: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class UserTaskStats(BaseModel):
    total_assigned: int = 0
    pending: int = 0
    in_progress: int = 0
    pending_approval: int = 0
    completed: int = 0
    cancelled: int = 0


class UserWithStats(UserOut):
    task_stats: UserTaskStats
    manager_name: Optional[str] = None
    creator_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

