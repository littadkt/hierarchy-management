import os

path = r"frontend/src/lib/types.ts"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Extend SapDashboardStats
old_stats_end = "  tax_rates_count?: number;\n}"
new_stats_end = '''  tax_rates_count?: number;
  invoices_count?: number;
  total_invoiced_revenue?: number;
  pending_invoices_due?: number;
  vendors_count?: number;
  purchase_orders_count?: number;
  goods_receipts_count?: number;
  outbound_deliveries_count?: number;
}'''

text = text.replace(old_stats_end, new_stats_end)

# 2. Add new SAP interfaces after SapTaxSummary
old_tax_summary = '''export interface SapTaxSummary {
  total_output_tax: number;
  total_input_credit: number;
  net_tax_payable: number;
  tax_breakdown_by_rate: Record<string, number>;
}'''

new_interfaces = '''export interface SapTaxSummary {
  total_output_tax: number;
  total_input_credit: number;
  net_tax_payable: number;
  tax_breakdown_by_rate: Record<string, number>;
}

// -------------------------------------------------------------
// 10. SAP SALES & DISTRIBUTION (SD) ENTERPRISE
// -------------------------------------------------------------
export interface SapCustomer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone: string;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  city?: string | null;
  state?: string | null;
  credit_limit: number;
  outstanding_balance: number;
  payment_terms: string;
  customer_group: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SapCustomerEnquiry {
  id: string;
  enquiry_number: string;
  customer_name: string;
  contact_phone: string;
  contact_email?: string | null;
  requirement_details: string;
  source: string;
  estimated_value: number;
  status: string;
  assigned_to?: string | null;
  created_at: string;
}

export interface SapInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  billing_date: string;
  due_date: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_gstin?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  source_module: string;
  source_reference?: string | null;
  payment_terms: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  payment_method?: string | null;
  notes?: string | null;
  items_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapOutboundDelivery {
  id: string;
  delivery_number: string;
  sales_order_number: string;
  customer_name: string;
  shipping_address: string;
  carrier_name: string;
  tracking_number: string;
  shipping_date: string;
  estimated_delivery: string;
  actual_delivery?: string | null;
  status: string;
  total_packages: number;
  total_weight_kg: number;
  driver_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapPosSale {
  id: string;
  bill_number: string;
  counter_code: string;
  cashier_name: string;
  customer_name: string;
  customer_phone?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  tender_amount: number;
  change_returned: number;
  payment_mode: string;
  items_json?: string | null;
  created_at: string;
}

// -------------------------------------------------------------
// 11. SAP MATERIALS MANAGEMENT (MM) & PURCHASING
// -------------------------------------------------------------
export interface SapVendor {
  id: string;
  vendor_code: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  payment_terms: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  ifsc_code?: string | null;
  rating: number;
  outstanding_payable: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SapPurchaseOrder {
  id: string;
  po_number: string;
  vendor_code: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  order_date: string;
  expected_delivery_date: string;
  material_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_terms: string;
  shipping_address?: string | null;
  approval_status: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapGoodsReceipt {
  id: string;
  grn_number: string;
  po_reference: string;
  vendor_name: string;
  received_date: string;
  material_code: string;
  material_name: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  uom: string;
  warehouse_zone: string;
  storage_bin: string;
  quality_status: string;
  received_by: string;
  delivery_challan_number?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface SapVendorBill {
  id: string;
  bill_number: string;
  vendor_bill_ref: string;
  po_reference?: string | null;
  grn_reference?: string | null;
  vendor_code: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  bill_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_payable: number;
  status: string;
  created_at: string;
}

export interface SapDebitNote {
  id: string;
  debit_note_number: string;
  original_bill_ref: string;
  vendor_code: string;
  vendor_name: string;
  return_reason: string;
  debit_amount: number;
  tax_reversed: number;
  total_debit: number;
  status: string;
  created_at: string;
}

// -------------------------------------------------------------
// 12. SAP INVENTORY MODULE
// -------------------------------------------------------------
export interface SapStockTransfer {
  id: string;
  transfer_code: string;
  material_code: string;
  material_name: string;
  source_godown: string;
  destination_godown: string;
  quantity: number;
  uom: string;
  transfer_date: string;
  authorized_by: string;
  status: string;
  created_at: string;
}

export interface SapStockMovement {
  id: string;
  document_number: string;
  movement_type: string;
  material_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  storage_location: string;
  reference_order?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SapStockTaking {
  id: string;
  count_cycle_code: string;
  material_code: string;
  material_name: string;
  storage_location: string;
  system_book_quantity: number;
  physical_counted_quantity: number;
  variance_quantity: number;
  variance_value: number;
  counted_by: string;
  reconciled_status: string;
  count_date: string;
}

export interface SapDamagedItem {
  id: string;
  incident_number: string;
  material_code: string;
  material_name: string;
  damaged_quantity: number;
  uom: string;
  estimated_loss_value: number;
  damage_reason: string;
  disposal_action: string;
  approved_by: string;
  created_at: string;
}

export interface SapPriceChange {
  id: string;
  change_number: string;
  material_code: string;
  material_name: string;
  old_selling_price: number;
  new_selling_price: number;
  effective_date: string;
  reason: string;
  changed_by: string;
  created_at: string;
}

// -------------------------------------------------------------
// 13. SAP FINANCIAL ACCOUNTING (FI) VOUCHERS & BRS
// -------------------------------------------------------------
export interface SapAccountingVoucher {
  id: string;
  voucher_number: string;
  voucher_type: string;
  voucher_date: string;
  debit_ledger: string;
  credit_ledger: string;
  amount: number;
  narration: string;
  reference_number?: string | null;
  cheque_or_utr_number?: string | null;
  status: string;
  created_at: string;
}

export interface SapBankReconciliation {
  id: string;
  statement_number: string;
  bank_account_ledger: string;
  period_date: string;
  balance_as_per_company_books: number;
  balance_as_per_bank_statement: number;
  uncredited_deposits: number;
  unpresented_cheques: number;
  bank_charges_not_booked: number;
  reconciled_difference: number;
  status: string;
  created_at: string;
}

// -------------------------------------------------------------
// 14. SAP ADMINISTRATION, TEMPLATES & DATA MIGRATION
// -------------------------------------------------------------
export interface SapVoucherFormat {
  id: string;
  format_code: string;
  title: string;
  doc_type: string;
  header_title: string;
  footer_terms: string;
  show_gst_breakup: boolean;
  show_qr_code: boolean;
  company_pan_display: string;
  company_gstin_display: string;
  is_default: boolean;
  created_at: string;
}

export interface SapDataMigration {
  id: string;
  batch_code: string;
  entity_type: string;
  total_records: number;
  imported_success: number;
  import_failed: number;
  status: string;
  filename: string;
  uploaded_by: string;
  created_at: string;
}

// -------------------------------------------------------------
// 15. COMPREHENSIVE DRILL-DOWN STATEMENTS & FINANCIAL REPORTS
// -------------------------------------------------------------
export interface TrialBalanceItem {
  account_number: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface SapTrialBalanceReport {
  items: TrialBalanceItem[];
  total_debits: number;
  total_credits: number;
  is_balanced: bool;
}

export interface SapProfitLossReport {
  total_revenue: number;
  sales_revenue: number;
  service_revenue: number;
  rental_revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  operating_expenses: number;
  depreciation: number;
  net_profit: number;
}

export interface SapBalanceSheetReport {
  current_assets: number;
  fixed_assets: number;
  total_assets: number;
  current_liabilities: number;
  long_term_liabilities: number;
  total_liabilities: number;
  equity_retained_earnings: number;
  total_liabilities_and_equity: number;
}

export interface ReceivablesAgeingBucket {
  customer_code: string;
  customer_name: string;
  total_outstanding: number;
  current_0_30_days: number;
  bucket_31_60_days: number;
  bucket_61_90_days: number;
  bucket_90_plus_days: number;
}

export interface SapReceivablesAgeingReport {
  buckets: ReceivablesAgeingBucket[];
  grand_total_outstanding: number;
  total_0_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
}

export interface SalesRegisterEntry {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_gstin?: string | null;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  status: string;
}

export interface SapSalesRegisterReport {
  entries: SalesRegisterEntry[];
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_sales: number;
}
'''

# Note: In TypeScript `bool` should be `boolean`
new_interfaces = new_interfaces.replace("is_balanced: bool;", "is_balanced: boolean;")

text = text.replace(old_tax_summary, new_interfaces)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("types.ts successfully patched!")
