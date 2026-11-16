import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# =====================================================================
# 0. OPERATIONAL SERVICES & FLEET RENTALS (EXISTING SUITE CORE)
# =====================================================================

class ProductServiceTicket(Base):
    __tablename__ = "sap_service_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ticket_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    service_type: Mapped[str] = mapped_column(
        String(50), default="REPAIR", nullable=False
    )  # REPAIR, MAINTENANCE, INSPECTION, WARRANTY, AMC
    priority: Mapped[str] = mapped_column(
        String(20), default="MEDIUM", nullable=False
    )  # LOW, MEDIUM, HIGH, URGENT
    status: Mapped[str] = mapped_column(
        String(50), default="RECEIVED", index=True, nullable=False
    )  # RECEIVED, DIAGNOSING, IN_REPAIR, WAITING_PARTS, READY, DELIVERED, CANCELLED
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    diagnostic_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parts_replaced: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parts_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    service_charge: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    assigned_technician_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    received_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expected_delivery_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class RentalProduct(Base):
    __tablename__ = "sap_rental_products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    daily_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    weekly_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    monthly_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    security_deposit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    available_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    condition_status: Mapped[str] = mapped_column(
        String(50), default="EXCELLENT", nullable=False
    )  # EXCELLENT, GOOD, MAINTENANCE
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    bookings: Mapped[list["RentalBooking"]] = relationship(
        "RentalBooking", back_populates="product", cascade="all, delete-orphan"
    )


class RentalBooking(Base):
    __tablename__ = "sap_rental_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    rental_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sap_rental_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_id_proof: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_return_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rate_type: Mapped[str] = mapped_column(
        String(20), default="DAILY", nullable=False
    )  # DAILY, WEEKLY, MONTHLY
    rental_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    security_deposit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    deposit_refunded: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    damage_charges: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="ACTIVE", index=True, nullable=False
    )  # BOOKED, ACTIVE, RETURNED, OVERDUE, CANCELLED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    product: Mapped[Optional["RentalProduct"]] = relationship(
        "RentalProduct", back_populates="bookings"
    )


class SapSalesOrder(Base):
    __tablename__ = "sap_sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="CONFIRMED", index=True, nullable=False
    )  # DRAFT, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED
    payment_status: Mapped[str] = mapped_column(
        String(50), default="PENDING", nullable=False
    )  # PENDING, PARTIALLY_PAID, PAID
    items_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 1. SAP FI - FINANCIAL ACCOUNTING
# =====================================================================
class SapGlAccount(Base):
    __tablename__ = "sap_gl_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapJournalEntry(Base):
    __tablename__ = "sap_journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    entry_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    posting_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    debit_account: Mapped[str] = mapped_column(String(100), nullable=False)
    credit_account: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    narration: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="POSTED", nullable=False
    )  # POSTED, DRAFT, REVERSED
    tax_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 2. SAP CO - COST & PROFIT MANAGEMENT
# =====================================================================
class SapCostCenter(Base):
    __tablename__ = "sap_cost_centers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    center_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    manager_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    budget_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actual_spent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapProfitCenter(Base):
    __tablename__ = "sap_profit_centers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    center_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    head_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actual_revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 3. SAP MM - MATERIAL & INVENTORY MANAGEMENT
# =====================================================================
class SapMaterialMaster(Base):
    __tablename__ = "sap_material_masters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    material_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    material_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # RAW_MATERIAL, SPARE_PART, FINISHED_GOOD, OPERATING_SUPPLY
    base_uom: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    current_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    safety_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    storage_location: Mapped[str] = mapped_column(String(100), default="LOC-CENTRAL", nullable=False)
    valuation_class: Mapped[str] = mapped_column(String(50), default="VAL-STD", nullable=False)
    hsn_code: Mapped[str] = mapped_column(String(50), default="840999", nullable=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapPurchaseRequisition(Base):
    __tablename__ = "sap_purchase_requisitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pr_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    requested_by: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="PENDING", nullable=False
    )  # PENDING, APPROVED, PO_CREATED, REJECTED
    required_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 4. SAP SD - SALES & DISTRIBUTION (QUOTATIONS)
# =====================================================================
class SapQuotation(Base):
    __tablename__ = "sap_quotations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    quotation_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    pricing_condition: Mapped[str] = mapped_column(
        String(100), default="STANDARD_COMMERCIAL", nullable=False
    )
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="SENT", nullable=False
    )  # DRAFT, SENT, ACCEPTED, REJECTED, CONVERTED_TO_ORDER
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 5. SAP HCM - HUMAN RESOURCE MANAGEMENT
# =====================================================================
class SapHcmEmployee(Base):
    __tablename__ = "sap_hcm_employees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    personnel_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    employment_type: Mapped[str] = mapped_column(
        String(50), default="PERMANENT", nullable=False
    )  # PERMANENT, CONTRACT, TRAINEE
    basic_salary: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    hra: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    special_allowance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_deduction_tds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    net_salary: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    joining_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50), default="ACTIVE", nullable=False
    )  # ACTIVE, ON_LEAVE, RESIGNED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 6. SAP PP - PRODUCTION PLANNING
# =====================================================================
class SapProductionOrder(Base):
    __tablename__ = "sap_production_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    planned_quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    produced_quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="UNITS", nullable=False)
    work_center: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="RELEASED", nullable=False
    )  # PLANNED, RELEASED, IN_PROCESS, COMPLETED, CANCELLED
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapBomItem(Base):
    __tablename__ = "sap_bom_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bom_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    parent_product: Mapped[str] = mapped_column(String(255), nullable=False)
    component_code: Mapped[str] = mapped_column(String(50), nullable=False)
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    scrap_factor_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 7. SAP WM - WAREHOUSE MANAGEMENT
# =====================================================================
class SapWarehouseBin(Base):
    __tablename__ = "sap_warehouse_bins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bin_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    warehouse_zone: Mapped[str] = mapped_column(
        String(100), default="ZONE-A", nullable=False
    )
    storage_type: Mapped[str] = mapped_column(
        String(50), default="RACK", nullable=False
    )  # RACK, SHELF, FLOOR_PALLET
    max_weight_capacity_kg: Mapped[float] = mapped_column(Float, default=1000.0, nullable=False)
    current_weight_kg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    current_material_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    current_material_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_stock_qty: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="EMPTY", nullable=False
    )  # EMPTY, OCCUPIED, FULL, LOCKED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapTransferOrder(Base):
    __tablename__ = "sap_transfer_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transfer_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_bin: Mapped[str] = mapped_column(String(50), nullable=False)
    destination_bin: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="PCS", nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="OPEN", nullable=False
    )  # OPEN, CONFIRMED, CANCELLED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 8. SAP ABAP - PROGRAMMING & CUSTOMIZATION WORKBENCH
# =====================================================================
class SapAbapScript(Base):
    __tablename__ = "sap_abap_scripts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    script_name: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    module: Mapped[str] = mapped_column(
        String(20), default="FI", nullable=False
    )  # FI, CO, MM, SD, HCM, PP, WM, TAX
    code: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(100), default="SAP_ADMIN", nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 9. TAX OPTION - TAX SLABS, GST/VAT & TAX LEDGERS
# =====================================================================
class SapTaxRate(Base):
    __tablename__ = "sap_tax_rates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tax_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    tax_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_type: Mapped[str] = mapped_column(
        String(50), default="GST", nullable=False
    )  # GST, IGST, VAT, TDS, CESS
    rate_percentage: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    cgst_rate: Mapped[float] = mapped_column(Float, default=9.0, nullable=False)
    sgst_rate: Mapped[float] = mapped_column(Float, default=9.0, nullable=False)
    igst_rate: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapTaxLedger(Base):
    __tablename__ = "sap_tax_ledgers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transaction_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    source_module: Mapped[str] = mapped_column(
        String(50), default="SD", nullable=False
    )  # FI, SD, MM, SERVICE, RENTAL
    invoice_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    hsn_sac_code: Mapped[str] = mapped_column(String(50), default="9987", nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_rate_pct: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_tax: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    entry_type: Mapped[str] = mapped_column(
        String(50), default="OUTPUT_TAX", nullable=False
    )  # OUTPUT_TAX, INPUT_TAX_CREDIT, TDS_DEDUCTED
    posting_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    party_name: Mapped[str] = mapped_column(String(255), nullable=False)
    party_gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 10. SALES MODULE (CUSTOMERS, ENQUIRIES, POS, INVOICES, DELIVERIES)
# =====================================================================
class SapCustomer(Base):
    __tablename__ = "sap_customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    customer_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    shipping_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), default="Kochi", nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), default="Kerala", nullable=True)
    credit_limit: Mapped[float] = mapped_column(Float, default=500000.0, nullable=False)
    outstanding_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    payment_terms: Mapped[str] = mapped_column(String(50), default="NET_30", nullable=False)
    customer_group: Mapped[str] = mapped_column(String(50), default="COMMERCIAL", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapCustomerEnquiry(Base):
    __tablename__ = "sap_customer_enquiries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    enquiry_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    requirement_details: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="DIRECT_VISIT", nullable=False)
    estimated_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="OPEN", index=True, nullable=False
    )  # OPEN, QUOTED, WON, LOST, CANCELLED
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapInvoice(Base):
    __tablename__ = "sap_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    invoice_type: Mapped[str] = mapped_column(
        String(50), default="CUSTOMER_INVOICE", nullable=False
    )  # CUSTOMER_INVOICE, PROFORMA_INVOICE, CREDIT_MEMO, DEBIT_MEMO
    billing_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    shipping_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_module: Mapped[str] = mapped_column(
        String(50), default="SD", nullable=False
    )  # SD, SERVICES, RENTALS, MANUAL, POS
    source_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_terms: Mapped[str] = mapped_column(
        String(50), default="NET_30", nullable=False
    )  # NET_30, NET_15, IMMEDIATE, ADVANCE, NET_60
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance_due: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="ISSUED", index=True, nullable=False
    )  # DRAFT, ISSUED, PAID, PARTIALLY_PAID, CANCELLED, OVERDUE
    payment_method: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # BANK_TRANSFER, UPI, CASH, CREDIT_CARD, CHEQUE
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    items_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapOutboundDelivery(Base):
    __tablename__ = "sap_outbound_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    delivery_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    sales_order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
    carrier_name: Mapped[str] = mapped_column(String(100), default="BlueDart Express", nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=False)
    shipping_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    estimated_delivery: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    actual_delivery: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="DISPATCHED", index=True, nullable=False
    )  # PICKING, PACKED, DISPATCHED, IN_TRANSIT, DELIVERED, CANCELLED
    total_packages: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_weight_kg: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    driver_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapPosSale(Base):
    __tablename__ = "sap_pos_sales"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bill_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    counter_code: Mapped[str] = mapped_column(String(50), default="COUNTER-01", nullable=False)
    cashier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), default="Walk-in Retail Customer", nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tender_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_returned: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(50), default="CASH", nullable=False)  # CASH, CARD, UPI, SPLIT
    items_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 11. PURCHASE MODULE (SUPPLIERS, PO, GRN, AP BILLS, DEBIT NOTES)
# =====================================================================
class SapVendor(Base):
    __tablename__ = "sap_vendors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    vendor_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), default="Bengaluru", nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), default="Karnataka", nullable=True)
    payment_terms: Mapped[str] = mapped_column(
        String(50), default="NET_30", nullable=False
    )  # NET_30, NET_60, ADVANCE, IMMEDIATE
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=4.5, nullable=False)
    outstanding_payable: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    category: Mapped[str] = mapped_column(
        String(100), default="RAW_MATERIALS", nullable=False
    )  # RAW_MATERIALS, SPARE_PARTS, EQUIPMENT, LOGISTICS, SERVICES
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapPurchaseOrder(Base):
    __tablename__ = "sap_purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    vendor_code: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expected_delivery_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="EA", nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Float, default=18.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_terms: Mapped[str] = mapped_column(String(50), default="NET_30", nullable=False)
    shipping_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approval_status: Mapped[str] = mapped_column(
        String(50), default="APPROVED", nullable=False
    )  # DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
    status: Mapped[str] = mapped_column(
        String(50), default="ORDERED", index=True, nullable=False
    )  # ORDERED, PARTIALLY_RECEIVED, RECEIVED, BILLED, CANCELLED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapGoodsReceipt(Base):
    __tablename__ = "sap_goods_receipts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    grn_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    po_reference: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    received_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity_received: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_accepted: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_rejected: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="EA", nullable=False)
    warehouse_zone: Mapped[str] = mapped_column(String(50), default="ZONE-A", nullable=False)
    storage_bin: Mapped[str] = mapped_column(String(50), default="BIN-A1-01", nullable=False)
    quality_status: Mapped[str] = mapped_column(
        String(50), default="ACCEPTED", nullable=False
    )  # ACCEPTED, REJECTED, INSPECTION
    received_by: Mapped[str] = mapped_column(String(255), nullable=False)
    delivery_challan_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapVendorBill(Base):
    __tablename__ = "sap_vendor_bills"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bill_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    vendor_bill_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    po_reference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    grn_reference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vendor_code: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vendor_gstin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bill_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance_payable: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="UNPAID", nullable=False)  # UNPAID, PARTIALLY_PAID, PAID
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapDebitNote(Base):
    __tablename__ = "sap_debit_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    debit_note_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    original_bill_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor_code: Mapped[str] = mapped_column(String(50), nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    return_reason: Mapped[str] = mapped_column(Text, nullable=False)
    debit_amount: Mapped[float] = mapped_column(Float, nullable=False)
    tax_reversed: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_debit: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ISSUED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 12. INVENTORY MODULE (TRANSFERS, ISSUES, PHYSICAL COUNT, SCRAP, PRICES)
# =====================================================================
class SapStockTransfer(Base):
    __tablename__ = "sap_stock_transfers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transfer_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_godown: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_godown: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="EA", nullable=False)
    transfer_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    authorized_by: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)  # IN_TRANSIT, COMPLETED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapStockMovement(Base):
    __tablename__ = "sap_stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    movement_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 201 (Issue for Cost Center), 261 (Issue for Production Order), 561 (Initial Stock Entry), 101 (GR for PO)
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="EA", nullable=False)
    storage_location: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_order: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapStockTaking(Base):
    __tablename__ = "sap_stock_takings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    count_cycle_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_location: Mapped[str] = mapped_column(String(100), nullable=False)
    system_book_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    physical_counted_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    variance_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    variance_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    counted_by: Mapped[str] = mapped_column(String(255), nullable=False)
    reconciled_status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False)  # PENDING, RECONCILED
    count_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapDamagedItem(Base):
    __tablename__ = "sap_damaged_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    incident_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    damaged_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    uom: Mapped[str] = mapped_column(String(20), default="EA", nullable=False)
    estimated_loss_value: Mapped[float] = mapped_column(Float, nullable=False)
    damage_reason: Mapped[str] = mapped_column(Text, nullable=False)  # TRANSIT_DAMAGE, WATER_LEAK, OBSOLETE, HANDLING
    disposal_action: Mapped[str] = mapped_column(String(50), default="SCRAP_WRITE_OFF", nullable=False)
    approved_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapPriceChange(Base):
    __tablename__ = "sap_price_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    change_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    old_selling_price: Mapped[float] = mapped_column(Float, nullable=False)
    new_selling_price: Mapped[float] = mapped_column(Float, nullable=False)
    effective_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    changed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 13. FINANCE MODULE (VOUCHERS, BRS, DAY BOOK)
# =====================================================================
class SapAccountingVoucher(Base):
    __tablename__ = "sap_accounting_vouchers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    voucher_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    voucher_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # PAYMENT_VOUCHER, RECEIPT_VOUCHER, JOURNAL_VOUCHER, CONTRA_VOUCHER
    voucher_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    debit_ledger: Mapped[str] = mapped_column(String(255), nullable=False)
    credit_ledger: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    narration: Mapped[str] = mapped_column(Text, nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cheque_or_utr_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="POSTED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapBankReconciliation(Base):
    __tablename__ = "sap_bank_reconciliations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    statement_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    bank_account_ledger: Mapped[str] = mapped_column(String(255), nullable=False)
    period_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    balance_as_per_company_books: Mapped[float] = mapped_column(Float, nullable=False)
    balance_as_per_bank_statement: Mapped[float] = mapped_column(Float, nullable=False)
    uncredited_deposits: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unpresented_cheques: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    bank_charges_not_booked: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reconciled_difference: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="RECONCILED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# =====================================================================
# 14. ADMINISTRATION, TEMPLATES & DATA MIGRATION
# =====================================================================
class SapVoucherFormat(Base):
    __tablename__ = "sap_voucher_formats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    format_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    doc_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # TAX_INVOICE, DELIVERY_CHALLAN, POS_RECEIPT, PAYMENT_RECEIPT, PO_FORMAT
    header_title: Mapped[str] = mapped_column(String(255), default="TAX INVOICE", nullable=False)
    footer_terms: Mapped[str] = mapped_column(Text, nullable=False)
    show_gst_breakup: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_qr_code: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    company_pan_display: Mapped[str] = mapped_column(String(50), default="AABCL8291M", nullable=False)
    company_gstin_display: Mapped[str] = mapped_column(String(50), default="29AABCL8291M1Z5", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SapDataMigration(Base):
    __tablename__ = "sap_data_migrations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_code: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False
    )
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # CUSTOMERS, SUPPLIERS, MATERIAL_MASTER, OPENING_BALANCES
    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_success: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    import_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

