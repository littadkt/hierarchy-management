from datetime import datetime, timezone
from typing import List, Optional, Tuple, Union
import uuid
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.models.user import Role, User
from app.models.wholesale_customer import WholesaleCustomer
from app.models.wholesale_order import OrderStatus, WholesaleOrder
from app.models.wholesale_product import WholesaleProduct
from app.schemas.wholesale import (
    WholesaleCustomerCreate,
    WholesaleCustomerUpdate,
    WholesaleOrderCreate,
    WholesaleOrderUpdate,
    WholesaleProductCreate,
    WholesaleProductUpdate,
)


class WholesaleService:
    # --- Wholesale Customers ---
    @staticmethod
    async def list_customers(
        session: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[WholesaleCustomer], int]:
        query = select(WholesaleCustomer)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    WholesaleCustomer.name.ilike(search_term),
                    WholesaleCustomer.place.ilike(search_term),
                    WholesaleCustomer.contact_number.ilike(search_term),
                    WholesaleCustomer.email.ilike(search_term),
                )
            )

        # Count total
        count_stmt = select(WholesaleCustomer.id)
        if search:
            search_term = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    WholesaleCustomer.name.ilike(search_term),
                    WholesaleCustomer.place.ilike(search_term),
                    WholesaleCustomer.contact_number.ilike(search_term),
                    WholesaleCustomer.email.ilike(search_term),
                )
            )
        count_res = await session.execute(count_stmt)
        total = len(count_res.scalars().all())

        query = query.order_by(WholesaleCustomer.name.asc()).offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_customer(session: AsyncSession, customer_id: uuid.UUID) -> Optional[WholesaleCustomer]:
        stmt = select(WholesaleCustomer).where(WholesaleCustomer.id == customer_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_customer(
        session: AsyncSession, customer_in: WholesaleCustomerCreate
    ) -> WholesaleCustomer:
        customer = WholesaleCustomer(
            name=customer_in.name.strip(),
            place=customer_in.place.strip(),
            contact_number=customer_in.contact_number.strip(),
            email=customer_in.email.strip() if customer_in.email else None,
            address=customer_in.address.strip() if customer_in.address else None,
        )
        session.add(customer)
        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def update_customer(
        session: AsyncSession,
        customer_id: uuid.UUID,
        customer_in: WholesaleCustomerUpdate,
    ) -> WholesaleCustomer:
        customer = await WholesaleService.get_customer(session, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale customer not found.",
            )
        if customer_in.name is not None:
            customer.name = customer_in.name.strip()
        if customer_in.place is not None:
            customer.place = customer_in.place.strip()
        if customer_in.contact_number is not None:
            customer.contact_number = customer_in.contact_number.strip()
        if customer_in.email is not None:
            customer.email = customer_in.email.strip() if customer_in.email else None
        if customer_in.address is not None:
            customer.address = customer_in.address.strip() if customer_in.address else None

        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def delete_customer(
        session: AsyncSession,
        customer_id: uuid.UUID,
    ) -> None:
        customer = await WholesaleService.get_customer(session, customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale customer not found.",
            )
        # Check if customer has active orders
        order_stmt = select(WholesaleOrder).where(WholesaleOrder.customer_id == customer_id)
        order_res = await session.execute(order_stmt)
        if order_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete customer with associated orders. Delete or reassign orders first.",
            )
        await session.delete(customer)
        await session.commit()

    # --- Wholesale Products ---
    @staticmethod
    async def list_products(
        session: AsyncSession,
        search: Optional[str] = None,
        category: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[WholesaleProduct], int]:
        query = select(WholesaleProduct)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    WholesaleProduct.name.ilike(search_term),
                    WholesaleProduct.code.ilike(search_term),
                    WholesaleProduct.brand.ilike(search_term),
                    WholesaleProduct.vendor.ilike(search_term),
                    WholesaleProduct.category.ilike(search_term),
                )
            )
        if category:
            query = query.where(WholesaleProduct.category == category)

        count_stmt = select(WholesaleProduct.id)
        if search:
            search_term = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    WholesaleProduct.name.ilike(search_term),
                    WholesaleProduct.code.ilike(search_term),
                    WholesaleProduct.brand.ilike(search_term),
                    WholesaleProduct.vendor.ilike(search_term),
                    WholesaleProduct.category.ilike(search_term),
                )
            )
        if category:
            count_stmt = count_stmt.where(WholesaleProduct.category == category)
        count_res = await session.execute(count_stmt)
        total = len(count_res.scalars().all())

        query = query.order_by(WholesaleProduct.name.asc()).offset(skip).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_product(session: AsyncSession, product_id: uuid.UUID) -> Optional[WholesaleProduct]:
        stmt = select(WholesaleProduct).where(WholesaleProduct.id == product_id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_product_by_code(session: AsyncSession, code: str) -> Optional[WholesaleProduct]:
        stmt = select(WholesaleProduct).where(WholesaleProduct.code == code.strip())
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_product(
        session: AsyncSession, product_in: WholesaleProductCreate
    ) -> WholesaleProduct:
        # Check duplicate code
        existing = await WholesaleService.get_product_by_code(session, product_in.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Wholesale product with code/barcode '{product_in.code}' already exists.",
            )

        product = WholesaleProduct(
            code=product_in.code.strip(),
            name=product_in.name.strip(),
            rate=product_in.rate,
            category=product_in.category.strip(),
            brand=product_in.brand.strip(),
            vendor=product_in.vendor.strip(),
            quantity=product_in.quantity,
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)
        return product

    @staticmethod
    async def update_product(
        session: AsyncSession,
        product_id: uuid.UUID,
        product_in: WholesaleProductUpdate,
    ) -> WholesaleProduct:
        product = await WholesaleService.get_product(session, product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale product not found.",
            )
        if product_in.code is not None and product_in.code.strip() != product.code:
            existing = await WholesaleService.get_product_by_code(session, product_in.code)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Barcode '{product_in.code}' is already assigned to another wholesale product.",
                )
            product.code = product_in.code.strip()

        if product_in.name is not None:
            product.name = product_in.name.strip()
        if product_in.rate is not None:
            product.rate = product_in.rate
        if product_in.category is not None:
            product.category = product_in.category.strip()
        if product_in.brand is not None:
            product.brand = product_in.brand.strip()
        if product_in.vendor is not None:
            product.vendor = product_in.vendor.strip()
        if product_in.quantity is not None:
            product.quantity = product_in.quantity

        await session.commit()
        await session.refresh(product)
        return product

    @staticmethod
    async def delete_product(
        session: AsyncSession,
        product_id: uuid.UUID,
    ) -> None:
        product = await WholesaleService.get_product(session, product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale product not found.",
            )
        # Check if product is in any active orders
        order_stmt = select(WholesaleOrder).where(WholesaleOrder.product_id == product_id)
        order_res = await session.execute(order_stmt)
        if order_res.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete product with associated orders.",
            )
        await session.delete(product)
        await session.commit()

    @staticmethod
    async def bulk_delete_products(
        session: AsyncSession,
        product_ids: List[uuid.UUID],
    ) -> dict:
        deleted_count = 0
        errors: List[str] = []

        for product_id in product_ids:
            product = await WholesaleService.get_product(session, product_id)
            if not product:
                continue

            order_stmt = select(WholesaleOrder).where(WholesaleOrder.product_id == product_id)
            order_res = await session.execute(order_stmt)
            if order_res.scalars().first():
                errors.append(f"Product '{product.name}' ({product.code}) has associated orders and cannot be deleted.")
                continue

            await session.delete(product)
            deleted_count += 1

        await session.commit()
        return {
            "deleted_count": deleted_count,
            "failed_count": len(errors),
            "errors": errors,
        }

    # --- Super Admin Order Placement Permissions ---
    @staticmethod
    async def set_user_order_permission(
        session: AsyncSession,
        operator: User,
        target_user_id: uuid.UUID,
        can_place: bool,
    ) -> User:
        """
        Super Admin Provision:
        Set which users are allowed to place wholesale orders.
        """
        if operator.role != Role.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin has permission to configure which users are allowed to place orders.",
            )

        stmt = select(User).where(User.id == target_user_id)
        res = await session.execute(stmt)
        target = res.scalar_one_or_none()
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        target.can_place_wholesale_orders = can_place
        await session.commit()
        await session.refresh(target)
        return target

    @staticmethod
    async def list_users_with_permissions(session: AsyncSession, operator: User) -> List[User]:
        """List users for Super Admin permissions configuration"""
        if operator.role != Role.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Super Admin can view order permission management.",
            )
        stmt = select(User).order_by(User.role.asc(), User.full_name.asc())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    # --- Wholesale Order Placement ---
    @staticmethod
    async def create_order(
        session: AsyncSession,
        operator: User,
        order_in: WholesaleOrderCreate,
    ) -> Union[WholesaleOrder, List[WholesaleOrder]]:
        """
        Place wholesale orders (supports single or multiple products at a time).
        Requires user to be Super Admin or have can_place_wholesale_orders permission.
        """
        if operator.role != Role.SUPER_ADMIN and not operator.can_place_wholesale_orders:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to place wholesale orders. Permission must be granted by Super Admin.",
            )

        # 1. Fetch Customer
        customer = await WholesaleService.get_customer(session, order_in.customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected wholesale customer does not exist.",
            )

        # 2. Normalize items list
        items_to_order: List[Tuple[uuid.UUID, int]] = []
        if order_in.items and len(order_in.items) > 0:
            for item in order_in.items:
                if item.quantity <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Quantity for each product item must be at least 1.",
                    )
                items_to_order.append((item.product_id, item.quantity))
        elif order_in.product_id and (order_in.quantity or 1) >= 1:
            items_to_order.append((order_in.product_id, order_in.quantity or 1))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one wholesale product item must be specified.",
            )

        # 3. Validate all products exist before creating orders
        products_map = {}
        for prod_id, qty in items_to_order:
            product = await WholesaleService.get_product(session, prod_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Wholesale product '{prod_id}' not found.",
                )
            products_map[prod_id] = product

        place = (order_in.place or customer.place).strip()
        contact_number = (order_in.contact_number or customer.contact_number).strip()
        order_base = f"WO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        created_orders: List[WholesaleOrder] = []
        is_multi = len(items_to_order) > 1

        for idx, (prod_id, qty) in enumerate(items_to_order):
            product = products_map[prod_id]
            # Decrement stock
            product.quantity -= qty

            total_amount = round(product.rate * qty, 2)
            order_num = f"{order_base}-{idx + 1}" if is_multi else order_base

            order = WholesaleOrder(
                order_number=order_num,
                customer_id=customer.id,
                customer_name=customer.name,
                place=place,
                contact_number=contact_number,
                product_id=product.id,
                product_code=product.code,
                product_name=product.name,
                unit_rate=product.rate,
                quantity=qty,
                total_amount=total_amount,
                status=OrderStatus.PENDING,
                notes=order_in.notes.strip() if order_in.notes else None,
                placed_by_id=operator.id,
            )
            session.add(order)
            created_orders.append(order)

        await session.commit()

        # Eager load relationships for response
        loaded_orders: List[WholesaleOrder] = []
        for o in created_orders:
            stmt = (
                select(WholesaleOrder)
                .options(
                    selectinload(WholesaleOrder.customer),
                    selectinload(WholesaleOrder.product),
                    selectinload(WholesaleOrder.placed_by),
                )
                .where(WholesaleOrder.id == o.id)
            )
            res = await session.execute(stmt)
            loaded_orders.append(res.scalar_one())

        broadcaster.broadcast_sync({
            "type": "WHOLESALE_ORDER_CREATED",
            "data": {
                "order_ids": [str(o.id) for o in loaded_orders],
                "placed_by_id": str(operator.id),
                "count": len(loaded_orders),
            },
        })

        if is_multi:
            return loaded_orders
        return loaded_orders[0]

    @staticmethod
    async def list_orders(
        session: AsyncSession,
        operator: User,
        status_filter: Optional[OrderStatus] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[WholesaleOrder], int]:
        """
        List placed orders:
        - Shown to In-Charges, Admins, and Super Admins (see all orders).
        - Other roles (who were allowed to place orders) see only their own orders.
        """
        query = select(WholesaleOrder).options(
            selectinload(WholesaleOrder.customer),
            selectinload(WholesaleOrder.product),
            selectinload(WholesaleOrder.placed_by),
        )

        # Visibility filter: In-Charge, Admin, Super Admin see all; others see their own
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
            query = query.where(WholesaleOrder.placed_by_id == operator.id)

        if status_filter:
            query = query.where(WholesaleOrder.status == status_filter)

        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    WholesaleOrder.order_number.ilike(search_term),
                    WholesaleOrder.customer_name.ilike(search_term),
                    WholesaleOrder.place.ilike(search_term),
                    WholesaleOrder.product_name.ilike(search_term),
                    WholesaleOrder.product_code.ilike(search_term),
                )
            )

        # Total count
        count_stmt = select(WholesaleOrder.id)
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
            count_stmt = count_stmt.where(WholesaleOrder.placed_by_id == operator.id)
        if status_filter:
            count_stmt = count_stmt.where(WholesaleOrder.status == status_filter)
        if search:
            search_term = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    WholesaleOrder.order_number.ilike(search_term),
                    WholesaleOrder.customer_name.ilike(search_term),
                    WholesaleOrder.place.ilike(search_term),
                    WholesaleOrder.product_name.ilike(search_term),
                    WholesaleOrder.product_code.ilike(search_term),
                )
            )

        count_res = await session.execute(count_stmt)
        total = len(count_res.scalars().all())

        query = query.order_by(WholesaleOrder.created_at.desc()).offset(skip).limit(limit)
        res = await session.execute(query)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_order_by_id(session: AsyncSession, order_id: uuid.UUID) -> Optional[WholesaleOrder]:
        stmt = (
            select(WholesaleOrder)
            .options(
                selectinload(WholesaleOrder.customer),
                selectinload(WholesaleOrder.product),
                selectinload(WholesaleOrder.placed_by),
            )
            .where(WholesaleOrder.id == order_id)
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def update_order_status(
        session: AsyncSession,
        operator: User,
        order_id: uuid.UUID,
        new_status: OrderStatus,
    ) -> WholesaleOrder:
        """
        Update order status:
        Super Admin, Admin, and In-Charge can update status.
        """
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only In-Charges, Admins, and Super Admins can update order status.",
            )

        order = await WholesaleService.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale order not found.",
            )

        # If order is being cancelled from non-cancelled status, restore product stock
        if new_status == OrderStatus.CANCELLED and order.status != OrderStatus.CANCELLED:
            product = await WholesaleService.get_product(session, order.product_id)
            if product:
                product.quantity += order.quantity

        order.status = new_status
        await session.commit()
        await session.refresh(order)
        broadcaster.broadcast_sync({
            "type": "WHOLESALE_ORDER_STATUS_UPDATED",
            "data": {
                "order_id": str(order.id),
                "status": new_status.value if hasattr(new_status, "value") else new_status,
                "placed_by_id": str(order.placed_by_id),
                "operator_id": str(operator.id),
            },
        })
        return order

    @staticmethod
    async def update_order(
        session: AsyncSession,
        operator: User,
        order_id: uuid.UUID,
        order_in: WholesaleOrderUpdate,
    ) -> WholesaleOrder:
        order = await WholesaleService.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale order not found.",
            )

        # Permission check
        is_elevated = operator.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]
        is_owner = order.placed_by_id == operator.id
        if not is_elevated and not (is_owner and order.status == OrderStatus.PENDING):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this order.",
            )

        # Update customer if changed
        if order_in.customer_id is not None and order_in.customer_id != order.customer_id:
            customer = await WholesaleService.get_customer(session, order_in.customer_id)
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified customer not found.",
                )
            order.customer_id = customer.id
            order.customer_name = customer.name
            order.place = order_in.place or customer.place
            order.contact_number = order_in.contact_number or customer.contact_number
        else:
            if order_in.place is not None:
                order.place = order_in.place
            if order_in.contact_number is not None:
                order.contact_number = order_in.contact_number

        if order_in.notes is not None:
            order.notes = order_in.notes

        # Status update if provided
        if order_in.status is not None and order_in.status != order.status:
            if not is_elevated:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only In-Charges, Admins, and Super Admins can update order status.",
                )
            if order_in.status == OrderStatus.CANCELLED and order.status != OrderStatus.CANCELLED:
                prod = await WholesaleService.get_product(session, order.product_id)
                if prod:
                    prod.quantity += order.quantity
            order.status = order_in.status

        # Product or Quantity update
        new_quantity = order_in.quantity if order_in.quantity is not None else order.quantity
        new_product_id = order_in.product_id if order_in.product_id is not None else order.product_id

        if new_product_id != order.product_id:
            old_prod = await WholesaleService.get_product(session, order.product_id)
            new_prod = await WholesaleService.get_product(session, new_product_id)
            if not new_prod:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified wholesale product not found.",
                )

            # Restore old product stock if order is active
            if order.status not in [OrderStatus.CANCELLED, OrderStatus.DELIVERED] and old_prod:
                old_prod.quantity += order.quantity

            # Adjust new product stock (independent, negative stock allowed)
            if order.status not in [OrderStatus.CANCELLED, OrderStatus.DELIVERED]:
                new_prod.quantity -= new_quantity

            order.product_id = new_prod.id
            order.product_code = new_prod.code
            order.product_name = new_prod.name
            order.unit_rate = new_prod.rate
            order.quantity = new_quantity
            order.total_amount = new_prod.rate * new_quantity

        elif order_in.quantity is not None and order_in.quantity != order.quantity:
            prod = await WholesaleService.get_product(session, order.product_id)
            qty_diff = new_quantity - order.quantity
            if order.status not in [OrderStatus.CANCELLED, OrderStatus.DELIVERED] and prod:
                prod.quantity -= qty_diff

            order.quantity = new_quantity
            order.total_amount = order.unit_rate * new_quantity

        await session.commit()
        await session.refresh(order)
        broadcaster.broadcast_sync({
            "type": "WHOLESALE_ORDER_UPDATED",
            "data": {
                "order_id": str(order.id),
                "status": order.status.value if hasattr(order.status, "value") else order.status,
                "placed_by_id": str(order.placed_by_id),
            },
        })
        return order

    @staticmethod
    async def delete_order(
        session: AsyncSession,
        operator: User,
        order_id: uuid.UUID,
    ) -> None:
        order = await WholesaleService.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wholesale order not found.",
            )

        is_elevated = operator.role in [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE]
        is_owner = order.placed_by_id == operator.id
        if not is_elevated and not (is_owner and order.status == OrderStatus.PENDING):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete this order.",
            )

        # Restore stock if active
        if order.status not in [OrderStatus.CANCELLED, OrderStatus.DELIVERED]:
            product = await WholesaleService.get_product(session, order.product_id)
            if product:
                product.quantity += order.quantity

        await session.delete(order)
        await session.commit()
        broadcaster.broadcast_sync({
            "type": "WHOLESALE_ORDER_DELETED",
            "data": {
                "order_id": str(order_id),
                "placed_by_id": str(order.placed_by_id),
            },
        })

    @staticmethod
    async def get_customer_by_contact_or_name(
        session: AsyncSession, contact: str, name: str
    ) -> Optional[WholesaleCustomer]:
        stmt = select(WholesaleCustomer).where(
            or_(
                WholesaleCustomer.contact_number == contact.strip(),
                WholesaleCustomer.name.ilike(name.strip()),
            )
        )
        res = await session.execute(stmt)
        return res.scalars().first()

    @staticmethod
    async def bulk_import_products_from_excel(
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

            existing = await WholesaleService.get_product_by_code(session, code)
            if existing:
                existing.name = name
                existing.rate = rate_val
                existing.category = category
                existing.brand = brand
                existing.vendor = vendor
                existing.quantity = qty_val
                updated_count += 1
            else:
                item = WholesaleProduct(
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

    @staticmethod
    async def bulk_import_customers_from_excel(
        session: AsyncSession, rows: List[dict]
    ) -> dict:
        total_rows = len(rows)
        success_count = 0
        updated_count = 0
        failed_count = 0
        errors: List[str] = []

        for idx, row in enumerate(rows, start=1):
            name = str(row.get("name") or row.get("customername") or "").strip()
            place = str(row.get("place") or row.get("city") or "").strip()
            contact_number = str(
                row.get("contact_number")
                or row.get("contactnumber")
                or row.get("phone")
                or row.get("mobile")
                or ""
            ).strip()
            email = str(row.get("email") or "").strip() if row.get("email") else None
            address = str(row.get("address") or "").strip() if row.get("address") else None

            if not name or not place or not contact_number:
                failed_count += 1
                errors.append(f"Row {idx}: 'Customer Name', 'Place', and 'Contact Number' are required.")
                continue

            existing = await WholesaleService.get_customer_by_contact_or_name(session, contact_number, name)
            if existing:
                existing.name = name
                existing.place = place
                existing.contact_number = contact_number
                if email:
                    existing.email = email
                if address:
                    existing.address = address
                updated_count += 1
            else:
                customer = WholesaleCustomer(
                    name=name,
                    place=place,
                    contact_number=contact_number,
                    email=email,
                    address=address,
                )
                session.add(customer)
                success_count += 1

        await session.commit()
        return {
            "total_rows": total_rows,
            "success_count": success_count,
            "updated_count": updated_count,
            "failed_count": failed_count,
            "errors": errors,
        }

