import os

path = r"frontend/src/lib/api.ts"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update imports from ./types
old_import = "  SapTaxSummary,\n"
new_import = '''  SapTaxSummary,
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
  SapTrialBalanceReport,
  SapProfitLossReport,
  SapBalanceSheetReport,
  SapReceivablesAgeingReport,
  SapSalesRegisterReport,
'''

text = text.replace(old_import, new_import)

# 2. Add methods to sapApi before `};\n\n// ==========================================\n// CRM SUITE`
old_sap_end = '''  getTaxSummary: async (): Promise<SapTaxSummary> => {
    const response = await api.get("/sap/tax/summary");
    return response.data;
  },
};'''

new_sap_methods = '''  getTaxSummary: async (): Promise<SapTaxSummary> => {
    const response = await api.get("/sap/tax/summary");
    return response.data;
  },

  // 10. SALES MODULE (CUSTOMERS, ENQUIRIES, INVOICES, DELIVERIES, POS)
  listCustomers: async (params?: { search?: string; customer_group?: string; is_active?: boolean; skip?: number; limit?: number }): Promise<{ items: SapCustomer[]; total: number }> => {
    const response = await api.get("/sap/customers", { params });
    return response.data;
  },
  getCustomer: async (id: string): Promise<SapCustomer> => {
    const response = await api.get(`/sap/customers/${id}`);
    return response.data;
  },
  createCustomer: async (data: Partial<SapCustomer>): Promise<SapCustomer> => {
    const response = await api.post("/sap/customers", data);
    return response.data;
  },
  updateCustomer: async (id: string, data: Partial<SapCustomer>): Promise<SapCustomer> => {
    const response = await api.patch(`/sap/customers/${id}`, data);
    return response.data;
  },

  listEnquiries: async (params?: { search?: string; enquiry_status?: string; skip?: number; limit?: number }): Promise<{ items: SapCustomerEnquiry[]; total: number }> => {
    const response = await api.get("/sap/enquiries", { params });
    return response.data;
  },
  createEnquiry: async (data: Partial<SapCustomerEnquiry>): Promise<SapCustomerEnquiry> => {
    const response = await api.post("/sap/enquiries", data);
    return response.data;
  },
  updateEnquiry: async (id: string, data: Partial<SapCustomerEnquiry>): Promise<SapCustomerEnquiry> => {
    const response = await api.patch(`/sap/enquiries/${id}`, data);
    return response.data;
  },

  listInvoices: async (params?: { search?: string; invoice_type?: string; invoice_status?: string; skip?: number; limit?: number }): Promise<{ items: SapInvoice[]; total: number }> => {
    const response = await api.get("/sap/invoices", { params });
    return response.data;
  },
  getInvoice: async (id: string): Promise<SapInvoice> => {
    const response = await api.get(`/sap/invoices/${id}`);
    return response.data;
  },
  createInvoice: async (data: Partial<SapInvoice>): Promise<SapInvoice> => {
    const response = await api.post("/sap/invoices", data);
    return response.data;
  },
  updateInvoice: async (id: string, data: Partial<SapInvoice>): Promise<SapInvoice> => {
    const response = await api.patch(`/sap/invoices/${id}`, data);
    return response.data;
  },
  recordInvoicePayment: async (id: string, data: { amount_paid: number; payment_method?: string; notes?: string }): Promise<SapInvoice> => {
    const response = await api.post(`/sap/invoices/${id}/payments`, data);
    return response.data;
  },

  listDeliveries: async (params?: { search?: string; delivery_status?: string; skip?: number; limit?: number }): Promise<{ items: SapOutboundDelivery[]; total: number }> => {
    const response = await api.get("/sap/deliveries", { params });
    return response.data;
  },
  createDelivery: async (data: Partial<SapOutboundDelivery>): Promise<SapOutboundDelivery> => {
    const response = await api.post("/sap/deliveries", data);
    return response.data;
  },
  updateDelivery: async (id: string, data: Partial<SapOutboundDelivery>): Promise<SapOutboundDelivery> => {
    const response = await api.patch(`/sap/deliveries/${id}`, data);
    return response.data;
  },

  listPosSales: async (params?: { search?: string; payment_mode?: string; skip?: number; limit?: number }): Promise<{ items: SapPosSale[]; total: number }> => {
    const response = await api.get("/sap/pos-sales", { params });
    return response.data;
  },
  createPosSale: async (data: Partial<SapPosSale>): Promise<SapPosSale> => {
    const response = await api.post("/sap/pos-sales", data);
    return response.data;
  },

  // 11. PURCHASE MODULE (VENDORS, PO, GRN, AP BILLS, DEBIT NOTES)
  listVendors: async (params?: { search?: string; category?: string; is_active?: boolean; skip?: number; limit?: number }): Promise<{ items: SapVendor[]; total: number }> => {
    const response = await api.get("/sap/vendors", { params });
    return response.data;
  },
  getVendor: async (id: string): Promise<SapVendor> => {
    const response = await api.get(`/sap/vendors/${id}`);
    return response.data;
  },
  createVendor: async (data: Partial<SapVendor>): Promise<SapVendor> => {
    const response = await api.post("/sap/vendors", data);
    return response.data;
  },
  updateVendor: async (id: string, data: Partial<SapVendor>): Promise<SapVendor> => {
    const response = await api.patch(`/sap/vendors/${id}`, data);
    return response.data;
  },

  listPurchaseOrders: async (params?: { search?: string; po_status?: string; skip?: number; limit?: number }): Promise<{ items: SapPurchaseOrder[]; total: number }> => {
    const response = await api.get("/sap/purchase-orders", { params });
    return response.data;
  },
  getPurchaseOrder: async (id: string): Promise<SapPurchaseOrder> => {
    const response = await api.get(`/sap/purchase-orders/${id}`);
    return response.data;
  },
  createPurchaseOrder: async (data: Partial<SapPurchaseOrder>): Promise<SapPurchaseOrder> => {
    const response = await api.post("/sap/purchase-orders", data);
    return response.data;
  },
  updatePurchaseOrder: async (id: string, data: Partial<SapPurchaseOrder>): Promise<SapPurchaseOrder> => {
    const response = await api.patch(`/sap/purchase-orders/${id}`, data);
    return response.data;
  },

  listGoodsReceipts: async (params?: { search?: string; po_reference?: string; skip?: number; limit?: number }): Promise<{ items: SapGoodsReceipt[]; total: number }> => {
    const response = await api.get("/sap/goods-receipts", { params });
    return response.data;
  },
  createGoodsReceipt: async (data: Partial<SapGoodsReceipt>): Promise<SapGoodsReceipt> => {
    const response = await api.post("/sap/goods-receipts", data);
    return response.data;
  },

  listVendorBills: async (params?: { search?: string; bill_status?: string; skip?: number; limit?: number }): Promise<{ items: SapVendorBill[]; total: number }> => {
    const response = await api.get("/sap/vendor-bills", { params });
    return response.data;
  },
  createVendorBill: async (data: Partial<SapVendorBill>): Promise<SapVendorBill> => {
    const response = await api.post("/sap/vendor-bills", data);
    return response.data;
  },
  updateVendorBill: async (id: string, data: Partial<SapVendorBill>): Promise<SapVendorBill> => {
    const response = await api.patch(`/sap/vendor-bills/${id}`, data);
    return response.data;
  },

  listDebitNotes: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapDebitNote[]; total: number }> => {
    const response = await api.get("/sap/debit-notes", { params });
    return response.data;
  },
  createDebitNote: async (data: Partial<SapDebitNote>): Promise<SapDebitNote> => {
    const response = await api.post("/sap/debit-notes", data);
    return response.data;
  },

  // 12. INVENTORY MODULE (TRANSFERS, MOVEMENTS, STOCK TAKING, DAMAGED, PRICE)
  listStockTransfers: async (params?: { search?: string; status?: string; skip?: number; limit?: number }): Promise<{ items: SapStockTransfer[]; total: number }> => {
    const response = await api.get("/sap/stock-transfers", { params });
    return response.data;
  },
  createStockTransfer: async (data: Partial<SapStockTransfer>): Promise<SapStockTransfer> => {
    const response = await api.post("/sap/stock-transfers", data);
    return response.data;
  },

  listStockMovements: async (params?: { search?: string; movement_type?: string; skip?: number; limit?: number }): Promise<{ items: SapStockMovement[]; total: number }> => {
    const response = await api.get("/sap/stock-movements", { params });
    return response.data;
  },
  createStockMovement: async (data: Partial<SapStockMovement>): Promise<SapStockMovement> => {
    const response = await api.post("/sap/stock-movements", data);
    return response.data;
  },

  listStockTakings: async (params?: { search?: string; status?: string; skip?: number; limit?: number }): Promise<{ items: SapStockTaking[]; total: number }> => {
    const response = await api.get("/sap/stock-takings", { params });
    return response.data;
  },
  createStockTaking: async (data: Partial<SapStockTaking>): Promise<SapStockTaking> => {
    const response = await api.post("/sap/stock-takings", data);
    return response.data;
  },

  listDamagedItems: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapDamagedItem[]; total: number }> => {
    const response = await api.get("/sap/damaged-items", { params });
    return response.data;
  },
  createDamagedItem: async (data: Partial<SapDamagedItem>): Promise<SapDamagedItem> => {
    const response = await api.post("/sap/damaged-items", data);
    return response.data;
  },

  listPriceChanges: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapPriceChange[]; total: number }> => {
    const response = await api.get("/sap/price-changes", { params });
    return response.data;
  },
  createPriceChange: async (data: Partial<SapPriceChange>): Promise<SapPriceChange> => {
    const response = await api.post("/sap/price-changes", data);
    return response.data;
  },

  // 13. FINANCE MODULE (VOUCHERS, BRS, STATEMENTS)
  listAccountingVouchers: async (params?: { voucher_type?: string; search?: string; skip?: number; limit?: number }): Promise<{ items: SapAccountingVoucher[]; total: number }> => {
    const response = await api.get("/sap/accounting-vouchers", { params });
    return response.data;
  },
  createAccountingVoucher: async (data: Partial<SapAccountingVoucher>): Promise<SapAccountingVoucher> => {
    const response = await api.post("/sap/accounting-vouchers", data);
    return response.data;
  },

  listBankReconciliations: async (params?: { bank_account?: string; search?: string; skip?: number; limit?: number }): Promise<{ items: SapBankReconciliation[]; total: number }> => {
    const response = await api.get("/sap/bank-reconciliations", { params });
    return response.data;
  },
  createBankReconciliation: async (data: Partial<SapBankReconciliation>): Promise<SapBankReconciliation> => {
    const response = await api.post("/sap/bank-reconciliations", data);
    return response.data;
  },

  // 14. FINANCIAL REPORTS
  getTrialBalanceReport: async (): Promise<SapTrialBalanceReport> => {
    const response = await api.get("/sap/reports/trial-balance");
    return response.data;
  },
  getProfitLossReport: async (): Promise<SapProfitLossReport> => {
    const response = await api.get("/sap/reports/profit-loss");
    return response.data;
  },
  getBalanceSheetReport: async (): Promise<SapBalanceSheetReport> => {
    const response = await api.get("/sap/reports/balance-sheet");
    return response.data;
  },
  getReceivablesAgeingReport: async (): Promise<SapReceivablesAgeingReport> => {
    const response = await api.get("/sap/reports/receivables-ageing");
    return response.data;
  },
  getSalesRegisterReport: async (): Promise<SapSalesRegisterReport> => {
    const response = await api.get("/sap/reports/sales-register");
    return response.data;
  },

  // 15. ADMINISTRATION, FORMATS & DATA MIGRATION
  listVoucherFormats: async (): Promise<SapVoucherFormat[]> => {
    const response = await api.get("/sap/voucher-formats");
    return response.data;
  },
  createVoucherFormat: async (data: Partial<SapVoucherFormat>): Promise<SapVoucherFormat> => {
    const response = await api.post("/sap/voucher-formats", data);
    return response.data;
  },
  listDataMigrations: async (): Promise<SapDataMigration[]> => {
    const response = await api.get("/sap/data-migrations");
    return response.data;
  },
  createDataMigration: async (data: Partial<SapDataMigration>): Promise<SapDataMigration> => {
    const response = await api.post("/sap/data-migrations", data);
    return response.data;
  },
};'''

text = text.replace(old_sap_end, new_sap_methods)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("api.ts successfully patched!")
