import os

path = r"backend/app/services/sap_service.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

target_marker = "    # -------------------------------------------------------------\n    # 14. SEED SAP DEFAULTS FOR ALL MODULES (FI, CO, MM, SD, HCM, PP, WM, ABAP, TAX)\n    # -------------------------------------------------------------"

new_methods = '''    # -------------------------------------------------------------
    # 14. CUSTOMERS & ENQUIRIES (SALES)
    # -------------------------------------------------------------
    @staticmethod
    async def list_customers(
        session: AsyncSession,
        search: Optional[str] = None,
        customer_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapCustomer], int]:
        stmt = select(SapCustomer)
        if customer_type and customer_type.upper() != "ALL":
            stmt = stmt.where(SapCustomer.customer_type == customer_type.upper())
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
                    SapCustomerEnquiry.product_interest.ilike(s),
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
        payment_status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapInvoice], int]:
        stmt = select(SapInvoice)
        if invoice_type and invoice_type.upper() != "ALL":
            stmt = stmt.where(SapInvoice.invoice_type == invoice_type.upper())
        if payment_status and payment_status.upper() != "ALL":
            stmt = stmt.where(SapInvoice.payment_status == payment_status.upper())
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
        stmt = stmt.order_by(desc(SapInvoice.invoice_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_invoice(session: AsyncSession, invoice_id: uuid.UUID) -> Optional[SapInvoice]:
        return (await session.execute(select(SapInvoice).where(SapInvoice.id == invoice_id))).scalar_one_or_none()

    @staticmethod
    async def create_invoice(session: AsyncSession, invoice_in: SapInvoiceCreate) -> SapInvoice:
        payload = invoice_in.model_dump()
        if not payload.get("invoice_number"):
            payload["invoice_number"] = f"INV-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
        if payload.get("due_amount") is None:
            payload["due_amount"] = payload.get("grand_total", 0.0) - payload.get("paid_amount", 0.0)
        invoice = SapInvoice(**payload)
        session.add(invoice)

        if invoice.total_tax > 0:
            tax_entry = SapTaxLedger(
                transaction_number=f"TX-{invoice.invoice_number}",
                source_module="SD",
                invoice_reference=invoice.invoice_number,
                taxable_amount=invoice.subtotal,
                tax_rate_pct=18.0 if invoice.subtotal > 0 else 0.0,
                cgst_amount=invoice.cgst_amount,
                sgst_amount=invoice.sgst_amount,
                igst_amount=invoice.igst_amount,
                total_tax=invoice.total_tax,
                entry_type="OUTPUT_TAX",
                posting_date=datetime.now(timezone.utc),
                party_name=invoice.customer_name,
                party_gstin=invoice.customer_gstin,
            )
            session.add(tax_entry)

        if invoice.customer_id:
            cust = await SapService.get_customer(session, invoice.customer_id)
            if cust:
                cust.current_balance = (cust.current_balance or 0.0) + invoice.due_amount

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
        invoice.due_amount = max(0.0, invoice.grand_total - invoice.paid_amount)
        if invoice.due_amount <= 0 and invoice.grand_total > 0:
            invoice.payment_status = "PAID"
        elif invoice.paid_amount > 0:
            invoice.payment_status = "PARTIAL"
        await session.commit()
        await session.refresh(invoice)
        return invoice

    @staticmethod
    async def record_invoice_payment(session: AsyncSession, invoice_id: uuid.UUID, payment_in: SapInvoicePaymentRecord) -> Optional[SapInvoice]:
        invoice = await SapService.get_invoice(session, invoice_id)
        if not invoice:
            return None
        invoice.paid_amount += payment_in.amount
        invoice.due_amount = max(0.0, invoice.grand_total - invoice.paid_amount)
        if invoice.due_amount <= 0:
            invoice.payment_status = "PAID"
        else:
            invoice.payment_status = "PARTIAL"

        voucher = SapAccountingVoucher(
            voucher_number=f"RCT-{uuid.uuid4().hex[:6].upper()}",
            voucher_type="RECEIPT",
            reference_number=invoice.invoice_number,
            debit_account="100200 - HDFC Bank Account" if payment_in.payment_method != "CASH" else "100100 - Main Cash Ledger",
            credit_account="110100 - Trade Debtors",
            amount=payment_in.amount,
            narration=payment_in.notes or f"Received payment for invoice {invoice.invoice_number}",
            payment_mode=payment_in.payment_method,
            party_name=invoice.customer_name,
            status="POSTED"
        )
        session.add(voucher)

        if invoice.customer_id:
            cust = await SapService.get_customer(session, invoice.customer_id)
            if cust:
                cust.current_balance = max(0.0, (cust.current_balance or 0.0) - payment_in.amount)

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
        stmt = stmt.order_by(desc(SapOutboundDelivery.delivery_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_delivery(session: AsyncSession, delivery_in: SapOutboundDeliveryCreate) -> SapOutboundDelivery:
        payload = delivery_in.model_dump()
        if not payload.get("delivery_number"):
            payload["delivery_number"] = f"GDN-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
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
        stmt = stmt.order_by(desc(SapPosSale.bill_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_pos_sale(session: AsyncSession, pos_in: SapPosSaleCreate) -> SapPosSale:
        payload = pos_in.model_dump()
        if not payload.get("bill_number"):
            payload["bill_number"] = f"POS-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        pos = SapPosSale(**payload)
        session.add(pos)

        if pos.items:
            for item in pos.items:
                m_code = item.get("material_code")
                qty = float(item.get("quantity") or 0.0)
                if m_code and qty > 0:
                    mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == m_code))
                    mat = mat_res.scalar_one_or_none()
                    if mat:
                        mat.current_stock = max(0.0, mat.current_stock - qty)

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
        vendor_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapVendor], int]:
        stmt = select(SapVendor)
        if vendor_type and vendor_type.upper() != "ALL":
            stmt = stmt.where(SapVendor.vendor_type == vendor_type.upper())
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
        stmt = stmt.order_by(desc(SapPurchaseOrder.po_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def get_purchase_order(session: AsyncSession, po_id: uuid.UUID) -> Optional[SapPurchaseOrder]:
        return (await session.execute(select(SapPurchaseOrder).where(SapPurchaseOrder.id == po_id))).scalar_one_or_none()

    @staticmethod
    async def create_purchase_order(session: AsyncSession, po_in: SapPurchaseOrderCreate) -> SapPurchaseOrder:
        payload = po_in.model_dump()
        if not payload.get("po_number"):
            payload["po_number"] = f"PO-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
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
        po_number: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapGoodsReceipt], int]:
        stmt = select(SapGoodsReceipt)
        if po_number:
            stmt = stmt.where(SapGoodsReceipt.po_number == po_number)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapGoodsReceipt.grn_number.ilike(s),
                    SapGoodsReceipt.po_number.ilike(s),
                    SapGoodsReceipt.vendor_name.ilike(s),
                    SapGoodsReceipt.material_code.ilike(s),
                    SapGoodsReceipt.material_name.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapGoodsReceipt.receipt_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_goods_receipt(session: AsyncSession, grn_in: SapGoodsReceiptCreate) -> SapGoodsReceipt:
        payload = grn_in.model_dump()
        if not payload.get("grn_number"):
            payload["grn_number"] = f"GRN-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
        grn = SapGoodsReceipt(**payload)
        session.add(grn)

        if grn.material_code:
            mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == grn.material_code))
            mat = mat_res.scalar_one_or_none()
            if mat:
                mat.current_stock += grn.received_quantity

        if grn.po_number:
            po_res = await session.execute(select(SapPurchaseOrder).where(SapPurchaseOrder.po_number == grn.po_number))
            po = po_res.scalar_one_or_none()
            if po:
                po.received_quantity += grn.received_quantity
                if po.received_quantity >= po.quantity:
                    po.status = "RECEIVED"
                else:
                    po.status = "PARTIALLY_RECEIVED"

        movement = SapStockMovement(
            movement_number=f"MVT-{uuid.uuid4().hex[:6].upper()}",
            material_code=grn.material_code,
            material_name=grn.material_name,
            movement_type="101",
            movement_type_description="Goods Receipt against PO",
            quantity=grn.received_quantity,
            uom=grn.uom,
            storage_location=grn.storage_location or "LOC-GENERAL",
            reference_doc=grn.grn_number,
            remarks=f"Received against PO {grn.po_number}",
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
                    SapVendorBill.vendor_invoice_number.ilike(s),
                    SapVendorBill.vendor_name.ilike(s),
                    SapVendorBill.po_number.ilike(s),
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
        if not payload.get("bill_number"):
            payload["bill_number"] = f"BILL-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
        if payload.get("due_amount") is None:
            payload["due_amount"] = payload.get("total_amount", 0.0) - payload.get("paid_amount", 0.0)
        bill = SapVendorBill(**payload)
        session.add(bill)

        if bill.tax_amount > 0:
            tax_entry = SapTaxLedger(
                transaction_number=f"TX-{bill.bill_number}",
                source_module="MM",
                invoice_reference=bill.vendor_invoice_number or bill.bill_number,
                taxable_amount=bill.taxable_amount,
                tax_rate_pct=18.0 if bill.taxable_amount > 0 else 0.0,
                cgst_amount=bill.tax_amount / 2,
                sgst_amount=bill.tax_amount / 2,
                igst_amount=0.0,
                total_tax=bill.tax_amount,
                entry_type="INPUT_TAX_CREDIT",
                posting_date=datetime.now(timezone.utc),
                party_name=bill.vendor_name,
                party_gstin=bill.vendor_gstin,
            )
            session.add(tax_entry)

        if bill.vendor_id:
            vend = await SapService.get_vendor(session, bill.vendor_id)
            if vend:
                vend.current_balance = (vend.current_balance or 0.0) + bill.due_amount

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
        bill.due_amount = max(0.0, bill.total_amount - bill.paid_amount)
        if bill.due_amount <= 0:
            bill.status = "PAID"
        elif bill.paid_amount > 0:
            bill.status = "PARTIAL"
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
                    SapDebitNote.original_bill_number.ilike(s),
                    SapDebitNote.reason.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapDebitNote.note_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_debit_note(session: AsyncSession, note_in: SapDebitNoteCreate) -> SapDebitNote:
        payload = note_in.model_dump()
        if not payload.get("debit_note_number"):
            payload["debit_note_number"] = f"DN-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
        note = SapDebitNote(**payload)
        session.add(note)

        if note.vendor_id:
            vend = await SapService.get_vendor(session, note.vendor_id)
            if vend:
                vend.current_balance = max(0.0, (vend.current_balance or 0.0) - note.total_amount)

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
                    SapStockTransfer.transfer_number.ilike(s),
                    SapStockTransfer.source_godown.ilike(s),
                    SapStockTransfer.target_godown.ilike(s),
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
        if not payload.get("transfer_number"):
            payload["transfer_number"] = f"TRF-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
        transfer = SapStockTransfer(**payload)
        session.add(transfer)

        mvt = SapStockMovement(
            movement_number=f"MVT-{uuid.uuid4().hex[:6].upper()}",
            material_code=transfer.material_code,
            material_name=transfer.material_name,
            movement_type="311",
            movement_type_description=f"Transfer from {transfer.source_godown} to {transfer.target_godown}",
            quantity=transfer.quantity,
            uom=transfer.uom,
            storage_location=transfer.target_godown,
            reference_doc=transfer.transfer_number,
            remarks=transfer.remarks or "Godown transfer",
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
                    SapStockMovement.movement_number.ilike(s),
                    SapStockMovement.material_code.ilike(s),
                    SapStockMovement.material_name.ilike(s),
                    SapStockMovement.movement_type.ilike(s),
                    SapStockMovement.reference_doc.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapStockMovement.posting_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_stock_movement(session: AsyncSession, movement_in: SapStockMovementCreate) -> SapStockMovement:
        payload = movement_in.model_dump()
        if not payload.get("movement_number"):
            payload["movement_number"] = f"MVT-{uuid.uuid4().hex[:6].upper()}"
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
            stmt = stmt.where(SapStockTaking.status == status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapStockTaking.session_code.ilike(s),
                    SapStockTaking.godown.ilike(s),
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
        if not payload.get("session_code"):
            payload["session_code"] = f"STK-{datetime.now(timezone.utc).strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        payload["variance_qty"] = payload.get("physical_count_qty", 0.0) - payload.get("book_stock_qty", 0.0)
        taking = SapStockTaking(**payload)
        session.add(taking)
        await session.commit()
        await session.refresh(taking)
        return taking

    @staticmethod
    async def list_damaged_items(
        session: AsyncSession,
        search: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[SapDamagedItem], int]:
        stmt = select(SapDamagedItem)
        if status and status.upper() != "ALL":
            stmt = stmt.where(SapDamagedItem.status == status.upper())
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapDamagedItem.damage_report_code.ilike(s),
                    SapDamagedItem.material_code.ilike(s),
                    SapDamagedItem.material_name.ilike(s),
                    SapDamagedItem.damage_reason.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapDamagedItem.report_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_damaged_item(session: AsyncSession, item_in: SapDamagedItemCreate) -> SapDamagedItem:
        payload = item_in.model_dump()
        if not payload.get("damage_report_code"):
            payload["damage_report_code"] = f"DMG-{datetime.now(timezone.utc).strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
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
                    SapPriceChange.material_code.ilike(s),
                    SapPriceChange.material_name.ilike(s),
                    SapPriceChange.price_list_name.ilike(s),
                    SapPriceChange.change_reason.ilike(s),
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
        change = SapPriceChange(**payload)
        session.add(change)

        mat_res = await session.execute(select(SapMaterialMaster).where(SapMaterialMaster.material_code == change.material_code))
        mat = mat_res.scalar_one_or_none()
        if mat:
            change.old_price = mat.unit_price
            mat.unit_price = change.new_price

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
                    SapAccountingVoucher.party_name.ilike(s),
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
        prefix = payload.get("voucher_type", "JRN")[:3].upper()
        if not payload.get("voucher_number"):
            payload["voucher_number"] = f"{prefix}-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:5].upper()}"
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
            stmt = stmt.where(SapBankReconciliation.bank_account == bank_account)
        if search:
            s = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SapBankReconciliation.bank_account.ilike(s),
                    SapBankReconciliation.period_month.ilike(s),
                    SapBankReconciliation.status.ilike(s),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0
        stmt = stmt.order_by(desc(SapBankReconciliation.statement_date)).offset(skip).limit(limit)
        res = await session.execute(stmt)
        return list(res.scalars().all()), total

    @staticmethod
    async def create_bank_reconciliation(session: AsyncSession, brs_in: SapBankReconciliationCreate) -> SapBankReconciliation:
        payload = brs_in.model_dump()
        payload["variance_amount"] = payload.get("statement_closing_balance", 0.0) - payload.get("book_balance", 0.0)
        if abs(payload["variance_amount"]) < 0.01:
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
        rows = []
        tot_debit = 0.0
        tot_credit = 0.0
        for acc in accounts:
            debit = acc.balance if acc.account_type in ["ASSET", "EXPENSE"] else 0.0
            credit = acc.balance if acc.account_type in ["LIABILITY", "EQUITY", "REVENUE"] else 0.0
            tot_debit += debit
            tot_credit += credit
            rows.append({
                "account_number": acc.account_number,
                "account_name": acc.account_name,
                "account_type": acc.account_type,
                "debit": debit,
                "credit": credit,
            })
        return SapTrialBalanceReport(
            as_of_date=datetime.now(timezone.utc),
            rows=rows,
            total_debits=tot_debit,
            total_credits=tot_credit,
            is_balanced=abs(tot_debit - tot_credit) < 1.0,
        )

    @staticmethod
    async def get_profit_loss_report(session: AsyncSession) -> SapProfitLossReport:
        res = await session.execute(select(SapGlAccount).where(SapGlAccount.account_type.in_(["REVENUE", "EXPENSE"])))
        accounts = res.scalars().all()
        rev_rows = []
        exp_rows = []
        tot_rev = 0.0
        tot_exp = 0.0
        for a in accounts:
            if a.account_type == "REVENUE":
                rev_rows.append({"account_number": a.account_number, "account_name": a.account_name, "amount": a.balance})
                tot_rev += a.balance
            else:
                exp_rows.append({"account_number": a.account_number, "account_name": a.account_name, "amount": a.balance})
                tot_exp += a.balance
        return SapProfitLossReport(
            period_label="Current Financial Year 2026-27",
            revenue_items=rev_rows,
            expense_items=exp_rows,
            total_revenue=tot_rev,
            total_expenses=tot_exp,
            net_profit_loss=tot_rev - tot_exp,
        )

    @staticmethod
    async def get_balance_sheet_report(session: AsyncSession) -> SapBalanceSheetReport:
        res = await session.execute(select(SapGlAccount).where(SapGlAccount.account_type.in_(["ASSET", "LIABILITY", "EQUITY"])))
        accounts = res.scalars().all()
        assets = []
        liab = []
        eq = []
        tot_asset = 0.0
        tot_liab = 0.0
        tot_eq = 0.0
        for a in accounts:
            if a.account_type == "ASSET":
                assets.append({"account_number": a.account_number, "account_name": a.account_name, "amount": a.balance})
                tot_asset += a.balance
            elif a.account_type == "LIABILITY":
                liab.append({"account_number": a.account_number, "account_name": a.account_name, "amount": a.balance})
                tot_liab += a.balance
            elif a.account_type == "EQUITY":
                eq.append({"account_number": a.account_number, "account_name": a.account_name, "amount": a.balance})
                tot_eq += a.balance

        pl = await SapService.get_profit_loss_report(session)
        if pl.net_profit_loss != 0:
            eq.append({"account_number": "399999", "account_name": "Current Period Net Earnings", "amount": pl.net_profit_loss})
            tot_eq += pl.net_profit_loss

        return SapBalanceSheetReport(
            as_of_date=datetime.now(timezone.utc),
            assets=assets,
            liabilities=liab,
            equity=eq,
            total_assets=tot_asset,
            total_liabilities=tot_liab,
            total_equity=tot_eq,
            is_balanced=abs(tot_asset - (tot_liab + tot_eq)) < 1.0,
        )

    @staticmethod
    async def get_receivables_ageing_report(session: AsyncSession) -> SapReceivablesAgeingReport:
        res = await session.execute(select(SapInvoice).where(SapInvoice.due_amount > 0))
        invoices = res.scalars().all()
        now = datetime.now(timezone.utc)
        b0_30 = 0.0
        b31_60 = 0.0
        b61_90 = 0.0
        b90_plus = 0.0
        rows = []
        for inv in invoices:
            age_days = (now - (inv.invoice_date.replace(tzinfo=timezone.utc) if inv.invoice_date.tzinfo is None else inv.invoice_date)).days
            due = inv.due_amount
            c0, c31, c61, c90 = 0.0, 0.0, 0.0, 0.0
            if age_days <= 30:
                b0_30 += due
                c0 = due
            elif age_days <= 60:
                b31_60 += due
                c31 = due
            elif age_days <= 90:
                b61_90 += due
                c61 = due
            else:
                b90_plus += due
                c90 = due
            rows.append({
                "invoice_number": inv.invoice_number,
                "customer_name": inv.customer_name,
                "invoice_date": inv.invoice_date.isoformat(),
                "age_days": age_days,
                "total_due": due,
                "bucket_0_30": c0,
                "bucket_31_60": c31,
                "bucket_61_90": c61,
                "bucket_90_plus": c90,
            })
        return SapReceivablesAgeingReport(
            total_receivable=b0_30 + b31_60 + b61_90 + b90_plus,
            bucket_0_30=b0_30,
            bucket_31_60=b31_60,
            bucket_61_90=b61_90,
            bucket_90_plus=b90_plus,
            rows=rows,
        )

    @staticmethod
    async def get_sales_register_report(session: AsyncSession) -> SapSalesRegisterReport:
        res = await session.execute(select(SapInvoice).order_by(desc(SapInvoice.invoice_date)))
        invoices = res.scalars().all()
        rows = []
        tot_taxable = 0.0
        tot_cgst = 0.0
        tot_sgst = 0.0
        tot_igst = 0.0
        tot_grand = 0.0
        for inv in invoices:
            tot_taxable += inv.subtotal
            tot_cgst += inv.cgst_amount
            tot_sgst += inv.sgst_amount
            tot_igst += inv.igst_amount
            tot_grand += inv.grand_total
            rows.append({
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat(),
                "customer_name": inv.customer_name,
                "customer_gstin": inv.customer_gstin,
                "taxable_amount": inv.subtotal,
                "cgst_amount": inv.cgst_amount,
                "sgst_amount": inv.sgst_amount,
                "igst_amount": inv.igst_amount,
                "total_tax": inv.total_tax,
                "grand_total": inv.grand_total,
                "payment_status": inv.payment_status,
            })
        return SapSalesRegisterReport(
            total_taxable_value=tot_taxable,
            total_cgst=tot_cgst,
            total_sgst=tot_sgst,
            total_igst=tot_igst,
            total_invoiced_value=tot_grand,
            invoices=rows,
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
        mig = SapDataMigration(**payload)
        session.add(mig)
        await session.commit()
        await session.refresh(mig)
        return mig

'''

new_seed_items = '''
        # 10. Default Customers (Sales)
        existing_cust = (await session.execute(select(SapCustomer))).scalars().first()
        if not existing_cust:
            customers = [
                SapCustomer(customer_code="CUST-10001", company_name="Apex Power & Infrastructure Ltd", contact_person="Rajesh Kumar", email="rajesh@apexinfra.com", phone="+91 98765 43210", gstin="32AAACA5678G2Z1", address_line1="Plot 45, Industrial Zone", city="Kochi", state="Kerala", postal_code="682024", credit_limit=500000.0, current_balance=124000.0, customer_type="CORPORATE"),
                SapCustomer(customer_code="CUST-10002", company_name="Horizon Construction Works", contact_person="Mathew Philip", email="mathew@horizonworks.in", phone="+91 98471 22334", gstin="32AABCH1234F1Z5", address_line1="12/34 River Road", city="Calicut", state="Kerala", postal_code="673001", credit_limit=300000.0, current_balance=45000.0, customer_type="COMMERCIAL"),
                SapCustomer(customer_code="CUST-10003", company_name="Southern Logistics & Freight", contact_person="Deepak Nair", email="logistics@southernfreight.com", phone="+91 94470 99887", gstin="32AADCS9988K1Z3", address_line1="Cargo Terminal 4", city="Kochi", state="Kerala", postal_code="682009", credit_limit=200000.0, current_balance=0.0, customer_type="CORPORATE"),
            ]
            session.add_all(customers)

        # 11. Default Vendors (Purchase)
        existing_vend = (await session.execute(select(SapVendor))).scalars().first()
        if not existing_vend:
            vendors = [
                SapVendor(vendor_code="VEND-20001", company_name="PetroLube Industrial Supply Co", contact_person="Anand Sharma", email="sales@petrolube.com", phone="+91 98112 33445", gstin="32AABCP9900H1Z8", address_line1="Chemical Park, Sector 8", city="Kochi", state="Kerala", postal_code="682030", vendor_type="DISTRIBUTOR", payment_terms="NET_30", current_balance=52800.0),
                SapVendor(vendor_code="VEND-20002", company_name="Metro Diesel & Machinery Spares", contact_person="Sunil Varma", email="sunil@metrodiesel.in", phone="+91 98220 55667", gstin="32AABCM4433E1Z9", address_line1="Autonagar 1st Cross", city="Ernakulam", state="Kerala", postal_code="682018", vendor_type="MANUFACTURER", payment_terms="NET_45", current_balance=89000.0),
                SapVendor(vendor_code="VEND-20003", company_name="Bosch Heavy Hydraulics India", contact_person="Kiran Reddy", email="support@boschheavy.com", phone="+91 98330 77889", gstin="29AABCB1122D1Z0", address_line1="Peenya Industrial Area", city="Bangalore", state="Karnataka", postal_code="560058", vendor_type="MANUFACTURER", payment_terms="IMMEDIATE", current_balance=0.0),
            ]
            session.add_all(vendors)

        # 12. Default Invoices (Sales & Billing)
        existing_inv = (await session.execute(select(SapInvoice))).scalars().first()
        if not existing_inv:
            invoices = [
                SapInvoice(invoice_number="INV-2026-0001", customer_name="Apex Power & Infrastructure Ltd", customer_gstin="32AAACA5678G2Z1", invoice_type="TAX_INVOICE", subtotal=120000.0, cgst_amount=10800.0, sgst_amount=10800.0, igst_amount=0.0, total_tax=21600.0, grand_total=141600.0, paid_amount=141600.0, due_amount=0.0, payment_status="PAID", items=[{"material_code": "MAT-FNG-004", "description": "Silent Diesel Generator Set 15kVA", "quantity": 1, "unit_price": 120000.0, "total": 120000.0}]),
                SapInvoice(invoice_number="INV-2026-0002", customer_name="Horizon Construction Works", customer_gstin="32AABCH1234F1Z5", invoice_type="TAX_INVOICE", subtotal=45000.0, cgst_amount=4050.0, sgst_amount=4050.0, igst_amount=0.0, total_tax=8100.0, grand_total=53100.0, paid_amount=8100.0, due_amount=45000.0, payment_status="PARTIAL", items=[{"material_code": "MAT-RAW-001", "description": "Hydraulic Fluid Grade ISO 68", "quantity": 100, "unit_price": 220.0, "total": 22000.0}, {"material_code": "MAT-SPR-002", "description": "Diesel Fuel Injector Nozzle Assembly", "quantity": 5, "unit_price": 4600.0, "total": 23000.0}]),
                SapInvoice(invoice_number="INV-2026-0003", customer_name="Southern Logistics & Freight", customer_gstin="32AADCS9988K1Z3", invoice_type="TAX_INVOICE", subtotal=85000.0, cgst_amount=7650.0, sgst_amount=7650.0, igst_amount=0.0, total_tax=15300.0, grand_total=100300.0, paid_amount=0.0, due_amount=100300.0, payment_status="PENDING", items=[{"material_code": "MAT-SPR-003", "description": "Heavy Duty V-Belt 5PK1220", "quantity": 100, "unit_price": 850.0, "total": 85000.0}]),
            ]
            session.add_all(invoices)

        # 13. Default Purchase Orders (Purchase)
        existing_pos = (await session.execute(select(SapPurchaseOrder))).scalars().first()
        if not existing_pos:
            pos = [
                SapPurchaseOrder(po_number="PO-2026-0001", vendor_name="PetroLube Industrial Supply Co", vendor_gstin="32AABCP9900H1Z8", material_code="MAT-RAW-001", material_name="Hydraulic Fluid Grade ISO 68", quantity=500.0, received_quantity=500.0, uom="LTR", unit_price=200.0, subtotal=100000.0, tax_amount=18000.0, total_amount=118000.0, status="RECEIVED"),
                SapPurchaseOrder(po_number="PO-2026-0002", vendor_name="Metro Diesel & Machinery Spares", vendor_gstin="32AABCM4433E1Z9", material_code="MAT-SPR-002", material_name="Diesel Fuel Injector Nozzle Assembly", quantity=30.0, received_quantity=10.0, uom="PCS", unit_price=4200.0, subtotal=126000.0, tax_amount=22680.0, total_amount=148680.0, status="PARTIALLY_RECEIVED"),
            ]
            session.add_all(pos)

        # 14. Default Goods Receipts (Purchase GRN)
        existing_grn = (await session.execute(select(SapGoodsReceipt))).scalars().first()
        if not existing_grn:
            grns = [
                SapGoodsReceipt(grn_number="GRN-2026-0001", po_number="PO-2026-0001", vendor_name="PetroLube Industrial Supply Co", material_code="MAT-RAW-001", material_name="Hydraulic Fluid Grade ISO 68", received_quantity=500.0, uom="LTR", storage_location="LOC-FLUIDS-01", accepted_quantity=500.0, inspection_status="ACCEPTED"),
                SapGoodsReceipt(grn_number="GRN-2026-0002", po_number="PO-2026-0002", vendor_name="Metro Diesel & Machinery Spares", material_code="MAT-SPR-002", material_name="Diesel Fuel Injector Nozzle Assembly", received_quantity=10.0, uom="PCS", storage_location="LOC-SPARES-B2", accepted_quantity=10.0, inspection_status="ACCEPTED"),
            ]
            session.add_all(grns)

        # 15. Default Vendor Bills (AP)
        existing_bills = (await session.execute(select(SapVendorBill))).scalars().first()
        if not existing_bills:
            bills = [
                SapVendorBill(bill_number="BILL-2026-0001", vendor_name="PetroLube Industrial Supply Co", vendor_gstin="32AABCP9900H1Z8", vendor_invoice_number="PETRO-INV-9981", po_number="PO-2026-0001", taxable_amount=100000.0, tax_amount=18000.0, total_amount=118000.0, paid_amount=118000.0, due_amount=0.0, status="PAID"),
                SapVendorBill(bill_number="BILL-2026-0002", vendor_name="Metro Diesel & Machinery Spares", vendor_gstin="32AABCM4433E1Z9", vendor_invoice_number="METRO-INV-4412", po_number="PO-2026-0002", taxable_amount=42000.0, tax_amount=7560.0, total_amount=49560.0, paid_amount=0.0, due_amount=49560.0, status="PENDING"),
            ]
            session.add_all(bills)

        # 16. Default Accounting Vouchers (Finance)
        existing_vouch = (await session.execute(select(SapAccountingVoucher))).scalars().first()
        if not existing_vouch:
            vouchers = [
                SapAccountingVoucher(voucher_number="RCT-2026-0001", voucher_type="RECEIPT", reference_number="INV-2026-0001", debit_account="100200 - HDFC Commercial Current Account", credit_account="110100 - Trade Debtors", amount=141600.0, narration="Payment received in full against INV-2026-0001", payment_mode="BANK_TRANSFER", party_name="Apex Power & Infrastructure Ltd", status="POSTED"),
                SapAccountingVoucher(voucher_number="PAY-2026-0001", voucher_type="PAYMENT", reference_number="BILL-2026-0001", debit_account="200100 - Trade Creditors", credit_account="100200 - HDFC Commercial Current Account", amount=118000.0, narration="Settlement for PetroLube bulk lubricant order", payment_mode="NEFT", party_name="PetroLube Industrial Supply Co", status="POSTED"),
                SapAccountingVoucher(voucher_number="CON-2026-0001", voucher_type="CONTRA", reference_number="CASH-DEP-01", debit_account="100200 - HDFC Commercial Current Account", credit_account="100100 - Main Operating Cash Ledger", amount=25000.0, narration="Excess counter cash deposit into HDFC bank", payment_mode="CASH", status="POSTED"),
                SapAccountingVoucher(voucher_number="JRN-2026-0001", voucher_type="JOURNAL", reference_number="DEPR-2026-Q1", debit_account="500100 - Workshop Spares & Consumables Expense", credit_account="100100 - Main Operating Cash Ledger", amount=14500.0, narration="Provision for quarterly workshop tool wear and consumables", status="POSTED"),
            ]
            session.add_all(vouchers)

        # 17. Default Outbound Deliveries (GDN)
        existing_deliv = (await session.execute(select(SapOutboundDelivery))).scalars().first()
        if not existing_deliv:
            deliveries = [
                SapOutboundDelivery(delivery_number="GDN-2026-0001", sales_order_number="SO-2026-0001", customer_name="Apex Power & Infrastructure Ltd", shipping_address="Plot 45, Industrial Zone, Kochi", transport_carrier="FastTrack Logistics", tracking_number="FT-7712398", total_packages=2, status="DELIVERED"),
                SapOutboundDelivery(delivery_number="GDN-2026-0002", sales_order_number="SO-2026-0002", customer_name="Horizon Construction Works", shipping_address="12/34 River Road, Calicut", transport_carrier="Express Cargo Fleet", tracking_number="EC-441209", total_packages=5, status="IN_TRANSIT"),
            ]
            session.add_all(deliveries)

        # 18. Default Voucher Formats (Admin)
        existing_formats = (await session.execute(select(SapVoucherFormat))).scalars().first()
        if not existing_formats:
            formats = [
                SapVoucherFormat(voucher_type="TAX_INVOICE", format_name="Standard GST Tax Invoice Layout", header_title="TAX INVOICE - RULE 46 CGST RULES", prefix="INV-", next_number=4, number_length=4, show_company_logo=True, show_bank_details=True, declaration_text="We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.", is_default=True),
                SapVoucherFormat(voucher_type="PAYMENT_RECEIPT", format_name="Official Cash/Bank Receipt Voucher", header_title="OFFICIAL RECEIPT", prefix="RCT-", next_number=2, number_length=4, show_company_logo=True, declaration_text="Received with thanks.", is_default=True),
                SapVoucherFormat(voucher_type="DELIVERY_CHALLAN", format_name="Standard Goods Delivery Note Challan", header_title="GOODS DELIVERY CHALLAN", prefix="GDN-", next_number=3, number_length=4, show_company_logo=True, declaration_text="Goods delivered in good condition.", is_default=True),
            ]
            session.add_all(formats)
'''

# Insert new methods before target_marker
assert target_marker in content, "Target marker not found in sap_service.py"
content = content.replace(target_marker, new_methods + target_marker)

# Append new seed items right before `await session.commit()` in ensure_sap_core_defaults
commit_marker = "        await session.commit()\n"
last_commit_idx = content.rfind(commit_marker)
assert last_commit_idx != -1, "Commit marker not found"
content = content[:last_commit_idx] + new_seed_items + "\n" + content[last_commit_idx:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("sap_service.py successfully patched!")
