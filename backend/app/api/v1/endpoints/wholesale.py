from typing import Any, List, Optional, Union
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.excel_utils import create_excel_template, parse_excel_or_csv_bytes
from app.db.session import get_db
from app.models.user import Role, User
from app.models.wholesale_order import OrderStatus
from app.schemas.user import UserBrief, UserOut
from app.schemas.wholesale import (
    BulkDeleteProductsRequest,
    BulkDeleteProductsResult,
    BulkUploadResult,
    SetOrderPermissionRequest,
    WholesaleCustomerCreate,
    WholesaleCustomerOut,
    WholesaleCustomerUpdate,
    WholesaleOrderCreate,
    WholesaleOrderOut,
    WholesaleOrderStatusUpdate,
    WholesaleOrderUpdate,
    WholesaleProductCreate,
    WholesaleProductOut,
    WholesaleProductUpdate,
)
from app.services.wholesale_service import WholesaleService

router = APIRouter()


class WholesaleCustomerListResponse(BaseModel):
    items: List[WholesaleCustomerOut]
    total: int
    skip: int
    limit: int


class WholesaleProductListResponse(BaseModel):
    items: List[WholesaleProductOut]
    total: int
    skip: int
    limit: int


class WholesaleOrderListResponse(BaseModel):
    items: List[WholesaleOrderOut]
    total: int
    skip: int
    limit: int


# --- Wholesale Customers Endpoints ---
@router.get("/customers", response_model=WholesaleCustomerListResponse)
@router.get("/customers/", response_model=WholesaleCustomerListResponse, include_in_schema=False)
async def list_wholesale_customers(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List wholesale customers"""
    items, total = await WholesaleService.list_customers(
        session, search=search, skip=skip, limit=limit
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post(
    "/customers",
    response_model=WholesaleCustomerOut,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/customers/",
    response_model=WholesaleCustomerOut,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_wholesale_customer(
    customer_in: WholesaleCustomerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new wholesale customer"""
    return await WholesaleService.create_customer(session, customer_in)


@router.get("/customers/template")
async def download_customers_template(
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download standard Excel template for bulk importing wholesale customers"""
    headers = ["Customer Name", "Place", "Contact Number", "Email", "Address"]
    samples = [
        ["Metro Supermarket", "Kochi", "+91 9876543210", "metro@example.com", "Main Road, MG Circle, Kochi"],
        ["Apex Distributors", "Calicut", "+91 9845123456", "apex@example.com", "Trade Tower, 2nd Floor, Calicut"],
        ["City Retail Hub", "Trivandrum", "+91 9744112233", "retailhub@example.com", "City Center Mall, Trivandrum"],
    ]
    file_bytes = create_excel_template("Customers Import", headers, samples)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="wholesale_customers_template.xlsx"'},
    )


@router.post("/customers/upload-excel", response_model=BulkUploadResult)
async def upload_wholesale_customers_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Upload Excel/CSV file to bulk import wholesale customers"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only In-Charges, Admins, and Super Admins can import wholesale customers.",
        )
    filename = file.filename or "upload.xlsx"
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    rows = parse_excel_or_csv_bytes(contents, filename)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid data rows found in the uploaded file.",
        )
    return await WholesaleService.bulk_import_customers_from_excel(session, rows)


@router.get("/customers/{customer_id}", response_model=WholesaleCustomerOut)
async def get_wholesale_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    customer = await WholesaleService.get_customer(session, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wholesale customer not found.",
        )
    return customer


@router.put("/customers/{customer_id}", response_model=WholesaleCustomerOut)
async def update_wholesale_customer(
    customer_id: uuid.UUID,
    customer_in: WholesaleCustomerUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update wholesale customer details"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only In-Charges, Admins, and Super Admins can edit wholesale customers.",
        )
    return await WholesaleService.update_customer(session, customer_id, customer_in)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wholesale_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete wholesale customer"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only In-Charges, Admins, and Super Admins can delete wholesale customers.",
        )
    await WholesaleService.delete_customer(session, customer_id)


# --- Wholesale Products Endpoints ---
@router.get("/products", response_model=WholesaleProductListResponse)
@router.get("/products/", response_model=WholesaleProductListResponse, include_in_schema=False)
async def list_wholesale_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List wholesale products"""
    items, total = await WholesaleService.list_products(
        session, search=search, category=category, skip=skip, limit=limit
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/products/by-code/{code}", response_model=WholesaleProductOut)
async def get_wholesale_product_by_code(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Lookup wholesale product by barcode"""
    product = await WholesaleService.get_product_by_code(session, code)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Wholesale product with barcode '{code}' not found.",
        )
    return product


@router.post(
    "/products",
    response_model=WholesaleProductOut,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/products/",
    response_model=WholesaleProductOut,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_wholesale_product(
    product_in: WholesaleProductCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new wholesale product"""
    return await WholesaleService.create_product(session, product_in)


@router.get("/products/template")
async def download_products_template(
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download standard Excel template for bulk importing wholesale products"""
    headers = ["Barcode", "Product Name", "Rate", "Category", "Brand", "Vendor", "Quantity"]
    samples = [
        ["W-PROD-001", "Premium Basmati Rice 25kg", 2450.00, "Groceries", "Royal Delight", "Agro Foods Ltd", 40],
        ["W-PROD-002", "Refined Sunflower Oil 15L Tin", 1850.00, "Edible Oils", "SunGold", "Oil Mills Corp", 60],
        ["W-PROD-003", "Whole Wheat Flour 50kg Bag", 1400.00, "Flour & Grains", "Harvest Fresh", "Grain Mills India", 30],
    ]
    file_bytes = create_excel_template("Products Import", headers, samples)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="wholesale_products_template.xlsx"'},
    )


@router.post("/products/upload-excel", response_model=BulkUploadResult)
async def upload_wholesale_products_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Upload Excel/CSV file to bulk import wholesale products"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can import wholesale products.",
        )
    filename = file.filename or "upload.xlsx"
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    rows = parse_excel_or_csv_bytes(contents, filename)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid data rows found in the uploaded file.",
        )
    return await WholesaleService.bulk_import_products_from_excel(session, rows)


@router.get("/products/{product_id}", response_model=WholesaleProductOut)
async def get_wholesale_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    product = await WholesaleService.get_product(session, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wholesale product not found.",
        )
    return product


@router.put("/products/{product_id}", response_model=WholesaleProductOut)
async def update_wholesale_product(
    product_id: uuid.UUID,
    product_in: WholesaleProductUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update wholesale product details"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can update wholesale products.",
        )
    return await WholesaleService.update_product(session, product_id, product_in)


@router.post("/products/bulk-delete", response_model=BulkDeleteProductsResult)
async def bulk_delete_wholesale_products(
    payload: BulkDeleteProductsRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Bulk delete wholesale products (Super Admin & Admin only)"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can delete wholesale products.",
        )
    return await WholesaleService.bulk_delete_products(session, payload.product_ids)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wholesale_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete wholesale product"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can delete wholesale products.",
        )
    await WholesaleService.delete_product(session, product_id)


# --- Super Admin Order Permissions Endpoints ---
@router.get("/permissions/users", response_model=List[UserBrief])
async def list_users_order_permissions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Super Admin Provision:
    List all organization users with their order placement permissions.
    """
    return await WholesaleService.list_users_with_permissions(session, current_user)


@router.post("/permissions", response_model=UserBrief)
async def set_user_order_permission(
    payload: SetOrderPermissionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Super Admin Provision:
    Set which users are allowed to place wholesale orders.
    """
    return await WholesaleService.set_user_order_permission(
        session,
        operator=current_user,
        target_user_id=payload.user_id,
        can_place=payload.can_place_wholesale_orders,
    )


# --- Wholesale Orders Endpoints ---
@router.post(
    "/orders",
    response_model=Union[WholesaleOrderOut, List[WholesaleOrderOut]],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/orders/",
    response_model=Union[WholesaleOrderOut, List[WholesaleOrderOut]],
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def place_wholesale_order(
    order_in: WholesaleOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Place a wholesale order:
    Allowed only for Super Admin or users granted permission by Super Admin.
    """
    return await WholesaleService.create_order(
        session=session,
        operator=current_user,
        order_in=order_in,
    )


@router.get("/orders", response_model=WholesaleOrderListResponse)
@router.get("/orders/", response_model=WholesaleOrderListResponse, include_in_schema=False)
async def list_wholesale_orders(
    status: Optional[OrderStatus] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    List placed orders:
    - In-Charges, Admins, and Super Admins: view all placed orders across organization.
    - Other permitted users: view their own placed orders.
    """
    orders, total = await WholesaleService.list_orders(
        session=session,
        operator=current_user,
        status_filter=status,
        search=search,
        skip=skip,
        limit=limit,
    )
    return {"items": orders, "total": total, "skip": skip, "limit": limit}


@router.get("/orders/{order_id}", response_model=WholesaleOrderOut)
async def get_wholesale_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    order = await WholesaleService.get_order_by_id(session, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wholesale order not found.",
        )
    return order


@router.patch("/orders/{order_id}/status", response_model=WholesaleOrderOut)
async def update_wholesale_order_status(
    order_id: uuid.UUID,
    status_update: WholesaleOrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update order status:
    Allowed for In-Charges, Admins, and Super Admins.
    """
    return await WholesaleService.update_order_status(
        session=session,
        operator=current_user,
        order_id=order_id,
        new_status=status_update.status,
    )


@router.put("/orders/{order_id}", response_model=WholesaleOrderOut)
async def update_wholesale_order(
    order_id: uuid.UUID,
    order_in: WholesaleOrderUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update wholesale order details"""
    return await WholesaleService.update_order(
        session=session,
        operator=current_user,
        order_id=order_id,
        order_in=order_in,
    )


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wholesale_order(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete wholesale order"""
    await WholesaleService.delete_order(
        session=session,
        operator=current_user,
        order_id=order_id,
    )

