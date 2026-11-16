"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Factory,
  Layers,
  Play,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Gauge,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapProductionOrder, SapBomItem } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapPpPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "bom">("orders");
  const [orders, setOrders] = useState<SapProductionOrder[]>([]);
  const [bomItems, setBomItems] = useState<SapBomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Order Modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [plannedQty, setPlannedQty] = useState<number>(50);
  const [orderUom, setOrderUom] = useState("UNITS");
  const [workCenter, setWorkCenter] = useState("WC-ASSEMBLY-01");
  const [priority, setPriority] = useState("HIGH");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Create BOM Modal
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [bomCode, setBomCode] = useState("");
  const [parentProduct, setParentProduct] = useState("");
  const [componentCode, setComponentCode] = useState("");
  const [componentName, setComponentName] = useState("");
  const [compQty, setCompQty] = useState<number>(1);
  const [compUom, setCompUom] = useState("EA");
  const [scrapPct, setScrapPct] = useState<number>(2.0);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orderData, bomData] = await Promise.all([
        sapApi.listProductionOrders({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          search: search.trim() || undefined,
        }),
        sapApi.listBomItems({ search: search.trim() || undefined }),
      ]);
      setOrders(orderData);
      setBomItems(bomData);
    } catch (err) {
      console.error("Failed to load SAP PP data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || plannedQty <= 0) {
      setFormError("Please enter valid Product Name and Planned Quantity");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createProductionOrder({
        order_number: orderNumber.trim() || `ORD-${Date.now().toString().slice(-6)}`,
        product_name: productName.trim(),
        planned_quantity: Number(plannedQty),
        produced_quantity: 0,
        uom: orderUom.trim().toUpperCase(),
        work_center: workCenter.trim(),
        start_date: startDate || new Date().toISOString(),
        end_date: endDate || new Date(Date.now() + 14 * 86400000).toISOString(),
        status: "PLANNED",
        priority: priority,
      });
      setIsOrderModalOpen(false);
      setOrderNumber("");
      setProductName("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomCode.trim() || !parentProduct.trim() || !componentName.trim()) {
      setFormError("Please enter BOM Code, Parent Product, and Component Details");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createBomItem({
        bom_code: bomCode.trim().toUpperCase(),
        parent_product: parentProduct.trim(),
        component_code: componentCode.trim().toUpperCase() || `CMP-${Date.now().toString().slice(-4)}`,
        component_name: componentName.trim(),
        quantity: Number(compQty) || 1,
        uom: compUom.trim().toUpperCase(),
        scrap_factor_pct: Number(scrapPct) || 0,
      });
      setIsBomModalOpen(false);
      setBomCode("");
      setParentProduct("");
      setComponentCode("");
      setComponentName("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (id: string, newStatus: string) => {
    try {
      await sapApi.updateProductionOrderStatus(id, newStatus);
      loadData();
    } catch (err) {
      alert("Failed to update status: " + getErrorMessage(err));
    }
  };

  // Metrics
  const activeOrders = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;
  const inProcessCount = orders.filter((o) => o.status === "IN_PROCESS").length;
  const totalPlannedUnits = orders.reduce((acc, o) => acc + (o.planned_quantity || 0), 0);
  const totalProducedUnits = orders.reduce((acc, o) => acc + (o.produced_quantity || 0), 0);
  const completionPct = totalPlannedUnits > 0 ? Math.round((totalProducedUnits / totalPlannedUnits) * 100) : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 text-slate-800 dark:text-slate-100">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Bar / Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Link
                  href="/sap"
                  className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> SAP Hub
                </Link>
                <span>/</span>
                <span className="text-slate-700 dark:text-slate-200">SAP PP</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Factory className="w-7 h-7" />
                </div>
                SAP PP — Production Planning
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manufacturing shop floor orders, Bill of Materials (BOM) hierarchy, and work-center scheduling.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsBomModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-cyan-600" />
                Add BOM Component
              </button>
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm transition-all"
              >
                <Cpu className="w-4 h-4" />
                Create Production Order
              </button>
            </div>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Orders */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Production Orders
                </span>
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Factory className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {activeOrders} Active
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Planned or released orders in shop floor
              </div>
            </div>

            {/* In-Process */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  In Assembly & Milling
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Gauge className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {inProcessCount} Orders
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Work centers currently operating
              </div>
            </div>

            {/* BOM Components */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  BOM Specifications
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {bomItems.length} Items
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Components registered in BOM master
              </div>
            </div>

            {/* Overall Progress */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Shop-Floor Completion
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {completionPct}%
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {totalProducedUnits} of {totalPlannedUnits} units completed
              </div>
            </div>
          </div>

          {/* Segmented Tabs & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "orders"
                    ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Production Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab("bom")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "bom"
                    ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Bill of Materials (BOM) ({bomItems.length})
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search order #, product, BOM..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {activeTab === "orders" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="PLANNED">Planned</option>
                  <option value="RELEASED">Released</option>
                  <option value="IN_PROCESS">In Process</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              )}

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </form>
          </div>

          {/* TAB 1: PRODUCTION ORDERS */}
          {activeTab === "orders" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Work Center</th>
                      <th className="py-3 px-4 text-center">Priority</th>
                      <th className="py-3 px-4">Progress (Units)</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading production orders...
                        </td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          No production orders found.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => {
                        const pct =
                          ord.planned_quantity > 0
                            ? Math.min(100, Math.round((ord.produced_quantity / ord.planned_quantity) * 100))
                            : 0;
                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {ord.order_number}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                              {ord.product_name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                              {ord.work_center}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.priority === "HIGH"
                                    ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {ord.priority}
                              </span>
                            </td>
                            <td className="py-3 px-4 w-48">
                              <div className="flex justify-between text-[11px] font-mono text-slate-700 dark:text-slate-300 mb-1">
                                <span>{ord.produced_quantity} / {ord.planned_quantity} {ord.uom}</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-cyan-600 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              <div>{new Date(ord.start_date).toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">to {new Date(ord.end_date).toLocaleDateString()}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ord.status === "COMPLETED"
                                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                    : ord.status === "IN_PROCESS"
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                    : ord.status === "RELEASED"
                                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {ord.status === "PLANNED" && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(ord.id, "RELEASED")}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold transition-all shadow-sm"
                                  >
                                    Release
                                  </button>
                                )}
                                {ord.status === "RELEASED" && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(ord.id, "IN_PROCESS")}
                                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold transition-all shadow-sm"
                                  >
                                    Start Process
                                  </button>
                                )}
                                {ord.status === "IN_PROCESS" && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(ord.id, "COMPLETED")}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-all shadow-sm"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: BILL OF MATERIALS */}
          {activeTab === "bom" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">BOM Code</th>
                      <th className="py-3 px-4">Parent Product / Assembly</th>
                      <th className="py-3 px-4">Component Code</th>
                      <th className="py-3 px-4">Component Name</th>
                      <th className="py-3 px-4 text-right">Quantity Required</th>
                      <th className="py-3 px-4 text-right">Scrap Factor %</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading BOM hierarchy...
                        </td>
                      </tr>
                    ) : bomItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No BOM items registered.
                        </td>
                      </tr>
                    ) : (
                      bomItems.map((bom) => (
                        <tr key={bom.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {bom.bom_code}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {bom.parent_product}
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-600 dark:text-cyan-400">
                            {bom.component_code}
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                            {bom.component_name}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {bom.quantity} {bom.uom}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            {bom.scrap_factor_pct}%
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Active BOM
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL 1: CREATE PRODUCTION ORDER */}
        {isOrderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Release Production Order (PP)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Schedule a shop-floor manufacturing run for finished goods or assemblies.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Order Number
                    </label>
                    <input
                      type="text"
                      placeholder="ORD-2026-004"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="HIGH">High Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="LOW">Low Priority</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Finished Product / Sub-Assembly Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Industrial Hydraulic Pump Unit"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Planned Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={plannedQty}
                      onChange={(e) => setPlannedQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UoM
                    </label>
                    <input
                      type="text"
                      value={orderUom}
                      onChange={(e) => setOrderUom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Work Center
                    </label>
                    <input
                      type="text"
                      value={workCenter}
                      onChange={(e) => setWorkCenter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Planned Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Planned Completion Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Scheduling..." : "Create Order"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ADD BOM COMPONENT */}
        {isBomModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsBomModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Add BOM Component Item
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Define raw material or part requirement in assembly BOM.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateBom} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      BOM Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="BOM-PUMP-01"
                      value={bomCode}
                      onChange={(e) => setBomCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Parent Product
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Hydraulic Pump Unit"
                      value={parentProduct}
                      onChange={(e) => setParentProduct(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Component Code
                    </label>
                    <input
                      type="text"
                      placeholder="CMP-SEAL-01"
                      value={componentCode}
                      onChange={(e) => setComponentCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Component Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Viton O-Ring High Pressure"
                      value={componentName}
                      onChange={(e) => setComponentName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Qty / Unit
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={compQty}
                      onChange={(e) => setCompQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UoM
                    </label>
                    <input
                      type="text"
                      value={compUom}
                      onChange={(e) => setCompUom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Scrap %
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={scrapPct}
                      onChange={(e) => setScrapPct(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBomModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Adding..." : "Add to BOM"}
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
