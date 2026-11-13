from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=255)
    allowed_wifi_ips: Optional[str] = Field(None, max_length=500, description="Allowed Wi-Fi IP addresses or CIDR subnets (comma-separated)")
    wifi_ssid: Optional[str] = Field(None, max_length=100, description="Office Wi-Fi SSID name")
    is_active: bool = True


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    code: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=255)
    allowed_wifi_ips: Optional[str] = Field(None, max_length=500)
    wifi_ssid: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class BranchOut(BranchBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
