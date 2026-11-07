from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.purchase_request import PurchaseRequestStatus
from app.schemas.user import UserBrief


class PurchaseRequestBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, description="Barcode")
    name: Optional[str] = Field(default="", max_length=255)
    rate: Optional[float] = Field(default=0.0, ge=0)
    category: Optional[str] = Field(default="", max_length=100)
    brand: Optional[str] = Field(default="", max_length=100)
    vendor: Optional[str] = Field(default="", max_length=100)
    quantity: int = Field(default=1, ge=1)
    notes: Optional[str] = None


class PurchaseRequestCreate(PurchaseRequestBase):
    pass


class PurchaseRequestUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    rate: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = Field(None, ge=1)
    notes: Optional[str] = None


class PurchaseRequestStatusUpdate(BaseModel):
    status: PurchaseRequestStatus
    remarks: Optional[str] = Field(None, max_length=1000)


class PurchaseRequestHistoryOut(BaseModel):
    id: uuid.UUID
    purchase_request_id: uuid.UUID
    changed_by_id: Optional[uuid.UUID] = None
    old_status: Optional[PurchaseRequestStatus] = None
    new_status: PurchaseRequestStatus
    remarks: Optional[str] = None
    created_at: datetime
    changed_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseRequestOut(PurchaseRequestBase):
    id: uuid.UUID
    inventory_item_id: Optional[uuid.UUID] = None
    requested_by_id: uuid.UUID
    purchase_manager_id: Optional[uuid.UUID] = None
    status: PurchaseRequestStatus
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    requested_by: Optional[UserBrief] = None
    purchase_manager: Optional[UserBrief] = None
    history: List[PurchaseRequestHistoryOut] = []

    model_config = ConfigDict(from_attributes=True)

