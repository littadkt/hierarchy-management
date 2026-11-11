from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.branch import Branch
from app.models.inventory import InventoryItem
from app.schemas.inventory import InventoryItemCreate, InventoryItemUpdate


class InventoryService:
    @staticmethod
    async def get_by_id(session: AsyncSession, item_id: uuid.UUID) -> Optional[InventoryItem]:
        stmt = (
            select(InventoryItem)
            .options(selectinload(InventoryItem.branch))
            .where(InventoryItem.id == item_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_code(
        session: AsyncSession,
        code: str,
        branch_id: Optional[uuid.UUID] = None,
    ) -> Optional[InventoryItem]:
        stmt = (
            select(InventoryItem)
            .options(selectinload(InventoryItem.branch))
            .where(InventoryItem.code == code)
        )
        if branch_id is not None:
            stmt = stmt.where(InventoryItem.branch_id == branch_id)
        result = await session.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def list_items(
        session: AsyncSession,
        search: Optional[str] = None,
        category: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[InventoryItem], int]:
        stmt = select(InventoryItem).options(selectinload(InventoryItem.branch))

        if branch_id is not None:
            stmt = stmt.where(InventoryItem.branch_id == branch_id)

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

        target_branch_id = item_in.branch_id
        if not target_branch_id:
            # Fallback to the first active branch if present
            first_branch = (
                await session.execute(
                    select(Branch.id).where(Branch.is_active == True).order_by(Branch.created_at.asc()).limit(1)
                )
            ).scalar_one_or_none()
            target_branch_id = first_branch

        existing = await InventoryService.get_by_code(session, code, branch_id=target_branch_id)
        if existing:
            branch_label = f" in branch '{existing.branch.name}'" if existing.branch else ""
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Inventory item with barcode '{code}' already exists{branch_label}.",
            )

        item = InventoryItem(
            branch_id=target_branch_id,
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
        return await InventoryService.get_by_id(session, item.id)

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

        target_branch_id = item_in.branch_id if item_in.branch_id is not None else item.branch_id

        if item_in.code is not None or item_in.branch_id is not None:
            new_code = item_in.code.strip() if item_in.code is not None else item.code
            if not new_code:
                new_code = item.code
            if new_code != item.code or target_branch_id != item.branch_id:
                existing = await InventoryService.get_by_code(session, new_code, branch_id=target_branch_id)
                if existing and existing.id != item.id:
                    branch_label = f" in branch '{existing.branch.name}'" if existing.branch else ""
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Barcode '{new_code}' is already assigned to another item{branch_label}.",
                    )
                item.code = new_code
                item.branch_id = target_branch_id

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
        return await InventoryService.get_by_id(session, item.id)

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
        return await InventoryService.get_by_id(session, item.id)

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
        session: AsyncSession,
        rows: List[dict],
        default_branch_id: Optional[uuid.UUID] = None,
    ) -> dict:
        total_rows = len(rows)
        success_count = 0
        updated_count = 0
        failed_count = 0
        errors: List[str] = []

        # Load all branches to map rows by branch name/code if present in Excel
        branches = (await session.execute(select(Branch))).scalars().all()
        branch_by_name = {b.name.lower().strip(): b.id for b in branches}
        branch_by_code = {b.code.lower().strip(): b.id for b in branches if b.code}
        first_branch_id = branches[0].id if branches else None

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

            # Determine target branch for this item
            branch_raw = str(row.get("branch") or row.get("branch_name") or "").strip().lower()
            row_branch_id = (
                branch_by_name.get(branch_raw)
                or branch_by_code.get(branch_raw)
                or default_branch_id
                or first_branch_id
            )

            existing = await InventoryService.get_by_code(session, code, branch_id=row_branch_id)
            if existing:
                existing.name = name
                existing.rate = rate_val
                existing.category = category
                existing.brand = brand
                existing.vendor = vendor
                existing.quantity = qty_val
                if row_branch_id:
                    existing.branch_id = row_branch_id
                updated_count += 1
            else:
                item = InventoryItem(
                    branch_id=row_branch_id,
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


