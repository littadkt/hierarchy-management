from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.wholesale_order import OrderStatus
from app.schemas.user import UserBrief


# --- Wholesale Customer Schemas ---
class WholesaleCustomerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    place: str = Field(..., min_length=2, max_length=255)
    contact_number: str = Field(..., min_length=5, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)


class WholesaleCustomerCreate(WholesaleCustomerBase):
    pass


class WholesaleCustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    place: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_number: Optional[str] = Field(None, min_length=5, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)


class WholesaleCustomerOut(WholesaleCustomerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Wholesale Product Schemas ---
class WholesaleProductBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, description="Barcode")
    name: str = Field(..., min_length=1, max_length=255)
    rate: float = Field(..., ge=0, description="Wholesale rate")
    category: str = Field(..., min_length=1, max_length=100)
    brand: str = Field(..., min_length=1, max_length=100)
    vendor: str = Field(..., min_length=1, max_length=100)
    quantity: int = Field(default=0)


class WholesaleProductCreate(WholesaleProductBase):
    pass


class WholesaleProductUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    rate: Optional[float] = Field(None, ge=0)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    brand: Optional[str] = Field(None, min_length=1, max_length=100)
    vendor: Optional[str] = Field(None, min_length=1, max_length=100)
    quantity: Optional[int] = Field(None)


class WholesaleProductOut(WholesaleProductBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkDeleteProductsRequest(BaseModel):
    product_ids: List[uuid.UUID]


class BulkDeleteProductsResult(BaseModel):
    deleted_count: int
    failed_count: int
    errors: List[str] = []


# --- Wholesale Order Schemas ---
class WholesaleOrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class WholesaleOrderCreate(BaseModel):
    customer_id: uuid.UUID
    # Optional when using multiple items
    product_id: Optional[uuid.UUID] = None
    quantity: Optional[int] = Field(None, ge=1)
    # Multi-product list
    items: Optional[List[WholesaleOrderItemCreate]] = None
    place: Optional[str] = Field(None, max_length=255)
    contact_number: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=1000)


class WholesaleOrderUpdate(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    product_id: Optional[uuid.UUID] = None
    quantity: Optional[int] = Field(None, ge=1)
    place: Optional[str] = Field(None, max_length=255)
    contact_number: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[OrderStatus] = None


class WholesaleOrderStatusUpdate(BaseModel):
    status: OrderStatus


class WholesaleOrderOut(BaseModel):
    id: uuid.UUID
    order_number: str
    customer_id: uuid.UUID
    customer_name: str
    place: str
    contact_number: str
    product_id: uuid.UUID
    product_code: str
    product_name: str
    unit_rate: float
    quantity: int
    total_amount: float
    status: OrderStatus
    notes: Optional[str] = None
    placed_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    placed_by: Optional[UserBrief] = None
    customer: Optional[WholesaleCustomerOut] = None
    product: Optional[WholesaleProductOut] = None

    model_config = ConfigDict(from_attributes=True)


# --- Super Admin Order Permission Schemas ---
class SetOrderPermissionRequest(BaseModel):
    user_id: uuid.UUID
    can_place_wholesale_orders: bool


class BulkUploadResult(BaseModel):
    total_rows: int
    success_count: int
    updated_count: int
    failed_count: int
    errors: list[str] = []

