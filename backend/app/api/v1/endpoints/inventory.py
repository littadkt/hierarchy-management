from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.excel_utils import create_excel_template, parse_excel_or_csv_bytes
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.inventory import (
    BulkDeleteInventoryRequest,
    BulkDeleteInventoryResult,
    BulkUploadResult,
    InventoryItemCreate,
    InventoryItemOut,
    InventoryItemQuantityUpdate,
    InventoryItemUpdate,
)
from app.services.inventory_service import InventoryService

router = APIRouter()


class InventoryListResponse(BaseModel):
    items: List[InventoryItemOut]
    total: int
    skip: int
    limit: int


@router.get("/by-code/{code}", response_model=InventoryItemOut)
async def get_inventory_by_code(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Scan/lookup inventory item by barcode.
    Returns 404 if item is not present in inventory database.
    """
    item = await InventoryService.get_by_code(session, code)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{code}' was not found in inventory.",
        )
    return item


@router.get("", response_model=InventoryListResponse)
@router.get("/", response_model=InventoryListResponse, include_in_schema=False)
async def list_inventory(
    search: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List inventory items with search & category filtering"""
    items, total = await InventoryService.list_items(
        session=session,
        search=search,
        category=category,
        skip=skip,
        limit=limit,
    )
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/template")
async def download_inventory_template(
    current_user: User = Depends(get_current_user),
) -> Response:
    """Download standard Excel template for bulk importing inventory items"""
    headers = ["Barcode", "Product Name", "Rate", "Category", "Brand", "Vendor", "Quantity"]
    samples = [
        ["BAR-1001", "Wireless Optical Mouse", 450.00, "Electronics", "Logitech", "Tech Supplies Co", 50],
        ["BAR-1002", "Mechanical Keyboard RGB", 1850.00, "Electronics", "Redragon", "Tech Supplies Co", 25],
        ["BAR-1003", "A4 Copy Paper 500 Sheets", 280.00, "Stationery", "JK Paper", "Office World", 100],
    ]
    file_bytes = create_excel_template("Inventory Import", headers, samples)
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="inventory_template.xlsx"'},
    )


@router.post("/upload-excel", response_model=BulkUploadResult)
async def upload_inventory_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Upload Excel/CSV file to bulk import inventory items"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can import inventory items.",
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
    return await InventoryService.bulk_import_from_excel(session, rows)


@router.get("/{item_id}", response_model=InventoryItemOut)
async def get_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await InventoryService.get_by_id(session, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    return item


@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_inventory_item(
    item_in: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new product to inventory database"""
    return await InventoryService.create_item(session, item_in)


@router.put("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    item_id: uuid.UUID,
    item_in: InventoryItemUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update inventory item details"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can update inventory items.",
        )
    return await InventoryService.update_item(session, item_id, item_in)


@router.patch("/{item_id}/quantity", response_model=InventoryItemOut)
async def update_inventory_quantity(
    item_id: uuid.UUID,
    qty_in: InventoryItemQuantityUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Quantity edit for inventory items"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can update inventory stock quantity.",
        )
    return await InventoryService.update_quantity(session, item_id, qty_in.quantity)


@router.post("/bulk-delete", response_model=BulkDeleteInventoryResult)
async def bulk_delete_inventory_items(
    payload: BulkDeleteInventoryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Bulk delete inventory items (Super Admin & Admin only)"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can delete inventory items.",
        )
    return await InventoryService.bulk_delete_items(session, payload.item_ids)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete inventory item"""
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can delete inventory items.",
        )
    await InventoryService.delete_item(session, item_id)


