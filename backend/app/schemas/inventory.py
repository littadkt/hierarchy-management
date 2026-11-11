from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class InventoryItemBase(BaseModel):
    branch_id: Optional[uuid.UUID] = Field(default=None, description="Branch this item stock belongs to")
    code: Optional[str] = Field(default="", max_length=100, description="Barcode")
    name: Optional[str] = Field(default="", max_length=255)
    rate: Optional[float] = Field(default=0.0, ge=0)
    category: Optional[str] = Field(default="", max_length=100)
    brand: Optional[str] = Field(default="", max_length=100)
    vendor: Optional[str] = Field(default="", max_length=100)
    quantity: Optional[int] = Field(default=0)


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    branch_id: Optional[uuid.UUID] = Field(None, description="Branch ID")
    code: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, max_length=255)
    rate: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = Field(None)


class InventoryItemQuantityUpdate(BaseModel):
    quantity: int = Field(..., ge=0, description="Updated stock quantity")


class InventoryItemOut(InventoryItemBase):
    id: uuid.UUID
    branch_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkUploadResult(BaseModel):
    total_rows: int
    success_count: int
    updated_count: int
    failed_count: int
    errors: list[str] = []


class BulkDeleteInventoryRequest(BaseModel):
    item_ids: list[uuid.UUID]


class BulkDeleteInventoryResult(BaseModel):
    deleted_count: int
    failed_count: int
    errors: list[str] = []


