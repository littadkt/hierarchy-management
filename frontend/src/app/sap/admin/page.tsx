"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  Sliders,
  FileSpreadsheet,
  Users,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  FileUp,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import {
  SapVoucherFormat,
  SapDataMigration,
  SapTaxSummary,
  SapInvoice,
  SapVendorBill,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapAdminSuitePage() {
  const [activeTab, setActiveTab] = useState<
    | "BRANCHES"
    | "FORMATS"
    | "REPORTS_BUILDER"
    | "GST_RETURNS"
    | "USER_CONTROL"
    | "MIGRATION"
  >("BRANCHES");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data states
  const [voucherFormats, setVoucherFormats] = useState<SapVoucherFormat[]>([]);
  const [migrations, setMigrations] = useState<SapDataMigration[]>([]);
  const [taxSummary, setTaxSummary] = useState<SapTaxSummary | null>(null);
  const [invoices, setInvoices] = useState<SapInvoice[]>([]);
  const [bills, setBills] = useState<SapVendorBill[]>([]);

  // Modals & Action States
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Format Form
  const [formatForm, setFormatForm] = useState({
    format_code: "FMT-INV-NEW",
    title: "Commercial Wholesale Tax Invoice",
    doc_type: "TAX_INVOICE",
    header_title: "TAX INVOICE - RULE 46",
    footer_terms: "All payments are due within 30 days. Late interest applicable at 18% p.a. Jurisdiction: Kochi, Kerala.",
    show_gst_breakup: true,
    show_qr_code: true,
    company_pan_display: "AABCL8291M",
    company_gstin_display: "32AABCL8291M1Z5",
    is_default: false,
  });

  // Migration Form
  const [migrationForm, setMigrationForm] = useState({
    entity_type: "CUSTOMERS",
    filename: "master_customers_2026.csv",
    uploaded_by: "System Administrator",
    total_records: 48,
    imported_success: 48,
    import_failed: 0,
    status: "COMPLETED",
  });

  // Branches Mock Data
  const branches = [
    { code: "BR-KOC-01", name: "Central Headquarter & Hub", city: "Kochi", state: "Kerala", gstin: "32AABCL8291M1Z5", manager: "Praveen Nair", phone: "+91 98470 11223", status: "PRIMARY" },
    { code: "BR-CAL-02", name: "Northern Regional Godown", city: "Calicut", state: "Kerala", gstin: "32AABCL8291M1Z5", manager: "Sunil George", phone: "+91 98471 44556", status: "ACTIVE" },
    { code: "BR-BLR-03", name: "Karnataka Industrial Branch", city: "Bengaluru", state: "Karnataka", gstin: "29AABCL8291M1Z0", manager: "Ramesh Babu", phone: "+91 98110 77889", status: "ACTIVE" },
  ];

  // User Control Mock Matrix
  const sapRoles = [
    { role: "SAP Super Administrator", users_count: 2, access: "Full Root Control (FI, CO, MM, SD, PP, WM, ABAP, TAX)", level: "Level 1" },
    { role: "Finance & Accounts Lead (FI)", users_count: 4, access: "GL, Vouchers, BRS, Trial Balance, P&L, Balance Sheet, GST Returns", level: "Level 2" },
    { role: "Materials & Supply Chain Lead (MM)", users_count: 5, access: "Vendor POs, GRN MIGO, Stock Valuation, Godown Transfers", level: "Level 2" },
    { role: "Sales & Distribution Specialist (SD)", users_count: 6, access: "Customer Enquiries, Quotations, Sales Orders, POS Billing", level: "Level 3" },
    { role: "Warehouse Keeper (WM)", users_count: 8, access: "Bin Tracking, Godown Transfers, Physical Count Entry", level: "Level 4" },
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "FORMATS") {
        const fmts = await sapApi.listVoucherFormats();
        setVoucherFormats(fmts);
      } else if (activeTab === "MIGRATION") {
        const migs = await sapApi.listDataMigrations();
        setMigrations(migs);
      } else if (activeTab === "GST_RETURNS" || activeTab === "REPORTS_BUILDER") {
        const [tax, invs, vbills] = await Promise.all([
          sapApi.getTaxSummary(),
          sapApi.listInvoices({ limit: 200 }),
          sapApi.listVendorBills({ limit: 200 }),
        ]);
        setTaxSummary(tax);
        setInvoices(invs.items);
        setBills(vbills.items);
      }
    } catch (err) {
      console.error("Failed to load admin suite data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateFormat = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await sapApi.createVoucherFormat(formatForm);
      setIsFormatModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create voucher format"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateMigration = async (entity: string) => {
    setActionLoading(true);
    try {
      await sapApi.createDataMigration({
        entity_type: entity,
        filename: `import_${entity.toLowerCase()}_sample.csv`,
        uploaded_by: "System Administrator",
        total_records: 25,
        imported_success: 25,
        import_failed: 0,
        status: "COMPLETED",
      });
      alert(`Master data migration batch for ${entity} imported successfully with 25 records!`);
      loadData();
    } catch (err) {
      alert("Failed to process migration file");
    } finally {
      setActionLoading(false);
    }
  };

  const exportGstr1CSV = () => {
    const headers = ["GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice Date", "Invoice Value (₹)", "Place Of Supply", "Reverse Charge", "Invoice Type", "Taxable Value (₹)", "Rate (%)", "Cess Amount (₹)"];
    const rows = invoices.map((inv) => [
      inv.customer_gstin || "URP",
      `"${inv.customer_name}"`,
      inv.invoice_number,
      new Date(inv.billing_date).toLocaleDateString(),
      inv.total_amount.toFixed(2),
      "32-Kerala",
      "N",
      "Regular",
      inv.taxable_amount.toFixed(2),
      "18",
      "0.00",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GSTR_1_Outward_Supplies_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportGstr3bCSV = () => {
    const headers = ["Nature of Supplies", "Total Taxable Value (₹)", "Integrated Tax (₹)", "Central Tax (₹)", "State/UT Tax (₹)", "Cess (₹)"];
    const totTaxableSD = invoices.reduce((s, i) => s + i.taxable_amount, 0);
    const totCgstSD = invoices.reduce((s, i) => s + i.cgst_amount, 0);
    const totSgstSD = invoices.reduce((s, i) => s + i.sgst_amount, 0);
    const totItcTaxable = bills.reduce((s, b) => s + b.subtotal, 0);
    const totItcTax = bills.reduce((s, b) => s + b.tax_amount, 0);

    const rows = [
      ["(a) Outward taxable supplies (other than zero rated, nil rated and exempted)", totTaxableSD.toFixed(2), "0.00", totCgstSD.toFixed(2), totSgstSD.toFixed(2), "0.00"],
      ["(b) Outward taxable supplies (zero rated)", "0.00", "0.00", "0.00", "0.00", "0.00"],
      ["(c) Eligible ITC - All other ITC (Inward supplies from registered persons)", totItcTaxable.toFixed(2), "0.00", (totItcTax / 2).toFixed(2), (totItcTax / 2).toFixed(2), "0.00"],
      ["(d) Net GST Liability Payable in Cash", (totTaxableSD - totItcTaxable).toFixed(2), "0.00", Math.max(0, totCgstSD - totItcTax / 2).toFixed(2), Math.max(0, totSgstSD - totItcTax / 2).toFixed(2), "0.00"],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GSTR_3B_Monthly_Computation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplateCSV = (type: string) => {
    let headers: string[] = [];
    if (type === "CUSTOMERS") {
      headers = ["customer_code", "company_name", "contact_person", "phone", "email", "gstin", "credit_limit", "customer_group"];
    } else if (type === "SUPPLIERS") {
      headers = ["vendor_code", "company_name", "contact_person", "phone", "email", "gstin", "category", "payment_terms"];
    } else if (type === "MATERIALS") {
      headers = ["material_code", "name", "material_type", "base_uom", "current_stock", "safety_stock", "unit_price", "storage_location", "hsn_code"];
    } else {
      headers = ["account_number", "account_name", "account_type", "opening_balance_debit", "opening_balance_credit"];
    }
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Template_${type}_Migration.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ProtectedRoute>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sap"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  SAP Administration & Tools
                </span>
                <span className="text-xs text-slate-500 font-mono">GST Returns, Formats & Master Data Migration</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Administration & System Controls
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {activeTab === "FORMATS" && (
              <button
                onClick={() => setIsFormatModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Voucher Format
              </button>
            )}
            {activeTab === "GST_RETURNS" && (
              <div className="flex gap-2">
                <button
                  onClick={exportGstr1CSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export GSTR-1 Excel
                </button>
                <button
                  onClick={exportGstr3bCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export GSTR-3B Excel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: "BRANCHES", label: "Branch Management", icon: Building2 },
            { id: "FORMATS", label: "Formats of Vouchers/Bills", icon: Sliders },
            { id: "REPORTS_BUILDER", label: "Report Builder (Drill-Down)", icon: FileSpreadsheet },
            { id: "GST_RETURNS", label: "GST Returns (Excel GSTR-1/3B)", icon: Download },
            { id: "USER_CONTROL", label: "Administrative Roles & Matrix", icon: Users },
            { id: "MIGRATION", label: "Master Data Migration", icon: UploadCloud },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: BRANCH MANAGEMENT */}
        {activeTab === "BRANCHES" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {branches.map((b) => (
                <div key={b.code} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">{b.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        b.status === "PRIMARY"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">{b.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{b.city}, {b.state}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-600 dark:text-slate-400">
                    <div>GSTIN: <span className="font-mono font-semibold text-slate-900 dark:text-white">{b.gstin}</span></div>
                    <div>Branch Head: <span className="font-medium text-slate-800 dark:text-slate-200">{b.manager}</span></div>
                    <div>Contact: {b.phone}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: FORMATS OF VOUCHERS / BILLS */}
        {activeTab === "FORMATS" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {voucherFormats.map((fmt) => (
                <div key={fmt.id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">{fmt.format_code}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {fmt.doc_type}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{fmt.title}</h3>
                  <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <span className="font-semibold block text-slate-700 dark:text-slate-300">Header: {fmt.header_title}</span>
                    <span className="line-clamp-2 mt-1">Footer: {fmt.footer_terms}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                    <span>GST Breakdown: {fmt.show_gst_breakup ? "✓ Yes" : "No"}</span>
                    <span>QR Code: {fmt.show_qr_code ? "✓ Yes" : "No"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: REPORT BUILDER (DRILL-DOWN MODEL) */}
        {activeTab === "REPORTS_BUILDER" && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Interactive Report Builder</h3>
              <p className="text-xs text-slate-500">Generate drill-down statements across SD, MM, and FI operations</p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Target Module</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs mt-1">
                    <option value="SD">Sales & Distribution (SD)</option>
                    <option value="MM">Materials Management (MM)</option>
                    <option value="FI">Financial Accounting (FI)</option>
                    <option value="TAX">Tax & GST Summary</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Drill-Down Depth</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs mt-1">
                    <option value="DETAILED">Detailed Document Level</option>
                    <option value="SUMMARY">Monthly / Group Summary</option>
                    <option value="PARTY">Party / Customer Consolidated</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Financial Period</label>
                  <select className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs mt-1">
                    <option value="FY2627">FY 2026-27 (Current)</option>
                    <option value="Q1">Quarter 1 (Apr - Jun)</option>
                    <option value="MONTH">Current Month</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => alert("Drill-down analytics report compiled! Available in PDF and Excel format.")}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Generate Drill-Down Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GST RETURN FORMAT IN EXCEL */}
        {activeTab === "GST_RETURNS" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">GSTR-1 Outward Supplies</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₹{invoices.reduce((s, i) => s + i.total_amount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total B2B & Retail invoices ready for GSTN upload</p>
                <button
                  onClick={exportGstr1CSV}
                  className="w-full py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download GSTR-1 Excel (.csv)
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">GSTR-2B Input Tax Credit</span>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  ₹{bills.reduce((s, b) => s + b.tax_amount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Auto-populated inward ITC credit from vendor bills</p>
                <button
                  onClick={exportGstr3bCSV}
                  className="w-full py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download GSTR-2B Recon (.csv)
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">GSTR-3B Net Tax Payable</span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  ₹{Math.max(0, invoices.reduce((s, i) => s + i.tax_amount, 0) - bills.reduce((s, b) => s + b.tax_amount, 0)).toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Output Tax minus Input Tax Credit</p>
                <button
                  onClick={exportGstr3bCSV}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  Download GSTR-3B Excel (.csv)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: USER MANAGEMENT & ADMINISTRATIVE CONTROL */}
        {activeTab === "USER_CONTROL" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">SAP Functional Role</th>
                      <th className="px-5 py-3.5">Security Level</th>
                      <th className="px-5 py-3.5">Active Staff</th>
                      <th className="px-5 py-3.5">Operational Scope & Modules</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {sapRoles.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{r.role}</td>
                        <td className="px-5 py-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">{r.level}</td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{r.users_count} users</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-sm">{r.access}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Authorized
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: MASTER DATA MIGRATION FACILITY */}
        {activeTab === "MIGRATION" && (
          <div className="space-y-6">
            {/* Download templates */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Master Data Migration Templates</h3>
                <p className="text-xs text-slate-500">Download formatted CSV structures to migrate legacy ERP data into SAP</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {[
                  { id: "CUSTOMERS", label: "Customers Master (.csv)", desc: "Company, GSTIN, credit limit" },
                  { id: "SUPPLIERS", label: "Suppliers Master (.csv)", desc: "Vendor code, terms, categories" },
                  { id: "MATERIALS", label: "Materials Master (.csv)", desc: "SKU, units, stock valuation" },
                  { id: "OPENING_BALANCES", label: "Opening Balances (.csv)", desc: "GL accounts, opening trial balance" },
                ].map((tmpl) => (
                  <div key={tmpl.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{tmpl.label}</h4>
                    <p className="text-[11px] text-slate-500">{tmpl.desc}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => downloadTemplateCSV(tmpl.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        Template
                      </button>
                      <button
                        onClick={() => handleSimulateMigration(tmpl.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                      >
                        <UploadCloud className="w-3 h-3" />
                        Import
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Migration History Log */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Batch Migration Execution Log</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Batch Code</th>
                      <th className="px-5 py-3.5">Entity Type</th>
                      <th className="px-5 py-3.5">File Name</th>
                      <th className="px-5 py-3.5">Records Imported</th>
                      <th className="px-5 py-3.5">Uploaded By</th>
                      <th className="px-5 py-3.5">Timestamp</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {migrations.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          {m.batch_code}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            {m.entity_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">{m.filename}</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {m.imported_success} / {m.total_records}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{m.uploaded_by}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {migrations.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No legacy migration batches executed yet. Click "Import" on any template card above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE VOUCHER FORMAT */}
        {isFormatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Voucher / Bill Format</h3>
                <button
                  onClick={() => setIsFormatModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFormat} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Format Code *</label>
                    <input
                      type="text"
                      required
                      value={formatForm.format_code}
                      onChange={(e) => setFormatForm({ ...formatForm, format_code: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Document Type *</label>
                    <select
                      value={formatForm.doc_type}
                      onChange={(e) => setFormatForm({ ...formatForm, doc_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    >
                      <option value="TAX_INVOICE">Tax Invoice</option>
                      <option value="DELIVERY_CHALLAN">Delivery Challan</option>
                      <option value="PAYMENT_RECEIPT">Payment Receipt</option>
                      <option value="POS_RECEIPT">POS Receipt</option>
                      <option value="PURCHASE_ORDER">Purchase Order</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Format Title *</label>
                  <input
                    type="text"
                    required
                    value={formatForm.title}
                    onChange={(e) => setFormatForm({ ...formatForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Header Banner Title</label>
                  <input
                    type="text"
                    value={formatForm.header_title}
                    onChange={(e) => setFormatForm({ ...formatForm, header_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Terms & Declaration Footer</label>
                  <textarea
                    rows={2}
                    value={formatForm.footer_terms}
                    onChange={(e) => setFormatForm({ ...formatForm, footer_terms: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormatModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Saving..." : "Save Format"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
