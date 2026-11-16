import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# -------------------------------------------------------------
# PRODUCT SERVICE & REPAIRS
# -------------------------------------------------------------
class ProductServiceTicketBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    customer_phone: str = Field(..., max_length=50)
    customer_email: Optional[str] = Field(default=None, max_length=255)
    product_name: str = Field(..., max_length=255)
    serial_number: Optional[str] = Field(default=None, max_length=100)
    service_type: str = Field(default="REPAIR")  # REPAIR, MAINTENANCE, INSPECTION, WARRANTY, AMC
    priority: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, URGENT
    status: str = Field(default="RECEIVED")  # RECEIVED, DIAGNOSING, IN_REPAIR, WAITING_PARTS, READY, DELIVERED, CANCELLED
    issue_description: str
    diagnostic_notes: Optional[str] = None
    parts_replaced: Optional[str] = None
    parts_cost: float = Field(default=0.0, ge=0)
    service_charge: float = Field(default=0.0, ge=0)
    total_cost: float = Field(default=0.0, ge=0)
    assigned_technician_name: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None


class ProductServiceTicketCreate(ProductServiceTicketBase):
    ticket_number: Optional[str] = None


class ProductServiceTicketUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    product_name: Optional[str] = None
    serial_number: Optional[str] = None
    service_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    issue_description: Optional[str] = None
    diagnostic_notes: Optional[str] = None
    parts_replaced: Optional[str] = None
    parts_cost: Optional[float] = None
    service_charge: Optional[float] = None
    total_cost: Optional[float] = None
    assigned_technician_name: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None


class ProductServiceTicketOut(ProductServiceTicketBase):
    id: uuid.UUID
    ticket_number: str
    received_date: datetime
    completed_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# RENTAL PRODUCTS & FLEET
# -------------------------------------------------------------
class RentalProductBase(BaseModel):
    product_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    category: str = Field(..., max_length=100)
    daily_rate: float = Field(default=0.0, ge=0)
    weekly_rate: float = Field(default=0.0, ge=0)
    monthly_rate: float = Field(default=0.0, ge=0)
    security_deposit: float = Field(default=0.0, ge=0)
    total_quantity: int = Field(default=1, ge=0)
    available_quantity: int = Field(default=1, ge=0)
    condition_status: str = Field(default="EXCELLENT")  # EXCELLENT, GOOD, MAINTENANCE
    description: Optional[str] = None


class RentalProductCreate(RentalProductBase):
    pass


class RentalProductUpdate(BaseModel):
    product_code: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    security_deposit: Optional[float] = None
    total_quantity: Optional[int] = None
    available_quantity: Optional[int] = None
    condition_status: Optional[str] = None
    description: Optional[str] = None


class RentalProductOut(RentalProductBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# RENTAL BOOKINGS
# -------------------------------------------------------------
class RentalBookingBase(BaseModel):
    rental_product_id: Optional[uuid.UUID] = None
    product_name: str = Field(..., max_length=255)
    customer_name: str = Field(..., max_length=255)
    customer_phone: str = Field(..., max_length=50)
    customer_id_proof: Optional[str] = None
    start_date: datetime
    end_date: datetime
    rate_type: str = Field(default="DAILY")  # DAILY, WEEKLY, MONTHLY
    rental_rate: float = Field(default=0.0, ge=0)
    quantity: int = Field(default=1, ge=1)
    total_amount: float = Field(default=0.0, ge=0)
    security_deposit: float = Field(default=0.0, ge=0)
    deposit_refunded: float = Field(default=0.0, ge=0)
    damage_charges: float = Field(default=0.0, ge=0)
    status: str = Field(default="ACTIVE")  # BOOKED, ACTIVE, RETURNED, OVERDUE, CANCELLED
    notes: Optional[str] = None


class RentalBookingCreate(RentalBookingBase):
    booking_number: Optional[str] = None


class RentalBookingUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_id_proof: Optional[str] = None
    end_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    deposit_refunded: Optional[float] = None
    damage_charges: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class RentalBookingOut(RentalBookingBase):
    id: uuid.UUID
    booking_number: str
    actual_return_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# SAP SALES ORDERS
# -------------------------------------------------------------
class SapSalesOrderBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    total_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    status: str = Field(default="CONFIRMED")
    payment_status: str = Field(default="PENDING")
    items_summary: Optional[str] = None
    notes: Optional[str] = None


class SapSalesOrderCreate(SapSalesOrderBase):
    order_number: Optional[str] = None
    order_date: Optional[datetime] = None


class SapSalesOrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    notes: Optional[str] = None


class SapSalesOrderOut(SapSalesOrderBase):
    id: uuid.UUID
    order_number: str
    order_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# SAP DASHBOARD STATS
# -------------------------------------------------------------
class SapDashboardStats(BaseModel):
    active_service_tickets: int
    completed_services_this_month: int
    service_revenue: float
    total_rental_assets: int
    active_rentals: int
    rental_revenue: float
    open_sales_orders: int
    total_sales_revenue: float
    inventory_items_count: int
    low_stock_alerts_count: int
    gl_accounts_count: int = 0
    total_posted_jv: int = 0
    cost_centers_count: int = 0
    materials_count: int = 0
    open_pr_count: int = 0
    open_quotations_count: int = 0
    hcm_employees_count: int = 0
    open_production_orders: int = 0
    warehouse_bins_count: int = 0
    active_abap_scripts: int = 0
    total_tax_collected: float = 0.0
    total_itc_credit: float = 0.0


# -------------------------------------------------------------
# 1. SAP FI - FINANCIAL ACCOUNTING SCHEMAS
# -------------------------------------------------------------
class SapGlAccountBase(BaseModel):
    account_number: str = Field(..., max_length=50)
    account_name: str = Field(..., max_length=255)
    account_type: str = Field(...)  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    balance: float = Field(default=0.0)
    currency: str = Field(default="INR", max_length=10)
    is_active: bool = Field(default=True)


class SapGlAccountCreate(SapGlAccountBase):
    pass


class SapGlAccountOut(SapGlAccountBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapJournalEntryBase(BaseModel):
    reference: str = Field(..., max_length=100)
    debit_account: str = Field(..., max_length=100)
    credit_account: str = Field(..., max_length=100)
    amount: float = Field(..., gt=0)
    currency: str = Field(default="INR", max_length=10)
    narration: str
    status: str = Field(default="POSTED")
    tax_code: Optional[str] = None
    tax_amount: float = Field(default=0.0, ge=0)


class SapJournalEntryCreate(SapJournalEntryBase):
    entry_number: Optional[str] = None
    posting_date: Optional[datetime] = None


class SapJournalEntryOut(SapJournalEntryBase):
    id: uuid.UUID
    entry_number: str
    posting_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 2. SAP CO - COST & PROFIT MANAGEMENT SCHEMAS
# -------------------------------------------------------------
class SapCostCenterBase(BaseModel):
    center_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    manager_name: str = Field(..., max_length=255)
    department: str = Field(..., max_length=100)
    budget_amount: float = Field(default=0.0, ge=0)
    actual_spent: float = Field(default=0.0, ge=0)
    currency: str = Field(default="INR", max_length=10)
    is_active: bool = Field(default=True)


class SapCostCenterCreate(SapCostCenterBase):
    pass


class SapCostCenterOut(SapCostCenterBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapProfitCenterBase(BaseModel):
    center_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    head_name: str = Field(..., max_length=255)
    target_revenue: float = Field(default=0.0, ge=0)
    actual_revenue: float = Field(default=0.0, ge=0)
    currency: str = Field(default="INR", max_length=10)
    is_active: bool = Field(default=True)


class SapProfitCenterCreate(SapProfitCenterBase):
    pass


class SapProfitCenterOut(SapProfitCenterBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 3. SAP MM - MATERIAL MANAGEMENT SCHEMAS
# -------------------------------------------------------------
class SapMaterialMasterBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    material_type: str = Field(...)  # RAW_MATERIAL, SPARE_PART, FINISHED_GOOD, OPERATING_SUPPLY
    base_uom: str = Field(default="PCS", max_length=20)
    current_stock: float = Field(default=0.0, ge=0)
    safety_stock: float = Field(default=0.0, ge=0)
    unit_price: float = Field(default=0.0, ge=0)
    storage_location: str = Field(default="LOC-CENTRAL", max_length=100)
    valuation_class: str = Field(default="VAL-STD", max_length=50)
    hsn_code: str = Field(default="840999", max_length=50)
    tax_rate: float = Field(default=18.0, ge=0)


class SapMaterialMasterCreate(SapMaterialMasterBase):
    pass


class SapMaterialMasterOut(SapMaterialMasterBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapPurchaseRequisitionBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    quantity: float = Field(default=1.0, gt=0)
    uom: str = Field(default="PCS", max_length=20)
    estimated_cost: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    requested_by: str = Field(..., max_length=255)
    status: str = Field(default="PENDING")
    required_date: Optional[datetime] = None


class SapPurchaseRequisitionCreate(SapPurchaseRequisitionBase):
    pr_number: Optional[str] = None


class SapPurchaseRequisitionOut(SapPurchaseRequisitionBase):
    id: uuid.UUID
    pr_number: str
    required_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 4. SAP SD - SALES & DISTRIBUTION (QUOTATIONS)
# -------------------------------------------------------------
class SapQuotationBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pricing_condition: str = Field(default="STANDARD_COMMERCIAL", max_length=100)
    subtotal: float = Field(default=0.0, ge=0)
    discount_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    total_amount: float = Field(default=0.0, ge=0)
    status: str = Field(default="SENT")
    notes: Optional[str] = None


class SapQuotationCreate(SapQuotationBase):
    quotation_number: Optional[str] = None
    valid_until: Optional[datetime] = None


class SapQuotationOut(SapQuotationBase):
    id: uuid.UUID
    quotation_number: str
    valid_until: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 5. SAP HCM - HUMAN RESOURCE MANAGEMENT
# -------------------------------------------------------------
class SapHcmEmployeeBase(BaseModel):
    personnel_number: str = Field(..., max_length=50)
    full_name: str = Field(..., max_length=255)
    designation: str = Field(..., max_length=100)
    department: str = Field(..., max_length=100)
    employment_type: str = Field(default="PERMANENT", max_length=50)
    basic_salary: float = Field(default=0.0, ge=0)
    hra: float = Field(default=0.0, ge=0)
    special_allowance: float = Field(default=0.0, ge=0)
    tax_deduction_tds: float = Field(default=0.0, ge=0)
    net_salary: float = Field(default=0.0, ge=0)
    status: str = Field(default="ACTIVE")


class SapHcmEmployeeCreate(SapHcmEmployeeBase):
    joining_date: Optional[datetime] = None


class SapHcmEmployeeOut(SapHcmEmployeeBase):
    id: uuid.UUID
    joining_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 6. SAP PP - PRODUCTION PLANNING
# -------------------------------------------------------------
class SapProductionOrderBase(BaseModel):
    product_name: str = Field(..., max_length=255)
    planned_quantity: float = Field(default=1.0, gt=0)
    produced_quantity: float = Field(default=0.0, ge=0)
    uom: str = Field(default="UNITS", max_length=20)
    work_center: str = Field(..., max_length=100)
    status: str = Field(default="RELEASED")
    priority: str = Field(default="MEDIUM", max_length=20)


class SapProductionOrderCreate(SapProductionOrderBase):
    order_number: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SapProductionOrderOut(SapProductionOrderBase):
    id: uuid.UUID
    order_number: str
    start_date: datetime
    end_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapBomItemBase(BaseModel):
    bom_code: str = Field(..., max_length=50)
    parent_product: str = Field(..., max_length=255)
    component_code: str = Field(..., max_length=50)
    component_name: str = Field(..., max_length=255)
    quantity: float = Field(default=1.0, gt=0)
    uom: str = Field(default="PCS", max_length=20)
    scrap_factor_pct: float = Field(default=0.0, ge=0)


class SapBomItemCreate(SapBomItemBase):
    pass


class SapBomItemOut(SapBomItemBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 7. SAP WM - WAREHOUSE MANAGEMENT
# -------------------------------------------------------------
class SapWarehouseBinBase(BaseModel):
    bin_code: str = Field(..., max_length=50)
    warehouse_zone: str = Field(default="ZONE-A", max_length=100)
    storage_type: str = Field(default="RACK", max_length=50)
    max_weight_capacity_kg: float = Field(default=1000.0, ge=0)
    current_weight_kg: float = Field(default=0.0, ge=0)
    current_material_code: Optional[str] = None
    current_material_name: Optional[str] = None
    current_stock_qty: float = Field(default=0.0, ge=0)
    status: str = Field(default="EMPTY")


class SapWarehouseBinCreate(SapWarehouseBinBase):
    pass


class SapWarehouseBinOut(SapWarehouseBinBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapTransferOrderBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    source_bin: str = Field(..., max_length=50)
    destination_bin: str = Field(..., max_length=50)
    quantity: float = Field(default=1.0, gt=0)
    uom: str = Field(default="PCS", max_length=20)
    status: str = Field(default="OPEN")


class SapTransferOrderCreate(SapTransferOrderBase):
    transfer_number: Optional[str] = None


class SapTransferOrderOut(SapTransferOrderBase):
    id: uuid.UUID
    transfer_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 8. SAP ABAP - PROGRAMMING WORKBENCH
# -------------------------------------------------------------
class SapAbapScriptBase(BaseModel):
    script_name: str = Field(..., max_length=100)
    title: str = Field(..., max_length=255)
    module: str = Field(default="FI", max_length=20)
    code: str
    author: str = Field(default="SAP_ADMIN", max_length=100)
    version: str = Field(default="1.0.0", max_length=20)
    is_active: bool = Field(default=True)


class SapAbapScriptCreate(SapAbapScriptBase):
    pass


class SapAbapScriptOut(SapAbapScriptBase):
    id: uuid.UUID
    execution_count: int
    last_run_at: Optional[datetime] = None
    last_output: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapAbapRunRequest(BaseModel):
    parameters: Optional[dict] = None


class SapAbapRunResponse(BaseModel):
    status: str
    execution_time_ms: float
    output_log: str
    result_dataset: list[dict] = []


# -------------------------------------------------------------
# 9. TAX OPTION - TAX SLABS & TAX LEDGER SCHEMAS
# -------------------------------------------------------------
class SapTaxRateBase(BaseModel):
    tax_code: str = Field(..., max_length=50)
    tax_name: str = Field(..., max_length=255)
    tax_type: str = Field(default="GST", max_length=50)
    rate_percentage: float = Field(default=18.0, ge=0)
    cgst_rate: float = Field(default=9.0, ge=0)
    sgst_rate: float = Field(default=9.0, ge=0)
    igst_rate: float = Field(default=18.0, ge=0)
    description: Optional[str] = None
    is_active: bool = Field(default=True)


class SapTaxRateCreate(SapTaxRateBase):
    pass


class SapTaxRateOut(SapTaxRateBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapTaxLedgerBase(BaseModel):
    source_module: str = Field(default="SD", max_length=50)
    invoice_reference: str = Field(..., max_length=100)
    hsn_sac_code: str = Field(default="9987", max_length=50)
    taxable_amount: float = Field(default=0.0, ge=0)
    tax_rate_pct: float = Field(default=18.0, ge=0)
    cgst_amount: float = Field(default=0.0, ge=0)
    sgst_amount: float = Field(default=0.0, ge=0)
    igst_amount: float = Field(default=0.0, ge=0)
    total_tax: float = Field(default=0.0, ge=0)
    entry_type: str = Field(default="OUTPUT_TAX", max_length=50)
    party_name: str = Field(..., max_length=255)
    party_gstin: Optional[str] = None


class SapTaxLedgerCreate(SapTaxLedgerBase):
    transaction_number: Optional[str] = None
    posting_date: Optional[datetime] = None


class SapTaxLedgerOut(SapTaxLedgerBase):
    id: uuid.UUID
    transaction_number: str
    posting_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapTaxSummaryOut(BaseModel):
    total_output_tax: float
    total_input_credit: float
    net_tax_payable: float
    tax_breakdown_by_rate: dict[str, float]


# -------------------------------------------------------------
# 10. SALES MODULE SCHEMAS (CUSTOMERS, ENQUIRIES, INVOICES, POS, DELIVERIES)
# -------------------------------------------------------------
class SapCustomerBase(BaseModel):
    customer_code: str = Field(..., max_length=50)
    company_name: str = Field(..., max_length=255)
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: str = Field(..., max_length=50)
    gstin: Optional[str] = None
    pan: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    city: Optional[str] = "Kochi"
    state: Optional[str] = "Kerala"
    credit_limit: float = Field(default=500000.0, ge=0)
    outstanding_balance: float = Field(default=0.0, ge=0)
    payment_terms: str = Field(default="NET_30", max_length=50)
    customer_group: str = Field(default="COMMERCIAL", max_length=50)
    is_active: bool = Field(default=True)


class SapCustomerCreate(SapCustomerBase):
    pass


class SapCustomerUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    credit_limit: Optional[float] = None
    payment_terms: Optional[str] = None
    is_active: Optional[bool] = None


class SapCustomerOut(SapCustomerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapCustomerEnquiryBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    contact_phone: str = Field(..., max_length=50)
    contact_email: Optional[str] = None
    requirement_details: str = Field(...)
    source: str = Field(default="DIRECT_VISIT")
    estimated_value: float = Field(default=0.0, ge=0)
    status: str = Field(default="OPEN")
    assigned_to: Optional[str] = None


class SapCustomerEnquiryCreate(SapCustomerEnquiryBase):
    enquiry_number: Optional[str] = None


class SapCustomerEnquiryUpdate(BaseModel):
    status: Optional[str] = None
    estimated_value: Optional[float] = None
    assigned_to: Optional[str] = None


class SapCustomerEnquiryOut(SapCustomerEnquiryBase):
    id: uuid.UUID
    enquiry_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapInvoiceBase(BaseModel):
    invoice_type: str = Field(default="CUSTOMER_INVOICE", max_length=50)
    customer_name: str = Field(..., max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_gstin: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    source_module: str = Field(default="SD", max_length=50)
    source_reference: Optional[str] = None
    payment_terms: str = Field(default="NET_30", max_length=50)
    subtotal: float = Field(default=0.0, ge=0)
    discount_amount: float = Field(default=0.0, ge=0)
    taxable_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    cgst_amount: float = Field(default=0.0, ge=0)
    sgst_amount: float = Field(default=0.0, ge=0)
    igst_amount: float = Field(default=0.0, ge=0)
    total_amount: float = Field(default=0.0, ge=0)
    paid_amount: float = Field(default=0.0, ge=0)
    balance_due: float = Field(default=0.0, ge=0)
    status: str = Field(default="ISSUED", max_length=50)
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    items_summary: Optional[str] = None


class SapInvoiceCreate(SapInvoiceBase):
    invoice_number: Optional[str] = None
    billing_date: Optional[datetime] = None
    due_date: Optional[datetime] = None


class SapInvoiceUpdate(BaseModel):
    status: Optional[str] = None
    paid_amount: Optional[float] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class SapInvoicePaymentRecord(BaseModel):
    amount_paid: float = Field(..., gt=0)
    payment_method: str = Field(default="BANK_TRANSFER")
    notes: Optional[str] = None


class SapInvoiceOut(SapInvoiceBase):
    id: uuid.UUID
    invoice_number: str
    billing_date: datetime
    due_date: datetime
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapOutboundDeliveryBase(BaseModel):
    sales_order_number: str = Field(..., max_length=50)
    customer_name: str = Field(..., max_length=255)
    shipping_address: str = Field(...)
    carrier_name: str = Field(default="BlueDart Express", max_length=100)
    tracking_number: str = Field(..., max_length=100)
    status: str = Field(default="DISPATCHED", max_length=50)
    total_packages: int = Field(default=1, ge=1)
    total_weight_kg: float = Field(default=10.0, ge=0)
    driver_phone: Optional[str] = None


class SapOutboundDeliveryCreate(SapOutboundDeliveryBase):
    delivery_number: Optional[str] = None
    shipping_date: Optional[datetime] = None
    estimated_delivery: Optional[datetime] = None


class SapOutboundDeliveryUpdate(BaseModel):
    status: Optional[str] = None
    carrier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    actual_delivery: Optional[datetime] = None


class SapOutboundDeliveryOut(SapOutboundDeliveryBase):
    id: uuid.UUID
    delivery_number: str
    shipping_date: datetime
    estimated_delivery: datetime
    actual_delivery: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapPosSaleBase(BaseModel):
    counter_code: str = Field(default="COUNTER-01", max_length=50)
    cashier_name: str = Field(..., max_length=255)
    customer_name: str = Field(default="Walk-in Retail Customer", max_length=255)
    customer_phone: Optional[str] = None
    subtotal: float = Field(default=0.0, ge=0)
    discount_amount: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    tender_amount: float = Field(..., ge=0)
    change_returned: float = Field(default=0.0, ge=0)
    payment_mode: str = Field(default="CASH", max_length=50)
    items_json: Optional[str] = None


class SapPosSaleCreate(SapPosSaleBase):
    bill_number: Optional[str] = None


class SapPosSaleOut(SapPosSaleBase):
    id: uuid.UUID
    bill_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 11. PURCHASE MODULE SCHEMAS (SUPPLIERS, PO, GRN, AP BILLS, DEBIT NOTES)
# -------------------------------------------------------------
class SapVendorBase(BaseModel):
    vendor_code: str = Field(..., max_length=50)
    company_name: str = Field(..., max_length=255)
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: str = Field(..., max_length=50)
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Bengaluru"
    state: Optional[str] = "Karnataka"
    payment_terms: str = Field(default="NET_30", max_length=50)
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    rating: float = Field(default=4.5, ge=0, le=5)
    outstanding_payable: float = Field(default=0.0, ge=0)
    category: str = Field(default="RAW_MATERIALS", max_length=100)
    is_active: bool = Field(default=True)


class SapVendorCreate(SapVendorBase):
    pass


class SapVendorUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    payment_terms: Optional[str] = None
    rating: Optional[float] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class SapVendorOut(SapVendorBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapPurchaseOrderBase(BaseModel):
    vendor_code: str = Field(..., max_length=50)
    vendor_name: str = Field(..., max_length=255)
    vendor_gstin: Optional[str] = None
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    quantity: float = Field(..., gt=0)
    uom: str = Field(default="EA", max_length=20)
    unit_price: float = Field(..., ge=0)
    subtotal: float = Field(..., ge=0)
    tax_rate: float = Field(default=18.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    payment_terms: str = Field(default="NET_30", max_length=50)
    shipping_address: Optional[str] = None
    approval_status: str = Field(default="APPROVED", max_length=50)
    status: str = Field(default="ORDERED", max_length=50)
    notes: Optional[str] = None


class SapPurchaseOrderCreate(SapPurchaseOrderBase):
    po_number: Optional[str] = None
    order_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None


class SapPurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    approval_status: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None


class SapPurchaseOrderOut(SapPurchaseOrderBase):
    id: uuid.UUID
    po_number: str
    order_date: datetime
    expected_delivery_date: datetime
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapGoodsReceiptBase(BaseModel):
    po_reference: str = Field(..., max_length=50)
    vendor_name: str = Field(..., max_length=255)
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    quantity_received: float = Field(..., gt=0)
    quantity_accepted: float = Field(..., ge=0)
    quantity_rejected: float = Field(default=0.0, ge=0)
    uom: str = Field(default="EA", max_length=20)
    warehouse_zone: str = Field(default="ZONE-A", max_length=50)
    storage_bin: str = Field(default="BIN-A1-01", max_length=50)
    quality_status: str = Field(default="ACCEPTED", max_length=50)
    received_by: str = Field(..., max_length=255)
    delivery_challan_number: Optional[str] = None
    remarks: Optional[str] = None


class SapGoodsReceiptCreate(SapGoodsReceiptBase):
    grn_number: Optional[str] = None
    received_date: Optional[datetime] = None


class SapGoodsReceiptOut(SapGoodsReceiptBase):
    id: uuid.UUID
    grn_number: str
    received_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapVendorBillBase(BaseModel):
    vendor_bill_ref: str = Field(..., max_length=100)
    po_reference: Optional[str] = None
    grn_reference: Optional[str] = None
    vendor_code: str = Field(..., max_length=50)
    vendor_name: str = Field(..., max_length=255)
    vendor_gstin: Optional[str] = None
    subtotal: float = Field(default=0.0, ge=0)
    tax_amount: float = Field(default=0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    paid_amount: float = Field(default=0.0, ge=0)
    balance_payable: float = Field(default=0.0, ge=0)
    status: str = Field(default="UNPAID", max_length=50)


class SapVendorBillCreate(SapVendorBillBase):
    bill_number: Optional[str] = None
    bill_date: Optional[datetime] = None
    due_date: Optional[datetime] = None


class SapVendorBillUpdate(BaseModel):
    status: Optional[str] = None
    paid_amount: Optional[float] = None


class SapVendorBillOut(SapVendorBillBase):
    id: uuid.UUID
    bill_number: str
    bill_date: datetime
    due_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapDebitNoteBase(BaseModel):
    original_bill_ref: str = Field(..., max_length=100)
    vendor_code: str = Field(..., max_length=50)
    vendor_name: str = Field(..., max_length=255)
    return_reason: str = Field(...)
    debit_amount: float = Field(..., ge=0)
    tax_reversed: float = Field(default=0.0, ge=0)
    total_debit: float = Field(..., ge=0)
    status: str = Field(default="ISSUED", max_length=50)


class SapDebitNoteCreate(SapDebitNoteBase):
    debit_note_number: Optional[str] = None


class SapDebitNoteOut(SapDebitNoteBase):
    id: uuid.UUID
    debit_note_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 12. INVENTORY MODULE SCHEMAS (TRANSFERS, ISSUES, PHYSICAL COUNT, SCRAP, PRICES)
# -------------------------------------------------------------
class SapStockTransferBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    source_godown: str = Field(..., max_length=100)
    destination_godown: str = Field(..., max_length=100)
    quantity: float = Field(..., gt=0)
    uom: str = Field(default="EA", max_length=20)
    authorized_by: str = Field(..., max_length=255)
    status: str = Field(default="COMPLETED", max_length=50)


class SapStockTransferCreate(SapStockTransferBase):
    transfer_code: Optional[str] = None
    transfer_date: Optional[datetime] = None


class SapStockTransferOut(SapStockTransferBase):
    id: uuid.UUID
    transfer_code: str
    transfer_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapStockMovementBase(BaseModel):
    movement_type: str = Field(..., max_length=20)  # 201, 261, 561, 101
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    quantity: float = Field(..., gt=0)
    uom: str = Field(default="EA", max_length=20)
    storage_location: str = Field(..., max_length=100)
    reference_order: Optional[str] = None
    notes: Optional[str] = None


class SapStockMovementCreate(SapStockMovementBase):
    document_number: Optional[str] = None


class SapStockMovementOut(SapStockMovementBase):
    id: uuid.UUID
    document_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapStockTakingBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    storage_location: str = Field(..., max_length=100)
    system_book_quantity: float = Field(default=0.0)
    physical_counted_quantity: float = Field(..., ge=0)
    counted_by: str = Field(..., max_length=255)
    reconciled_status: str = Field(default="PENDING", max_length=50)


class SapStockTakingCreate(SapStockTakingBase):
    count_cycle_code: Optional[str] = None
    variance_quantity: Optional[float] = None
    variance_value: Optional[float] = None


class SapStockTakingOut(SapStockTakingBase):
    id: uuid.UUID
    count_cycle_code: str
    variance_quantity: float
    variance_value: float
    count_date: datetime
    model_config = ConfigDict(from_attributes=True)


class SapDamagedItemBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    damaged_quantity: float = Field(..., gt=0)
    uom: str = Field(default="EA", max_length=20)
    estimated_loss_value: float = Field(..., ge=0)
    damage_reason: str = Field(...)
    disposal_action: str = Field(default="SCRAP_WRITE_OFF", max_length=50)
    approved_by: str = Field(..., max_length=255)


class SapDamagedItemCreate(SapDamagedItemBase):
    incident_number: Optional[str] = None


class SapDamagedItemOut(SapDamagedItemBase):
    id: uuid.UUID
    incident_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapPriceChangeBase(BaseModel):
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=255)
    old_selling_price: float = Field(..., ge=0)
    new_selling_price: float = Field(..., ge=0)
    effective_date: datetime
    reason: str = Field(..., max_length=255)
    changed_by: str = Field(..., max_length=255)


class SapPriceChangeCreate(SapPriceChangeBase):
    change_number: Optional[str] = None


class SapPriceChangeOut(SapPriceChangeBase):
    id: uuid.UUID
    change_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 13. FINANCE MODULE SCHEMAS (ACCOUNTING VOUCHERS, BRS, STATEMENTS)
# -------------------------------------------------------------
class SapAccountingVoucherBase(BaseModel):
    voucher_type: str = Field(..., max_length=50)  # PAYMENT_VOUCHER, RECEIPT_VOUCHER, JOURNAL_VOUCHER, CONTRA_VOUCHER
    debit_ledger: str = Field(..., max_length=255)
    credit_ledger: str = Field(..., max_length=255)
    amount: float = Field(..., gt=0)
    narration: str = Field(...)
    reference_number: Optional[str] = None
    cheque_or_utr_number: Optional[str] = None
    status: str = Field(default="POSTED", max_length=50)


class SapAccountingVoucherCreate(SapAccountingVoucherBase):
    voucher_number: Optional[str] = None
    voucher_date: Optional[datetime] = None


class SapAccountingVoucherOut(SapAccountingVoucherBase):
    id: uuid.UUID
    voucher_number: str
    voucher_date: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapBankReconciliationBase(BaseModel):
    bank_account_ledger: str = Field(..., max_length=255)
    period_date: datetime
    balance_as_per_company_books: float = Field(...)
    balance_as_per_bank_statement: float = Field(...)
    uncredited_deposits: float = Field(default=0.0, ge=0)
    unpresented_cheques: float = Field(default=0.0, ge=0)
    bank_charges_not_booked: float = Field(default=0.0, ge=0)
    reconciled_difference: float = Field(default=0.0)
    status: str = Field(default="RECONCILED", max_length=50)


class SapBankReconciliationCreate(SapBankReconciliationBase):
    statement_number: Optional[str] = None


class SapBankReconciliationOut(SapBankReconciliationBase):
    id: uuid.UUID
    statement_number: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 14. ADMIN, FORMATS & DATA MIGRATION SCHEMAS
# -------------------------------------------------------------
class SapVoucherFormatBase(BaseModel):
    format_code: str = Field(..., max_length=50)
    title: str = Field(..., max_length=255)
    doc_type: str = Field(..., max_length=50)
    header_title: str = Field(default="TAX INVOICE", max_length=255)
    footer_terms: str = Field(...)
    show_gst_breakup: bool = Field(default=True)
    show_qr_code: bool = Field(default=True)
    company_pan_display: str = Field(default="AABCL8291M", max_length=50)
    company_gstin_display: str = Field(default="29AABCL8291M1Z5", max_length=50)
    is_default: bool = Field(default=True)


class SapVoucherFormatCreate(SapVoucherFormatBase):
    pass


class SapVoucherFormatOut(SapVoucherFormatBase):
    id: uuid.UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SapDataMigrationBase(BaseModel):
    batch_code: Optional[str] = None
    entity_type: str = Field(...)  # CUSTOMERS, SUPPLIERS, MATERIAL_MASTER, OPENING_BALANCES
    total_records: int = Field(default=0, ge=0)
    imported_success: int = Field(default=0, ge=0)
    import_failed: int = Field(default=0, ge=0)
    status: str = Field(default="COMPLETED", max_length=50)
    filename: str = Field(..., max_length=255)
    uploaded_by: str = Field(..., max_length=255)


class SapDataMigrationCreate(SapDataMigrationBase):
    pass


class SapDataMigrationOut(SapDataMigrationBase):
    id: uuid.UUID
    batch_code: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# 15. COMPREHENSIVE DRILL-DOWN STATEMENTS & FINANCIAL REPORTS
# -------------------------------------------------------------
class TrialBalanceItem(BaseModel):
    account_number: str
    account_name: str
    account_type: str
    debit_balance: float = 0.0
    credit_balance: float = 0.0


class SapTrialBalanceReport(BaseModel):
    items: List[TrialBalanceItem]
    total_debits: float
    total_credits: float
    is_balanced: bool


class SapProfitLossReport(BaseModel):
    total_revenue: float
    sales_revenue: float
    service_revenue: float
    rental_revenue: float
    cost_of_goods_sold: float
    gross_profit: float
    operating_expenses: float
    depreciation: float
    net_profit: float


class SapBalanceSheetReport(BaseModel):
    current_assets: float
    fixed_assets: float
    total_assets: float
    current_liabilities: float
    long_term_liabilities: float
    total_liabilities: float
    equity_retained_earnings: float
    total_liabilities_and_equity: float


class ReceivablesAgeingBucket(BaseModel):
    customer_code: str
    customer_name: str
    total_outstanding: float
    current_0_30_days: float
    bucket_31_60_days: float
    bucket_61_90_days: float
    bucket_90_plus_days: float


class SapReceivablesAgeingReport(BaseModel):
    buckets: List[ReceivablesAgeingBucket]
    grand_total_outstanding: float
    total_0_30: float
    total_31_60: float
    total_61_90: float
    total_90_plus: float


class SalesRegisterEntry(BaseModel):
    invoice_number: str
    date: datetime
    customer_name: str
    customer_gstin: Optional[str]
    taxable_amount: float
    cgst: float
    sgst: float
    igst: float
    total_amount: float
    status: str


class SapSalesRegisterReport(BaseModel):
    entries: List[SalesRegisterEntry]
    total_taxable: float
    total_cgst: float
    total_sgst: float
    total_igst: float
    total_sales: float


