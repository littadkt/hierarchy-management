"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  FileText,
  DollarSign,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  Printer,
  Download,
  Filter,
  X,
  ChevronRight,
  PackageCheck,
  ShieldCheck,
  Building,
  Phone,
  Mail,
  MapPin,
  Star,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import {
  SapVendor,
  SapPurchaseOrder,
  SapGoodsReceipt,
  SapVendorBill,
  SapDebitNote,
  SapMaterialMaster,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapPurchasingSuitePage() {
  const [activeTab, setActiveTab] = useState<
    | "SUPPLIERS"
    | "ORDERS"
    | "RECEIPTS"
    | "BILLS"
    | "PAYMENTS"
    | "DEBIT_NOTES"
    | "REGISTER"
  >("SUPPLIERS");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data states
  const [vendors, setVendors] = useState<SapVendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<SapPurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<SapGoodsReceipt[]>([]);
  const [vendorBills, setVendorBills] = useState<SapVendorBill[]>([]);
  const [debitNotes, setDebitNotes] = useState<SapDebitNote[]>([]);
  const [materials, setMaterials] = useState<SapMaterialMaster[]>([]);

  // Modals
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isDebitModalOpen, setIsDebitModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Forms
  const [vendorForm, setVendorForm] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    gstin: "",
    pan: "",
    address: "",
    city: "Kochi",
    state: "Kerala",
    payment_terms: "NET_30",
    category: "RAW_MATERIALS",
    rating: 4.8,
  });

  const [poForm, setPoForm] = useState({
    vendor_code: "",
    vendor_name: "",
    vendor_gstin: "",
    material_code: "",
    material_name: "",
    quantity: 10,
    uom: "EA",
    unit_price: 1000,
    subtotal: 10000,
    tax_rate: 18.0,
    tax_amount: 1800,
    total_amount: 11800,
    payment_terms: "NET_30",
    notes: "",
  });

  const [grnForm, setGrnForm] = useState({
    po_reference: "",
    vendor_name: "",
    material_code: "",
    material_name: "",
    quantity_received: 10,
    quantity_accepted: 10,
    quantity_rejected: 0,
    uom: "EA",
    warehouse_zone: "ZONE-A",
    storage_bin: "BIN-A-01-01",
    quality_status: "ACCEPTED",
    received_by: "Store Keeper",
  });

  const [billForm, setBillForm] = useState({
    vendor_bill_ref: "",
    po_reference: "",
    vendor_code: "",
    vendor_name: "",
    vendor_gstin: "",
    subtotal: 10000,
    tax_amount: 1800,
    total_amount: 11800,
  });

  const [debitForm, setDebitForm] = useState({
    original_bill_ref: "",
    vendor_code: "",
    vendor_name: "",
    return_reason: "Rejection due to surface quality defects during GRN inspection",
    debit_amount: 2500,
    tax_reversed: 450,
    total_debit: 2950,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "SUPPLIERS") {
        const res = await sapApi.listVendors({ search: search.trim() || undefined });
        setVendors(res.items);
      } else if (activeTab === "ORDERS") {
        const [poRes, mats, vends] = await Promise.all([
          sapApi.listPurchaseOrders({ search: search.trim() || undefined }),
          sapApi.listMaterials(),
          sapApi.listVendors(),
        ]);
        setPurchaseOrders(poRes.items);
        setMaterials(mats);
        setVendors(vends.items);
      } else if (activeTab === "RECEIPTS") {
        const res = await sapApi.listGoodsReceipts({ search: search.trim() || undefined });
        setGoodsReceipts(res.items);
      } else if (activeTab === "BILLS" || activeTab === "PAYMENTS" || activeTab === "REGISTER") {
        const res = await sapApi.listVendorBills({ search: search.trim() || undefined });
        setVendorBills(res.items);
      } else if (activeTab === "DEBIT_NOTES") {
        const res = await sapApi.listDebitNotes({ search: search.trim() || undefined });
        setDebitNotes(res.items);
      }
    } catch (err) {
      console.error("Failed to load purchasing data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createVendor({
        ...vendorForm,
        vendor_code: `VEND-${Math.floor(10000 + Math.random() * 90000)}`,
      });
      setIsVendorModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create vendor"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      const sub = poForm.quantity * poForm.unit_price;
      const tax = (sub * poForm.tax_rate) / 100;
      await sapApi.createPurchaseOrder({
        ...poForm,
        subtotal: sub,
        tax_amount: tax,
        total_amount: sub + tax,
      });
      setIsPoModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create purchase order"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createGoodsReceipt(grnForm);
      setIsGrnModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create goods receipt"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createVendorBill(billForm);
      setIsBillModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create vendor bill"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDebitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createDebitNote(debitForm);
      setIsDebitModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create debit note"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (bill: SapVendorBill) => {
    const amount = prompt(`Enter payment settlement amount for bill ${bill.bill_number}:`, bill.balance_payable.toString());
    if (!amount) return;
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) return;

    try {
      await sapApi.updateVendorBill(bill.id, {
        paid_amount: bill.paid_amount + paid,
        status: bill.paid_amount + paid >= bill.total_amount ? "PAID" : "PARTIALLY_PAID",
      });
      alert(`Payment of ₹${paid.toLocaleString()} recorded successfully!`);
      loadData();
    } catch (err) {
      alert("Failed to update vendor bill payment");
    }
  };

  const exportPurchaseRegisterCSV = () => {
    const headers = ["Bill Number", "Vendor Invoice Ref", "PO Reference", "Supplier Name", "GSTIN", "Date", "Due Date", "Taxable (₹)", "ITC Tax (₹)", "Total (₹)", "Paid (₹)", "Balance (₹)", "Status"];
    const rows = vendorBills.map((b) => [
      b.bill_number,
      `"${b.vendor_bill_ref}"`,
      b.po_reference || "N/A",
      `"${b.vendor_name}"`,
      b.vendor_gstin || "N/A",
      new Date(b.bill_date).toLocaleDateString(),
      new Date(b.due_date).toLocaleDateString(),
      b.subtotal.toFixed(2),
      b.tax_amount.toFixed(2),
      b.total_amount.toFixed(2),
      b.paid_amount.toFixed(2),
      b.balance_payable.toFixed(2),
      b.status,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Purchase_Register_AP_${new Date().toISOString().slice(0, 10)}.csv`);
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
                  SAP MM Purchasing
                </span>
                <span className="text-xs text-slate-500 font-mono">Procurement & Accounts Payable (AP)</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Purchasing & Vendor Management
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
            {activeTab === "SUPPLIERS" && (
              <button
                onClick={() => setIsVendorModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Supplier
              </button>
            )}
            {activeTab === "ORDERS" && (
              <button
                onClick={() => setIsPoModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Generate PO
              </button>
            )}
            {activeTab === "RECEIPTS" && (
              <button
                onClick={() => setIsGrnModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                Record Goods Receipt (GRN)
              </button>
            )}
            {activeTab === "BILLS" && (
              <button
                onClick={() => setIsBillModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Record Vendor AP Bill
              </button>
            )}
            {activeTab === "DEBIT_NOTES" && (
              <button
                onClick={() => setIsDebitModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm cursor-pointer"
              >
                <TrendingDown className="w-4 h-4" />
                Create Debit Note
              </button>
            )}
            {activeTab === "REGISTER" && (
              <button
                onClick={exportPurchaseRegisterCSV}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Purchase Register (CSV)
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: "SUPPLIERS", label: "Supplier List", icon: Building },
            { id: "ORDERS", label: "Purchase Orders", icon: FileText },
            { id: "RECEIPTS", label: "Goods Receipt (GRN)", icon: PackageCheck },
            { id: "BILLS", label: "Purchase Accounts Entry (AP)", icon: CreditCard },
            { id: "PAYMENTS", label: "Supplier Payment & Outstanding", icon: DollarSign },
            { id: "DEBIT_NOTES", label: "Purchase Return / Debit Note", icon: TrendingDown },
            { id: "REGISTER", label: "Purchase Registers", icon: ShoppingBag },
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

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              placeholder="Search vendors, PO numbers, bill references, materials..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 cursor-pointer"
          >
            Search
          </button>
        </div>

        {/* TAB 1: SUPPLIERS */}
        {activeTab === "SUPPLIERS" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Active Approved Suppliers</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{vendors.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Accounts Payable (AP)</span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  ₹{vendors.reduce((sum, v) => sum + (v.outstanding_payable || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Raw Material Vendors</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {vendors.filter((v) => v.category === "RAW_MATERIALS").length}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Vendor Code</th>
                      <th className="px-5 py-3.5">Supplier Name</th>
                      <th className="px-5 py-3.5">Contact Details</th>
                      <th className="px-5 py-3.5">GSTIN</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5">Payment Terms</th>
                      <th className="px-5 py-3.5">Outstanding AP</th>
                      <th className="px-5 py-3.5 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {vendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">{v.vendor_code}</td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {v.company_name}
                          {v.contact_person && (
                            <span className="block text-xs text-slate-400 font-normal">Attn: {v.contact_person}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <div>{v.phone}</div>
                          <div className="text-slate-400">{v.email || "No email"}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {v.gstin || "URP"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {v.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{v.payment_terms}</td>
                        <td className="px-5 py-3.5 font-semibold text-rose-600 dark:text-rose-400">
                          ₹{v.outstanding_payable.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {v.rating.toFixed(1)}
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

        {/* TAB 2: PURCHASE ORDERS */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">PO Number</th>
                      <th className="px-5 py-3.5">Supplier Name</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Order Qty</th>
                      <th className="px-5 py-3.5">Unit Rate</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5">PO Date</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {po.po_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {po.vendor_name}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                          <div>{po.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{po.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          {po.quantity} {po.uom}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{po.unit_price.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{po.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(po.order_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              po.status === "RECEIVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : po.status === "PARTIALLY_RECEIVED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {po.status}
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

        {/* TAB 3: GOODS RECEIPTS (GRN) */}
        {activeTab === "RECEIPTS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">GRN #</th>
                      <th className="px-5 py-3.5">PO Reference</th>
                      <th className="px-5 py-3.5">Vendor</th>
                      <th className="px-5 py-3.5">Material</th>
                      <th className="px-5 py-3.5">Accepted Qty</th>
                      <th className="px-5 py-3.5">Storage Bin</th>
                      <th className="px-5 py-3.5">Inspection</th>
                      <th className="px-5 py-3.5 text-right">Receipt Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {goodsReceipts.map((grn) => (
                      <tr key={grn.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          {grn.grn_number}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {grn.po_reference}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{grn.vendor_name}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                          <div>{grn.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{grn.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {grn.quantity_accepted} {grn.uom}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {grn.storage_bin}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {grn.quality_status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 text-right">
                          {new Date(grn.received_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: AP BILLS & TAB 5: PAYMENTS */}
        {(activeTab === "BILLS" || activeTab === "PAYMENTS") && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Bill #</th>
                      <th className="px-5 py-3.5">Vendor Invoice #</th>
                      <th className="px-5 py-3.5">Supplier Name</th>
                      <th className="px-5 py-3.5">Bill Date</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5">Balance Payable</th>
                      <th className="px-5 py-3.5">Status</th>
                      {activeTab === "PAYMENTS" && <th className="px-5 py-3.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {vendorBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                          {b.bill_number}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {b.vendor_bill_ref}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{b.vendor_name}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(b.bill_date).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{new Date(b.due_date).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{b.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                          ₹{b.balance_payable.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        {activeTab === "PAYMENTS" && (
                          <td className="px-5 py-3.5 text-right">
                            {b.balance_payable > 0 ? (
                              <button
                                onClick={() => handleRecordPayment(b)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Settle Payment
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">Settled</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DEBIT NOTES */}
        {activeTab === "DEBIT_NOTES" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Debit Note #</th>
                      <th className="px-5 py-3.5">Bill Reference</th>
                      <th className="px-5 py-3.5">Supplier Name</th>
                      <th className="px-5 py-3.5">Return Reason</th>
                      <th className="px-5 py-3.5">Debit Amount</th>
                      <th className="px-5 py-3.5">Tax Reversed</th>
                      <th className="px-5 py-3.5">Total Reversal</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {debitNotes.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">
                          {dn.debit_note_number}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {dn.original_bill_ref}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{dn.vendor_name}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {dn.return_reason}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{dn.debit_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{dn.tax_reversed.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                          ₹{dn.total_debit.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            {dn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {debitNotes.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          No purchase debit notes issued.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PURCHASE REGISTER */}
        {activeTab === "REGISTER" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">AP Comprehensive Purchase Register</h3>
                  <p className="text-xs text-slate-500">Input Tax Credit (ITC) & Goods Inward Register</p>
                </div>
                <button
                  onClick={exportPurchaseRegisterCSV}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export Excel / CSV
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Inward Taxable Value</span>
                  <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    ₹{vendorBills.reduce((acc, b) => acc + b.subtotal, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Input Tax Credit (ITC)</span>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    ₹{vendorBills.reduce((acc, b) => acc + b.tax_amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500">Total Gross AP Purchases</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ₹{vendorBills.reduce((acc, b) => acc + b.total_amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE VENDOR */}
        {isVendorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Approved Supplier</h3>
                <button
                  onClick={() => setIsVendorModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVendor} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier / Company Name *</label>
                  <input
                    type="text"
                    required
                    value={vendorForm.company_name}
                    onChange={(e) => setVendorForm({ ...vendorForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Person</label>
                    <input
                      type="text"
                      value={vendorForm.contact_person}
                      onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Phone *</label>
                    <input
                      type="text"
                      required
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">GSTIN</label>
                    <input
                      type="text"
                      value={vendorForm.gstin}
                      onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Category</label>
                    <select
                      value={vendorForm.category}
                      onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    >
                      <option value="RAW_MATERIALS">Raw Materials</option>
                      <option value="SPARE_PARTS">Spare Parts</option>
                      <option value="EQUIPMENT">Machinery & Equipment</option>
                      <option value="LOGISTICS">Logistics & Freight</option>
                      <option value="SERVICES">Services</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsVendorModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Saving..." : "Save Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE PO */}
        {isPoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Generate Purchase Order</h3>
                <button
                  onClick={() => setIsPoModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePo} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Select Supplier *</label>
                  <select
                    required
                    value={poForm.vendor_code}
                    onChange={(e) => {
                      const v = vendors.find((vend) => vend.vendor_code === e.target.value);
                      if (v) {
                        setPoForm({
                          ...poForm,
                          vendor_code: v.vendor_code,
                          vendor_name: v.company_name,
                          vendor_gstin: v.gstin || "",
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="">Choose Supplier...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.vendor_code}>
                        {v.company_name} ({v.vendor_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Select Material SKU *</label>
                  <select
                    required
                    value={poForm.material_code}
                    onChange={(e) => {
                      const m = materials.find((mat) => mat.material_code === e.target.value);
                      if (m) {
                        setPoForm({
                          ...poForm,
                          material_code: m.material_code,
                          material_name: m.name,
                          uom: m.base_uom,
                          unit_price: m.unit_price,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="">Choose Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.material_code}>
                        {m.name} ({m.material_code}) - ₹{m.unit_price} / {m.base_uom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity</label>
                    <input
                      type="number"
                      required
                      value={poForm.quantity}
                      onChange={(e) => setPoForm({ ...poForm, quantity: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Unit Price (₹)</label>
                    <input
                      type="number"
                      required
                      value={poForm.unit_price}
                      onChange={(e) => setPoForm({ ...poForm, unit_price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Tax Rate (%)</label>
                    <input
                      type="number"
                      value={poForm.tax_rate}
                      onChange={(e) => setPoForm({ ...poForm, tax_rate: parseFloat(e.target.value) || 18 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPoModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Generating..." : "Generate Purchase Order"}
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
