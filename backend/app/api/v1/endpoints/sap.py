from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.sap import (
    ProductServiceTicketCreate,
    ProductServiceTicketOut,
    ProductServiceTicketUpdate,
    RentalBookingCreate,
    RentalBookingOut,
    RentalBookingUpdate,
    RentalProductCreate,
    RentalProductOut,
    RentalProductUpdate,
    SapDashboardStats,
    SapSalesOrderCreate,
    SapSalesOrderOut,
    SapSalesOrderUpdate,
    SapGlAccountCreate,
    SapGlAccountOut,
    SapJournalEntryCreate,
    SapJournalEntryOut,
    SapCostCenterCreate,
    SapCostCenterOut,
    SapProfitCenterCreate,
    SapProfitCenterOut,
    SapMaterialMasterCreate,
    SapMaterialMasterOut,
    SapPurchaseRequisitionCreate,
    SapPurchaseRequisitionOut,
    SapQuotationCreate,
    SapQuotationOut,
    SapHcmEmployeeCreate,
    SapHcmEmployeeOut,
    SapProductionOrderCreate,
    SapProductionOrderOut,
    SapBomItemCreate,
    SapBomItemOut,
    SapWarehouseBinCreate,
    SapWarehouseBinOut,
    SapTransferOrderCreate,
    SapTransferOrderOut,
    SapAbapScriptCreate,
    SapAbapScriptOut,
    SapAbapRunRequest,
    SapAbapRunResponse,
    SapTaxRateCreate,
    SapTaxRateOut,
    SapTaxLedgerCreate,
    SapTaxLedgerOut,
    SapTaxSummaryOut,
    SapCustomerCreate,
    SapCustomerUpdate,
    SapCustomerOut,
    SapCustomerEnquiryCreate,
    SapCustomerEnquiryUpdate,
    SapCustomerEnquiryOut,
    SapInvoiceCreate,
    SapInvoiceUpdate,
    SapInvoicePaymentRecord,
    SapInvoiceOut,
    SapOutboundDeliveryCreate,
    SapOutboundDeliveryUpdate,
    SapOutboundDeliveryOut,
    SapPosSaleCreate,
    SapPosSaleOut,
    SapVendorCreate,
    SapVendorUpdate,
    SapVendorOut,
    SapPurchaseOrderCreate,
    SapPurchaseOrderUpdate,
    SapPurchaseOrderOut,
    SapGoodsReceiptCreate,
    SapGoodsReceiptOut,
    SapVendorBillCreate,
    SapVendorBillUpdate,
    SapVendorBillOut,
    SapDebitNoteCreate,
    SapDebitNoteOut,
    SapStockTransferCreate,
    SapStockTransferOut,
    SapStockMovementCreate,
    SapStockMovementOut,
    SapStockTakingCreate,
    SapStockTakingOut,
    SapDamagedItemCreate,
    SapDamagedItemOut,
    SapPriceChangeCreate,
    SapPriceChangeOut,
    SapAccountingVoucherCreate,
    SapAccountingVoucherOut,
    SapBankReconciliationCreate,
    SapBankReconciliationOut,
    SapVoucherFormatCreate,
    SapVoucherFormatOut,
    SapDataMigrationCreate,
    SapDataMigrationOut,
    SapTrialBalanceReport,
    SapProfitLossReport,
    SapBalanceSheetReport,
    SapReceivablesAgeingReport,
    SapSalesRegisterReport,
)
from app.services.sap_service import SapService

router = APIRouter()


class ServiceTicketListResponse(BaseModel):
    items: List[ProductServiceTicketOut]
    total: int


class RentalProductListResponse(BaseModel):
    items: List[RentalProductOut]
    total: int


class CustomerListResponse(BaseModel):
    items: List[SapCustomerOut]
    total: int


class EnquiryListResponse(BaseModel):
    items: List[SapCustomerEnquiryOut]
    total: int


class InvoiceListResponse(BaseModel):
    items: List[SapInvoiceOut]
    total: int


class DeliveryListResponse(BaseModel):
    items: List[SapOutboundDeliveryOut]
    total: int


class PosSaleListResponse(BaseModel):
    items: List[SapPosSaleOut]
    total: int


class VendorListResponse(BaseModel):
    items: List[SapVendorOut]
    total: int


class PurchaseOrderListResponse(BaseModel):
    items: List[SapPurchaseOrderOut]
    total: int


class GoodsReceiptListResponse(BaseModel):
    items: List[SapGoodsReceiptOut]
    total: int


class VendorBillListResponse(BaseModel):
    items: List[SapVendorBillOut]
    total: int


class DebitNoteListResponse(BaseModel):
    items: List[SapDebitNoteOut]
    total: int


class StockTransferListResponse(BaseModel):
    items: List[SapStockTransferOut]
    total: int


class StockMovementListResponse(BaseModel):
    items: List[SapStockMovementOut]
    total: int


class StockTakingListResponse(BaseModel):
    items: List[SapStockTakingOut]
    total: int


class DamagedItemListResponse(BaseModel):
    items: List[SapDamagedItemOut]
    total: int


class PriceChangeListResponse(BaseModel):
    items: List[SapPriceChangeOut]
    total: int


class AccountingVoucherListResponse(BaseModel):
    items: List[SapAccountingVoucherOut]
    total: int


class BankReconciliationListResponse(BaseModel):
    items: List[SapBankReconciliationOut]
    total: int


class RentalBookingListResponse(BaseModel):
    items: List[RentalBookingOut]
    total: int


class SalesOrderListResponse(BaseModel):
    items: List[SapSalesOrderOut]
    total: int


# -------------------------------------------------------------
# SAP DASHBOARD STATS
# -------------------------------------------------------------
@router.get("/dashboard", response_model=SapDashboardStats)
async def get_sap_dashboard_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await SapService.ensure_sap_core_defaults(session)
    return await SapService.get_dashboard_stats(session)


# -------------------------------------------------------------
# PRODUCT SERVICE TICKETS & REPAIRS
# -------------------------------------------------------------
@router.get("/services", response_model=ServiceTicketListResponse)
async def list_service_tickets(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_service_tickets(
        session, search=search, ticket_status=status, service_type=service_type, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/services/{ticket_id}", response_model=ProductServiceTicketOut)
async def get_service_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_service_ticket(session, ticket_id)


@router.post("/services", response_model=ProductServiceTicketOut, status_code=status.HTTP_201_CREATED)
async def create_service_ticket(
    payload: ProductServiceTicketCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_service_ticket(session, payload)


@router.put("/services/{ticket_id}", response_model=ProductServiceTicketOut)
async def update_service_ticket(
    ticket_id: uuid.UUID,
    payload: ProductServiceTicketUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.update_service_ticket(session, ticket_id, payload)


@router.delete("/services/{ticket_id}")
async def delete_service_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await SapService.delete_service_ticket(session, ticket_id)
    return {"message": "Service ticket deleted successfully"}


# -------------------------------------------------------------
# RENTAL PRODUCTS & FLEET
# -------------------------------------------------------------
@router.get("/rentals/products", response_model=RentalProductListResponse)
async def list_rental_products(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_rental_products(
        session, category=category, search=search, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/rentals/products/{product_id}", response_model=RentalProductOut)
async def get_rental_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_rental_product(session, product_id)


@router.post("/rentals/products", response_model=RentalProductOut, status_code=status.HTTP_201_CREATED)
async def create_rental_product(
    payload: RentalProductCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_rental_product(session, payload)


@router.put("/rentals/products/{product_id}", response_model=RentalProductOut)
async def update_rental_product(
    product_id: uuid.UUID,
    payload: RentalProductUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.update_rental_product(session, product_id, payload)


@router.delete("/rentals/products/{product_id}")
async def delete_rental_product(
    product_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await SapService.delete_rental_product(session, product_id)
    return {"message": "Rental product deleted successfully"}


# -------------------------------------------------------------
# RENTAL BOOKINGS
# -------------------------------------------------------------
@router.get("/rentals/bookings", response_model=RentalBookingListResponse)
async def list_rental_bookings(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_rental_bookings(
        session, booking_status=status, search=search, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.post("/rentals/bookings", response_model=RentalBookingOut, status_code=status.HTTP_201_CREATED)
async def create_rental_booking(
    payload: RentalBookingCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_rental_booking(session, payload)


@router.put("/rentals/bookings/{booking_id}", response_model=RentalBookingOut)
async def update_rental_booking(
    booking_id: uuid.UUID,
    payload: RentalBookingUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.update_rental_booking(session, booking_id, payload)


# -------------------------------------------------------------
# SAP SALES ORDERS
# -------------------------------------------------------------
@router.get("/sales", response_model=SalesOrderListResponse)
async def list_sales_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_sales_orders(
        session, order_status=status, search=search, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.post("/sales", response_model=SapSalesOrderOut, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    payload: SapSalesOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_sales_order(session, payload)


@router.put("/sales/{order_id}", response_model=SapSalesOrderOut)
async def update_sales_order(
    order_id: uuid.UUID,
    payload: SapSalesOrderUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.update_sales_order(session, order_id, payload)


# =============================================================
# 1. SAP FI - FINANCIAL ACCOUNTING ENDPOINTS
# =============================================================
@router.get("/fi/gl-accounts", response_model=List[SapGlAccountOut])
async def list_gl_accounts(
    account_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_gl_accounts(session, account_type=account_type, search=search)


@router.post("/fi/gl-accounts", response_model=SapGlAccountOut, status_code=status.HTTP_201_CREATED)
async def create_gl_account(
    payload: SapGlAccountCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_gl_account(session, payload)


@router.get("/fi/journal-entries", response_model=List[SapJournalEntryOut])
async def list_journal_entries(
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_journal_entries(session, search=search, limit=limit)


@router.post("/fi/journal-entries", response_model=SapJournalEntryOut, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    payload: SapJournalEntryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_journal_entry(session, payload)


# =============================================================
# 2. SAP CO - COST & PROFIT MANAGEMENT ENDPOINTS
# =============================================================
@router.get("/co/cost-centers", response_model=List[SapCostCenterOut])
async def list_cost_centers(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_cost_centers(session, search=search)


@router.post("/co/cost-centers", response_model=SapCostCenterOut, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    payload: SapCostCenterCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_cost_center(session, payload)


@router.get("/co/profit-centers", response_model=List[SapProfitCenterOut])
async def list_profit_centers(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_profit_centers(session, search=search)


@router.post("/co/profit-centers", response_model=SapProfitCenterOut, status_code=status.HTTP_201_CREATED)
async def create_profit_center(
    payload: SapProfitCenterCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_profit_center(session, payload)


# =============================================================
# 3. SAP MM - MATERIAL MANAGEMENT ENDPOINTS
# =============================================================
@router.get("/mm/materials", response_model=List[SapMaterialMasterOut])
async def list_materials(
    material_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_materials(session, material_type=material_type, search=search)


@router.post("/mm/materials", response_model=SapMaterialMasterOut, status_code=status.HTTP_201_CREATED)
async def create_material(
    payload: SapMaterialMasterCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_material(session, payload)


@router.get("/mm/purchase-requisitions", response_model=List[SapPurchaseRequisitionOut])
async def list_purchase_requisitions(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_purchase_requisitions(session, status=status)


@router.post("/mm/purchase-requisitions", response_model=SapPurchaseRequisitionOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_requisition(
    payload: SapPurchaseRequisitionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_purchase_requisition(session, payload)


# =============================================================
# 4. SAP SD - SALES & DISTRIBUTION (QUOTATIONS)
# =============================================================
@router.get("/sd/quotations", response_model=List[SapQuotationOut])
async def list_quotations(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_quotations(session, status=status)


@router.post("/sd/quotations", response_model=SapQuotationOut, status_code=status.HTTP_201_CREATED)
async def create_quotation(
    payload: SapQuotationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_quotation(session, payload)


# =============================================================
# 5. SAP HCM - HUMAN RESOURCE MANAGEMENT ENDPOINTS
# =============================================================
@router.get("/hcm/employees", response_model=List[SapHcmEmployeeOut])
async def list_hcm_employees(
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_hcm_employees(session, department=department, search=search)


@router.post("/hcm/employees", response_model=SapHcmEmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_hcm_employee(
    payload: SapHcmEmployeeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_hcm_employee(session, payload)


# =============================================================
# 6. SAP PP - PRODUCTION PLANNING ENDPOINTS
# =============================================================
@router.get("/pp/production-orders", response_model=List[SapProductionOrderOut])
async def list_production_orders(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_production_orders(session, status=status)


@router.post("/pp/production-orders", response_model=SapProductionOrderOut, status_code=status.HTTP_201_CREATED)
async def create_production_order(
    payload: SapProductionOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_production_order(session, payload)


@router.get("/pp/bom-items", response_model=List[SapBomItemOut])
async def list_bom_items(
    bom_code: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_bom_items(session, bom_code=bom_code)


@router.post("/pp/bom-items", response_model=SapBomItemOut, status_code=status.HTTP_201_CREATED)
async def create_bom_item(
    payload: SapBomItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_bom_item(session, payload)


# =============================================================
# 7. SAP WM - WAREHOUSE MANAGEMENT ENDPOINTS
# =============================================================
@router.get("/wm/warehouse-bins", response_model=List[SapWarehouseBinOut])
async def list_warehouse_bins(
    zone: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_warehouse_bins(session, zone=zone, status=status)


@router.post("/wm/warehouse-bins", response_model=SapWarehouseBinOut, status_code=status.HTTP_201_CREATED)
async def create_warehouse_bin(
    payload: SapWarehouseBinCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_warehouse_bin(session, payload)


@router.get("/wm/transfer-orders", response_model=List[SapTransferOrderOut])
async def list_transfer_orders(
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_transfer_orders(session, status=status)


@router.post("/wm/transfer-orders", response_model=SapTransferOrderOut, status_code=status.HTTP_201_CREATED)
async def create_transfer_order(
    payload: SapTransferOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_transfer_order(session, payload)


# =============================================================
# 8. SAP ABAP - PROGRAMMING WORKBENCH ENDPOINTS
# =============================================================
@router.get("/abap/scripts", response_model=List[SapAbapScriptOut])
async def list_abap_scripts(
    module: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_abap_scripts(session, module=module)


@router.post("/abap/scripts", response_model=SapAbapScriptOut, status_code=status.HTTP_201_CREATED)
async def create_abap_script(
    payload: SapAbapScriptCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_abap_script(session, payload)


@router.post("/abap/scripts/{script_id}/run", response_model=SapAbapRunResponse)
async def run_abap_script(
    script_id: uuid.UUID,
    payload: SapAbapRunRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.run_abap_script(session, script_id, payload.parameters)


# =============================================================
# 9. TAX OPTION - TAX SLABS & TAX LEDGER ENDPOINTS
# =============================================================
@router.get("/tax/rates", response_model=List[SapTaxRateOut])
async def list_tax_rates(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_tax_rates(session)


@router.post("/tax/rates", response_model=SapTaxRateOut, status_code=status.HTTP_201_CREATED)
async def create_tax_rate(
    payload: SapTaxRateCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_tax_rate(session, payload)


@router.get("/tax/ledgers", response_model=List[SapTaxLedgerOut])
async def list_tax_ledgers(
    entry_type: Optional[str] = Query(None),
    source_module: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_tax_ledgers(
        session, entry_type=entry_type, source_module=source_module, limit=limit
    )


@router.post("/tax/ledgers", response_model=SapTaxLedgerOut, status_code=status.HTTP_201_CREATED)
async def create_tax_ledger(
    payload: SapTaxLedgerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_tax_ledger(session, payload)


@router.get("/tax/summary", response_model=SapTaxSummaryOut)
async def get_tax_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_tax_summary(session)



# =============================================================
# 10. SALES MODULE (CUSTOMERS, ENQUIRIES, INVOICES, DELIVERIES, POS)
# =============================================================
@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None),
    customer_group: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_customers(
        session, search=search, customer_group=customer_group, is_active=is_active, skip=skip, limit=limit
    )
    return CustomerListResponse(items=items, total=total)


@router.post("/customers", response_model=SapCustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: SapCustomerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_customer(session, payload)


@router.get("/customers/{customer_id}", response_model=SapCustomerOut)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.get_customer(session, customer_id)
    if not item:
        raise HTTPException(status_code=404, detail="Customer not found")
    return item


@router.patch("/customers/{customer_id}", response_model=SapCustomerOut)
async def update_customer(
    customer_id: uuid.UUID,
    payload: SapCustomerUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_customer(session, customer_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Customer not found")
    return item


@router.get("/enquiries", response_model=EnquiryListResponse)
async def list_enquiries(
    search: Optional[str] = Query(None),
    enquiry_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_enquiries(
        session, search=search, enquiry_status=enquiry_status, skip=skip, limit=limit
    )
    return EnquiryListResponse(items=items, total=total)


@router.post("/enquiries", response_model=SapCustomerEnquiryOut, status_code=status.HTTP_201_CREATED)
async def create_enquiry(
    payload: SapCustomerEnquiryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_enquiry(session, payload)


@router.patch("/enquiries/{enquiry_id}", response_model=SapCustomerEnquiryOut)
async def update_enquiry(
    enquiry_id: uuid.UUID,
    payload: SapCustomerEnquiryUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_enquiry(session, enquiry_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return item


@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    search: Optional[str] = Query(None),
    invoice_type: Optional[str] = Query(None),
    invoice_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_invoices(
        session, search=search, invoice_type=invoice_type, invoice_status=invoice_status, skip=skip, limit=limit
    )
    return InvoiceListResponse(items=items, total=total)


@router.post("/invoices", response_model=SapInvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: SapInvoiceCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_invoice(session, payload)


@router.get("/invoices/{invoice_id}", response_model=SapInvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.get_invoice(session, invoice_id)
    if not item:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return item


@router.patch("/invoices/{invoice_id}", response_model=SapInvoiceOut)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: SapInvoiceUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_invoice(session, invoice_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return item


@router.post("/invoices/{invoice_id}/payments", response_model=SapInvoiceOut)
async def record_invoice_payment(
    invoice_id: uuid.UUID,
    payload: SapInvoicePaymentRecord,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.record_invoice_payment(session, invoice_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return item


@router.get("/deliveries", response_model=DeliveryListResponse)
async def list_deliveries(
    search: Optional[str] = Query(None),
    delivery_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_deliveries(
        session, search=search, delivery_status=delivery_status, skip=skip, limit=limit
    )
    return DeliveryListResponse(items=items, total=total)


@router.post("/deliveries", response_model=SapOutboundDeliveryOut, status_code=status.HTTP_201_CREATED)
async def create_delivery(
    payload: SapOutboundDeliveryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_delivery(session, payload)


@router.patch("/deliveries/{delivery_id}", response_model=SapOutboundDeliveryOut)
async def update_delivery(
    delivery_id: uuid.UUID,
    payload: SapOutboundDeliveryUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_delivery(session, delivery_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return item


@router.get("/pos-sales", response_model=PosSaleListResponse)
async def list_pos_sales(
    search: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_pos_sales(
        session, search=search, payment_mode=payment_mode, skip=skip, limit=limit
    )
    return PosSaleListResponse(items=items, total=total)


@router.post("/pos-sales", response_model=SapPosSaleOut, status_code=status.HTTP_201_CREATED)
async def create_pos_sale(
    payload: SapPosSaleCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_pos_sale(session, payload)


# =============================================================
# 11. PURCHASE MODULE (VENDORS, PO, GRN, AP BILLS, DEBIT NOTES)
# =============================================================
@router.get("/vendors", response_model=VendorListResponse)
async def list_vendors(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_vendors(
        session, search=search, category=category, is_active=is_active, skip=skip, limit=limit
    )
    return VendorListResponse(items=items, total=total)


@router.post("/vendors", response_model=SapVendorOut, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: SapVendorCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_vendor(session, payload)


@router.get("/vendors/{vendor_id}", response_model=SapVendorOut)
async def get_vendor(
    vendor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.get_vendor(session, vendor_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return item


@router.patch("/vendors/{vendor_id}", response_model=SapVendorOut)
async def update_vendor(
    vendor_id: uuid.UUID,
    payload: SapVendorUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_vendor(session, vendor_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return item


@router.get("/purchase-orders", response_model=PurchaseOrderListResponse)
async def list_purchase_orders(
    search: Optional[str] = Query(None),
    po_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_purchase_orders(
        session, search=search, po_status=po_status, skip=skip, limit=limit
    )
    return PurchaseOrderListResponse(items=items, total=total)


@router.post("/purchase-orders", response_model=SapPurchaseOrderOut, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: SapPurchaseOrderCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_purchase_order(session, payload)


@router.get("/purchase-orders/{po_id}", response_model=SapPurchaseOrderOut)
async def get_purchase_order(
    po_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.get_purchase_order(session, po_id)
    if not item:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return item


@router.patch("/purchase-orders/{po_id}", response_model=SapPurchaseOrderOut)
async def update_purchase_order(
    po_id: uuid.UUID,
    payload: SapPurchaseOrderUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_purchase_order(session, po_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return item


@router.get("/goods-receipts", response_model=GoodsReceiptListResponse)
async def list_goods_receipts(
    search: Optional[str] = Query(None),
    po_reference: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_goods_receipts(
        session, search=search, po_reference=po_reference, skip=skip, limit=limit
    )
    return GoodsReceiptListResponse(items=items, total=total)


@router.post("/goods-receipts", response_model=SapGoodsReceiptOut, status_code=status.HTTP_201_CREATED)
async def create_goods_receipt(
    payload: SapGoodsReceiptCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_goods_receipt(session, payload)


@router.get("/vendor-bills", response_model=VendorBillListResponse)
async def list_vendor_bills(
    search: Optional[str] = Query(None),
    bill_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_vendor_bills(
        session, search=search, bill_status=bill_status, skip=skip, limit=limit
    )
    return VendorBillListResponse(items=items, total=total)


@router.post("/vendor-bills", response_model=SapVendorBillOut, status_code=status.HTTP_201_CREATED)
async def create_vendor_bill(
    payload: SapVendorBillCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_vendor_bill(session, payload)


@router.patch("/vendor-bills/{bill_id}", response_model=SapVendorBillOut)
async def update_vendor_bill(
    bill_id: uuid.UUID,
    payload: SapVendorBillUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    item = await SapService.update_vendor_bill(session, bill_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Vendor Bill not found")
    return item


@router.get("/debit-notes", response_model=DebitNoteListResponse)
async def list_debit_notes(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_debit_notes(session, search=search, skip=skip, limit=limit)
    return DebitNoteListResponse(items=items, total=total)


@router.post("/debit-notes", response_model=SapDebitNoteOut, status_code=status.HTTP_201_CREATED)
async def create_debit_note(
    payload: SapDebitNoteCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_debit_note(session, payload)


# =============================================================
# 12. INVENTORY MODULE (TRANSFERS, MOVEMENTS, STOCK TAKING, DAMAGED, PRICE)
# =============================================================
@router.get("/stock-transfers", response_model=StockTransferListResponse)
async def list_stock_transfers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_stock_transfers(session, search=search, status=status, skip=skip, limit=limit)
    return StockTransferListResponse(items=items, total=total)


@router.post("/stock-transfers", response_model=SapStockTransferOut, status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(
    payload: SapStockTransferCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_stock_transfer(session, payload)


@router.get("/stock-movements", response_model=StockMovementListResponse)
async def list_stock_movements(
    search: Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_stock_movements(
        session, search=search, movement_type=movement_type, skip=skip, limit=limit
    )
    return StockMovementListResponse(items=items, total=total)


@router.post("/stock-movements", response_model=SapStockMovementOut, status_code=status.HTTP_201_CREATED)
async def create_stock_movement(
    payload: SapStockMovementCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_stock_movement(session, payload)


@router.get("/stock-takings", response_model=StockTakingListResponse)
async def list_stock_takings(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_stock_takings(session, search=search, status=status, skip=skip, limit=limit)
    return StockTakingListResponse(items=items, total=total)


@router.post("/stock-takings", response_model=SapStockTakingOut, status_code=status.HTTP_201_CREATED)
async def create_stock_taking(
    payload: SapStockTakingCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_stock_taking(session, payload)


@router.get("/damaged-items", response_model=DamagedItemListResponse)
async def list_damaged_items(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_damaged_items(session, search=search, skip=skip, limit=limit)
    return DamagedItemListResponse(items=items, total=total)


@router.post("/damaged-items", response_model=SapDamagedItemOut, status_code=status.HTTP_201_CREATED)
async def create_damaged_item(
    payload: SapDamagedItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_damaged_item(session, payload)


@router.get("/price-changes", response_model=PriceChangeListResponse)
async def list_price_changes(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_price_changes(session, search=search, skip=skip, limit=limit)
    return PriceChangeListResponse(items=items, total=total)


@router.post("/price-changes", response_model=SapPriceChangeOut, status_code=status.HTTP_201_CREATED)
async def create_price_change(
    payload: SapPriceChangeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_price_change(session, payload)


# =============================================================
# 13. FINANCE MODULE (VOUCHERS, BRS, STATEMENTS)
# =============================================================
@router.get("/accounting-vouchers", response_model=AccountingVoucherListResponse)
async def list_accounting_vouchers(
    voucher_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_accounting_vouchers(
        session, voucher_type=voucher_type, search=search, skip=skip, limit=limit
    )
    return AccountingVoucherListResponse(items=items, total=total)


@router.post("/accounting-vouchers", response_model=SapAccountingVoucherOut, status_code=status.HTTP_201_CREATED)
async def create_accounting_voucher(
    payload: SapAccountingVoucherCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_accounting_voucher(session, payload)


@router.get("/bank-reconciliations", response_model=BankReconciliationListResponse)
async def list_bank_reconciliations(
    bank_account: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await SapService.list_bank_reconciliations(
        session, bank_account=bank_account, search=search, skip=skip, limit=limit
    )
    return BankReconciliationListResponse(items=items, total=total)


@router.post("/bank-reconciliations", response_model=SapBankReconciliationOut, status_code=status.HTTP_201_CREATED)
async def create_bank_reconciliation(
    payload: SapBankReconciliationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_bank_reconciliation(session, payload)


# =============================================================
# 14. REPORTS & STATEMENTS (TB, P&L, BS, AGEING, SALES REGISTER)
# =============================================================
@router.get("/reports/trial-balance", response_model=SapTrialBalanceReport)
async def get_trial_balance(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_trial_balance_report(session)


@router.get("/reports/profit-loss", response_model=SapProfitLossReport)
async def get_profit_loss(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_profit_loss_report(session)


@router.get("/reports/balance-sheet", response_model=SapBalanceSheetReport)
async def get_balance_sheet(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_balance_sheet_report(session)


@router.get("/reports/receivables-ageing", response_model=SapReceivablesAgeingReport)
async def get_receivables_ageing(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_receivables_ageing_report(session)


@router.get("/reports/sales-register", response_model=SapSalesRegisterReport)
async def get_sales_register(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.get_sales_register_report(session)


# =============================================================
# 15. ADMINISTRATION, FORMATS & DATA MIGRATION
# =============================================================
@router.get("/voucher-formats", response_model=List[SapVoucherFormatOut])
async def list_voucher_formats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_voucher_formats(session)


@router.post("/voucher-formats", response_model=SapVoucherFormatOut, status_code=status.HTTP_201_CREATED)
async def create_voucher_format(
    payload: SapVoucherFormatCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_voucher_format(session, payload)


@router.get("/data-migrations", response_model=List[SapDataMigrationOut])
async def list_data_migrations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.list_data_migrations(session)


@router.post("/data-migrations", response_model=SapDataMigrationOut, status_code=status.HTTP_201_CREATED)
async def create_data_migration(
    payload: SapDataMigrationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await SapService.create_data_migration(session, payload)
