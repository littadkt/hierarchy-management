"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Warehouse,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  Weight,
  CheckCircle2,
  AlertCircle,
  X,
  MapPin,
  Check,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapWarehouseBin, SapTransferOrder } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapWmPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"bins" | "transfer">("bins");
  const [bins, setBins] = useState<SapWarehouseBin[]>([]);
  const [transfers, setTransfers] = useState<SapTransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [toStatusFilter, setToStatusFilter] = useState("ALL");

  // Create Bin Modal
  const [isBinModalOpen, setIsBinModalOpen] = useState(false);
  const [binCode, setBinCode] = useState("");
  const [warehouseZone, setWarehouseZone] = useState("ZONE-A");
  const [storageType, setStorageType] = useState("RACK");
  const [maxCapacityKg, setMaxCapacityKg] = useState<number>(1000);
  const [currentWeightKg, setCurrentWeightKg] = useState<number>(0);
  const [currentMaterialCode, setCurrentMaterialCode] = useState("");
  const [currentMaterialName, setCurrentMaterialName] = useState("");
  const [currentStockQty, setCurrentStockQty] = useState<number>(0);
  const [binStatus, setBinStatus] = useState("EMPTY");

  // Create Transfer Order Modal
  const [isToModalOpen, setIsToModalOpen] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [toMaterialCode, setToMaterialCode] = useState("");
  const [toMaterialName, setToMaterialName] = useState("");
  const [sourceBin, setSourceBin] = useState("");
  const [destBin, setDestBin] = useState("");
  const [toQuantity, setToQuantity] = useState<number>(10);
  const [toUom, setToUom] = useState("EA");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [binData, toData] = await Promise.all([
        sapApi.listWarehouseBins({
          warehouse_zone: zoneFilter !== "ALL" ? zoneFilter : undefined,
          search: search.trim() || undefined,
        }),
        sapApi.listTransferOrders({
          status: toStatusFilter !== "ALL" ? toStatusFilter : undefined,
          search: search.trim() || undefined,
        }),
      ]);
      setBins(binData);
      setTransfers(toData);
    } catch (err) {
      console.error("Failed to load SAP WM data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [zoneFilter, toStatusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binCode.trim()) {
      setFormError("Please enter Bin Code");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createWarehouseBin({
        bin_code: binCode.trim().toUpperCase(),
        warehouse_zone: warehouseZone.trim(),
        storage_type: storageType,
        max_weight_capacity_kg: Number(maxCapacityKg) || 1000,
        current_weight_kg: Number(currentWeightKg) || 0,
        current_material_code: currentMaterialCode.trim() || undefined,
        current_material_name: currentMaterialName.trim() || undefined,
        current_stock_qty: Number(currentStockQty) || 0,
        status: binStatus,
      });
      setIsBinModalOpen(false);
      setBinCode("");
      setCurrentMaterialCode("");
      setCurrentMaterialName("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toMaterialCode.trim() || !sourceBin.trim() || !destBin.trim()) {
      setFormError("Please enter Material, Source Bin, and Destination Bin");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createTransferOrder({
        transfer_number: transferNumber.trim() || `TO-${Date.now().toString().slice(-6)}`,
        material_code: toMaterialCode.trim().toUpperCase(),
        material_name: toMaterialName.trim() || toMaterialCode.trim(),
        source_bin: sourceBin.trim().toUpperCase(),
        destination_bin: destBin.trim().toUpperCase(),
        quantity: Number(toQuantity) || 1,
        uom: toUom.trim().toUpperCase(),
        status: "OPEN",
      });
      setIsToModalOpen(false);
      setTransferNumber("");
      setToMaterialCode("");
      setSourceBin("");
      setDestBin("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmTransfer = async (id: string) => {
    try {
      await sapApi.updateTransferOrderStatus(id, "CONFIRMED");
      loadData();
    } catch (err) {
      alert("Failed to confirm transfer: " + getErrorMessage(err));
    }
  };

  // Metrics
  const totalCapacityKg = bins.reduce((acc, b) => acc + (b.max_weight_capacity_kg || 0), 0);
  const totalWeightStored = bins.reduce((acc, b) => acc + (b.current_weight_kg || 0), 0);
  const occupiedBins = bins.filter((b) => b.status === "OCCUPIED" || b.status === "FULL").length;
  const openTos = transfers.filter((t) => t.status === "OPEN").length;
  const zones = Array.from(new Set(bins.map((b) => b.warehouse_zone).filter(Boolean)));

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
                <span className="text-slate-700 dark:text-slate-200">SAP WM</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Warehouse className="w-7 h-7" />
                </div>
                SAP WM — Warehouse Management
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Storage bin location matrix, capacity utilization, and internal stock transfer orders (TO).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsBinModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-amber-600" />
                New Storage Bin
              </button>
              <button
                onClick={() => setIsToModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Create Transfer Order
              </button>
            </div>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Bins */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Storage Bin Network
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Warehouse className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {bins.length} Bins
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Across {zones.length} active warehouse zones
              </div>
            </div>

            {/* Occupancy Rate */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Bin Occupancy
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {occupiedBins} / {bins.length}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {bins.length > 0 ? Math.round((occupiedBins / bins.length) * 100) : 0}% bins occupied
              </div>
            </div>

            {/* Total Weight Stored */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Weight Utilization
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Weight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {totalWeightStored.toLocaleString()} kg
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                of {totalCapacityKg.toLocaleString()} kg total capacity
              </div>
            </div>

            {/* Open TOs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Open Transfer Orders
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {openTos} TOs
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Pending physical material movement
              </div>
            </div>
          </div>

          {/* Segmented Tabs & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("bins")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "bins"
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Storage Bins ({bins.length})
              </button>
              <button
                onClick={() => setActiveTab("transfer")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "transfer"
                    ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Transfer Orders ({transfers.length})
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search bin, zone, material..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {activeTab === "bins" ? (
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Zones</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={toStatusFilter}
                  onChange={(e) => setToStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="OPEN">Open</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
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

          {/* TAB 1: STORAGE BINS */}
          {activeTab === "bins" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Bin Code</th>
                      <th className="py-3 px-4">Warehouse Zone</th>
                      <th className="py-3 px-4">Storage Type</th>
                      <th className="py-3 px-4">Weight Capacity</th>
                      <th className="py-3 px-4">Stored SKU</th>
                      <th className="py-3 px-4 text-right">Stock Qty</th>
                      <th className="py-3 px-4 text-center">Bin Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading warehouse bins...
                        </td>
                      </tr>
                    ) : bins.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No storage bins found.
                        </td>
                      </tr>
                    ) : (
                      bins.map((b) => {
                        const pct =
                          b.max_weight_capacity_kg > 0
                            ? Math.min(100, Math.round((b.current_weight_kg / b.max_weight_capacity_kg) * 100))
                            : 0;
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {b.bin_code}
                            </td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">
                              {b.warehouse_zone}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {b.storage_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 w-44">
                              <div className="flex justify-between text-[11px] font-mono text-slate-700 dark:text-slate-300 mb-1">
                                <span>{b.current_weight_kg} / {b.max_weight_capacity_kg} kg</span>
                                <span className="font-bold">{pct}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {b.current_material_name ? (
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {b.current_material_name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {b.current_material_code}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Empty Slot</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {b.current_stock_qty > 0 ? b.current_stock_qty : "—"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.status === "EMPTY"
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    : b.status === "OCCUPIED"
                                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                    : b.status === "FULL"
                                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                    : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                                }`}
                              >
                                {b.status}
                              </span>
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

          {/* TAB 2: TRANSFER ORDERS */}
          {activeTab === "transfer" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">TO #</th>
                      <th className="py-3 px-4">Material Details</th>
                      <th className="py-3 px-4">Source Bin</th>
                      <th className="py-3 px-4">Destination Bin</th>
                      <th className="py-3 px-4 text-right">Transfer Qty</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading transfer orders...
                        </td>
                      </tr>
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No transfer orders found.
                        </td>
                      </tr>
                    ) : (
                      transfers.map((to) => (
                        <tr key={to.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {to.transfer_number}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {to.material_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {to.material_code}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {to.source_bin}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {to.destination_bin}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {to.quantity} {to.uom}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                to.status === "CONFIRMED"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                  : to.status === "OPEN"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {to.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {to.status === "OPEN" && (
                              <button
                                onClick={() => handleConfirmTransfer(to.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-all shadow-sm flex items-center gap-1 ml-auto"
                              >
                                <Check className="w-3 h-3" /> Confirm Putaway
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

        {/* MODAL 1: CREATE STORAGE BIN */}
        {isBinModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsBinModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Configure Storage Bin (WM)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Define warehouse physical coordinate and maximum weight threshold.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateBin} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bin Coordinate Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="BIN-A1-04"
                      value={binCode}
                      onChange={(e) => setBinCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Warehouse Zone
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ZONE-A"
                      value={warehouseZone}
                      onChange={(e) => setWarehouseZone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage Type
                    </label>
                    <select
                      value={storageType}
                      onChange={(e) => setStorageType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="RACK">High-Bay Rack</option>
                      <option value="SHELF">Standard Shelf</option>
                      <option value="FLOOR_PALLET">Floor Pallet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Max Weight Capacity (kg)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={maxCapacityKg}
                      onChange={(e) => setMaxCapacityKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Material Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="MAT-RAW-001"
                      value={currentMaterialCode}
                      onChange={(e) => setCurrentMaterialCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Material Name
                    </label>
                    <input
                      type="text"
                      placeholder="Aluminum Ingot"
                      value={currentMaterialName}
                      onChange={(e) => setCurrentMaterialName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Weight Stored (kg)
                    </label>
                    <input
                      type="number"
                      value={currentWeightKg}
                      onChange={(e) => setCurrentWeightKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Status
                    </label>
                    <select
                      value={binStatus}
                      onChange={(e) => setBinStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="EMPTY">Empty</option>
                      <option value="OCCUPIED">Occupied</option>
                      <option value="FULL">Full</option>
                      <option value="LOCKED">Locked</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBinModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Saving..." : "Save Storage Bin"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: CREATE TRANSFER ORDER */}
        {isToModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsToModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Stock Transfer Order (TO)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Execute internal warehouse bin-to-bin movement.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="MAT-RAW-001"
                      value={toMaterialCode}
                      onChange={(e) => setToMaterialCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Material Name
                    </label>
                    <input
                      type="text"
                      placeholder="Aluminum Ingot"
                      value={toMaterialName}
                      onChange={(e) => setToMaterialName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Source Bin
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="BIN-A1-01"
                      value={sourceBin}
                      onChange={(e) => setSourceBin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Destination Bin
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="BIN-A1-03"
                      value={destBin}
                      onChange={(e) => setDestBin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
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
                      value={toQuantity}
                      onChange={(e) => setToQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UoM
                    </label>
                    <input
                      type="text"
                      value={toUom}
                      onChange={(e) => setToUom(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsToModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Creating..." : "Issue Transfer Order"}
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
