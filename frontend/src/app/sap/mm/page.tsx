"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  FileCheck,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapMaterialMaster, SapPurchaseRequisition } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapMmPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"materials" | "pr">("materials");
  const [materials, setMaterials] = useState<SapMaterialMaster[]>([]);
  const [purchaseReqs, setPurchaseReqs] = useState<SapPurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [matTypeFilter, setMatTypeFilter] = useState("ALL");
  const [prStatusFilter, setPrStatusFilter] = useState("ALL");

  // Modal: Create Material
  const [isMatModalOpen, setIsMatModalOpen] = useState(false);
  const [matCode, setMatCode] = useState("");
  const [matName, setMatName] = useState("");
  const [matType, setMatType] = useState("RAW_MATERIAL");
  const [baseUom, setBaseUom] = useState("EA");
  const [currentStock, setCurrentStock] = useState<number>(100);
  const [safetyStock, setSafetyStock] = useState<number>(20);
  const [unitPrice, setUnitPrice] = useState<number>(500);
  const [storageLoc, setStorageLoc] = useState("WH-CENTRAL-A1");
  const [valuationClass, setValuationClass] = useState("3000");
  const [hsnCode, setHsnCode] = useState("847130");
  const [taxRate, setTaxRate] = useState<number>(18);

  // Modal: Create PR
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [prMaterialCode, setPrMaterialCode] = useState("");
  const [prMaterialName, setPrMaterialName] = useState("");
  const [prQuantity, setPrQuantity] = useState<number>(10);
  const [prUom, setPrUom] = useState("EA");
  const [prEstimatedCost, setPrEstimatedCost] = useState<number>(5000);
  const [prTaxAmount, setPrTaxAmount] = useState<number>(900);
  const [prRequestedBy, setPrRequestedBy] = useState("");
  const [prRequiredDate, setPrRequiredDate] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matData, prData] = await Promise.all([
        sapApi.listMaterials({
          material_type: matTypeFilter !== "ALL" ? matTypeFilter : undefined,
          search: search.trim() || undefined,
        }),
        sapApi.listPurchaseReqs({
          status: prStatusFilter !== "ALL" ? prStatusFilter : undefined,
          search: search.trim() || undefined,
        }),
      ]);
      setMaterials(matData);
      setPurchaseReqs(prData);
    } catch (err) {
      console.error("Failed to load SAP MM data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [matTypeFilter, prStatusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matCode.trim() || !matName.trim()) {
      setFormError("Please provide Material Code and Name");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createMaterial({
        material_code: matCode.trim().toUpperCase(),
        name: matName.trim(),
        material_type: matType,
        base_uom: baseUom.trim().toUpperCase(),
        current_stock: Number(currentStock) || 0,
        safety_stock: Number(safetyStock) || 0,
        unit_price: Number(unitPrice) || 0,
        storage_location: storageLoc.trim(),
        valuation_class: valuationClass.trim(),
        hsn_code: hsnCode.trim(),
        tax_rate: Number(taxRate) || 18,
      });
      setIsMatModalOpen(false);
      setMatCode("");
      setMatName("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreatePr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prMaterialCode.trim() || !prMaterialName.trim() || prQuantity <= 0) {
      setFormError("Please select or enter Material and positive Quantity");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createPurchaseReq({
        pr_number: `PR-${Date.now().toString().slice(-6)}`,
        material_code: prMaterialCode.trim().toUpperCase(),
        material_name: prMaterialName.trim(),
        quantity: Number(prQuantity),
        uom: prUom.trim().toUpperCase(),
        estimated_cost: Number(prEstimatedCost),
        tax_amount: Number(prTaxAmount),
        requested_by: prRequestedBy.trim() || user?.full_name || "Inventory Manager",
        required_date: prRequiredDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        status: "PENDING",
      });
      setIsPrModalOpen(false);
      setPrMaterialCode("");
      setPrMaterialName("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdatePrStatus = async (id: string, newStatus: string) => {
    try {
      await sapApi.updatePurchaseReqStatus(id, newStatus);
      loadData();
    } catch (err) {
      alert("Failed to update status: " + getErrorMessage(err));
    }
  };

  // Metrics
  const totalValuation = materials.reduce(
    (acc, m) => acc + (m.current_stock || 0) * (m.unit_price || 0),
    0
  );
  const lowStockCount = materials.filter(
    (m) => (m.current_stock || 0) <= (m.safety_stock || 0)
  ).length;
  const openPrCount = purchaseReqs.filter(
    (p) => p.status === "PENDING" || p.status === "APPROVED"
  ).length;

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
                <span className="text-slate-700 dark:text-slate-200">SAP MM</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <Boxes className="w-7 h-7" />
                </div>
                SAP MM — Material & Inventory Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Master data management, valuation classes, real-time stock levels, and purchase requisitions.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsMatModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-orange-600" />
                New Material Master
              </button>
              <button
                onClick={() => setIsPrModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all"
              >
                <FileCheck className="w-4 h-4" />
                Create Purchase Req
              </button>
            </div>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Valuation */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Inventory Valuation
                </span>
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₹{totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Total valuation across warehouse stock
              </div>
            </div>

            {/* Total Materials */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Materials
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {materials.length} Items
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Raw materials, spare parts, finished goods
              </div>
            </div>

            {/* Low Stock Warning */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Low Stock Warning
                </span>
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-2xl font-bold ${lowStockCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600"}`}>
                  {lowStockCount} Items
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Items at or below safety stock threshold
              </div>
            </div>

            {/* Open Purchase Requisitions */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Open Requisitions
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {openPrCount} PRs
                </span>
              </div>
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                Pending procurement approval
              </div>
            </div>
          </div>

          {/* Segmented Tabs & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("materials")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "materials"
                    ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Material Master ({materials.length})
              </button>
              <button
                onClick={() => setActiveTab("pr")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "pr"
                    ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Purchase Requisitions ({purchaseReqs.length})
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name, UoM..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {activeTab === "materials" ? (
                <select
                  value={matTypeFilter}
                  onChange={(e) => setMatTypeFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="RAW_MATERIAL">Raw Material</option>
                  <option value="SPARE_PART">Spare Part</option>
                  <option value="FINISHED_GOOD">Finished Good</option>
                  <option value="OPERATING_SUPPLY">Operating Supply</option>
                </select>
              ) : (
                <select
                  value={prStatusFilter}
                  onChange={(e) => setPrStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PO_CREATED">PO Created</option>
                  <option value="REJECTED">Rejected</option>
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

          {/* TAB 1: MATERIAL MASTER */}
          {activeTab === "materials" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Material Code</th>
                      <th className="py-3 px-4">Material Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-right">Stock / Safety</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-right">Valuation</th>
                      <th className="py-3 px-4">HSN / Tax</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading material catalog...
                        </td>
                      </tr>
                    ) : materials.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No materials found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      materials.map((m) => {
                        const isLowStock = (m.current_stock || 0) <= (m.safety_stock || 0);
                        const totalVal = (m.current_stock || 0) * (m.unit_price || 0);
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {m.material_code}
                            </td>
                            <td className="py-3 px-4 text-slate-900 dark:text-white font-semibold">
                              {m.name}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {m.material_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {m.storage_location}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`font-mono font-bold ${
                                  isLowStock ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {m.current_stock}
                              </span>
                              <span className="text-slate-400"> / {m.safety_stock} {m.base_uom}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                              ₹{m.unit_price.toLocaleString("en-IN")}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{totalVal.toLocaleString("en-IN")}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                              {m.hsn_code} ({m.tax_rate}%)
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isLowStock ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300">
                                  <AlertTriangle className="w-3 h-3" /> Reorder
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" /> In Stock
                                </span>
                              )}
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

          {/* TAB 2: PURCHASE REQUISITIONS */}
          {activeTab === "pr" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">PR #</th>
                      <th className="py-3 px-4">Material Details</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Estimated Cost</th>
                      <th className="py-3 px-4 text-right">Tax (GST)</th>
                      <th className="py-3 px-4">Requested By</th>
                      <th className="py-3 px-4">Required Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading purchase requisitions...
                        </td>
                      </tr>
                    ) : purchaseReqs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No purchase requisitions found.
                        </td>
                      </tr>
                    ) : (
                      purchaseReqs.map((pr) => (
                        <tr key={pr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {pr.pr_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {pr.material_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {pr.material_code}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {pr.quantity} {pr.uom}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                            ₹{pr.estimated_cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            ₹{pr.tax_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {pr.requested_by}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(pr.required_date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pr.status === "APPROVED"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  : pr.status === "PO_CREATED"
                                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                  : pr.status === "REJECTED"
                                  ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {pr.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {pr.status === "PENDING" && (
                              <button
                                onClick={() => handleUpdatePrStatus(pr.id, "APPROVED")}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-all shadow-sm"
                              >
                                Approve
                              </button>
                            )}
                            {pr.status === "APPROVED" && (
                              <button
                                onClick={() => handleUpdatePrStatus(pr.id, "PO_CREATED")}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-all shadow-sm"
                              >
                                Create PO
                              </button>
                            )}
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

        {/* MODAL 1: CREATE MATERIAL MASTER */}
        {isMatModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsMatModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Create Material Master Record
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Register new SKU with valuation class and statutory tax parameters.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateMaterial} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="MAT-RAW-002"
                      value={matCode}
                      onChange={(e) => setMatCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Type
                    </label>
                    <select
                      value={matType}
                      onChange={(e) => setMatType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="RAW_MATERIAL">Raw Material (ROH)</option>
                      <option value="SPARE_PART">Spare Part (ERSA)</option>
                      <option value="FINISHED_GOOD">Finished Good (FERT)</option>
                      <option value="OPERATING_SUPPLY">Operating Supply (HIBE)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Material Name & Specification
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Copper Bushing Assembly 45mm"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Base UoM
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="EA / KG"
                      value={baseUom}
                      onChange={(e) => setBaseUom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      required
                      value={currentStock}
                      onChange={(e) => setCurrentStock(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Safety Stock
                    </label>
                    <input
                      type="number"
                      required
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unit Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage Location
                    </label>
                    <input
                      type="text"
                      placeholder="WH-MAIN-BAY4"
                      value={storageLoc}
                      onChange={(e) => setStorageLoc(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Valuation Class
                    </label>
                    <input
                      type="text"
                      placeholder="3000"
                      value={valuationClass}
                      onChange={(e) => setValuationClass(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      placeholder="847130"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      GST Rate %
                    </label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMatModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Creating..." : "Save Material"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: CREATE PURCHASE REQUISITION */}
        {isPrModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsPrModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                New Purchase Requisition (PR)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Raise an internal procurement request for stock replenishment.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreatePr} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Material from Catalog
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = materials.find((m) => m.material_code === e.target.value);
                      if (selected) {
                        setPrMaterialCode(selected.material_code);
                        setPrMaterialName(selected.name);
                        setPrUom(selected.base_uom);
                        const cost = selected.unit_price * prQuantity;
                        setPrEstimatedCost(cost);
                        setPrTaxAmount((cost * (selected.tax_rate || 18)) / 100);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="">-- Choose Existing Material --</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.material_code}>
                        {m.material_code} - {m.name} (Stock: {m.current_stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="MAT-RAW-001"
                      value={prMaterialCode}
                      onChange={(e) => setPrMaterialCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="High-Density Aluminum Ingot"
                      value={prMaterialName}
                      onChange={(e) => setPrMaterialName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={prQuantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        setPrQuantity(q);
                        const selected = materials.find((m) => m.material_code === prMaterialCode);
                        if (selected) {
                          const cost = selected.unit_price * q;
                          setPrEstimatedCost(cost);
                          setPrTaxAmount((cost * (selected.tax_rate || 18)) / 100);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unit of Measure (UoM)
                    </label>
                    <input
                      type="text"
                      value={prUom}
                      onChange={(e) => setPrUom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Estimated Cost (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={prEstimatedCost}
                      onChange={(e) => setPrEstimatedCost(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tax GST (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={prTaxAmount}
                      onChange={(e) => setPrTaxAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Requested By
                    </label>
                    <input
                      type="text"
                      placeholder="Jane Doe (Lead Engineer)"
                      value={prRequestedBy}
                      onChange={(e) => setPrRequestedBy(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Required By Date
                    </label>
                    <input
                      type="date"
                      value={prRequiredDate}
                      onChange={(e) => setPrRequiredDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Submitting..." : "Submit Requisition"}
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
