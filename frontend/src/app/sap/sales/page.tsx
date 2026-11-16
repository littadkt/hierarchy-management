"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  CreditCard,
  ShoppingBag,
  Printer,
  Download,
  Filter,
  X,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Calendar,
  Building,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import {
  SapCustomer,
  SapCustomerEnquiry,
  SapInvoice,
  SapOutboundDelivery,
  SapPosSale,
  SapQuotation,
  SapSalesOrder,
  SapReceivablesAgeingReport,
  SapSalesRegisterReport,
  SapMaterialMaster,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapSalesSuitePage() {
  const [activeTab, setActiveTab] = useState<
    | "CUSTOMERS"
    | "ENQUIRIES"
    | "QUOTATIONS"
    | "ORDERS"
    | "DELIVERIES"
    | "POS"
    | "AGEING"
    | "REGISTER"
  >("CUSTOMERS");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data states
  const [customers, setCustomers] = useState<SapCustomer[]>([]);
  const [enquiries, setEnquiries] = useState<SapCustomerEnquiry[]>([]);
  const [quotations, setQuotations] = useState<SapQuotation[]>([]);
  const [orders, setOrders] = useState<SapSalesOrder[]>([]);
  const [deliveries, setDeliveries] = useState<SapOutboundDelivery[]>([]);
  const [posSales, setPosSales] = useState<SapPosSale[]>([]);
  const [ageingReport, setAgeingReport] = useState<SapReceivablesAgeingReport | null>(null);
  const [salesRegister, setSalesRegister] = useState<SapSalesRegisterReport | null>(null);
  const [materials, setMaterials] = useState<SapMaterialMaster[]>([]);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Customer Form
  const [custForm, setCustForm] = useState({
    customer_code: "",
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    gstin: "",
    pan: "",
    city: "Kochi",
    state: "Kerala",
    credit_limit: 300000,
    customer_group: "COMMERCIAL",
  });

  // Enquiry Form
  const [enqForm, setEnqForm] = useState({
    customer_name: "",
    contact_phone: "",
    contact_email: "",
    requirement_details: "",
    source: "DIRECT_VISIT",
    estimated_value: 50000,
  });

  // Delivery Form
  const [delivForm, setDelivForm] = useState({
    sales_order_number: "SO-2026-0001",
    customer_name: "",
    shipping_address: "",
    carrier_name: "BlueDart Express",
    tracking_number: "",
    total_packages: 1,
    total_weight_kg: 25.0,
    driver_phone: "",
  });

  // POS State
  const [posCart, setPosCart] = useState<Array<{ material_code: string; name: string; price: number; qty: number }>>([]);
  const [posCustomerName, setPosCustomerName] = useState("Walk-in Retail Customer");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posPaymentMode, setPosPaymentMode] = useState("CASH");
  const [posTenderAmount, setPosTenderAmount] = useState<number>(0);
  const [posSuccessReceipt, setPosSuccessReceipt] = useState<SapPosSale | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "CUSTOMERS") {
        const res = await sapApi.listCustomers({ search: search.trim() || undefined });
        setCustomers(res.items);
      } else if (activeTab === "ENQUIRIES") {
        const res = await sapApi.listEnquiries({ search: search.trim() || undefined });
        setEnquiries(res.items);
      } else if (activeTab === "QUOTATIONS") {
        const res = await sapApi.listQuotations({ search: search.trim() || undefined });
        setQuotations(res);
      } else if (activeTab === "ORDERS") {
        const res = await sapApi.listSalesOrders({ search: search.trim() || undefined });
        setOrders(res.items);
      } else if (activeTab === "DELIVERIES") {
        const res = await sapApi.listDeliveries({ search: search.trim() || undefined });
        setDeliveries(res.items);
      } else if (activeTab === "POS") {
        const [salesRes, mats] = await Promise.all([
          sapApi.listPosSales({ search: search.trim() || undefined }),
          sapApi.listMaterials({ search: search.trim() || undefined }),
        ]);
        setPosSales(salesRes.items);
        setMaterials(mats);
      } else if (activeTab === "AGEING") {
        const res = await sapApi.getReceivablesAgeingReport();
        setAgeingReport(res);
      } else if (activeTab === "REGISTER") {
        const res = await sapApi.getSalesRegisterReport();
        setSalesRegister(res);
      }
    } catch (err) {
      console.error("Failed to load sales data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createCustomer(custForm);
      setIsCustomerModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create customer"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createEnquiry(enqForm);
      setIsEnquiryModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create customer enquiry"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createDelivery(delivForm);
      setIsDeliveryModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create delivery note"));
    } finally {
      setActionLoading(false);
    }
  };

  // POS Actions
  const addToPosCart = (m: SapMaterialMaster) => {
    const existing = posCart.find((item) => item.material_code === m.material_code);
    if (existing) {
      setPosCart(posCart.map((i) => (i.material_code === m.material_code ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      setPosCart([...posCart, { material_code: m.material_code, name: m.name, price: m.unit_price, qty: 1 }]);
    }
  };

  const updateCartQty = (code: string, delta: number) => {
    setPosCart(
      posCart
        .map((i) => (i.material_code === code ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const posSubtotal = posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const posTax = posSubtotal * 0.18;
  const posTotal = posSubtotal + posTax;
  const posChange = Math.max(0, (posTenderAmount || 0) - posTotal);

  const handleCompletePosSale = async () => {
    if (posCart.length === 0) return;
    setActionLoading(true);
    try {
      const receipt = await sapApi.createPosSale({
        counter_code: "COUNTER-01",
        cashier_name: "Staff Cashier",
        customer_name: posCustomerName,
        customer_phone: posCustomerPhone || undefined,
        subtotal: posSubtotal,
        discount_amount: 0,
        tax_amount: posTax,
        total_amount: posTotal,
        tender_amount: posTenderAmount || posTotal,
        change_returned: posChange,
        payment_mode: posPaymentMode,
        items_json: JSON.stringify(posCart),
      });
      setPosSuccessReceipt(receipt);
      setPosCart([]);
      setPosTenderAmount(0);
      loadData();
    } catch (err) {
      alert("Failed to submit POS sale");
    } finally {
      setActionLoading(false);
    }
  };

  const exportSalesRegisterCSV = () => {
    if (!salesRegister || !salesRegister.entries) return;
    const headers = ["Invoice No", "Date", "Customer Name", "GSTIN", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Grand Total (₹)", "Status"];
    const rows = salesRegister.entries.map((r) => [
      r.invoice_number,
      new Date(r.date).toLocaleDateString(),
      `"${r.customer_name}"`,
      r.customer_gstin || "N/A",
      r.taxable_amount.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.igst.toFixed(2),
      r.total_amount.toFixed(2),
      r.status,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sales_Register_GST_${new Date().toISOString().slice(0, 10)}.csv`);
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
                  SAP SD Suite
                </span>
                <span className="text-xs text-slate-500 font-mono">Enterprise Sales & Distribution</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Sales & Commercial Operations
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
            {activeTab === "CUSTOMERS" && (
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Customer
              </button>
            )}
            {activeTab === "ENQUIRIES" && (
              <button
                onClick={() => setIsEnquiryModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Enquiry
              </button>
            )}
            {activeTab === "DELIVERIES" && (
              <button
                onClick={() => setIsDeliveryModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                Generate Delivery Note
              </button>
            )}
            {activeTab === "REGISTER" && (
              <button
                onClick={exportSalesRegisterCSV}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Sales Register (CSV)
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: "CUSTOMERS", label: "Customer List", icon: Users },
            { id: "ENQUIRIES", label: "Customer Enquiry", icon: Phone },
            { id: "QUOTATIONS", label: "Quotation", icon: FileText },
            { id: "ORDERS", label: "Order Confirmation", icon: CheckCircle2 },
            { id: "DELIVERIES", label: "Goods Delivery Note (GDN)", icon: Truck },
            { id: "POS", label: "POS Module", icon: Calculator },
            { id: "AGEING", label: "Receivables Ageing", icon: Clock },
            { id: "REGISTER", label: "Sales Register", icon: TrendingUp },
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

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              placeholder="Search by code, party name, phone, invoice, or status..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            Apply Filter
          </button>
        </div>

        {/* TAB CONTENT: 1. CUSTOMERS */}
        {activeTab === "CUSTOMERS" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Active Customers</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{customers.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Outstanding Balance</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{customers.reduce((acc, c) => acc + (c.outstanding_balance || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Corporate Accounts</span>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {customers.filter((c) => c.customer_group === "CORPORATE").length}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Code</th>
                      <th className="px-5 py-3.5">Customer / Company</th>
                      <th className="px-5 py-3.5">Contact</th>
                      <th className="px-5 py-3.5">GSTIN</th>
                      <th className="px-5 py-3.5">Credit Limit</th>
                      <th className="px-5 py-3.5">Outstanding</th>
                      <th className="px-5 py-3.5">Group</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {c.customer_code}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {c.company_name}
                          {c.contact_person && (
                            <span className="block text-xs text-slate-400 font-normal">Attn: {c.contact_person}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <div>{c.phone}</div>
                          <div className="text-slate-400">{c.email || "No email"}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {c.gstin || "URP (Unregistered)"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{c.credit_limit.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-rose-600 dark:text-rose-400">
                          ₹{c.outstanding_balance.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {c.customer_group}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          No customers found. Click "Add Customer" to register your first corporate account.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 2. CUSTOMER ENQUIRIES */}
        {activeTab === "ENQUIRIES" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Enquiry #</th>
                      <th className="px-5 py-3.5">Customer Name</th>
                      <th className="px-5 py-3.5">Contact Phone</th>
                      <th className="px-5 py-3.5">Requirement Details</th>
                      <th className="px-5 py-3.5">Source</th>
                      <th className="px-5 py-3.5">Est. Value</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {enquiries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {e.enquiry_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {e.customer_name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-xs">{e.contact_phone}</td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 text-xs max-w-xs truncate">
                          {e.requirement_details}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{e.source}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          ₹{e.estimated_value.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              e.status === "WON"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : e.status === "QUOTED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {enquiries.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No commercial enquiries recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 3. QUOTATIONS */}
        {activeTab === "QUOTATIONS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Quote #</th>
                      <th className="px-5 py-3.5">Customer Name</th>
                      <th className="px-5 py-3.5">Valid Until</th>
                      <th className="px-5 py-3.5">Subtotal</th>
                      <th className="px-5 py-3.5">Tax (GST)</th>
                      <th className="px-5 py-3.5">Grand Total</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {quotations.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {q.quotation_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {q.customer_name}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(q.valid_until).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{q.subtotal.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{q.tax_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{q.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {q.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {quotations.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No commercial quotations generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 4. ORDER CONFIRMATION */}
        {activeTab === "ORDERS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Order #</th>
                      <th className="px-5 py-3.5">Customer Name</th>
                      <th className="px-5 py-3.5">Phone</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5">Payment</th>
                      <th className="px-5 py-3.5">Order Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {o.order_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {o.customer_name}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{o.customer_phone}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{o.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              o.payment_status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {o.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => {
                              setDelivForm({
                                ...delivForm,
                                sales_order_number: o.order_number,
                                customer_name: o.customer_name,
                              });
                              setIsDeliveryModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Dispatch GDN
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No confirmed sales orders found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 5. GOODS DELIVERY NOTE (GDN) */}
        {activeTab === "DELIVERIES" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Delivery (GDN) #</th>
                      <th className="px-5 py-3.5">Order Ref</th>
                      <th className="px-5 py-3.5">Customer & Destination</th>
                      <th className="px-5 py-3.5">Carrier & Tracking</th>
                      <th className="px-5 py-3.5">Packages</th>
                      <th className="px-5 py-3.5">Dispatch Date</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          {d.delivery_number}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {d.sales_order_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white">
                          <div className="font-semibold">{d.customer_name}</div>
                          <div className="text-xs text-slate-400 truncate max-w-xs">{d.shipping_address}</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                          <div>{d.carrier_name}</div>
                          <div className="font-mono text-slate-400">{d.tracking_number}</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          {d.total_packages} pkg ({d.total_weight_kg} kg)
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(d.shipping_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              d.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {deliveries.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No delivery notes (GDN) issued yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 6. POS MODULE */}
        {activeTab === "POS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catalog list */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  Point of Sale Quick Checkout
                </h3>
                <span className="text-xs text-slate-500">Counter 01 • Active</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {materials.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addToPosCart(m)}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-left transition-all group shadow-2xs hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-400">{m.material_code}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                        Stock: {m.current_stock} {m.base_uom}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white text-sm mt-1.5 group-hover:text-emerald-600 transition-colors line-clamp-2">
                      {m.name}
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-base mt-2">
                      ₹{m.unit_price.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>

              {/* Recent POS Sales history */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Counter Bills</h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {posSales.slice(0, 5).map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{s.bill_number}</span>
                        <span className="text-slate-400 ml-2">({s.customer_name})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-emerald-600">₹{s.total_amount.toLocaleString()}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                          {s.payment_mode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart & Billing Checkout Pane */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                Current Cart ({posCart.length} items)
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Customer Details</label>
                <input
                  type="text"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={posCustomerPhone}
                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                  placeholder="Phone Number (optional)"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {/* Items in Cart */}
              <div className="max-h-56 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
                {posCart.map((i) => (
                  <div key={i.material_code} className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">{i.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        ₹{i.price.toLocaleString()} × {i.qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateCartQty(i.material_code, -1)}
                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold">{i.qty}</span>
                      <button
                        onClick={() => updateCartQty(i.material_code, 1)}
                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {posCart.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">Cart is empty. Click items on left to add.</div>
                )}
              </div>

              {/* Total calculations */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₹{posSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (18%)</span>
                  <span>₹{posTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Grand Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ₹{posTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Payment selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Payment Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["CASH", "UPI", "CARD"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPosPaymentMode(mode)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        posPaymentMode === mode
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tender Amount (₹)</label>
                  <input
                    type="number"
                    value={posTenderAmount || ""}
                    onChange={(e) => setPosTenderAmount(parseFloat(e.target.value) || 0)}
                    placeholder={`Enter ${posTotal}`}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white mt-1"
                  />
                  {posChange > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                      Change to return: ₹{posChange.toFixed(2)}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleCompletePosSale}
                  disabled={posCart.length === 0 || actionLoading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 mt-3 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {actionLoading ? "Printing..." : "Charge & Print POS Bill"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 7. RECEIVABLES AGEING */}
        {activeTab === "AGEING" && ageingReport && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Outstanding</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  ₹{ageingReport.grand_total_outstanding.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Current (0-30 Days)</span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  ₹{ageingReport.total_0_30.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">31-60 Days</span>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  ₹{ageingReport.total_31_60.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">61-90 Days</span>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  ₹{ageingReport.total_61_90.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Overdue (90+ Days)</span>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                  ₹{ageingReport.total_90_plus.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Customer Receivables Ageing Ledger</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Customer Name</th>
                      <th className="px-5 py-3.5">Total Outstanding</th>
                      <th className="px-5 py-3.5 text-emerald-600">0 - 30 Days</th>
                      <th className="px-5 py-3.5 text-blue-600">31 - 60 Days</th>
                      <th className="px-5 py-3.5 text-amber-600">61 - 90 Days</th>
                      <th className="px-5 py-3.5 text-rose-600">90+ Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {ageingReport.buckets.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {b.customer_name}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{b.total_outstanding.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          ₹{b.current_0_30_days.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-blue-600 dark:text-blue-400 font-semibold">
                          ₹{b.bucket_31_60_days.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-amber-600 dark:text-amber-400 font-semibold">
                          ₹{b.bucket_61_90_days.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-rose-600 dark:text-rose-400 font-semibold">
                          ₹{b.bucket_90_plus_days.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 8. SALES REGISTER */}
        {activeTab === "REGISTER" && salesRegister && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Taxable Value</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  ₹{salesRegister.total_taxable.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">CGST Collected</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  ₹{salesRegister.total_cgst.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">SGST Collected</span>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  ₹{salesRegister.total_sgst.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Invoiced Sales</span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  ₹{salesRegister.total_sales.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Invoice #</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Customer Name</th>
                      <th className="px-5 py-3.5">GSTIN</th>
                      <th className="px-5 py-3.5">Taxable</th>
                      <th className="px-5 py-3.5">CGST</th>
                      <th className="px-5 py-3.5">SGST</th>
                      <th className="px-5 py-3.5">Total Amount</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {salesRegister.entries.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {e.invoice_number}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(e.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {e.customer_name}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{e.customer_gstin || "URP"}</td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{e.taxable_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">₹{e.cgst.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">₹{e.sgst.toLocaleString()}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{e.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              e.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {e.status}
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

        {/* MODAL: CREATE CUSTOMER */}
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Corporate Customer</h3>
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
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

              <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={custForm.company_name}
                    onChange={(e) => setCustForm({ ...custForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Person</label>
                    <input
                      type="text"
                      value={custForm.contact_person}
                      onChange={(e) => setCustForm({ ...custForm, contact_person: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Phone *</label>
                    <input
                      type="text"
                      required
                      value={custForm.phone}
                      onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">GSTIN</label>
                    <input
                      type="text"
                      value={custForm.gstin}
                      onChange={(e) => setCustForm({ ...custForm, gstin: e.target.value })}
                      placeholder="e.g. 32AABCH1234F1Z5"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Credit Limit (₹)</label>
                    <input
                      type="number"
                      value={custForm.credit_limit}
                      onChange={(e) => setCustForm({ ...custForm, credit_limit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Group</label>
                  <select
                    value={custForm.customer_group}
                    onChange={(e) => setCustForm({ ...custForm, customer_group: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                  >
                    <option value="COMMERCIAL">Commercial Wholesale</option>
                    <option value="CORPORATE">Corporate & Infrastructure</option>
                    <option value="RETAIL">Retail Direct</option>
                    <option value="GOVERNMENT">Government Tender</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs cursor-pointer"
                  >
                    {actionLoading ? "Saving..." : "Save Customer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE ENQUIRY */}
        {isEnquiryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Customer Enquiry</h3>
                <button
                  onClick={() => setIsEnquiryModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateEnquiry} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={enqForm.customer_name}
                    onChange={(e) => setEnqForm({ ...enqForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Phone *</label>
                    <input
                      type="text"
                      required
                      value={enqForm.contact_phone}
                      onChange={(e) => setEnqForm({ ...enqForm, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Estimated Value (₹)</label>
                    <input
                      type="number"
                      value={enqForm.estimated_value}
                      onChange={(e) => setEnqForm({ ...enqForm, estimated_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Requirement Details *</label>
                  <textarea
                    rows={3}
                    required
                    value={enqForm.requirement_details}
                    onChange={(e) => setEnqForm({ ...enqForm, requirement_details: e.target.value })}
                    placeholder="Products, quantities, delivery specifications..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEnquiryModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Logging..." : "Log Enquiry"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: DISPATCH GDN */}
        {isDeliveryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Goods Delivery Note (GDN) Challan</h3>
                <button
                  onClick={() => setIsDeliveryModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateDelivery} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Sales Order # *</label>
                    <input
                      type="text"
                      required
                      value={delivForm.sales_order_number}
                      onChange={(e) => setDelivForm({ ...delivForm, sales_order_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={delivForm.customer_name}
                      onChange={(e) => setDelivForm({ ...delivForm, customer_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Shipping Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={delivForm.shipping_address}
                    onChange={(e) => setDelivForm({ ...delivForm, shipping_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Carrier / Transporter</label>
                    <input
                      type="text"
                      value={delivForm.carrier_name}
                      onChange={(e) => setDelivForm({ ...delivForm, carrier_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Tracking / Docket # *</label>
                    <input
                      type="text"
                      required
                      value={delivForm.tracking_number}
                      onChange={(e) => setDelivForm({ ...delivForm, tracking_number: e.target.value })}
                      placeholder="e.g. BD-9988112"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1 font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Total Packages</label>
                    <input
                      type="number"
                      value={delivForm.total_packages}
                      onChange={(e) => setDelivForm({ ...delivForm, total_packages: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Weight (KG)</label>
                    <input
                      type="number"
                      value={delivForm.total_weight_kg}
                      onChange={(e) => setDelivForm({ ...delivForm, total_weight_kg: parseFloat(e.target.value) || 10 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDeliveryModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Dispatching..." : "Generate Challan & Dispatch"}
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
