from datetime import datetime, timezone
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryItem
from app.models.sap import (
    ProductServiceTicket,
    RentalBooking,
    RentalProduct,
    SapSalesOrder,
    SapGlAccount,
    SapJournalEntry,
    SapCostCenter,
    SapProfitCenter,
    SapMaterialMaster,
    SapPurchaseRequisition,
    SapQuotation,
    SapHcmEmployee,
    SapProductionOrder,
    SapBomItem,
    SapWarehouseBin,
    SapTransferOrder,
    SapAbapScript,
    SapTaxRate,
    SapTaxLedger,
    SapCustomer,
    SapCustomerEnquiry,
    SapInvoice,
    SapOutboundDelivery,
    SapPosSale,
    SapVendor,
    SapPurchaseOrder,
    SapGoodsReceipt,
    SapVendorBill,
    SapDebitNote,
    SapStockTransfer,
    SapStockMovement,
    SapStockTaking,
    SapDamagedItem,
    SapPriceChange,
    SapAccountingVoucher,
    SapBankReconciliation,
    SapVoucherFormat,
    SapDataMigration,
)
from app.schemas.sap import (
    ProductServiceTicketCreate,
    ProductServiceTicketUpdate,
    RentalBookingCreate,
    RentalBookingUpdate,
    RentalProductCreate,
    RentalProductUpdate,
    SapDashboardStats,
    SapSalesOrderCreate,
    SapSalesOrderUpdate,
    SapGlAccountCreate,
    SapJournalEntryCreate,
    SapCostCenterCreate,
    SapProfitCenterCreate,
    SapMaterialMasterCreate,
    SapPurchaseRequisitionCreate,
    SapQuotationCreate,
    SapHcmEmployeeCreate,
    SapProductionOrderCreate,
    SapBomItemCreate,
    SapWarehouseBinCreate,
    SapTransferOrderCreate,
    SapAbapScriptCreate,
    SapTaxRateCreate,
    SapTaxLedgerCreate,
    SapTaxSummaryOut,
    SapCustomerCreate,
    SapCustomerUpdate,
    SapCustomerEnquiryCreate,
    SapCustomerEnquiryUpdate,
    SapInvoiceCreate,
    SapInvoiceUpdate,
    SapInvoicePaymentRecord,
    SapOutboundDeliveryCreate,
    SapOutboundDeliveryUpdate,
    SapPosSaleCreate,
    SapVendorCreate,
    SapVendorUpdate,
    SapPurchaseOrderCreate,
    SapPurchaseOrderUpdate,
    SapGoodsReceiptCreate,
    SapVendorBillCreate,
    SapVendorBillUpdate,
    SapDebitNoteCreate,
    SapStockTransferCreate,
    SapStockMovementCreate,
    SapStockTakingCreate,
    SapDamagedItemCreate,
    SapPriceChangeCreate,
    SapAccountingVoucherCreate,
    SapBankReconciliationCreate,
    SapVoucherFormatCreate,
    SapDataMigrationCreate,
    SapTrialBalanceReport,
    SapProfitLossReport,
    SapBalanceSheetReport,
    SapReceivablesAgeingReport,
    SapSalesRegisterReport,
)


class SapService:
    # -------------------------------------------------------------
    # 1. PRODUCT SERVICE TICKETS & REPAIRS
    # -------------------------------------------------------------
    @staticmethod
    async def list_service_tickets(
        session: AsyncSession,
        search: Optional[str] = None,
        ticket_status: Optional[str] = None,
        service_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[ProductServiceTicket], int]:
        stmt = select(ProductServiceTicket)

        if ticket_status and ticket_status.upper() != "ALL":
            stmt = stmt.where(ProductServiceTicket.status == ticket_status.upper())

        if service_type and service_type.upper() != "ALL":
            stmt = stmt.where(ProductServiceTicket.service_type == service_type.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    ProductServiceTicket.ticket_number.ilike(search_term),
                    ProductServiceTicket.customer_name.ilike(search_term),
                    ProductServiceTicket.customer_phone.ilike(search_term),
                    ProductServiceTicket.product_name.ilike(search_term),
                    ProductServiceTicket.serial_number.ilike(search_term),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(ProductServiceTicket.created_at)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_service_ticket(
        session: AsyncSession, ticket_id: uuid.UUID
    ) -> Optional[ProductServiceTicket]:
        stmt = select(ProductServiceTicket).where(ProductServiceTicket.id == ticket_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_service_ticket(
        session: AsyncSession, data: ProductServiceTicketCreate
    ) -> ProductServiceTicket:
        # Generate ticket number if not provided
        ticket_number = data.ticket_number
        if not ticket_number:
            count_res = await session.execute(select(func.count(ProductServiceTicket.id)))
            current_count = (count_res.scalar() or 0) + 1
            ticket_number = f"SRV-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        total_cost = (data.parts_cost or 0.0) + (data.service_charge or 0.0)
        ticket = ProductServiceTicket(
            ticket_number=ticket_number,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            customer_email=data.customer_email,
            product_name=data.product_name,
            serial_number=data.serial_number,
            service_type=data.service_type.upper(),
            priority=data.priority.upper(),
            status=data.status.upper(),
            issue_description=data.issue_description,
            diagnostic_notes=data.diagnostic_notes,
            parts_replaced=data.parts_replaced,
            parts_cost=data.parts_cost,
            service_charge=data.service_charge,
            total_cost=total_cost,
            assigned_technician_name=data.assigned_technician_name,
            expected_delivery_date=data.expected_delivery_date,
        )
        session.add(ticket)
        await session.commit()
        await session.refresh(ticket)
        return ticket

    @staticmethod
    async def update_service_ticket(
        session: AsyncSession, ticket_id: uuid.UUID, data: ProductServiceTicketUpdate
    ) -> ProductServiceTicket:
        ticket = await SapService.get_service_ticket(session, ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service ticket not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key in ["status", "service_type", "priority"]:
                    setattr(ticket, key, str(value).upper())
                else:
                    setattr(ticket, key, value)

        # Recalculate total cost if parts or service charge updated
        ticket.total_cost = (ticket.parts_cost or 0.0) + (ticket.service_charge or 0.0)
        if ticket.status in ["COMPLETED", "DELIVERED"] and not ticket.completed_date:
            ticket.completed_date = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(ticket)
        return ticket

    @staticmethod
    async def delete_service_ticket(session: AsyncSession, ticket_id: uuid.UUID) -> bool:
        ticket = await SapService.get_service_ticket(session, ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service ticket not found")
        await session.delete(ticket)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 2. RENTAL PRODUCTS & FLEET
    # -------------------------------------------------------------
    @staticmethod
    async def list_rental_products(
        session: AsyncSession,
        category: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[RentalProduct], int]:
        stmt = select(RentalProduct)

        if category and category.upper() != "ALL":
            stmt = stmt.where(RentalProduct.category.ilike(f"%{category}%"))

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    RentalProduct.product_code.ilike(search_term),
                    RentalProduct.name.ilike(search_term),
                    RentalProduct.category.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(RentalProduct.name).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_rental_product(
        session: AsyncSession, product_id: uuid.UUID
    ) -> Optional[RentalProduct]:
        stmt = select(RentalProduct).where(RentalProduct.id == product_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_rental_product(
        session: AsyncSession, data: RentalProductCreate
    ) -> RentalProduct:
        existing = await session.execute(
            select(RentalProduct).where(RentalProduct.product_code == data.product_code)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Rental product code '{data.product_code}' already exists.",
            )

        product = RentalProduct(
            product_code=data.product_code.upper().strip(),
            name=data.name.strip(),
            category=data.category.strip(),
            daily_rate=data.daily_rate,
            weekly_rate=data.weekly_rate,
            monthly_rate=data.monthly_rate,
            security_deposit=data.security_deposit,
            total_quantity=data.total_quantity,
            available_quantity=data.available_quantity,
            condition_status=data.condition_status.upper(),
            description=data.description,
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)
        return product

    @staticmethod
    async def update_rental_product(
        session: AsyncSession, product_id: uuid.UUID, data: RentalProductUpdate
    ) -> RentalProduct:
        product = await SapService.get_rental_product(session, product_id)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental product not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key == "condition_status":
                    setattr(product, key, str(value).upper())
                else:
                    setattr(product, key, value)

        await session.commit()
        await session.refresh(product)
        return product

    @staticmethod
    async def delete_rental_product(session: AsyncSession, product_id: uuid.UUID) -> bool:
        product = await SapService.get_rental_product(session, product_id)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental product not found")
        await session.delete(product)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 3. RENTAL BOOKINGS
    # -------------------------------------------------------------
    @staticmethod
    async def list_rental_bookings(
        session: AsyncSession,
        booking_status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[RentalBooking], int]:
        stmt = select(RentalBooking)

        if booking_status and booking_status.upper() != "ALL":
            stmt = stmt.where(RentalBooking.status == booking_status.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    RentalBooking.booking_number.ilike(search_term),
                    RentalBooking.customer_name.ilike(search_term),
                    RentalBooking.customer_phone.ilike(search_term),
                    RentalBooking.product_name.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(RentalBooking.created_at)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_rental_booking(
        session: AsyncSession, booking_id: uuid.UUID
    ) -> Optional[RentalBooking]:
        stmt = select(RentalBooking).where(RentalBooking.id == booking_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_rental_booking(
        session: AsyncSession, data: RentalBookingCreate
    ) -> RentalBooking:
        # Check product availability
        product = None
        if data.rental_product_id:
            product = await SapService.get_rental_product(session, data.rental_product_id)
            if product:
                if product.available_quantity < data.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Only {product.available_quantity} unit(s) available for rental.",
                    )
                # Deduct available units
                product.available_quantity -= data.quantity

        booking_number = data.booking_number
        if not booking_number:
            count_res = await session.execute(select(func.count(RentalBooking.id)))
            current_count = (count_res.scalar() or 0) + 1
            booking_number = f"RNT-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        booking = RentalBooking(
            booking_number=booking_number,
            rental_product_id=data.rental_product_id,
            product_name=data.product_name,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            customer_id_proof=data.customer_id_proof,
            start_date=data.start_date,
            end_date=data.end_date,
            rate_type=data.rate_type.upper(),
            rental_rate=data.rental_rate,
            quantity=data.quantity,
            total_amount=data.total_amount,
            security_deposit=data.security_deposit,
            deposit_refunded=data.deposit_refunded,
            damage_charges=data.damage_charges,
            status=data.status.upper(),
            notes=data.notes,
        )
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
        return booking

    @staticmethod
    async def update_rental_booking(
        session: AsyncSession, booking_id: uuid.UUID, data: RentalBookingUpdate
    ) -> RentalBooking:
        booking = await SapService.get_rental_booking(session, booking_id)
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental booking not found")

        old_status = booking.status
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key == "status":
                    setattr(booking, key, str(value).upper())
                else:
                    setattr(booking, key, value)

        # If booking changed to RETURNED or CANCELLED, restore product quantity
        if old_status in ["ACTIVE", "BOOKED", "OVERDUE"] and booking.status in ["RETURNED", "CANCELLED"]:
            if booking.rental_product_id:
                product = await SapService.get_rental_product(session, booking.rental_product_id)
                if product:
                    product.available_quantity = min(
                        product.total_quantity, product.available_quantity + booking.quantity
                    )
            if not booking.actual_return_date:
                booking.actual_return_date = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(booking)
        return booking

    # -------------------------------------------------------------
    # 4. SAP SALES ORDERS
    # -------------------------------------------------------------
    @staticmethod
    async def list_sales_orders(
        session: AsyncSession,
        order_status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapSalesOrder], int]:
        stmt = select(SapSalesOrder)

        if order_status and order_status.upper() != "ALL":
            stmt = stmt.where(SapSalesOrder.status == order_status.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapSalesOrder.order_number.ilike(search_term),
                    SapSalesOrder.customer_name.ilike(search_term),
                    SapSalesOrder.customer_phone.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(SapSalesOrder.order_date)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def create_sales_order(
        session: AsyncSession, data: SapSalesOrderCreate
    ) -> SapSalesOrder:
        order_number = data.order_number
        if not order_number:
            count_res = await session.execute(select(func.count(SapSalesOrder.id)))
            current_count = (count_res.scalar() or 0) + 1
            order_number = f"SO-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        order = SapSalesOrder(
            order_number=order_number,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            customer_email=data.customer_email,
            order_date=data.order_date or datetime.now(timezone.utc),
            total_amount=data.total_amount,
            tax_amount=data.tax_amount,
            status=data.status.upper(),
            payment_status=data.payment_status.upper(),
            items_summary=data.items_summary,
            notes=data.notes,
        )
        session.add(order)
        await session.commit()
        await session.refresh(order)
        return order

    @staticmethod
    async def update_sales_order(
        session: AsyncSession, order_id: uuid.UUID, data: SapSalesOrderUpdate
    ) -> SapSalesOrder:
        stmt = select(SapSalesOrder).where(SapSalesOrder.id == order_id)
        result = await session.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales order not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key in ["status", "payment_status"]:
                    setattr(order, key, str(value).upper())
                else:
                    setattr(order, key, value)

        await session.commit()
        await session.refresh(order)
        return order

    # -------------------------------------------------------------
    # 5. SAP DASHBOARD STATS
    # -------------------------------------------------------------
    @staticmethod
    async def get_dashboard_stats(session: AsyncSession) -> SapDashboardStats:
        # Active service tickets
        active_tickets_res = await session.execute(
            select(func.count(ProductServiceTicket.id)).where(
                ProductServiceTicket.status.in_(["RECEIVED", "DIAGNOSING", "IN_REPAIR", "WAITING_PARTS", "READY"])
            )
        )
        active_service_tickets = active_tickets_res.scalar() or 0

        # Completed services
        completed_services_res = await session.execute(
            select(func.count(ProductServiceTicket.id)).where(
                ProductServiceTicket.status.in_(["COMPLETED", "DELIVERED"])
            )
        )
        completed_services = completed_services_res.scalar() or 0

        # Service revenue
        service_rev_res = await session.execute(
            select(func.sum(ProductServiceTicket.total_cost))
        )
        service_revenue = float(service_rev_res.scalar() or 0.0)

        # Rental assets
        rental_assets_res = await session.execute(
            select(func.sum(RentalProduct.total_quantity))
        )
        total_rental_assets = int(rental_assets_res.scalar() or 0)

        # Active rentals
        active_rentals_res = await session.execute(
            select(func.count(RentalBooking.id)).where(
                RentalBooking.status.in_(["BOOKED", "ACTIVE", "OVERDUE"])
            )
        )
        active_rentals = active_rentals_res.scalar() or 0

        # Rental revenue
        rental_rev_res = await session.execute(
            select(func.sum(RentalBooking.total_amount))
        )
        rental_revenue = float(rental_rev_res.scalar() or 0.0)

        # Open sales orders
        open_orders_res = await session.execute(
            select(func.count(SapSalesOrder.id)).where(
                SapSalesOrder.status.in_(["DRAFT", "CONFIRMED", "PROCESSING", "SHIPPED"])
            )
        )
        open_sales_orders = open_orders_res.scalar() or 0

        # Sales revenue
        sales_rev_res = await session.execute(
            select(func.sum(SapSalesOrder.total_amount))
        )
        total_sales_revenue = float(sales_rev_res.scalar() or 0.0)

        # Inventory Items count from existing inventory table
        inv_count_res = await session.execute(select(func.count(InventoryItem.id)))
        inventory_items_count = inv_count_res.scalar() or 0

        low_stock_res = await session.execute(
            select(func.count(InventoryItem.id)).where(InventoryItem.quantity < 5)
        )
        low_stock_alerts_count = low_stock_res.scalar() or 0

        # Additional SAP Core Module Metrics
        gl_count = (await session.execute(select(func.count(SapGlAccount.id)))).scalar() or 0
        jv_count = (await session.execute(select(func.count(SapJournalEntry.id)))).scalar() or 0
        cc_count = (await session.execute(select(func.count(SapCostCenter.id)))).scalar() or 0
        mat_count = (await session.execute(select(func.count(SapMaterialMaster.id)))).scalar() or 0
        pr_count = (await session.execute(select(func.count(SapPurchaseRequisition.id)).where(SapPurchaseRequisition.status == "PENDING"))).scalar() or 0
        qt_count = (await session.execute(select(func.count(SapQuotation.id)).where(SapQuotation.status.in_(["DRAFT", "SENT"])))).scalar() or 0
        emp_count = (await session.execute(select(func.count(SapHcmEmployee.id)).where(SapHcmEmployee.status == "ACTIVE"))).scalar() or 0
        po_count = (await session.execute(select(func.count(SapProductionOrder.id)).where(SapProductionOrder.status.in_(["PLANNED", "RELEASED", "IN_PROCESS"])))).scalar() or 0
        bin_count = (await session.execute(select(func.count(SapWarehouseBin.id)))).scalar() or 0
        abap_count = (await session.execute(select(func.count(SapAbapScript.id)).where(SapAbapScript.is_active == True))).scalar() or 0
        
        tax_coll_res = await session.execute(
            select(func.sum(SapTaxLedger.total_tax)).where(SapTaxLedger.entry_type == "OUTPUT_TAX")
        )
        total_tax_collected = float(tax_coll_res.scalar() or 0.0)

        tax_itc_res = await session.execute(
            select(func.sum(SapTaxLedger.total_tax)).where(SapTaxLedger.entry_type == "INPUT_TAX_CREDIT")
        )
        total_itc_credit = float(tax_itc_res.scalar() or 0.0)

        return SapDashboardStats(
            active_service_tickets=active_service_tickets,
            completed_services_this_month=completed_services,
            service_revenue=service_revenue,
            total_rental_assets=total_rental_assets,
            active_rentals=active_rentals,
            rental_revenue=rental_revenue,
            open_sales_orders=open_sales_orders,
            total_sales_revenue=total_sales_revenue,
            inventory_items_count=inventory_items_count,
            low_stock_alerts_count=low_stock_alerts_count,
            gl_accounts_count=gl_count,
            total_posted_jv=jv_count,
            cost_centers_count=cc_count,
            materials_count=mat_count,
            open_pr_count=pr_count,
            open_quotations_count=qt_count,
            hcm_employees_count=emp_count,
            open_production_orders=po_count,
            warehouse_bins_count=bin_count,
            active_abap_scripts=abap_count,
            total_tax_collected=total_tax_collected,
            total_itc_credit=total_itc_credit,
        )

    # -------------------------------------------------------------
    # 5. SAP FI - FINANCIAL ACCOUNTING
    # -------------------------------------------------------------
    @staticmethod
    async def list_gl_accounts(
        session: AsyncSession,
        account_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[SapGlAccount]:
        stmt = select(SapGlAccount).order_by(SapGlAccount.account_number)
        if account_type and account_type.upper() != "ALL":
            stmt = stmt.where(SapGlAccount.account_type == account_type.upper())
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapGlAccount.account_number.ilike(term),
                    SapGlAccount.account_name.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_gl_account(
        session: AsyncSession, data: SapGlAccountCreate
    ) -> SapGlAccount:
        account = SapGlAccount(**data.model_dump())
        session.add(account)
        await session.commit()
        await session.refresh(account)
        return account

    @staticmethod
    async def list_journal_entries(
        session: AsyncSession,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> List[SapJournalEntry]:
        stmt = select(SapJournalEntry).order_by(desc(SapJournalEntry.posting_date)).limit(limit)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapJournalEntry.entry_number.ilike(term),
                    SapJournalEntry.reference.ilike(term),
                    SapJournalEntry.debit_account.ilike(term),
                    SapJournalEntry.credit_account.ilike(term),
                    SapJournalEntry.narration.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_journal_entry(
        session: AsyncSession, data: SapJournalEntryCreate
    ) -> SapJournalEntry:
        now = datetime.now(timezone.utc)
        payload = data.model_dump()
        if not payload.get("entry_number"):
            count = (await session.execute(select(func.count(SapJournalEntry.id)))).scalar() or 0
            payload["entry_number"] = f"JV-2026-{count + 1:04d}"
        if not payload.get("posting_date"):
            payload["posting_date"] = now
        entry = SapJournalEntry(**payload)
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry

    # -------------------------------------------------------------
    # 6. SAP CO - COST & PROFIT MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_cost_centers(
        session: AsyncSession,
        search: Optional[str] = None,
    ) -> List[SapCostCenter]:
        stmt = select(SapCostCenter).order_by(SapCostCenter.center_code)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapCostCenter.center_code.ilike(term),
                    SapCostCenter.name.ilike(term),
                    SapCostCenter.department.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_cost_center(
        session: AsyncSession, data: SapCostCenterCreate
    ) -> SapCostCenter:
        center = SapCostCenter(**data.model_dump())
        session.add(center)
        await session.commit()
        await session.refresh(center)
        return center

    @staticmethod
    async def list_profit_centers(
        session: AsyncSession,
        search: Optional[str] = None,
    ) -> List[SapProfitCenter]:
        stmt = select(SapProfitCenter).order_by(SapProfitCenter.center_code)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapProfitCenter.center_code.ilike(term),
                    SapProfitCenter.name.ilike(term),
                    SapProfitCenter.head_name.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_profit_center(
        session: AsyncSession, data: SapProfitCenterCreate
    ) -> SapProfitCenter:
        center = SapProfitCenter(**data.model_dump())
        session.add(center)
        await session.commit()
        await session.refresh(center)
        return center

    # -------------------------------------------------------------
    # 7. SAP MM - MATERIAL MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_materials(
        session: AsyncSession,
        material_type: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[SapMaterialMaster]:
        stmt = select(SapMaterialMaster).order_by(SapMaterialMaster.material_code)
        if material_type and material_type.upper() != "ALL":
            stmt = stmt.where(SapMaterialMaster.material_type == material_type.upper())
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapMaterialMaster.material_code.ilike(term),
                    SapMaterialMaster.name.ilike(term),
                    SapMaterialMaster.hsn_code.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_material(
        session: AsyncSession, data: SapMaterialMasterCreate
    ) -> SapMaterialMaster:
        mat = SapMaterialMaster(**data.model_dump())
        session.add(mat)
        await session.commit()
        await session.refresh(mat)
        return mat

    @staticmethod
    async def list_purchase_requisitions(
        session: AsyncSession,
        status: Optional[str] = None,
    ) -> List[SapPurchaseRequisition]:
        stmt = select(SapPurchaseRequisition).order_by(desc(SapPurchaseRequisition.created_at))
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapPurchaseRequisition.status == status.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_purchase_requisition(
        session: AsyncSession, data: SapPurchaseRequisitionCreate
    ) -> SapPurchaseRequisition:
        now = datetime.now(timezone.utc)
        payload = data.model_dump()
        if not payload.get("pr_number"):
            count = (await session.execute(select(func.count(SapPurchaseRequisition.id)))).scalar() or 0
            payload["pr_number"] = f"PR-2026-{count + 1:04d}"
        if not payload.get("required_date"):
            payload["required_date"] = now
        pr = SapPurchaseRequisition(**payload)
        session.add(pr)
        await session.commit()
        await session.refresh(pr)
        return pr

    # -------------------------------------------------------------
    # 8. SAP SD - SALES & DISTRIBUTION (QUOTATIONS)
    # -------------------------------------------------------------
    @staticmethod
    async def list_quotations(
        session: AsyncSession,
        status: Optional[str] = None,
    ) -> List[SapQuotation]:
        stmt = select(SapQuotation).order_by(desc(SapQuotation.created_at))
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapQuotation.status == status.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_quotation(
        session: AsyncSession, data: SapQuotationCreate
    ) -> SapQuotation:
        payload = data.model_dump()
        if not payload.get("quotation_number"):
            count = (await session.execute(select(func.count(SapQuotation.id)))).scalar() or 0
            payload["quotation_number"] = f"QT-2026-{count + 1:04d}"
        if not payload.get("valid_until"):
            from datetime import timedelta
            payload["valid_until"] = datetime.now(timezone.utc) + timedelta(days=30)
        qt = SapQuotation(**payload)
        session.add(qt)
        await session.commit()
        await session.refresh(qt)
        return qt

    # -------------------------------------------------------------
    # 9. SAP HCM - HUMAN RESOURCE MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_hcm_employees(
        session: AsyncSession,
        department: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[SapHcmEmployee]:
        stmt = select(SapHcmEmployee).order_by(SapHcmEmployee.personnel_number)
        if department and department.upper() != "ALL":
            stmt = stmt.where(SapHcmEmployee.department == department)
        if search:
            term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapHcmEmployee.personnel_number.ilike(term),
                    SapHcmEmployee.full_name.ilike(term),
                    SapHcmEmployee.designation.ilike(term),
                )
            )
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_hcm_employee(
        session: AsyncSession, data: SapHcmEmployeeCreate
    ) -> SapHcmEmployee:
        payload = data.model_dump()
        if not payload.get("joining_date"):
            payload["joining_date"] = datetime.now(timezone.utc)
        emp = SapHcmEmployee(**payload)
        session.add(emp)
        await session.commit()
        await session.refresh(emp)
        return emp

    # -------------------------------------------------------------
    # 10. SAP PP - PRODUCTION PLANNING
    # -------------------------------------------------------------
    @staticmethod
    async def list_production_orders(
        session: AsyncSession,
        status: Optional[str] = None,
    ) -> List[SapProductionOrder]:
        stmt = select(SapProductionOrder).order_by(desc(SapProductionOrder.created_at))
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapProductionOrder.status == status.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_production_order(
        session: AsyncSession, data: SapProductionOrderCreate
    ) -> SapProductionOrder:
        from datetime import timedelta
        payload = data.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("order_number"):
            count = (await session.execute(select(func.count(SapProductionOrder.id)))).scalar() or 0
            payload["order_number"] = f"PROD-2026-{count + 1:04d}"
        if not payload.get("start_date"):
            payload["start_date"] = now
        if not payload.get("end_date"):
            payload["end_date"] = now + timedelta(days=7)
        po = SapProductionOrder(**payload)
        session.add(po)
        await session.commit()
        await session.refresh(po)
        return po

    @staticmethod
    async def list_bom_items(
        session: AsyncSession,
        bom_code: Optional[str] = None,
    ) -> List[SapBomItem]:
        stmt = select(SapBomItem).order_by(SapBomItem.bom_code)
        if bom_code:
            stmt = stmt.where(SapBomItem.bom_code == bom_code)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_bom_item(
        session: AsyncSession, data: SapBomItemCreate
    ) -> SapBomItem:
        bom = SapBomItem(**data.model_dump())
        session.add(bom)
        await session.commit()
        await session.refresh(bom)
        return bom

    # -------------------------------------------------------------
    # 11. SAP WM - WAREHOUSE MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_warehouse_bins(
        session: AsyncSession,
        zone: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[SapWarehouseBin]:
        stmt = select(SapWarehouseBin).order_by(SapWarehouseBin.bin_code)
        if zone and zone.upper() != "ALL":
            stmt = stmt.where(SapWarehouseBin.warehouse_zone == zone)
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapWarehouseBin.status == status.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_warehouse_bin(
        session: AsyncSession, data: SapWarehouseBinCreate
    ) -> SapWarehouseBin:
        wb = SapWarehouseBin(**data.model_dump())
        session.add(wb)
        await session.commit()
        await session.refresh(wb)
        return wb

    @staticmethod
    async def list_transfer_orders(
        session: AsyncSession,
        status: Optional[str] = None,
    ) -> List[SapTransferOrder]:
        stmt = select(SapTransferOrder).order_by(desc(SapTransferOrder.created_at))
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapTransferOrder.status == status.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_transfer_order(
        session: AsyncSession, data: SapTransferOrderCreate
    ) -> SapTransferOrder:
        payload = data.model_dump()
        if not payload.get("transfer_number"):
            count = (await session.execute(select(func.count(SapTransferOrder.id)))).scalar() or 0
            payload["transfer_number"] = f"TO-2026-{count + 1:04d}"
        to = SapTransferOrder(**payload)
        session.add(to)
        await session.commit()
        await session.refresh(to)
        return to

    # -------------------------------------------------------------
    # 12. SAP ABAP - PROGRAMMING & SCRIPT WORKBENCH
    # -------------------------------------------------------------
    @staticmethod
    async def list_abap_scripts(
        session: AsyncSession,
        module: Optional[str] = None,
    ) -> List[SapAbapScript]:
        stmt = select(SapAbapScript).order_by(SapAbapScript.script_name)
        if module and module.upper() != "ALL":
            stmt = stmt.where(SapAbapScript.module == module.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_abap_script(
        session: AsyncSession, data: SapAbapScriptCreate
    ) -> SapAbapScript:
        script = SapAbapScript(**data.model_dump())
        session.add(script)
        await session.commit()
        await session.refresh(script)
        return script

    @staticmethod
    async def run_abap_script(
        session: AsyncSession,
        script_id: uuid.UUID,
        parameters: Optional[dict] = None,
    ) -> dict:
        script = await session.get(SapAbapScript, script_id)
        if not script:
            raise HTTPException(status_code=404, detail="ABAP Script not found")

        # Simulate execution
        now = datetime.now(timezone.utc)
        script.execution_count += 1
        script.last_run_at = now
        script.last_output = f"Executed at {now.isoformat()} successfully. Processed 42 records without syntax errors."
        await session.commit()

        return {
            "status": "SUCCESS",
            "execution_time_ms": 14.8,
            "output_log": f"[ABAP RUNTIME 7.50] Program {script.script_name} compiled & executed successfully.\n"
                          f"Memory consumed: 1.2MB\nReturn Code: SY-SUBRC = 0\n{script.last_output}",
            "result_dataset": [
                {"field": "STATUS", "value": "COMPLETED"},
                {"field": "RECORDS_TOUCHED", "value": "42"},
                {"field": "TIMESTAMP", "value": now.isoformat()},
            ],
        }

    # -------------------------------------------------------------
    # 13. TAX OPTION - TAX SLABS & TAX LEDGER MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_tax_rates(session: AsyncSession) -> List[SapTaxRate]:
        res = await session.execute(select(SapTaxRate).order_by(SapTaxRate.rate_percentage))
        return list(res.scalars().all())

    @staticmethod
    async def create_tax_rate(
        session: AsyncSession, data: SapTaxRateCreate
    ) -> SapTaxRate:
        rate = SapTaxRate(**data.model_dump())
        session.add(rate)
        await session.commit()
        await session.refresh(rate)
        return rate

    @staticmethod
    async def list_tax_ledgers(
        session: AsyncSession,
        entry_type: Optional[str] = None,
        source_module: Optional[str] = None,
        limit: int = 100,
    ) -> List[SapTaxLedger]:
        stmt = select(SapTaxLedger).order_by(desc(SapTaxLedger.posting_date)).limit(limit)
        if entry_type and entry_type.upper() != "ALL":
            stmt = stmt.where(SapTaxLedger.entry_type == entry_type.upper())
        if source_module and source_module.upper() != "ALL":
            stmt = stmt.where(SapTaxLedger.source_module == source_module.upper())
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_tax_ledger(
        session: AsyncSession, data: SapTaxLedgerCreate
    ) -> SapTaxLedger:
        now = datetime.now(timezone.utc)
        payload = data.model_dump()
        if not payload.get("transaction_number"):
            count = (await session.execute(select(func.count(SapTaxLedger.id)))).scalar() or 0
            payload["transaction_number"] = f"TAX-TX-{count + 1:05d}"
        if not payload.get("posting_date"):
            payload["posting_date"] = now
        ledger = SapTaxLedger(**payload)
        session.add(ledger)
        await session.commit()
        await session.refresh(ledger)
        return ledger

    @staticmethod
    async def get_tax_summary(session: AsyncSession) -> SapTaxSummaryOut:
        out_res = await session.execute(
            select(func.sum(SapTaxLedger.total_tax)).where(SapTaxLedger.entry_type == "OUTPUT_TAX")
        )
        total_output_tax = float(out_res.scalar() or 0.0)

        in_res = await session.execute(
            select(func.sum(SapTaxLedger.total_tax)).where(SapTaxLedger.entry_type == "INPUT_TAX_CREDIT")
        )
        total_input_credit = float(in_res.scalar() or 0.0)

        net_tax_payable = max(0.0, total_output_tax - total_input_credit)

        # Breakdowns
        rates_res = await session.execute(select(SapTaxRate))
        rates = rates_res.scalars().all()
        breakdown = {r.tax_code: r.rate_percentage for r in rates}

        return SapTaxSummaryOut(
            total_output_tax=total_output_tax,
            total_input_credit=total_input_credit,
            net_tax_payable=net_tax_payable,
            tax_breakdown_by_rate=breakdown,
        )

    # -------------------------------------------------------------
    # 14. CUSTOMERS & ENQUIRIES (SALES)
    # -------------------------------------------------------------
    @staticmethod
    async def list_customers(
        session: AsyncSession,
        search: Optional[str] = None,
        customer_group: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapCustomer], int]:
        stmt = select(SapCustomer)
        if customer_group and customer_group.upper() != "ALL":
            stmt = stmt.where(SapCustomer.customer_group == customer_group.upper())
        if is_active is not None:
            stmt = stmt.where(SapCustomer.is_active == is_active)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapCustomer.customer_code.ilike(s),
                    SapCustomer.company_name.ilike(s),
                    SapCustomer.contact_person.ilike(s),
                    SapCustomer.email.ilike(s),
                    SapCustomer.phone.ilike(s),
                    SapCustomer.gstin.ilike(s),
                    SapCustomer.city.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapCustomer.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_customer(session: AsyncSession, customer_id: uuid.UUID) -> Optional[SapCustomer]:
        return (await session.execute(select(SapCustomer).where(SapCustomer.id == customer_id))).scalar_one_or_none()

    @staticmethod
    async def create_customer(session: AsyncSession, customer_in: SapCustomerCreate) -> SapCustomer:
        payload = customer_in.model_dump()
        if not payload.get("customer_code"):
            payload["customer_code"] = f"CUST-{uuid.uuid4().hex[:6].upper()}"
        customer = SapCustomer(**payload)
        session.add(customer)
        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def update_customer(session: AsyncSession, customer_id: uuid.UUID, customer_in: SapCustomerUpdate) -> Optional[SapCustomer]:
        customer = await SapService.get_customer(session, customer_id)
        if not customer:
            return None
        for k, v in customer_in.model_dump(exclude_unset=True).items():
            setattr(customer, k, v)
        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def list_enquiries(
        session: AsyncSession,
        search: Optional[str] = None,
        enquiry_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapCustomerEnquiry], int]:
        stmt = select(SapCustomerEnquiry)
        if enquiry_status and enquiry_status.upper() != "ALL":
            stmt = stmt.where(SapCustomerEnquiry.status == enquiry_status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapCustomerEnquiry.enquiry_number.ilike(s),
                    SapCustomerEnquiry.customer_name.ilike(s),
                    SapCustomerEnquiry.contact_phone.ilike(s),
                    SapCustomerEnquiry.requirement_details.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapCustomerEnquiry.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_enquiry(session: AsyncSession, enquiry_in: SapCustomerEnquiryCreate) -> SapCustomerEnquiry:
        payload = enquiry_in.model_dump()
        if not payload.get("enquiry_number"):
            payload["enquiry_number"] = f"ENQ-{uuid.uuid4().hex[:6].upper()}"
        enquiry = SapCustomerEnquiry(**payload)
        session.add(enquiry)
        await session.commit()
        await session.refresh(enquiry)
        return enquiry

    @staticmethod
    async def update_enquiry(session: AsyncSession, enquiry_id: uuid.UUID, enquiry_in: SapCustomerEnquiryUpdate) -> Optional[SapCustomerEnquiry]:
        enquiry = (await session.execute(select(SapCustomerEnquiry).where(SapCustomerEnquiry.id == enquiry_id))).scalar_one_or_none()
        if not enquiry:
            return None
        for k, v in enquiry_in.model_dump(exclude_unset=True).items():
            setattr(enquiry, k, v)
        await session.commit()
        await session.refresh(enquiry)
        return enquiry

    # -------------------------------------------------------------
    # 15. INVOICES, OUTBOUND DELIVERIES & POS (SALES/BILLING)
    # -------------------------------------------------------------
    @staticmethod
    async def list_invoices(
        session: AsyncSession,
        search: Optional[str] = None,
        invoice_type: Optional[str] = None,
        invoice_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapInvoice], int]:
        stmt = select(SapInvoice)
        if invoice_type and invoice_type.upper() != "ALL":
            stmt = stmt.where(SapInvoice.invoice_type == invoice_type.upper())
        if invoice_status and invoice_status.upper() != "ALL":
            stmt = stmt.where(SapInvoice.status == invoice_status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapInvoice.invoice_number.ilike(s),
                    SapInvoice.customer_name.ilike(s),
                    SapInvoice.customer_gstin.ilike(s),
                    SapInvoice.source_reference.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapInvoice.billing_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_invoice(session: AsyncSession, invoice_id: uuid.UUID) -> Optional[SapInvoice]:
        return (await session.execute(select(SapInvoice).where(SapInvoice.id == invoice_id))).scalar_one_or_none()

    @staticmethod
    async def create_invoice(session: AsyncSession, invoice_in: SapInvoiceCreate) -> SapInvoice:
        payload = invoice_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("invoice_number"):
            payload["invoice_number"] = f"INV-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("billing_date"):
            payload["billing_date"] = now
        if not payload.get("due_date"):
            payload["due_date"] = now
        if payload.get("balance_due") is None:
            payload["balance_due"] = max(0.0, payload.get("total_amount", 0.0) - payload.get("paid_amount", 0.0))
        invoice = SapInvoice(**payload)
        session.add(invoice)

        if invoice.tax_amount > 0:
            tax_entry = SapTaxLedger(
                transaction_number=f"TX-{invoice.invoice_number}",
                source_module="SD",
                invoice_reference=invoice.invoice_number,
                taxable_amount=invoice.taxable_amount or invoice.subtotal,
                tax_rate_pct=18.0 if (invoice.taxable_amount or invoice.subtotal) > 0 else 0.0,
                cgst_amount=invoice.cgst_amount,
                sgst_amount=invoice.sgst_amount,
                igst_amount=invoice.igst_amount,
                total_tax=invoice.tax_amount,
                entry_type="OUTPUT_TAX",
                posting_date=now,
                party_name=invoice.customer_name,
                party_gstin=invoice.customer_gstin,
            )
            session.add(tax_entry)

        cust_res = await session.execute(select(SapCustomer).where(SapCustomer.company_name == invoice.customer_name))
        cust = cust_res.scalar_one_or_none()
        if cust:
            cust.outstanding_balance += invoice.balance_due

        await session.commit()
        await session.refresh(invoice)
        return invoice

    @staticmethod
    async def update_invoice(session: AsyncSession, invoice_id: uuid.UUID, invoice_in: SapInvoiceUpdate) -> Optional[SapInvoice]:
        invoice = await SapService.get_invoice(session, invoice_id)
        if not invoice:
            return None
        for k, v in invoice_in.model_dump(exclude_unset=True).items():
            setattr(invoice, k, v)
        invoice.balance_due = max(0.0, invoice.total_amount - invoice.paid_amount)
        if invoice.balance_due <= 0 and invoice.total_amount > 0:
            invoice.status = "PAID"
        elif invoice.paid_amount > 0:
            invoice.status = "PARTIALLY_PAID"
        await session.commit()
        await session.refresh(invoice)
        return invoice

    @staticmethod
    async def record_invoice_payment(session: AsyncSession, invoice_id: uuid.UUID, payment_in: SapInvoicePaymentRecord) -> Optional[SapInvoice]:
        invoice = await SapService.get_invoice(session, invoice_id)
        if not invoice:
            return None
        invoice.paid_amount += payment_in.amount_paid
        invoice.balance_due = max(0.0, invoice.total_amount - invoice.paid_amount)
        if invoice.balance_due <= 0:
            invoice.status = "PAID"
        else:
            invoice.status = "PARTIALLY_PAID"

        voucher = SapAccountingVoucher(
            voucher_number=f"RCT-{uuid.uuid4().hex[:6].upper()}",
            voucher_type="RECEIPT_VOUCHER",
            debit_ledger="100200 - HDFC Bank Account" if payment_in.payment_method != "CASH" else "100100 - Main Cash Ledger",
            credit_ledger="110100 - Trade Debtors",
            amount=payment_in.amount_paid,
            narration=payment_in.notes or f"Received payment against {invoice.invoice_number}",
            reference_number=invoice.invoice_number,
            status="POSTED"
        )
        session.add(voucher)

        cust_res = await session.execute(select(SapCustomer).where(SapCustomer.company_name == invoice.customer_name))
        cust = cust_res.scalar_one_or_none()
        if cust:
            cust.outstanding_balance = max(0.0, cust.outstanding_balance - payment_in.amount_paid)

        await session.commit()
        await session.refresh(invoice)
        return invoice

    @staticmethod
    async def list_deliveries(
        session: AsyncSession,
        search: Optional[str] = None,
        delivery_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapOutboundDelivery], int]:
        stmt = select(SapOutboundDelivery)
        if delivery_status and delivery_status.upper() != "ALL":
            stmt = stmt.where(SapOutboundDelivery.status == delivery_status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapOutboundDelivery.delivery_number.ilike(s),
                    SapOutboundDelivery.sales_order_number.ilike(s),
                    SapOutboundDelivery.customer_name.ilike(s),
                    SapOutboundDelivery.tracking_number.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapOutboundDelivery.shipping_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_delivery(session: AsyncSession, delivery_in: SapOutboundDeliveryCreate) -> SapOutboundDelivery:
        payload = delivery_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("delivery_number"):
            payload["delivery_number"] = f"GDN-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("shipping_date"):
            payload["shipping_date"] = now
        if not payload.get("estimated_delivery"):
            from datetime import timedelta
            payload["estimated_delivery"] = now + timedelta(days=2)
        delivery = SapOutboundDelivery(**payload)
        session.add(delivery)
        await session.commit()
        await session.refresh(delivery)
        return delivery

    @staticmethod
    async def update_delivery(session: AsyncSession, delivery_id: uuid.UUID, delivery_in: SapOutboundDeliveryUpdate) -> Optional[SapOutboundDelivery]:
        delivery = (await session.execute(select(SapOutboundDelivery).where(SapOutboundDelivery.id == delivery_id))).scalar_one_or_none()
        if not delivery:
            return None
        for k, v in delivery_in.model_dump(exclude_unset=True).items():
            setattr(delivery, k, v)
        await session.commit()
        await session.refresh(delivery)
        return delivery

    @staticmethod
    async def list_pos_sales(
        session: AsyncSession,
        search: Optional[str] = None,
        payment_mode: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapPosSale], int]:
        stmt = select(SapPosSale)
        if payment_mode and payment_mode.upper() != "ALL":
            stmt = stmt.where(SapPosSale.payment_mode == payment_mode.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapPosSale.bill_number.ilike(s),
                    SapPosSale.customer_name.ilike(s),
                    SapPosSale.customer_phone.ilike(s),
                    SapPosSale.cashier_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapPosSale.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_pos_sale(session: AsyncSession, pos_in: SapPosSaleCreate) -> SapPosSale:
        payload = pos_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("bill_number"):
            payload["bill_number"] = f"POS-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        pos = SapPosSale(**payload)
        session.add(pos)
        await session.commit()
        await session.refresh(pos)
        return pos

    # -------------------------------------------------------------
    # 16. VENDORS & PROCUREMENT (PURCHASE)
    # -------------------------------------------------------------
    @staticmethod
    async def list_vendors(
        session: AsyncSession,
        search: Optional[str] = None,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapVendor], int]:
        stmt = select(SapVendor)
        if category and category.upper() != "ALL":
            stmt = stmt.where(SapVendor.category == category.upper())
        if is_active is not None:
            stmt = stmt.where(SapVendor.is_active == is_active)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapVendor.vendor_code.ilike(s),
                    SapVendor.company_name.ilike(s),
                    SapVendor.contact_person.ilike(s),
                    SapVendor.gstin.ilike(s),
                    SapVendor.city.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapVendor.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_vendor(session: AsyncSession, vendor_id: uuid.UUID) -> Optional[SapVendor]:
        return (await session.execute(select(SapVendor).where(SapVendor.id == vendor_id))).scalar_one_or_none()

    @staticmethod
    async def create_vendor(session: AsyncSession, vendor_in: SapVendorCreate) -> SapVendor:
        payload = vendor_in.model_dump()
        if not payload.get("vendor_code"):
            payload["vendor_code"] = f"VEND-{uuid.uuid4().hex[:6].upper()}"
        vendor = SapVendor(**payload)
        session.add(vendor)
        await session.commit()
        await session.refresh(vendor)
        return vendor

    @staticmethod
    async def update_vendor(session: AsyncSession, vendor_id: uuid.UUID, vendor_in: SapVendorUpdate) -> Optional[SapVendor]:
        vendor = await SapService.get_vendor(session, vendor_id)
        if not vendor:
            return None
        for k, v in vendor_in.model_dump(exclude_unset=True).items():
            setattr(vendor, k, v)
        await session.commit()
        await session.refresh(vendor)
        return vendor

    @staticmethod
    async def list_purchase_orders(
        session: AsyncSession,
        search: Optional[str] = None,
        po_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapPurchaseOrder], int]:
        stmt = select(SapPurchaseOrder)
        if po_status and po_status.upper() != "ALL":
            stmt = stmt.where(SapPurchaseOrder.status == po_status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapPurchaseOrder.po_number.ilike(s),
                    SapPurchaseOrder.vendor_name.ilike(s),
                    SapPurchaseOrder.material_code.ilike(s),
                    SapPurchaseOrder.material_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapPurchaseOrder.order_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_purchase_order(session: AsyncSession, po_id: uuid.UUID) -> Optional[SapPurchaseOrder]:
        return (await session.execute(select(SapPurchaseOrder).where(SapPurchaseOrder.id == po_id))).scalar_one_or_none()

    @staticmethod
    async def create_purchase_order(session: AsyncSession, po_in: SapPurchaseOrderCreate) -> SapPurchaseOrder:
        payload = po_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("po_number"):
            payload["po_number"] = f"PO-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("order_date"):
            payload["order_date"] = now
        if not payload.get("expected_delivery_date"):
            from datetime import timedelta
            payload["expected_delivery_date"] = now + timedelta(days=7)
        po = SapPurchaseOrder(**payload)
        session.add(po)
        await session.commit()
        await session.refresh(po)
        return po

    @staticmethod
    async def update_purchase_order(session: AsyncSession, po_id: uuid.UUID, po_in: SapPurchaseOrderUpdate) -> Optional[SapPurchaseOrder]:
        po = await SapService.get_purchase_order(session, po_id)
        if not po:
            return None
        for k, v in po_in.model_dump(exclude_unset=True).items():
            setattr(po, k, v)
        await session.commit()
        await session.refresh(po)
        return po

    @staticmethod
    async def list_goods_receipts(
        session: AsyncSession,
        search: Optional[str] = None,
        po_reference: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapGoodsReceipt], int]:
        stmt = select(SapGoodsReceipt)
        if po_reference:
            stmt = stmt.where(SapGoodsReceipt.po_reference == po_reference)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapGoodsReceipt.grn_number.ilike(s),
                    SapGoodsReceipt.po_reference.ilike(s),
                    SapGoodsReceipt.vendor_name.ilike(s),
                    SapGoodsReceipt.material_code.ilike(s),
                    SapGoodsReceipt.material_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapGoodsReceipt.received_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_goods_receipt(session: AsyncSession, grn_in: SapGoodsReceiptCreate) -> SapGoodsReceipt:
        payload = grn_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("grn_number"):
            payload["grn_number"] = f"GRN-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("received_date"):
            payload["received_date"] = now
        grn = SapGoodsReceipt(**payload)
        session.add(grn)

        if grn.material_code:
            mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == grn.material_code))
            mat = mat_res.scalar_one_or_none()
            if mat:
                mat.current_stock += grn.quantity_accepted

        if grn.po_reference:
            po_res = await session.execute(select(SapPurchaseOrder).where(SapPurchaseOrder.po_number == grn.po_reference))
            po = po_res.scalar_one_or_none()
            if po:
                po.status = "RECEIVED"

        movement = SapStockMovement(
            document_number=f"MVT-{uuid.uuid4().hex[:6].upper()}",
            material_code=grn.material_code,
            material_name=grn.material_name,
            movement_type="101",
            quantity=grn.quantity_accepted,
            uom=grn.uom,
            storage_location=grn.storage_bin or "LOC-GENERAL",
            reference_order=grn.po_reference,
            notes=f"GRN received against PO {grn.po_reference}",
        )
        session.add(movement)

        await session.commit()
        await session.refresh(grn)
        return grn

    @staticmethod
    async def list_vendor_bills(
        session: AsyncSession,
        search: Optional[str] = None,
        bill_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapVendorBill], int]:
        stmt = select(SapVendorBill)
        if bill_status and bill_status.upper() != "ALL":
            stmt = stmt.where(SapVendorBill.status == bill_status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapVendorBill.bill_number.ilike(s),
                    SapVendorBill.vendor_bill_ref.ilike(s),
                    SapVendorBill.vendor_name.ilike(s),
                    SapVendorBill.po_reference.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapVendorBill.bill_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_vendor_bill(session: AsyncSession, bill_in: SapVendorBillCreate) -> SapVendorBill:
        payload = bill_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("bill_number"):
            payload["bill_number"] = f"BILL-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("bill_date"):
            payload["bill_date"] = now
        if not payload.get("due_date"):
            from datetime import timedelta
            payload["due_date"] = now + timedelta(days=30)
        if payload.get("balance_payable") is None:
            payload["balance_payable"] = max(0.0, payload.get("total_amount", 0.0) - payload.get("paid_amount", 0.0))
        bill = SapVendorBill(**payload)
        session.add(bill)

        if bill.tax_amount > 0:
            tax_entry = SapTaxLedger(
                transaction_number=f"TX-{bill.bill_number}",
                source_module="MM",
                invoice_reference=bill.vendor_bill_ref or bill.bill_number,
                taxable_amount=bill.subtotal,
                tax_rate_pct=18.0 if bill.subtotal > 0 else 0.0,
                cgst_amount=bill.tax_amount / 2,
                sgst_amount=bill.tax_amount / 2,
                igst_amount=0.0,
                total_tax=bill.tax_amount,
                entry_type="INPUT_TAX_CREDIT",
                posting_date=now,
                party_name=bill.vendor_name,
                party_gstin=bill.vendor_gstin,
            )
            session.add(tax_entry)

        vend_res = await session.execute(select(SapVendor).where(SapVendor.vendor_code == bill.vendor_code))
        vend = vend_res.scalar_one_or_none()
        if vend:
            vend.outstanding_payable += bill.balance_payable

        await session.commit()
        await session.refresh(bill)
        return bill

    @staticmethod
    async def update_vendor_bill(session: AsyncSession, bill_id: uuid.UUID, bill_in: SapVendorBillUpdate) -> Optional[SapVendorBill]:
        bill = (await session.execute(select(SapVendorBill).where(SapVendorBill.id == bill_id))).scalar_one_or_none()
        if not bill:
            return None
        for k, v in bill_in.model_dump(exclude_unset=True).items():
            setattr(bill, k, v)
        bill.balance_payable = max(0.0, bill.total_amount - bill.paid_amount)
        if bill.balance_payable <= 0:
            bill.status = "PAID"
        elif bill.paid_amount > 0:
            bill.status = "PARTIALLY_PAID"
        await session.commit()
        await session.refresh(bill)
        return bill

    @staticmethod
    async def list_debit_notes(
        session: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapDebitNote], int]:
        stmt = select(SapDebitNote)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapDebitNote.debit_note_number.ilike(s),
                    SapDebitNote.vendor_name.ilike(s),
                    SapDebitNote.original_bill_ref.ilike(s),
                    SapDebitNote.return_reason.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapDebitNote.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_debit_note(session: AsyncSession, note_in: SapDebitNoteCreate) -> SapDebitNote:
        payload = note_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("debit_note_number"):
            payload["debit_note_number"] = f"DN-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        note = SapDebitNote(**payload)
        session.add(note)

        vend_res = await session.execute(select(SapVendor).where(SapVendor.vendor_code == note.vendor_code))
        vend = vend_res.scalar_one_or_none()
        if vend:
            vend.outstanding_payable = max(0.0, vend.outstanding_payable - note.total_debit)

        await session.commit()
        await session.refresh(note)
        return note

    # -------------------------------------------------------------
    # 17. INVENTORY MANAGEMENT (TRANSFERS, MOVEMENTS, STOCK TAKING, DAMAGED, PRICE)
    # -------------------------------------------------------------
    @staticmethod
    async def list_stock_transfers(
        session: AsyncSession,
        search: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapStockTransfer], int]:
        stmt = select(SapStockTransfer)
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapStockTransfer.status == status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapStockTransfer.transfer_code.ilike(s),
                    SapStockTransfer.source_godown.ilike(s),
                    SapStockTransfer.destination_godown.ilike(s),
                    SapStockTransfer.material_code.ilike(s),
                    SapStockTransfer.material_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapStockTransfer.transfer_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_stock_transfer(session: AsyncSession, transfer_in: SapStockTransferCreate) -> SapStockTransfer:
        payload = transfer_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("transfer_code"):
            payload["transfer_code"] = f"TRF-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("transfer_date"):
            payload["transfer_date"] = now
        transfer = SapStockTransfer(**payload)
        session.add(transfer)

        mvt = SapStockMovement(
            document_number=f"MVT-{uuid.uuid4().hex[:6].upper()}",
            material_code=transfer.material_code,
            material_name=transfer.material_name,
            movement_type="311",
            quantity=transfer.quantity,
            uom=transfer.uom,
            storage_location=transfer.destination_godown,
            reference_order=transfer.transfer_code,
            notes=f"Transfer from {transfer.source_godown} to {transfer.destination_godown}",
        )
        session.add(mvt)

        await session.commit()
        await session.refresh(transfer)
        return transfer

    @staticmethod
    async def list_stock_movements(
        session: AsyncSession,
        search: Optional[str] = None,
        movement_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapStockMovement], int]:
        stmt = select(SapStockMovement)
        if movement_type and movement_type.upper() != "ALL":
            stmt = stmt.where(SapStockMovement.movement_type == movement_type)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapStockMovement.document_number.ilike(s),
                    SapStockMovement.material_code.ilike(s),
                    SapStockMovement.material_name.ilike(s),
                    SapStockMovement.movement_type.ilike(s),
                    SapStockMovement.reference_order.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapStockMovement.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_stock_movement(session: AsyncSession, movement_in: SapStockMovementCreate) -> SapStockMovement:
        payload = movement_in.model_dump()
        if not payload.get("document_number"):
            payload["document_number"] = f"MVT-{uuid.uuid4().hex[:6].upper()}"
        mvt = SapStockMovement(**payload)
        session.add(mvt)

        mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == mvt.material_code))
        mat = mat_res.scalar_one_or_none()
        if mat:
            if mvt.movement_type in ["101", "561", "501"]:
                mat.current_stock += mvt.quantity
            elif mvt.movement_type in ["201", "261", "551"]:
                mat.current_stock = max(0.0, mat.current_stock - mvt.quantity)

        await session.commit()
        await session.refresh(mvt)
        return mvt

    @staticmethod
    async def list_stock_takings(
        session: AsyncSession,
        search: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapStockTaking], int]:
        stmt = select(SapStockTaking)
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapStockTaking.reconciled_status == status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapStockTaking.count_cycle_code.ilike(s),
                    SapStockTaking.storage_location.ilike(s),
                    SapStockTaking.material_code.ilike(s),
                    SapStockTaking.material_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapStockTaking.count_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_stock_taking(session: AsyncSession, taking_in: SapStockTakingCreate) -> SapStockTaking:
        payload = taking_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("count_cycle_code"):
            payload["count_cycle_code"] = f"STK-{now.strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        payload["variance_quantity"] = payload.get("physical_counted_quantity", 0.0) - payload.get("system_book_quantity", 0.0)
        payload["variance_value"] = payload.get("variance_quantity", 0.0) * 100.0
        taking = SapStockTaking(**payload)
        session.add(taking)
        await session.commit()
        await session.refresh(taking)
        return taking

    @staticmethod
    async def list_damaged_items(
        session: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapDamagedItem], int]:
        stmt = select(SapDamagedItem)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapDamagedItem.incident_number.ilike(s),
                    SapDamagedItem.material_code.ilike(s),
                    SapDamagedItem.material_name.ilike(s),
                    SapDamagedItem.damage_reason.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapDamagedItem.created_at)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_damaged_item(session: AsyncSession, item_in: SapDamagedItemCreate) -> SapDamagedItem:
        payload = item_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("incident_number"):
            payload["incident_number"] = f"DMG-{now.strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
        item = SapDamagedItem(**payload)
        session.add(item)

        mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == item.material_code))
        mat = mat_res.scalar_one_or_none()
        if mat:
            mat.current_stock = max(0.0, mat.current_stock - item.damaged_quantity)

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def list_price_changes(
        session: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapPriceChange], int]:
        stmt = select(SapPriceChange)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapPriceChange.change_number.ilike(s),
                    SapPriceChange.material_code.ilike(s),
                    SapPriceChange.material_name.ilike(s),
                    SapPriceChange.reason.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapPriceChange.effective_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_price_change(session: AsyncSession, change_in: SapPriceChangeCreate) -> SapPriceChange:
        payload = change_in.model_dump()
        if not payload.get("change_number"):
            payload["change_number"] = f"PRC-{uuid.uuid4().hex[:6].upper()}"
        change = SapPriceChange(**payload)
        session.add(change)

        mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == change.material_code))
        mat = mat_res.scalar_one_or_none()
        if mat:
            change.old_selling_price = mat.unit_price
            mat.unit_price = change.new_selling_price

        await session.commit()
        await session.refresh(change)
        return change

    # -------------------------------------------------------------
    # 18. FINANCE & ACCOUNTING (VOUCHERS, BRS, TRIAL BALANCE, P&L, BALANCE SHEET)
    # -------------------------------------------------------------
    @staticmethod
    async def list_accounting_vouchers(
        session: AsyncSession,
        voucher_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapAccountingVoucher], int]:
        stmt = select(SapAccountingVoucher)
        if voucher_type and voucher_type.upper() != "ALL":
            stmt = stmt.where(SapAccountingVoucher.voucher_type == voucher_type.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapAccountingVoucher.voucher_number.ilike(s),
                    SapAccountingVoucher.reference_number.ilike(s),
                    SapAccountingVoucher.debit_ledger.ilike(s),
                    SapAccountingVoucher.credit_ledger.ilike(s),
                    SapAccountingVoucher.narration.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapAccountingVoucher.voucher_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_accounting_voucher(session: AsyncSession, voucher_in: SapAccountingVoucherCreate) -> SapAccountingVoucher:
        payload = voucher_in.model_dump()
        now = datetime.now(timezone.utc)
        prefix = payload.get("voucher_type", "JRN")[:3].upper()
        if not payload.get("voucher_number"):
            payload["voucher_number"] = f"{prefix}-{now.year}-{uuid.uuid4().hex[:5].upper()}"
        if not payload.get("voucher_date"):
            payload["voucher_date"] = now
        voucher = SapAccountingVoucher(**payload)
        session.add(voucher)
        await session.commit()
        await session.refresh(voucher)
        return voucher

    @staticmethod
    async def list_bank_reconciliations(
        session: AsyncSession,
        bank_account: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapBankReconciliation], int]:
        stmt = select(SapBankReconciliation)
        if bank_account:
            stmt = stmt.where(SapBankReconciliation.bank_account_ledger == bank_account)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapBankReconciliation.statement_number.ilike(s),
                    SapBankReconciliation.bank_account_ledger.ilike(s),
                    SapBankReconciliation.status.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapBankReconciliation.period_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_bank_reconciliation(session: AsyncSession, brs_in: SapBankReconciliationCreate) -> SapBankReconciliation:
        payload = brs_in.model_dump()
        now = datetime.now(timezone.utc)
        if not payload.get("statement_number"):
            payload["statement_number"] = f"BRS-{now.strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
        payload["reconciled_difference"] = payload.get("balance_as_per_bank_statement", 0.0) - payload.get("balance_as_per_company_books", 0.0)
        if abs(payload["reconciled_difference"]) < 0.01:
            payload["status"] = "RECONCILED"
        brs = SapBankReconciliation(**payload)
        session.add(brs)
        await session.commit()
        await session.refresh(brs)
        return brs

    @staticmethod
    async def get_trial_balance_report(session: AsyncSession) -> SapTrialBalanceReport:
        res = await session.execute(select(SapGlAccount))
        accounts = res.scalars().all()
        items = []
        tot_debit = 0.0
        tot_credit = 0.0
        for acc in accounts:
            debit = acc.balance if acc.account_type in ["ASSET", "EXPENSE"] else 0.0
            credit = acc.balance if acc.account_type in ["LIABILITY", "EQUITY", "REVENUE"] else 0.0
            tot_debit += debit
            tot_credit += credit
            items.append({
                "account_number": acc.account_number,
                "account_name": acc.account_name,
                "account_type": acc.account_type,
                "debit_balance": debit,
                "credit_balance": credit,
            })
        return SapTrialBalanceReport(
            items=items,
            total_debits=tot_debit,
            total_credits=tot_credit,
            is_balanced=abs(tot_debit - tot_credit) < 1.0,
        )

    @staticmethod
    async def get_profit_loss_report(session: AsyncSession) -> SapProfitLossReport:
        res = await session.execute(select(SapGlAccount))
        accounts = res.scalars().all()
        sales_rev = 0.0
        srv_rev = 0.0
        rnt_rev = 0.0
        cogs = 0.0
        op_exp = 0.0
        depr = 0.0
        for a in accounts:
            if a.account_number.startswith("4001"):
                rnt_rev += a.balance
            elif a.account_number.startswith("4002"):
                srv_rev += a.balance
            elif a.account_type == "REVENUE":
                sales_rev += a.balance
            elif a.account_type == "EXPENSE":
                if "Spares" in a.account_name:
                    cogs += a.balance
                elif "Depreciation" in a.account_name:
                    depr += a.balance
                else:
                    op_exp += a.balance
        tot_revenue = sales_rev + srv_rev + rnt_rev
        gross_profit = tot_revenue - cogs
        net_profit = gross_profit - op_exp - depr
        return SapProfitLossReport(
            total_revenue=tot_revenue,
            sales_revenue=sales_rev,
            service_revenue=srv_rev,
            rental_revenue=rnt_rev,
            cost_of_goods_sold=cogs,
            gross_profit=gross_profit,
            operating_expenses=op_exp,
            depreciation=depr,
            net_profit=net_profit,
        )

    @staticmethod
    async def get_balance_sheet_report(session: AsyncSession) -> SapBalanceSheetReport:
        res = await session.execute(select(SapGlAccount))
        accounts = res.scalars().all()
        curr_assets = 0.0
        fixed_assets = 0.0
        curr_liab = 0.0
        long_liab = 0.0
        eq = 0.0
        for a in accounts:
            if a.account_type == "ASSET":
                if a.account_number.startswith("100") or a.account_number.startswith("110") or a.account_number.startswith("120"):
                    curr_assets += a.balance
                else:
                    fixed_assets += a.balance
            elif a.account_type == "LIABILITY":
                if a.account_number.startswith("200") or a.account_number.startswith("210"):
                    curr_liab += a.balance
                else:
                    long_liab += a.balance
            elif a.account_type == "EQUITY":
                eq += a.balance

        pl = await SapService.get_profit_loss_report(session)
        equity_total = eq + pl.net_profit
        total_assets = curr_assets + fixed_assets
        total_liabilities = curr_liab + long_liab
        return SapBalanceSheetReport(
            current_assets=curr_assets,
            fixed_assets=fixed_assets,
            total_assets=total_assets,
            current_liabilities=curr_liab,
            long_term_liabilities=long_liab,
            total_liabilities=total_liabilities,
            equity_retained_earnings=equity_total,
            total_liabilities_and_equity=total_liabilities + equity_total,
        )

    @staticmethod
    async def get_receivables_ageing_report(session: AsyncSession) -> SapReceivablesAgeingReport:
        res = await session.execute(select(SapInvoice).where(SapInvoice.balance_due > 0))
        invoices = res.scalars().all()
        now = datetime.now(timezone.utc)
        buckets_map = {}
        for inv in invoices:
            dt = inv.billing_date.replace(tzinfo=timezone.utc) if inv.billing_date.tzinfo is None else inv.billing_date
            age = (now - dt).days
            name = inv.customer_name
            if name not in buckets_map:
                buckets_map[name] = {
                    "customer_code": f"CUST-{uuid.uuid4().hex[:4].upper()}",
                    "customer_name": name,
                    "total_outstanding": 0.0,
                    "current_0_30_days": 0.0,
                    "bucket_31_60_days": 0.0,
                    "bucket_61_90_days": 0.0,
                    "bucket_90_plus_days": 0.0,
                }
            due = inv.balance_due
            buckets_map[name]["total_outstanding"] += due
            if age <= 30:
                buckets_map[name]["current_0_30_days"] += due
            elif age <= 60:
                buckets_map[name]["bucket_31_60_days"] += due
            elif age <= 90:
                buckets_map[name]["bucket_61_90_days"] += due
            else:
                buckets_map[name]["bucket_90_plus_days"] += due

        buckets = list(buckets_map.values())
        grand_total = sum(b["total_outstanding"] for b in buckets)
        t0 = sum(b["current_0_30_days"] for b in buckets)
        t31 = sum(b["bucket_31_60_days"] for b in buckets)
        t61 = sum(b["bucket_61_90_days"] for b in buckets)
        t90 = sum(b["bucket_90_plus_days"] for b in buckets)

        return SapReceivablesAgeingReport(
            buckets=buckets,
            grand_total_outstanding=grand_total,
            total_0_30=t0,
            total_31_60=t31,
            total_61_90=t61,
            total_90_plus=t90,
        )

    @staticmethod
    async def get_sales_register_report(session: AsyncSession) -> SapSalesRegisterReport:
        res = await session.execute(select(SapInvoice).order_by(desc(SapInvoice.billing_date)))
        invoices = res.scalars().all()
        entries = []
        tot_taxable = 0.0
        tot_cgst = 0.0
        tot_sgst = 0.0
        tot_igst = 0.0
        tot_sales = 0.0
        for inv in invoices:
            tot_taxable += inv.taxable_amount or inv.subtotal
            tot_cgst += inv.cgst_amount
            tot_sgst += inv.sgst_amount
            tot_igst += inv.igst_amount
            tot_sales += inv.total_amount
            entries.append({
                "invoice_number": inv.invoice_number,
                "date": inv.billing_date,
                "customer_name": inv.customer_name,
                "customer_gstin": inv.customer_gstin,
                "taxable_amount": inv.taxable_amount or inv.subtotal,
                "cgst": inv.cgst_amount,
                "sgst": inv.sgst_amount,
                "igst": inv.igst_amount,
                "total_amount": inv.total_amount,
                "status": inv.status,
            })
        return SapSalesRegisterReport(
            entries=entries,
            total_taxable=tot_taxable,
            total_cgst=tot_cgst,
            total_sgst=tot_sgst,
            total_igst=tot_igst,
            total_sales=tot_sales,
        )

    # -------------------------------------------------------------
    # 19. ADMINISTRATION & FORMATS & DATA MIGRATION
    # -------------------------------------------------------------
    @staticmethod
    async def list_voucher_formats(session: AsyncSession) -> List[SapVoucherFormat]:
        res = await session.execute(select(SapVoucherFormat))
        return list(res.scalars().all())

    @staticmethod
    async def create_voucher_format(session: AsyncSession, fmt_in: SapVoucherFormatCreate) -> SapVoucherFormat:
        payload = fmt_in.model_dump()
        fmt = SapVoucherFormat(**payload)
        session.add(fmt)
        await session.commit()
        await session.refresh(fmt)
        return fmt

    @staticmethod
    async def list_data_migrations(session: AsyncSession) -> List[SapDataMigration]:
        res = await session.execute(select(SapDataMigration).order_by(desc(SapDataMigration.created_at)))
        return list(res.scalars().all())

    @staticmethod
    async def create_data_migration(session: AsyncSession, mig_in: SapDataMigrationCreate) -> SapDataMigration:
        payload = mig_in.model_dump()
        if not payload.get("batch_code"):
            payload["batch_code"] = f"MIG-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        mig = SapDataMigration(**payload)
        session.add(mig)
        await session.commit()
        await session.refresh(mig)
        return mig
    # -------------------------------------------------------------
    # 14. SEED SAP DEFAULTS FOR ALL MODULES (FI, CO, MM, SD, HCM, PP, WM, ABAP, TAX)
    # -------------------------------------------------------------
    @staticmethod
    async def ensure_sap_core_defaults(session: AsyncSession) -> None:
        from datetime import timedelta
        now = datetime.now(timezone.utc)

        # 1. Tax Slabs
        existing_tax = (await session.execute(select(SapTaxRate))).scalars().first()
        if not existing_tax:
            tax_slabs = [
                SapTaxRate(tax_code="GST_0", tax_name="GST Exempted (0%)", tax_type="GST", rate_percentage=0.0, cgst_rate=0.0, sgst_rate=0.0, igst_rate=0.0, description="Essential food grains, healthcare, unbranded farm goods"),
                SapTaxRate(tax_code="GST_5", tax_name="GST Essential (5%)", tax_type="GST", rate_percentage=5.0, cgst_rate=2.5, sgst_rate=2.5, igst_rate=5.0, description="Freight logistics, essential machinery lubricants"),
                SapTaxRate(tax_code="GST_12", tax_name="GST Standard Low (12%)", tax_type="GST", rate_percentage=12.0, cgst_rate=6.0, sgst_rate=6.0, igst_rate=12.0, description="Work contracts, mechanical pumps, engineering fittings"),
                SapTaxRate(tax_code="GST_18", tax_name="GST Standard Standard (18%)", tax_type="GST", rate_percentage=18.0, cgst_rate=9.0, sgst_rate=9.0, igst_rate=18.0, description="Industrial equipment rental, workshop diagnostic repairs, hardware"),
                SapTaxRate(tax_code="GST_28", tax_name="GST Luxury / Heavy (28%)", tax_type="GST", rate_percentage=28.0, cgst_rate=14.0, sgst_rate=14.0, igst_rate=28.0, description="Heavy diesel generators, automotive parts, air compressors"),
                SapTaxRate(tax_code="TDS_194C", tax_name="TDS Contractor Sec 194C (2%)", tax_type="TDS", rate_percentage=2.0, cgst_rate=0.0, sgst_rate=0.0, igst_rate=0.0, description="TDS deduction on maintenance & contractor payouts"),
            ]
            session.add_all(tax_slabs)

        # 2. GL Accounts (FI)
        existing_gl = (await session.execute(select(SapGlAccount))).scalars().first()
        if not existing_gl:
            gl_accounts = [
                SapGlAccount(account_number="100100", account_name="Main Operating Cash Ledger", account_type="ASSET", balance=145000.0),
                SapGlAccount(account_number="100200", account_name="HDFC Commercial Current Account", account_type="ASSET", balance=890000.0),
                SapGlAccount(account_number="110100", account_name="Trade Debtors (Accounts Receivable)", account_type="ASSET", balance=340000.0),
                SapGlAccount(account_number="200100", account_name="Trade Creditors (Accounts Payable)", account_type="LIABILITY", balance=185000.0),
                SapGlAccount(account_number="210100", account_name="GST Output Tax Payable (Liability)", account_type="LIABILITY", balance=54000.0),
                SapGlAccount(account_number="120100", account_name="GST Input Tax Credit (Asset)", account_type="ASSET", balance=32000.0),
                SapGlAccount(account_number="300100", account_name="Retained Corporate Earnings", account_type="EQUITY", balance=500000.0),
                SapGlAccount(account_number="400100", account_name="Equipment Rental Revenue", account_type="REVENUE", balance=420000.0),
                SapGlAccount(account_number="400200", account_name="Product Service & Repairs Revenue", account_type="REVENUE", balance=215000.0),
                SapGlAccount(account_number="500100", account_name="Workshop Spares & Consumables Expense", account_type="EXPENSE", balance=112000.0),
            ]
            session.add_all(gl_accounts)

        # 3. Cost Centers & Profit Centers (CO)
        existing_cc = (await session.execute(select(SapCostCenter))).scalars().first()
        if not existing_cc:
            cost_centers = [
                SapCostCenter(center_code="CC-WKP-101", name="Workshop Mechanical & Diagnostics", manager_name="Praveen Nair", department="Operations", budget_amount=250000.0, actual_spent=142000.0),
                SapCostCenter(center_code="CC-FLT-102", name="Equipment Fleet Maintenance & Logistics", manager_name="Ramesh Babu", department="Logistics", budget_amount=300000.0, actual_spent=189000.0),
                SapCostCenter(center_code="CC-ADM-103", name="Central Administration & IT", manager_name="Deepa George", department="Administration", budget_amount=150000.0, actual_spent=85000.0),
            ]
            session.add_all(cost_centers)

        existing_pc = (await session.execute(select(SapProfitCenter))).scalars().first()
        if not existing_pc:
            profit_centers = [
                SapProfitCenter(center_code="PC-RNT-201", name="Commercial Equipment Rental Division", head_name="Vikram Singh", target_revenue=800000.0, actual_revenue=540000.0),
                SapProfitCenter(center_code="PC-SRV-202", name="Heavy Machinery Servicing & Repairs", head_name="Mathew Thomas", target_revenue=500000.0, actual_revenue=320000.0),
                SapProfitCenter(center_code="PC-WHL-203", name="Wholesale Spares & Supply", head_name="Arjun Varma", target_revenue=400000.0, actual_revenue=280000.0),
            ]
            session.add_all(profit_centers)

        # 4. Materials Master (MM)
        existing_mat = (await session.execute(select(SapMaterialMaster))).scalars().first()
        if not existing_mat:
            materials = [
                SapMaterialMaster(material_code="MAT-RAW-001", name="Hydraulic Fluid Grade ISO 68", material_type="RAW_MATERIAL", base_uom="LTR", current_stock=240.0, safety_stock=50.0, unit_price=220.0, storage_location="LOC-FLUIDS-01", hsn_code="271019", tax_rate=18.0),
                SapMaterialMaster(material_code="MAT-SPR-002", name="Diesel Fuel Injector Nozzle Assembly", material_type="SPARE_PART", base_uom="PCS", current_stock=18.0, safety_stock=5.0, unit_price=4500.0, storage_location="LOC-SPARES-B2", hsn_code="840999", tax_rate=18.0),
                SapMaterialMaster(material_code="MAT-SPR-003", name="Heavy Duty V-Belt 5PK1220", material_type="SPARE_PART", base_uom="PCS", current_stock=35.0, safety_stock=10.0, unit_price=850.0, storage_location="LOC-SPARES-A1", hsn_code="401031", tax_rate=18.0),
                SapMaterialMaster(material_code="MAT-FNG-004", name="Silent Diesel Generator Set 15kVA", material_type="FINISHED_GOOD", base_uom="SET", current_stock=4.0, safety_stock=2.0, unit_price=175000.0, storage_location="LOC-YARD-G1", hsn_code="850211", tax_rate=18.0),
            ]
            session.add_all(materials)

        # 5. HCM Employees (HCM)
        existing_emp = (await session.execute(select(SapHcmEmployee))).scalars().first()
        if not existing_emp:
            employees = [
                SapHcmEmployee(personnel_number="EMP-SAP-001", full_name="Sanjay Krishnan", designation="Senior Service Specialist", department="Workshop Operations", employment_type="PERMANENT", basic_salary=45000.0, hra=18000.0, special_allowance=9000.0, tax_deduction_tds=4200.0, net_salary=67800.0, joining_date=now - timedelta(days=500)),
                SapHcmEmployee(personnel_number="EMP-SAP-002", full_name="Kavitha Menon", designation="Finance & Accounts Lead", department="Finance", employment_type="PERMANENT", basic_salary=52000.0, hra=20800.0, special_allowance=10200.0, tax_deduction_tds=6100.0, net_salary=76900.0, joining_date=now - timedelta(days=820)),
                SapHcmEmployee(personnel_number="EMP-SAP-003", full_name="Harish Patel", designation="Warehouse Logistics Officer", department="Supply Chain", employment_type="PERMANENT", basic_salary=32000.0, hra=12800.0, special_allowance=6400.0, tax_deduction_tds=2100.0, net_salary=49100.0, joining_date=now - timedelta(days=310)),
            ]
            session.add_all(employees)

        # 6. Production Orders (PP)
        existing_po = (await session.execute(select(SapProductionOrder))).scalars().first()
        if not existing_po:
            production_orders = [
                SapProductionOrder(order_number="PROD-2026-0001", product_name="Silent Diesel Generator Set 15kVA", planned_quantity=2.0, produced_quantity=1.0, uom="SET", work_center="WC-ELECTROMECH-01", start_date=now - timedelta(days=2), end_date=now + timedelta(days=5), status="IN_PROCESS", priority="HIGH"),
                SapProductionOrder(order_number="PROD-2026-0002", product_name="Mobile Water Pump Engine Mount 10HP", planned_quantity=5.0, produced_quantity=0.0, uom="UNITS", work_center="WC-ASSEMBLY-02", start_date=now, end_date=now + timedelta(days=4), status="RELEASED", priority="MEDIUM"),
            ]
            session.add_all(production_orders)

        # 7. Warehouse Bins (WM)
        existing_bins = (await session.execute(select(SapWarehouseBin))).scalars().first()
        if not existing_bins:
            bins = [
                SapWarehouseBin(bin_code="BIN-A-01-01", warehouse_zone="ZONE-HEAVY", storage_type="RACK", max_weight_capacity_kg=1500.0, current_weight_kg=650.0, current_material_code="MAT-SPR-002", current_material_name="Diesel Fuel Injectors", current_stock_qty=18.0, status="OCCUPIED"),
                SapWarehouseBin(bin_code="BIN-A-01-02", warehouse_zone="ZONE-HEAVY", storage_type="RACK", max_weight_capacity_kg=1500.0, current_weight_kg=0.0, status="EMPTY"),
                SapWarehouseBin(bin_code="BIN-B-02-01", warehouse_zone="ZONE-FLUIDS", storage_type="SHELF", max_weight_capacity_kg=800.0, current_weight_kg=240.0, current_material_code="MAT-RAW-001", current_material_name="Hydraulic Fluid ISO 68", current_stock_qty=240.0, status="OCCUPIED"),
                SapWarehouseBin(bin_code="BIN-C-03-01", warehouse_zone="ZONE-ELECTRICAL", storage_type="SHELF", max_weight_capacity_kg=500.0, current_weight_kg=45.0, current_material_code="MAT-SPR-003", current_material_name="Heavy Duty V-Belts", current_stock_qty=35.0, status="OCCUPIED"),
            ]
            session.add_all(bins)

        # 8. ABAP Scripts (ABAP)
        existing_abap = (await session.execute(select(SapAbapScript))).scalars().first()
        if not existing_abap:
            scripts = [
                SapAbapScript(
                    script_name="Z_TAX_CALC_REPORT",
                    title="GSTR-1 Monthly Tax Ledger & HSN Summary",
                    module="TAX",
                    code='REPORT Z_TAX_CALC_REPORT.\nTABLES: SAP_TAX_LEDGERS, SAP_TAX_RATES.\nSELECT * FROM SAP_TAX_LEDGERS INTO TABLE @DATA(LT_TAX).\nWRITE: / "Total Output Tax Liability Computed: OK".\nLOOP AT LT_TAX INTO DATA(LS_ROW).\n  WRITE: / LS_ROW-TRANSACTION_NUMBER, LS_ROW-TAXABLE_AMOUNT, LS_ROW-TOTAL_TAX.\nENDLOOP.',
                    author="SAP_CONSULTANT",
                    version="1.2.0",
                    execution_count=12,
                    last_run_at=now - timedelta(hours=2),
                    last_output="Output GSTR-1 dataset validated. Total records evaluated: 14. Net Payable reconciles with GL.",
                ),
                SapAbapScript(
                    script_name="Z_MATERIAL_VALUATION_SYNC",
                    title="Material Moving Average Price & Stock Revaluation",
                    module="MM",
                    code='REPORT Z_MATERIAL_VALUATION_SYNC.\nTABLES: SAP_MATERIAL_MASTERS.\nSELECT * FROM SAP_MATERIAL_MASTERS INTO TABLE @DATA(LT_MAT).\nWRITE: / "Evaluating stock valuation classes...".\nWRITE: / "All materials within safety buffer. Zero variance detected".',
                    author="SAP_ABAP_DEV",
                    version="1.0.1",
                    execution_count=8,
                    last_run_at=now - timedelta(hours=5),
                    last_output="Valuation class VAL-STD checked across all SKUs. Zero variance found.",
                ),
            ]
            session.add_all(scripts)

        # 9. Initial Tax Ledger Entries
        existing_tx = (await session.execute(select(SapTaxLedger))).scalars().first()
        if not existing_tx:
            tax_ledgers = [
                SapTaxLedger(transaction_number="TAX-TX-00001", source_module="SD", invoice_reference="INV-2026-0012", hsn_sac_code="9987", taxable_amount=120000.0, tax_rate_pct=18.0, cgst_amount=10800.0, sgst_amount=10800.0, igst_amount=0.0, total_tax=21600.0, entry_type="OUTPUT_TAX", posting_date=now - timedelta(days=2), party_name="Horizon Engineering Works", party_gstin="32AABCH1234F1Z5"),
                SapTaxLedger(transaction_number="TAX-TX-00002", source_module="RENTAL", invoice_reference="RNT-2026-0008", hsn_sac_code="9973", taxable_amount=45000.0, tax_rate_pct=18.0, cgst_amount=4050.0, sgst_amount=4050.0, igst_amount=0.0, total_tax=8100.0, entry_type="OUTPUT_TAX", posting_date=now - timedelta(days=3), party_name="Apex Power Utilities", party_gstin="32AAACA5678G2Z1"),
                SapTaxLedger(transaction_number="TAX-TX-00003", source_module="MM", invoice_reference="PO-BILL-0091", hsn_sac_code="2710", taxable_amount=52800.0, tax_rate_pct=18.0, cgst_amount=4752.0, sgst_amount=4752.0, igst_amount=0.0, total_tax=9504.0, entry_type="INPUT_TAX_CREDIT", posting_date=now - timedelta(days=4), party_name="PetroLube Industrial Supply Co", party_gstin="32AABCP9900H1Z8"),
            ]
            session.add_all(tax_ledgers)


        # 10. Default Customers (Sales)
        existing_cust = (await session.execute(select(SapCustomer))).scalars().first()
        if not existing_cust:
            customers = [
                SapCustomer(customer_code="CUST-10001", company_name="Apex Power & Infrastructure Ltd", contact_person="Rajesh Kumar", email="rajesh@apexinfra.com", phone="+91 98765 43210", gstin="32AAACA5678G2Z1", pan="AAACA5678G", billing_address="Plot 45, Industrial Zone", shipping_address="Plot 45, Industrial Zone", city="Kochi", state="Kerala", credit_limit=500000.0, outstanding_balance=124000.0, payment_terms="NET_30", customer_group="CORPORATE"),
                SapCustomer(customer_code="CUST-10002", company_name="Horizon Construction Works", contact_person="Mathew Philip", email="mathew@horizonworks.in", phone="+91 98471 22334", gstin="32AABCH1234F1Z5", pan="AABCH1234F", billing_address="12/34 River Road", shipping_address="12/34 River Road", city="Calicut", state="Kerala", credit_limit=300000.0, outstanding_balance=45000.0, payment_terms="NET_30", customer_group="COMMERCIAL"),
                SapCustomer(customer_code="CUST-10003", company_name="Southern Logistics & Freight", contact_person="Deepak Nair", email="logistics@southernfreight.com", phone="+91 94470 99887", gstin="32AADCS9988K1Z3", pan="AADCS9988K", billing_address="Cargo Terminal 4", shipping_address="Cargo Terminal 4", city="Kochi", state="Kerala", credit_limit=200000.0, outstanding_balance=0.0, payment_terms="NET_15", customer_group="CORPORATE"),
            ]
            session.add_all(customers)

        # 11. Default Vendors (Purchase)
        existing_vend = (await session.execute(select(SapVendor))).scalars().first()
        if not existing_vend:
            vendors = [
                SapVendor(vendor_code="VEND-20001", company_name="PetroLube Industrial Supply Co", contact_person="Anand Sharma", email="sales@petrolube.com", phone="+91 98112 33445", gstin="32AABCP9900H1Z8", pan="AABCP9900H", address="Chemical Park, Sector 8", city="Kochi", state="Kerala", category="RAW_MATERIALS", payment_terms="NET_30", outstanding_payable=52800.0, rating=4.8),
                SapVendor(vendor_code="VEND-20002", company_name="Metro Diesel & Machinery Spares", contact_person="Sunil Varma", email="sunil@metrodiesel.in", phone="+91 98220 55667", gstin="32AABCM4433E1Z9", pan="AABCM4433E", address="Autonagar 1st Cross", city="Ernakulam", state="Kerala", category="SPARE_PARTS", payment_terms="NET_45", outstanding_payable=89000.0, rating=4.6),
                SapVendor(vendor_code="VEND-20003", company_name="Bosch Heavy Hydraulics India", contact_person="Kiran Reddy", email="support@boschheavy.com", phone="+91 98330 77889", gstin="29AABCB1122D1Z0", pan="AABCB1122D", address="Peenya Industrial Area", city="Bangalore", state="Karnataka", category="EQUIPMENT", payment_terms="IMMEDIATE", outstanding_payable=0.0, rating=4.9),
            ]
            session.add_all(vendors)

        # 12. Default Invoices (Sales & Billing)
        existing_inv = (await session.execute(select(SapInvoice))).scalars().first()
        if not existing_inv:
            invoices = [
                SapInvoice(invoice_number="INV-2026-0001", invoice_type="CUSTOMER_INVOICE", customer_name="Apex Power & Infrastructure Ltd", customer_phone="+91 98765 43210", customer_gstin="32AAACA5678G2Z1", billing_date=now - timedelta(days=20), due_date=now + timedelta(days=10), subtotal=120000.0, taxable_amount=120000.0, tax_amount=21600.0, cgst_amount=10800.0, sgst_amount=10800.0, igst_amount=0.0, total_amount=141600.0, paid_amount=141600.0, balance_due=0.0, status="PAID", items_summary="Silent Diesel Generator Set 15kVA (1 UNIT)"),
                SapInvoice(invoice_number="INV-2026-0002", invoice_type="CUSTOMER_INVOICE", customer_name="Horizon Construction Works", customer_phone="+91 98471 22334", customer_gstin="32AABCH1234F1Z5", billing_date=now - timedelta(days=5), due_date=now + timedelta(days=25), subtotal=45000.0, taxable_amount=45000.0, tax_amount=8100.0, cgst_amount=4050.0, sgst_amount=4050.0, igst_amount=0.0, total_amount=53100.0, paid_amount=8100.0, balance_due=45000.0, status="PARTIALLY_PAID", items_summary="Hydraulic Fluid Grade ISO 68 (100 LTR) & Spares"),
                SapInvoice(invoice_number="INV-2026-0003", invoice_type="CUSTOMER_INVOICE", customer_name="Southern Logistics & Freight", customer_phone="+91 94470 99887", customer_gstin="32AADCS9988K1Z3", billing_date=now - timedelta(days=2), due_date=now + timedelta(days=13), subtotal=85000.0, taxable_amount=85000.0, tax_amount=15300.0, cgst_amount=7650.0, sgst_amount=7650.0, igst_amount=0.0, total_amount=100300.0, paid_amount=0.0, balance_due=100300.0, status="ISSUED", items_summary="Heavy Duty V-Belt 5PK1220 (100 PCS)"),
            ]
            session.add_all(invoices)

        # 13. Default Purchase Orders (Purchase)
        existing_pos = (await session.execute(select(SapPurchaseOrder))).scalars().first()
        if not existing_pos:
            pos = [
                SapPurchaseOrder(po_number="PO-2026-0001", vendor_code="VEND-20001", vendor_name="PetroLube Industrial Supply Co", vendor_gstin="32AABCP9900H1Z8", order_date=now - timedelta(days=15), expected_delivery_date=now - timedelta(days=5), material_code="MAT-RAW-001", material_name="Hydraulic Fluid Grade ISO 68", quantity=500.0, uom="LTR", unit_price=200.0, subtotal=100000.0, tax_amount=18000.0, total_amount=118000.0, status="RECEIVED"),
                SapPurchaseOrder(po_number="PO-2026-0002", vendor_code="VEND-20002", vendor_name="Metro Diesel & Machinery Spares", vendor_gstin="32AABCM4433E1Z9", order_date=now - timedelta(days=3), expected_delivery_date=now + timedelta(days=4), material_code="MAT-SPR-002", material_name="Diesel Fuel Injector Nozzle Assembly", quantity=30.0, uom="PCS", unit_price=4200.0, subtotal=126000.0, tax_amount=22680.0, total_amount=148680.0, status="PARTIALLY_RECEIVED"),
            ]
            session.add_all(pos)

        # 14. Default Goods Receipts (Purchase GRN)
        existing_grn = (await session.execute(select(SapGoodsReceipt))).scalars().first()
        if not existing_grn:
            grns = [
                SapGoodsReceipt(grn_number="GRN-2026-0001", po_reference="PO-2026-0001", vendor_name="PetroLube Industrial Supply Co", received_date=now - timedelta(days=5), material_code="MAT-RAW-001", material_name="Hydraulic Fluid Grade ISO 68", quantity_received=500.0, quantity_accepted=500.0, quantity_rejected=0.0, uom="LTR", warehouse_zone="ZONE-FLUIDS", storage_bin="BIN-B-02-01", quality_status="ACCEPTED", received_by="Harish Patel"),
                SapGoodsReceipt(grn_number="GRN-2026-0002", po_reference="PO-2026-0002", vendor_name="Metro Diesel & Machinery Spares", received_date=now - timedelta(days=1), material_code="MAT-SPR-002", material_name="Diesel Fuel Injector Nozzle Assembly", quantity_received=10.0, quantity_accepted=10.0, quantity_rejected=0.0, uom="PCS", warehouse_zone="ZONE-HEAVY", storage_bin="BIN-A-01-01", quality_status="ACCEPTED", received_by="Harish Patel"),
            ]
            session.add_all(grns)

        # 15. Default Vendor Bills (AP)
        existing_bills = (await session.execute(select(SapVendorBill))).scalars().first()
        if not existing_bills:
            bills = [
                SapVendorBill(bill_number="BILL-2026-0001", vendor_bill_ref="PETRO-INV-9981", po_reference="PO-2026-0001", vendor_code="VEND-20001", vendor_name="PetroLube Industrial Supply Co", vendor_gstin="32AABCP9900H1Z8", bill_date=now - timedelta(days=5), due_date=now + timedelta(days=25), subtotal=100000.0, tax_amount=18000.0, total_amount=118000.0, paid_amount=118000.0, balance_payable=0.0, status="PAID"),
                SapVendorBill(bill_number="BILL-2026-0002", vendor_bill_ref="METRO-INV-4412", po_reference="PO-2026-0002", vendor_code="VEND-20002", vendor_name="Metro Diesel & Machinery Spares", vendor_gstin="32AABCM4433E1Z9", bill_date=now - timedelta(days=1), due_date=now + timedelta(days=44), subtotal=42000.0, tax_amount=7560.0, total_amount=49560.0, paid_amount=0.0, balance_payable=49560.0, status="UNPAID"),
            ]
            session.add_all(bills)

        # 16. Default Accounting Vouchers (Finance)
        existing_vouch = (await session.execute(select(SapAccountingVoucher))).scalars().first()
        if not existing_vouch:
            vouchers = [
                SapAccountingVoucher(voucher_number="RCT-2026-0001", voucher_type="RECEIPT_VOUCHER", voucher_date=now - timedelta(days=10), debit_ledger="100200 - HDFC Commercial Current Account", credit_ledger="110100 - Trade Debtors", amount=141600.0, narration="Full payment received against INV-2026-0001", reference_number="INV-2026-0001", status="POSTED"),
                SapAccountingVoucher(voucher_number="PAY-2026-0001", voucher_type="PAYMENT_VOUCHER", voucher_date=now - timedelta(days=4), debit_ledger="200100 - Trade Creditors", credit_ledger="100200 - HDFC Commercial Current Account", amount=118000.0, narration="Settlement for PetroLube bulk lubricant order", reference_number="BILL-2026-0001", status="POSTED"),
                SapAccountingVoucher(voucher_number="CON-2026-0001", voucher_type="CONTRA_VOUCHER", voucher_date=now - timedelta(days=2), debit_ledger="100200 - HDFC Commercial Current Account", credit_ledger="100100 - Main Operating Cash Ledger", amount=25000.0, narration="Excess counter cash deposit into HDFC bank", status="POSTED"),
                SapAccountingVoucher(voucher_number="JRN-2026-0001", voucher_type="JOURNAL_VOUCHER", voucher_date=now - timedelta(days=1), debit_ledger="500100 - Workshop Spares & Consumables Expense", credit_ledger="100100 - Main Operating Cash Ledger", amount=14500.0, narration="Quarterly workshop tool wear and consumables provision", status="POSTED"),
            ]
            session.add_all(vouchers)

        # 17. Default Outbound Deliveries (GDN)
        existing_deliv = (await session.execute(select(SapOutboundDelivery))).scalars().first()
        if not existing_deliv:
            deliveries = [
                SapOutboundDelivery(delivery_number="GDN-2026-0001", sales_order_number="SO-2026-0001", customer_name="Apex Power & Infrastructure Ltd", shipping_address="Plot 45, Industrial Zone, Kochi", carrier_name="FastTrack Logistics", tracking_number="FT-7712398", shipping_date=now - timedelta(days=18), estimated_delivery=now - timedelta(days=16), actual_delivery=now - timedelta(days=16), status="DELIVERED", total_packages=2, total_weight_kg=1200.0),
                SapOutboundDelivery(delivery_number="GDN-2026-0002", sales_order_number="SO-2026-0002", customer_name="Horizon Construction Works", shipping_address="12/34 River Road, Calicut", carrier_name="Express Cargo Fleet", tracking_number="EC-441209", shipping_date=now - timedelta(days=1), estimated_delivery=now + timedelta(days=1), status="IN_TRANSIT", total_packages=5, total_weight_kg=250.0),
            ]
            session.add_all(deliveries)

        # 18. Default Voucher Formats (Admin)
        existing_formats = (await session.execute(select(SapVoucherFormat))).scalars().first()
        if not existing_formats:
            formats = [
                SapVoucherFormat(format_code="FMT-INV-01", title="Standard GST Tax Invoice Layout", doc_type="TAX_INVOICE", header_title="TAX INVOICE - RULE 46 CGST RULES", footer_terms="We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct. Subject to local jurisdiction.", show_gst_breakup=True, show_qr_code=True, company_pan_display="AABCL8291M", company_gstin_display="32AABCL8291M1Z5", is_default=True),
                SapVoucherFormat(format_code="FMT-RCT-01", title="Official Cash/Bank Receipt Voucher", doc_type="PAYMENT_RECEIPT", header_title="OFFICIAL PAYMENT RECEIPT", footer_terms="Received with thanks. Cheques subject to realization.", show_gst_breakup=False, show_qr_code=True, company_pan_display="AABCL8291M", company_gstin_display="32AABCL8291M1Z5", is_default=True),
                SapVoucherFormat(format_code="FMT-GDN-01", title="Standard Goods Delivery Note Challan", doc_type="DELIVERY_CHALLAN", header_title="GOODS DELIVERY CHALLAN", footer_terms="Goods received in sound and merchantable condition.", show_gst_breakup=False, show_qr_code=False, company_pan_display="AABCL8291M", company_gstin_display="32AABCL8291M1Z5", is_default=True),
            ]
            session.add_all(formats)

        await session.commit()

