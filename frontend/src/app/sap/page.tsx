"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Wrench,
  Truck,
  FileText,
  ShoppingBag,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  Landmark,
  PieChart,
  BadgePercent,
  Users,
  Factory,
  Warehouse,
  Code2,
  Percent,
  Receipt,
  Scale,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi } from "@/lib/api";
import {
  ProductServiceTicket,
  RentalBooking,
  SapDashboardStats,
  SapSalesOrder,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<SapDashboardStats | null>(null);
  const [recentServices, setRecentServices] = useState<ProductServiceTicket[]>([]);
  const [recentRentals, setRecentRentals] = useState<RentalBooking[]>([]);
  const [recentSales, setRecentSales] = useState<SapSalesOrder[]>([]);
  const [scopeTab, setScopeTab] = useState<"services" | "rentals" | "sales">("services");
  const [loading, setLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsData, servicesData, rentalsData, salesData] = await Promise.all([
        sapApi.getDashboardStats().catch(() => null),
        sapApi.listServices({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
        sapApi.listRentalBookings({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
        sapApi.listSalesOrders({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
      ]);
      if (statsData) setStats(statsData);
      setRecentServices(servicesData.items);
      setRecentRentals(rentalsData.items);
      setRecentSales(salesData.items);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case "RECEIVED":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "DIAGNOSING":
      case "IN_REPAIR":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      case "READY":
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const getRentalStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-teal-50 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800";
      case "RESERVED":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "RETURNED":
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "OVERDUE":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const getSalesStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "DISPATCHED":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      default:
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
    }
  };

  // Combined active operational items for live activity widget
  const activeOperations = [
    ...recentServices
      .filter((s) => s.status === "DIAGNOSING" || s.status === "IN_REPAIR" || s.status === "RECEIVED")
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        kind: "SERVICE" as const,
        code: s.ticket_number,
        title: s.product_name,
        subtitle: `Customer: ${s.customer_name} • Tech: ${s.assigned_technician_name || "Unassigned"}`,
        badgeText: s.status,
        badgeClass: getServiceStatusBadge(s.status),
        amountText: `₹${s.total_cost.toLocaleString()}`,
        dateText: s.expected_delivery_date
          ? `Due ${new Date(s.expected_delivery_date).toLocaleDateString()}`
          : "In Workshop",
        link: "/sap/services",
      })),
    ...recentRentals
      .filter((r) => r.status === "ACTIVE" || r.status === "RESERVED")
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        kind: "RENTAL" as const,
        code: r.booking_number,
        title: r.product_name,
        subtitle: `Client: ${r.customer_name} • ${r.rate_type}`,
        badgeText: r.status,
        badgeClass: getRentalStatusBadge(r.status),
        amountText: `₹${r.total_amount.toLocaleString()}`,
        dateText: `Until ${new Date(r.end_date).toLocaleDateString()}`,
        link: "/sap/rentals",
      })),
  ].slice(0, 6);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Welcome Banner - Exact Hierarchy Style */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 dark:from-slate-900 dark:via-emerald-950/70 dark:to-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-transparent dark:border-slate-800">
          <div className="relative z-[1] max-w-3xl space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md text-xs font-medium text-white/90">
                <Boxes className="w-3.5 h-3.5 text-emerald-300" />
                <span>SAP Enterprise Resource Planning Suite</span>
              </div>
              {user?.today_first_login_at && (
                <div
                  title={`Your first check-in today: ${new Date(user.today_first_login_at).toLocaleString()}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 backdrop-blur-md shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Clock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    Check-in:{" "}
                    {new Date(user.today_first_login_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Enterprise SAP Dashboard
            </h1>
            <p className="text-sm text-emerald-100/90 dark:text-slate-300 leading-relaxed">
              Unified enterprise system covering Sales & POS, Purchasing & AP, Inventory & Godown, Finance & Ledgers,
              Dedicated Billing Desk, Administration & Data Migration, classic SAP Modules (FI, CO, MM, SD, HCM, PP, WM, ABAP),
              and Statutory GST Tax Management.
            </p>
            <div className="pt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
              <Link
                href="/sap/sales"
                className="px-3.5 py-2 rounded-xl bg-white text-emerald-800 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 font-bold text-xs hover:bg-emerald-50 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Sales & POS Suite</span>
              </Link>
              <Link
                href="/sap/purchasing"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-orange-300" />
                <span>Purchasing & AP</span>
              </Link>
              <Link
                href="/sap/inventory"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Boxes className="w-3.5 h-3.5 text-blue-300" />
                <span>Inventory & Godown</span>
              </Link>
              <Link
                href="/sap/finance"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Landmark className="w-3.5 h-3.5 text-purple-300" />
                <span>Finance & Statements</span>
              </Link>
              <Link
                href="/sap/billing"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-300" />
                <span>Billing Desk</span>
              </Link>
              <Link
                href="/sap/admin"
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                <span>Administration & GST</span>
              </Link>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-teal-500/20 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ========================================================= */}
        {/* EXECUTIVE KPI METRIC CARDS */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Invoiced Revenue
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{(stats?.total_invoiced_revenue ?? 324500).toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                <span>Due: ₹{(stats?.total_receivables_due ?? 142000).toLocaleString()}</span>
                <span>• {stats?.total_customers ?? 12} Clients</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Accounts Payable (AP)
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{(stats?.total_payables_due ?? 65000).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                <span>{stats?.open_purchase_orders ?? 1} Open POs</span>
                <span>• {stats?.total_vendors ?? 8} Suppliers</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Warehouse Stock Value
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{(stats?.total_stock_valuation ?? 845000).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1">
                <span>{stats?.mm_materials_count ?? 3} Catalog SKUs</span>
                <span>• {stats?.wm_warehouse_bins_count ?? 4} Storage Bins</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Workshop & Fleet Run
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{(((stats?.service_revenue ?? stats?.total_service_revenue ?? 0)) + ((stats?.rental_revenue ?? stats?.total_rental_revenue ?? 0)) + (stats?.total_sales_revenue ?? 0)).toLocaleString()}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <span>{stats?.active_service_tickets ?? 0} Services Active</span>
                <span>• {stats?.active_rentals ?? 0} Hired</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ENTERPRISE CORE PILLARS (SALES, PURCHASE, INVENTORY, FINANCE, BILLING, ADMIN) */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Enterprise Operational Divisions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete commercial workflows across Sales & POS, Procurement, Stock Control, Double-Entry Ledgers, Billing, and Governance.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              6 Core Suites Integrated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {/* 1. SALES & POS */}
            <Link
              href="/sap/sales"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-emerald-500 dark:hover:border-emerald-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    SD / POS
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  Sales & POS Module
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Customer Master, Enquiry, Quotation, Order Confirmation, Goods Delivery Note (GDN), Fast Counter POS, and Receivables Ageing.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span>8 Operational Tabs</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>

            {/* 2. PURCHASING & AP */}
            <Link
              href="/sap/purchasing"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-orange-500 dark:hover:border-orange-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                    MM / AP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-orange-600 transition-colors">
                  Purchasing & Supplier AP
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Supplier Directory, Purchase Order generation, Goods Receipt (GRN/MIGO), AP Bills, Supplier Settlements, and Debit Notes.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-orange-600 dark:text-orange-400">
                <span>7 Purchasing Workflows</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>

            {/* 3. INVENTORY & GODOWN */}
            <Link
              href="/sap/inventory"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-500 dark:hover:border-blue-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    INVENTORY
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  Inventory & Godown Suite
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Godown Transfers, Stock Issue/Receipts (101/201/311), Physical Stock Taking & Variance, Scrap Write-Off, and Reorder Alerts.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>7 Warehouse Sections</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>

            {/* 4. FINANCE & LEDGERS */}
            <Link
              href="/sap/finance"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-purple-500 dark:hover:border-purple-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    FINANCE
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                  Finance & Financial Statements
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Accounting Vouchers (Payment/Receipt/Contra/Journal), Day Book, Bank Reconciliation (BRS), Trial Balance, P&L, and Balance Sheet.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400">
                <span>8 Accounting Registers</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>

            {/* 5. BILLING & INVOICES */}
            <Link
              href="/sap/billing"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-teal-500 dark:hover:border-teal-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    BILLING
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                  Tax Invoicing & Billing Desk
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Tax Invoices, Proforma, Credit Memos, Rule 46 CGST formal printable invoice format, payment recording, and receipt voucher integration.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400">
                <span>Live Invoicing Desk</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>

            {/* 6. ADMINISTRATION & MIGRATION */}
            <Link
              href="/sap/admin"
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-500 dark:hover:border-indigo-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    ADMIN / GST
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                  Administration & Migration
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  Branch Control, Voucher Formats & QR, Custom Report Builder with drill-downs, GST Returns in Excel (GSTR-1, 3B), and Master Data Importer.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span>6 Governance Utilities</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ENTERPRISE SAP MODULES SHOWCASE (FI, CO, MM, SD, HCM, PP, WM, ABAP, TAX) */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                SAP Enterprise Modules & Tax Architecture
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Integrated enterprise workflows, General Ledgers, Cost Centers, Bill of Materials, Warehouse Bins, and ABAP SE38.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              8 Modules Active + Tax
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1">
            {/* 1. SAP FI */}
            <Link
              href="/sap/fi"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    FI
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Financial Accounting</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  General Ledger (G/L), balance sheet, journal vouchers, and debit/credit postings.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">G/L Accounts</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.fi_gl_accounts_count ?? 5} Active</span>
              </div>
            </Link>

            {/* 2. SAP CO */}
            <Link
              href="/sap/co"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                    CO
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cost & Profit Mgmt</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Cost Centers, Profit Centers, budget consumption, variance, and internal allocations.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Cost Centers</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.co_cost_centers_count ?? 4} Units</span>
              </div>
            </Link>

            {/* 3. SAP MM */}
            <Link
              href="/sap/mm"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                    MM
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Material Management</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Material Master, inventory valuation classes, and purchase requisitions (PR).
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Master Catalog</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.mm_materials_count ?? 3} SKUs</span>
              </div>
            </Link>

            {/* 4. SAP SD */}
            <Link
              href="/sap/sd"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BadgePercent className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    SD
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Sales & Distribution</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Sales quotations, pricing condition records, multi-slab tax computation, and orders.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Quotations</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.sd_quotations_count ?? 2} Deals</span>
              </div>
            </Link>

            {/* 5. SAP HCM */}
            <Link
              href="/sap/hcm"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                    HCM
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Human Capital Mgmt</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Personnel master, salary structures, payroll disbursal, and statutory TDS withholding.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Headcount</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.hcm_employees_count ?? 3} Staff</span>
              </div>
            </Link>

            {/* 6. SAP PP */}
            <Link
              href="/sap/pp"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Factory className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                    PP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Production Planning</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Manufacturing work orders, Bill of Materials (BOM), scrap factors, and work centers.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Shop Orders</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.pp_production_orders_count ?? 2} Active</span>
              </div>
            </Link>

            {/* 7. SAP WM */}
            <Link
              href="/sap/wm"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    WM
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Warehouse Management</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Storage bin coordinates, weight capacities, and internal Transfer Orders (TO).
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Storage Bins</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.wm_warehouse_bins_count ?? 4} Bins</span>
              </div>
            </Link>

            {/* 8. SAP ABAP */}
            <Link
              href="/sap/abap"
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                    ABAP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">ABAP Workbench (SE38)</h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Custom Z-programs, data routines, SE38 compiler, and live ALV runtime execution.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Programs</span>
                <span className="font-bold text-slate-900 dark:text-white">{stats?.abap_scripts_count ?? 2} Activated</span>
              </div>
            </Link>

            {/* 9. TAX OPTION (Span across 4 columns or featured card) */}
            <Link
              href="/sap/tax"
              className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-500 hover:shadow-md transition-all group flex flex-col justify-between sm:col-span-2 md:col-span-3 lg:col-span-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    <Percent className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Enterprise Tax Hub & Statutory GST Management
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        Tax Option
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Statutory GST slabs (0%, 5%, 12%, 18%, 28%), TDS withholding, and automatic Input Tax Credit (ITC) ledgers.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans font-semibold">Configured Slabs</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{stats?.tax_rates_count ?? 6} Slabs</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-sans font-semibold text-xs flex items-center gap-1">
                    <span>Open Tax Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Operational Distribution Bar - Exact Hierarchy "Team Structure" Style */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              SAP Operations & Fleet Structure
            </h3>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View Inventory Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-center">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold block">
                Service In Repair
              </span>
              <span className="text-xl font-bold text-amber-900 dark:text-amber-200">
                {stats?.active_service_tickets ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 text-center">
              <span className="text-xs text-teal-700 dark:text-teal-300 font-semibold block">
                Fleet On Hire
              </span>
              <span className="text-xl font-bold text-teal-900 dark:text-teal-200">
                {stats?.active_rentals ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block">
                Available Fleet
              </span>
              <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
                {Math.max(0, (stats?.total_rental_assets ?? 0) - (stats?.active_rentals ?? 0))}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-center">
              <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold block">
                Low Stock Alerts
              </span>
              <span className="text-xl font-bold text-rose-900 dark:text-rose-200">
                {stats?.low_stock_alerts_count ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-center">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold block">
                Sales Dispatch
              </span>
              <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {stats?.open_sales_orders ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Live Operations Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Active Workshop & Fleet Deployments</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                  {(stats?.active_service_tickets ?? 0) + (stats?.active_rentals ?? 0)} in motion
                </span>
              </h3>
            </div>
            <Link
              href="/sap/services"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View Full Service Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeOperations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeOperations.map((op) => (
                <Link
                  key={`${op.kind}-${op.id}`}
                  href={op.link}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {op.code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${op.badgeClass}`}>
                        {op.badgeText}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate mt-1">
                      {op.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {op.subtitle}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {op.amountText}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {op.dateText}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No active service tickets or rentals deployed currently.
            </div>
          )}
        </div>

        {/* Operations Hub - Segmented Tabbed Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Operations Hub</h3>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setScopeTab("services")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "services"
                        ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Product Services</span>
                  </button>
                  <button
                    onClick={() => setScopeTab("rentals")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "rentals"
                        ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fleet Rentals</span>
                  </button>
                  <button
                    onClick={() => setScopeTab("sales")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "sales"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Sales Orders</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {scopeTab === "services"
                  ? "Showing equipment diagnostic and repair tickets in the workshop"
                  : scopeTab === "rentals"
                  ? "Active and upcoming equipment fleet rental contracts"
                  : "Customer sales orders pending dispatch or invoice execution"}
              </p>
            </div>
            <Link
              href={
                scopeTab === "services"
                  ? "/sap/services"
                  : scopeTab === "rentals"
                  ? "/sap/rentals"
                  : "/sap/sales"
              }
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>
                {scopeTab === "services"
                  ? "View All Service Tickets"
                  : scopeTab === "rentals"
                  ? "View All Rentals"
                  : "View All Sales Orders"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            {scopeTab === "services" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Ticket #</th>
                    <th className="px-5 py-3.5">Product & Equipment</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Service Type</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Technician</th>
                    <th className="px-5 py-3.5 text-right">Total Cost</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentServices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No service tickets found. Click "New Service Ticket" above to record one.
                      </td>
                    </tr>
                  ) : (
                    recentServices.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {t.ticket_number}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-xs">{t.product_name}</div>
                          {t.serial_number && (
                            <span className="text-[10px] text-slate-400">S/N: {t.serial_number}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          <div>{t.customer_name}</div>
                          <div className="text-[10px] text-slate-400">{t.customer_phone}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                            {t.service_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getServiceStatusBadge(t.status)}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {t.assigned_technician_name || "Unassigned"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{t.total_cost.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/sap/services"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {scopeTab === "rentals" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Booking #</th>
                    <th className="px-5 py-3.5">Product & Equipment</th>
                    <th className="px-5 py-3.5">Client / Customer</th>
                    <th className="px-5 py-3.5">Rate Plan</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Rental Duration</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentRentals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No rental bookings found.
                      </td>
                    </tr>
                  ) : (
                    recentRentals.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-teal-700 dark:text-teal-300">
                          {r.booking_number}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-xs">{r.product_name}</div>
                          {r.rental_product_id && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Product ID: {r.rental_product_id.slice(-6)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          <div>{r.customer_name}</div>
                          <div className="text-[10px] text-slate-400">{r.customer_phone}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                            {r.rate_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRentalStatusBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{r.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/sap/rentals"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {scopeTab === "sales" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Order #</th>
                    <th className="px-5 py-3.5">Customer Name</th>
                    <th className="px-5 py-3.5">Order Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Tax (GST)</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        No sales orders found.
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-blue-700 dark:text-blue-300">
                          {s.order_number}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div>{s.customer_name}</div>
                          {s.customer_email && (
                            <span className="text-[10px] text-slate-400">{s.customer_email}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {new Date(s.order_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getSalesStatusBadge(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{s.tax_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{s.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/sap/sales"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
