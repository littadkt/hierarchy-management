"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
  CreditCard,
  X,
  Receipt,
  Building,
  Calendar,
  Send,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapInvoice, SapMaterialMaster } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapBillingSuitePage() {
  const [invoices, setInvoices] = useState<SapInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [materials, setMaterials] = useState<SapMaterialMaster[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SapInvoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<SapInvoice | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Create Invoice Form
  const [invForm, setInvForm] = useState({
    invoice_type: "CUSTOMER_INVOICE",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_gstin: "",
    billing_address: "",
    shipping_address: "",
    payment_terms: "NET_30",
    material_code: "",
    material_name: "",
    quantity: 1,
    unit_price: 10000,
    notes: "Supply of commercial goods under GST rules",
  });

  // Payment Form
  const [payForm, setPayForm] = useState({
    amount_paid: 0,
    payment_method: "BANK_TRANSFER",
    notes: "Payment received via NEFT / RTGS",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, mats] = await Promise.all([
        sapApi.listInvoices({
          search: search.trim() || undefined,
          invoice_type: typeFilter === "ALL" ? undefined : typeFilter,
          invoice_status: statusFilter === "ALL" ? undefined : statusFilter,
        }),
        sapApi.listMaterials(),
      ]);
      setInvoices(res.items);
      setMaterials(mats);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      const subtotal = invForm.quantity * invForm.unit_price;
      const cgst = subtotal * 0.09;
      const sgst = subtotal * 0.09;
      const totalTax = cgst + sgst;
      const totalAmount = subtotal + totalTax;

      await sapApi.createInvoice({
        invoice_type: invForm.invoice_type,
        customer_name: invForm.customer_name,
        customer_phone: invForm.customer_phone || undefined,
        customer_email: invForm.customer_email || undefined,
        customer_gstin: invForm.customer_gstin || undefined,
        billing_address: invForm.billing_address || undefined,
        shipping_address: invForm.shipping_address || undefined,
        payment_terms: invForm.payment_terms,
        subtotal: subtotal,
        discount_amount: 0,
        taxable_amount: subtotal,
        tax_amount: totalTax,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        total_amount: totalAmount,
        paid_amount: 0,
        balance_due: totalAmount,
        status: "ISSUED",
        notes: invForm.notes,
        items_summary: `${invForm.material_name} (${invForm.quantity} UNITS @ ₹${invForm.unit_price})`,
      });

      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to generate tax invoice"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.recordInvoicePayment(selectedInvoice.id, payForm);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to record payment"));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Printable view overlay */}
        {printInvoice && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full p-8 space-y-6 shadow-2xl relative font-sans">
              <button
                onClick={() => setPrintInvoice(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Invoice Formal Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">LITTAD HIERARCHY CORP</h2>
                  <p className="text-xs text-slate-600 mt-1">Main Industrial Yard, Plot 45, Kochi, Kerala - 682024</p>
                  <p className="text-xs text-slate-600">GSTIN: 32AABCL8291M1Z5 | PAN: AABCL8291M</p>
                  <p className="text-xs text-slate-600">Phone: +91 98470 11223 | accounts@littad.com</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-md bg-slate-900 text-white font-black text-xs uppercase tracking-wider">
                    {printInvoice.invoice_type.replace("_", " ")}
                  </span>
                  <p className="font-mono font-bold text-base mt-2 text-slate-900">{printInvoice.invoice_number}</p>
                  <p className="text-xs text-slate-500">Date: {new Date(printInvoice.billing_date).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">Due: {new Date(printInvoice.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-500">Billed To (Customer):</span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">{printInvoice.customer_name}</p>
                  <p className="text-slate-600 mt-0.5">{printInvoice.billing_address || "Commercial Address on File"}</p>
                  <p className="font-mono mt-1 text-slate-800">GSTIN: {printInvoice.customer_gstin || "URP (Unregistered)"}</p>
                </div>
                <div>
                  <span className="font-bold uppercase tracking-wider text-slate-500">Payment & Dispatch Terms:</span>
                  <p className="text-slate-800 mt-1">Terms: <span className="font-semibold">{printInvoice.payment_terms}</span></p>
                  <p className="text-slate-800">Source: <span className="font-semibold">{printInvoice.source_module}</span></p>
                  <p className="text-slate-800">Status: <span className="font-bold text-emerald-700">{printInvoice.status}</span></p>
                </div>
              </div>

              {/* Item details */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Description & HSN</th>
                      <th className="p-3 text-right">Taxable (₹)</th>
                      <th className="p-3 text-right">CGST (9%)</th>
                      <th className="p-3 text-right">SGST (9%)</th>
                      <th className="p-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{printInvoice.items_summary || "Commercial Machinery / Spares Supply"}</div>
                        <div className="text-slate-500 text-[11px]">HSN: 8409 / 8502 • Rule 46 CGST Compliant</div>
                      </td>
                      <td className="p-3 text-right font-medium">₹{printInvoice.taxable_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-slate-600">₹{printInvoice.cgst_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-slate-600">₹{printInvoice.sgst_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-slate-900">₹{printInvoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-between items-start pt-2">
                <div className="text-xs text-slate-600 max-w-sm space-y-1">
                  <p className="font-bold text-slate-900">Bank Details for RTGS/NEFT:</p>
                  <p>Bank: HDFC Bank Ltd | Branch: MG Road Kochi</p>
                  <p>A/c No: 50200088991122 | IFSC: HDFC0000123</p>
                  <p className="pt-2 text-[11px] text-slate-500 italic">
                    Declaration: We declare that this invoice shows the actual price of goods and that all particulars are true and correct.
                  </p>
                </div>
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Value:</span>
                    <span>₹{printInvoice.taxable_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Tax (GST):</span>
                    <span>₹{printInvoice.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-900">
                    <span>Total Amount:</span>
                    <span>₹{printInvoice.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Paid Amount:</span>
                    <span>₹{printInvoice.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Balance Due:</span>
                    <span>₹{printInvoice.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Footer action */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Tax Invoice
                </button>
              </div>
            </div>
          </div>
        )}

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
                  SAP Billing & AR
                </span>
                <span className="text-xs text-slate-500 font-mono">Customer Invoicing & Tax Ledger</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Customer Invoices & Billing Desk
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
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Generate Tax Invoice
            </button>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Total Invoices Issued</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{invoices.length}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Total Billed Revenue</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{invoices.reduce((s, i) => s + i.total_amount, 0).toLocaleString()}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Collected Revenue</span>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              ₹{invoices.reduce((s, i) => s + i.paid_amount, 0).toLocaleString()}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500">Outstanding Receivables Due</span>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              ₹{invoices.reduce((s, i) => s + i.balance_due, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              placeholder="Search by invoice number, customer name, GSTIN, or items..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="ISSUED">Issued / Pending</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Types</option>
              <option value="CUSTOMER_INVOICE">Tax Invoice</option>
              <option value="PROFORMA_INVOICE">Proforma Invoice</option>
              <option value="CREDIT_MEMO">Credit Memo</option>
            </select>
          </div>
        </div>

        {/* Invoice table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5">Billing Date</th>
                  <th className="px-5 py-3.5">Subtotal</th>
                  <th className="px-5 py-3.5">Tax (GST)</th>
                  <th className="px-5 py-3.5">Grand Total</th>
                  <th className="px-5 py-3.5">Balance Due</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {inv.invoice_number}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {inv.invoice_type.replace("_INVOICE", "")}
                    </td>
                    <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                      {inv.customer_name}
                      {inv.customer_gstin && (
                        <span className="block text-[11px] font-mono text-slate-400">{inv.customer_gstin}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(inv.billing_date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      ₹{inv.subtotal.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                      ₹{inv.tax_amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                      ₹{inv.total_amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                      ₹{inv.balance_due.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : inv.status === "PARTIALLY_PAID"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.balance_due > 0 && (
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPayForm({ ...payForm, amount_paid: inv.balance_due });
                              setIsPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                          >
                            <DollarSign className="w-3 h-3" />
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => setPrintInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          View / Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: CREATE INVOICE */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Generate Tax Invoice</h3>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Invoice Type *</label>
                    <select
                      value={invForm.invoice_type}
                      onChange={(e) => setInvForm({ ...invForm, invoice_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    >
                      <option value="CUSTOMER_INVOICE">Regular Tax Invoice</option>
                      <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                      <option value="CREDIT_MEMO">Credit Memo</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Terms</label>
                    <select
                      value={invForm.payment_terms}
                      onChange={(e) => setInvForm({ ...invForm, payment_terms: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    >
                      <option value="NET_30">Net 30 Days</option>
                      <option value="NET_15">Net 15 Days</option>
                      <option value="IMMEDIATE">Immediate Due</option>
                      <option value="ADVANCE">Advance Paid</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Customer / Buyer Name *</label>
                  <input
                    type="text"
                    required
                    value={invForm.customer_name}
                    onChange={(e) => setInvForm({ ...invForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Phone</label>
                    <input
                      type="text"
                      value={invForm.customer_phone}
                      onChange={(e) => setInvForm({ ...invForm, customer_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Customer GSTIN</label>
                    <input
                      type="text"
                      value={invForm.customer_gstin}
                      onChange={(e) => setInvForm({ ...invForm, customer_gstin: e.target.value })}
                      placeholder="e.g. 32AAACA5678G2Z1"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1 font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Select Material / Product *</label>
                  <select
                    required
                    value={invForm.material_code}
                    onChange={(e) => {
                      const m = materials.find((mat) => mat.material_code === e.target.value);
                      if (m) {
                        setInvForm({
                          ...invForm,
                          material_code: m.material_code,
                          material_name: m.name,
                          unit_price: m.unit_price,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="">Choose Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.material_code}>
                        {m.name} ({m.material_code}) - ₹{m.unit_price}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity</label>
                    <input
                      type="number"
                      required
                      value={invForm.quantity}
                      onChange={(e) => setInvForm({ ...invForm, quantity: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Unit Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={invForm.unit_price}
                      onChange={(e) => setInvForm({ ...invForm, unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Generating..." : "Generate & Post Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD PAYMENT */}
        {isPaymentModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Invoice Payment</h3>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Balance Due:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">₹{selectedInvoice.balance_due.toLocaleString()}</span>
                </div>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    max={selectedInvoice.balance_due}
                    value={payForm.amount_paid}
                    onChange={(e) => setPayForm({ ...payForm, amount_paid: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-emerald-600 mt-1"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Method</label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="CASH">Counter Cash</option>
                    <option value="CHEQUE">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Notes / UTR Ref</label>
                  <input
                    type="text"
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Recording..." : "Record & Post Receipt Voucher"}
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
