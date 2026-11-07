from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryItem
from app.schemas.inventory import InventoryItemCreate, InventoryItemUpdate


class InventoryService:
    @staticmethod
    async def get_by_id(session: AsyncSession, item_id: uuid.UUID) -> Optional[InventoryItem]:
        stmt = select(InventoryItem).where(InventoryItem.id == item_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_code(session: AsyncSession, code: str) -> Optional[InventoryItem]:
        stmt = select(InventoryItem).where(InventoryItem.code == code)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_items(
        session: AsyncSession,
        search: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[InventoryItem], int]:
        stmt = select(InventoryItem)

        if category:
            stmt = stmt.where(InventoryItem.category.ilike(f"%{category}%"))

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    InventoryItem.code.ilike(search_term),
                    InventoryItem.name.ilike(search_term),
                    InventoryItem.category.ilike(search_term),
                    InventoryItem.brand.ilike(search_term),
                    InventoryItem.vendor.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(InventoryItem.name.asc()).offset(skip).limit(limit)
        result = await session.execute(stmt)
        items = result.scalars().all()

        return items, total

    @staticmethod
    async def create_item(
        session: AsyncSession, item_in: InventoryItemCreate
    ) -> InventoryItem:
        code = item_in.code.strip() if item_in.code and item_in.code.strip() else f"INV-{uuid.uuid4().hex[:8].upper()}"

        existing = await InventoryService.get_by_code(session, code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory item with barcode '{code}' already exists.",
            )

        item = InventoryItem(
            code=code,
            name=item_in.name.strip() if item_in.name else "",
            rate=float(item_in.rate or 0.0),
            category=item_in.category.strip() if item_in.category else "",
            brand=item_in.brand.strip() if item_in.brand else "",
            vendor=item_in.vendor.strip() if item_in.vendor else "",
            quantity=int(item_in.quantity or 0),
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_item(
        session: AsyncSession, item_id: uuid.UUID, item_in: InventoryItemUpdate
    ) -> InventoryItem:
        item = await InventoryService.get_by_id(session, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found",
            )

        if item_in.code is not None:
            new_code = item_in.code.strip()
            if not new_code:
                new_code = item.code
            if new_code != item.code:
                existing = await InventoryService.get_by_code(session, new_code)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Barcode '{new_code}' is already assigned to another item.",
                    )
                item.code = new_code

        if item_in.name is not None:
            item.name = item_in.name.strip()
        if item_in.rate is not None:
            item.rate = float(item_in.rate or 0.0)
        if item_in.category is not None:
            item.category = item_in.category.strip()
        if item_in.brand is not None:
            item.brand = item_in.brand.strip()
        if item_in.vendor is not None:
            item.vendor = item_in.vendor.strip()
        if item_in.quantity is not None:
            item.quantity = int(item_in.quantity or 0)

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_quantity(
        session: AsyncSession, item_id: uuid.UUID, quantity: int
    ) -> InventoryItem:
        item = await InventoryService.get_by_id(session, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found",
            )
        item.quantity = quantity
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def delete_item(
        session: AsyncSession, item_id: uuid.UUID
    ) -> None:
        item = await InventoryService.get_by_id(session, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found",
            )
        await session.delete(item)
        await session.commit()

    @staticmethod
    async def bulk_delete_items(
        session: AsyncSession, item_ids: List[uuid.UUID]
    ) -> dict:
        deleted_count = 0
        errors: List[str] = []

        for item_id in item_ids:
            item = await InventoryService.get_by_id(session, item_id)
            if not item:
                continue
            await session.delete(item)
            deleted_count += 1

        await session.commit()
        return {
            "deleted_count": deleted_count,
            "failed_count": len(errors),
            "errors": errors,
        }

    @staticmethod
    async def bulk_import_from_excel(
        session: AsyncSession, rows: List[dict]
    ) -> dict:
        total_rows = len(rows)
        success_count = 0
        updated_count = 0
        failed_count = 0
        errors: List[str] = []

        for idx, row in enumerate(rows, start=1):
            code = str(row.get("code") or "").strip()
            name = str(row.get("name") or "").strip()
            if not code or not name:
                failed_count += 1
                errors.append(f"Row {idx}: 'Barcode' and 'Product Name' are required.")
                continue

            try:
                rate_val = float(row.get("rate") if row.get("rate") is not None else 0.0)
                if rate_val < 0:
                    raise ValueError("Rate must be non-negative")
            except (ValueError, TypeError):
                failed_count += 1
                errors.append(f"Row {idx}: Invalid rate value '{row.get('rate')}'.")
                continue

            try:
                qty_raw = row.get("quantity")
                qty_val = int(float(qty_raw)) if qty_raw is not None else 0
                if qty_val < 0:
                    raise ValueError("Quantity must be non-negative")
            except (ValueError, TypeError):
                failed_count += 1
                errors.append(f"Row {idx}: Invalid quantity value '{row.get('quantity')}'.")
                continue

            category = str(row.get("category") or "General").strip()
            brand = str(row.get("brand") or "Generic").strip()
            vendor = str(row.get("vendor") or "Standard Vendor").strip()

            existing = await InventoryService.get_by_code(session, code)
            if existing:
                existing.name = name
                existing.rate = rate_val
                existing.category = category
                existing.brand = brand
                existing.vendor = vendor
                existing.quantity = qty_val
                updated_count += 1
            else:
                item = InventoryItem(
                    code=code,
                    name=name,
                    rate=rate_val,
                    category=category,
                    brand=brand,
                    vendor=vendor,
                    quantity=qty_val,
                )
                session.add(item)
                success_count += 1

        await session.commit()
        return {
            "total_rows": total_rows,
            "success_count": success_count,
            "updated_count": updated_count,
            "failed_count": failed_count,
            "errors": errors,
        }

