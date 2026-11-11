from datetime import datetime
from typing import Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.warranty import WarrantyStatus
from app.schemas.user import UserBrief


# --- Service Type Schemas ---
class WarrantyServiceTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: bool = True


class WarrantyServiceTypeCreate(WarrantyServiceTypeBase):
    pass


class WarrantyServiceTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WarrantyServiceTypeOut(WarrantyServiceTypeBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Staff Schemas ---
class WarrantyStaffBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True


class WarrantyStaffCreate(WarrantyStaffBase):
    pass


class WarrantyStaffUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class WarrantyStaffOut(WarrantyStaffBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Brand Schemas ---
class WarrantyBrandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True


class WarrantyBrandCreate(WarrantyBrandBase):
    pass


class WarrantyBrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None


class WarrantyBrandOut(WarrantyBrandBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Model Schemas ---
class WarrantyModelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    brand_id: Optional[uuid.UUID] = None
    is_active: bool = True


class WarrantyModelCreate(WarrantyModelBase):
    pass


class WarrantyModelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    brand_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class WarrantyModelOut(WarrantyModelBase):
    id: uuid.UUID
    brand: Optional[WarrantyBrandOut] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Warranty Job Schemas ---
class WarrantyJobBase(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None

    service_type_id: Optional[uuid.UUID] = None
    service_type_name: Optional[str] = None

    staff_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None

    product_name: str = Field(..., min_length=1, max_length=200)
    serial_number: str = Field(..., min_length=1, max_length=100)
    brand_id: Optional[uuid.UUID] = None
    brand_name: Optional[str] = None
    model_id: Optional[uuid.UUID] = None
    model_name: Optional[str] = None

    work_description: str = Field(..., min_length=1)
    status: WarrantyStatus = WarrantyStatus.RECEIVED
    notes: Optional[str] = None


class WarrantyJobCreate(WarrantyJobBase):
    pass


class WarrantyJobUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=200)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None

    service_type_id: Optional[uuid.UUID] = None
    service_type_name: Optional[str] = None

    staff_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None

    product_name: Optional[str] = Field(None, min_length=1, max_length=200)
    serial_number: Optional[str] = Field(None, min_length=1, max_length=100)
    brand_id: Optional[uuid.UUID] = None
    brand_name: Optional[str] = None
    model_id: Optional[uuid.UUID] = None
    model_name: Optional[str] = None

    work_description: Optional[str] = Field(None, min_length=1)
    status: Optional[WarrantyStatus] = None
    notes: Optional[str] = None
    completed_date: Optional[datetime] = None
    delivered_date: Optional[datetime] = None


class WarrantyJobStatusUpdate(BaseModel):
    status: WarrantyStatus
    notes: Optional[str] = None


class WarrantyJobOut(BaseModel):
    id: uuid.UUID
    job_number: str

    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None

    service_type_id: Optional[uuid.UUID] = None
    service_type_name: Optional[str] = None
    service_type: Optional[WarrantyServiceTypeOut] = None

    staff_id: Optional[uuid.UUID] = None
    staff_name: Optional[str] = None
    staff: Optional[WarrantyStaffOut] = None

    product_name: str
    serial_number: str
    brand_id: Optional[uuid.UUID] = None
    brand_name: Optional[str] = None
    brand: Optional[WarrantyBrandOut] = None

    model_id: Optional[uuid.UUID] = None
    model_name: Optional[str] = None
    model_rel: Optional[WarrantyModelOut] = None

    work_description: str
    status: WarrantyStatus
    notes: Optional[str] = None

    received_date: datetime
    completed_date: Optional[datetime] = None
    delivered_date: Optional[datetime] = None

    created_by_id: Optional[uuid.UUID] = None
    created_by: Optional[UserBrief] = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WarrantySerialHistory(BaseModel):
    serial_number: str
    total_services: int
    jobs: List[WarrantyJobOut]


class WarrantyJobsListResponse(BaseModel):
    items: List[WarrantyJobOut]
    total: int
    status_counts: Dict[str, int]
