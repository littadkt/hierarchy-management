"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  ArrowRightLeft,
  Activity,
  ClipboardList,
  AlertOctagon,
  Tag,
  BarChart3,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Warehouse,
  ShieldAlert,
  Download,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import {
  SapMaterialMaster,
  SapStockTransfer,
  SapStockMovement,
  SapStockTaking,
  SapDamagedItem,
  SapPriceChange,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapInventorySuitePage() {
  const [activeTab, setActiveTab] = useState<
    | "OVERVIEW"
    | "TRANSFERS"
    | "MOVEMENTS"
    | "STOCK_TAKING"
    | "DAMAGED"
    | "PRICES"
    | "ALERTS"
  >("OVERVIEW");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data states
  const [materials, setMaterials] = useState<SapMaterialMaster[]>([]);
  const [transfers, setTransfers] = useState<SapStockTransfer[]>([]);
  const [movements, setMovements] = useState<SapStockMovement[]>([]);
  const [stockTakings, setStockTakings] = useState<SapStockTaking[]>([]);
  const [damagedItems, setDamagedItems] = useState<SapDamagedItem[]>([]);
  const [priceChanges, setPriceChanges] = useState<SapPriceChange[]>([]);

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTakingModalOpen, setIsTakingModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Forms
  const [transferForm, setTransferForm] = useState({
    material_code: "",
    material_name: "",
    source_godown: "Main Central Godown",
    destination_godown: "Yard Godown B",
    quantity: 10,
    uom: "EA",
    authorized_by: "Store In-Charge",
  });

  const [takingForm, setTakingForm] = useState({
    material_code: "",
    material_name: "",
    storage_location: "LOC-SPARES-A1",
    system_book_quantity: 35,
    physical_counted_quantity: 33,
    counted_by: "Auditor Team A",
  });

  const [damageForm, setDamageForm] = useState({
    material_code: "",
    material_name: "",
    damaged_quantity: 2,
    uom: "EA",
    estimated_loss_value: 3500,
    damage_reason: "Transit damage during offloading from supplier lorry",
    disposal_action: "SCRAP_WRITE_OFF",
    approved_by: "Operations Manager",
  });

  const [priceForm, setPriceForm] = useState({
    material_code: "",
    material_name: "",
    old_selling_price: 850,
    new_selling_price: 920,
    effective_date: "",
    reason: "Supplier raw material cost hike",
    changed_by: "Pricing Manager",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "OVERVIEW" || activeTab === "ALERTS") {
        const mats = await sapApi.listMaterials({ search: search.trim() || undefined });
        setMaterials(mats);
      } else if (activeTab === "TRANSFERS") {
        const [trfRes, mats] = await Promise.all([
          sapApi.listStockTransfers({ search: search.trim() || undefined }),
          sapApi.listMaterials(),
        ]);
        setTransfers(trfRes.items);
        setMaterials(mats);
      } else if (activeTab === "MOVEMENTS") {
        const movRes = await sapApi.listStockMovements({ search: search.trim() || undefined });
        setMovements(movRes.items);
      } else if (activeTab === "STOCK_TAKING") {
        const [stkRes, mats] = await Promise.all([
          sapApi.listStockTakings({ search: search.trim() || undefined }),
          sapApi.listMaterials(),
        ]);
        setStockTakings(stkRes.items);
        setMaterials(mats);
      } else if (activeTab === "DAMAGED") {
        const [dmgRes, mats] = await Promise.all([
          sapApi.listDamagedItems({ search: search.trim() || undefined }),
          sapApi.listMaterials(),
        ]);
        setDamagedItems(dmgRes.items);
        setMaterials(mats);
      } else if (activeTab === "PRICES") {
        const [prcRes, mats] = await Promise.all([
          sapApi.listPriceChanges({ search: search.trim() || undefined }),
          sapApi.listMaterials(),
        ]);
        setPriceChanges(prcRes.items);
        setMaterials(mats);
      }
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createStockTransfer(transferForm);
      setIsTransferModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to create godown transfer"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTaking = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createStockTaking(takingForm);
      setIsTakingModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to record stock count"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createDamagedItem(damageForm);
      setIsDamageModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to log damaged scrap"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePriceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createPriceChange({
        ...priceForm,
        effective_date: priceForm.effective_date || new Date().toISOString(),
      });
      setIsPriceModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to update item price"));
    } finally {
      setActionLoading(false);
    }
  };

  const totalStockValuation = materials.reduce((acc, m) => acc + m.current_stock * m.unit_price, 0);

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
                  SAP MM / WM Inventory
                </span>
                <span className="text-xs text-slate-500 font-mono">Stock Valuation & Godown Transfers</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Inventory & Warehouse Operations
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
            {activeTab === "TRANSFERS" && (
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                New Godown Transfer
              </button>
            )}
            {activeTab === "STOCK_TAKING" && (
              <button
                onClick={() => setIsTakingModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <ClipboardList className="w-4 h-4" />
                Physical Stock Count
              </button>
            )}
            {activeTab === "DAMAGED" && (
              <button
                onClick={() => setIsDamageModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm cursor-pointer"
              >
                <AlertOctagon className="w-4 h-4" />
                Record Damaged Scrap
              </button>
            )}
            {activeTab === "PRICES" && (
              <button
                onClick={() => setIsPriceModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Tag className="w-4 h-4" />
                Revise Item Price
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: "OVERVIEW", label: "Stock Valuation & Master", icon: BarChart3 },
            { id: "TRANSFERS", label: "Godown Transfer", icon: ArrowRightLeft },
            { id: "MOVEMENTS", label: "Issue / Receipts (Movements)", icon: Activity },
            { id: "STOCK_TAKING", label: "Physical Stock Taking", icon: ClipboardList },
            { id: "DAMAGED", label: "Damaged Items / Scrap", icon: AlertOctagon },
            { id: "PRICES", label: "Item Price List & Revisions", icon: Tag },
            { id: "ALERTS", label: "Reorder & Expiry Alerts", icon: AlertTriangle },
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
              placeholder="Search by SKU, material name, godown, movement #..."
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

        {/* TAB 1: STOCK VALUATION & MASTER */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Material SKUs</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{materials.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Total Units in Stock</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {materials.reduce((sum, m) => sum + m.current_stock, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Reorder Warning SKUs</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {materials.filter((m) => m.current_stock <= m.safety_stock).length}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Total Stock Valuation</span>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  ₹{totalStockValuation.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Item Description</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5">Storage Bin</th>
                      <th className="px-5 py-3.5">Current Stock</th>
                      <th className="px-5 py-3.5">Safety Buffer</th>
                      <th className="px-5 py-3.5">Unit Price</th>
                      <th className="px-5 py-3.5 text-right">Total Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {materials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">{m.material_code}</td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{m.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {m.material_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">{m.storage_location}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {m.current_stock} {m.base_uom}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {m.safety_stock} {m.base_uom}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">₹{m.unit_price.toLocaleString()}</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 text-right">
                          ₹{(m.current_stock * m.unit_price).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GODOWN TRANSFERS */}
        {activeTab === "TRANSFERS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Transfer #</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Source Godown</th>
                      <th className="px-5 py-3.5">Destination Godown</th>
                      <th className="px-5 py-3.5">Quantity</th>
                      <th className="px-5 py-3.5">Authorized By</th>
                      <th className="px-5 py-3.5">Transfer Date</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {t.transfer_code}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          <div>{t.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{t.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300">{t.source_godown}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          {t.destination_godown}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {t.quantity} {t.uom}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{t.authorized_by}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(t.transfer_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {transfers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          No godown transfer postings yet. Click "New Godown Transfer" above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MOVEMENTS */}
        {activeTab === "MOVEMENTS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Document #</th>
                      <th className="px-5 py-3.5">Movement Type</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Quantity</th>
                      <th className="px-5 py-3.5">Storage Location</th>
                      <th className="px-5 py-3.5">Reference / Notes</th>
                      <th className="px-5 py-3.5 text-right">Posting Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          {m.document_number}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold">
                            Type {m.movement_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          <div>{m.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{m.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {m.quantity} {m.uom}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {m.storage_location}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {m.notes || m.reference_order || "-"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 text-right font-mono">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PHYSICAL STOCK TAKING */}
        {activeTab === "STOCK_TAKING" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Count Cycle #</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Godown Location</th>
                      <th className="px-5 py-3.5">System Stock</th>
                      <th className="px-5 py-3.5">Counted Stock</th>
                      <th className="px-5 py-3.5">Variance</th>
                      <th className="px-5 py-3.5">Auditor</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {stockTakings.map((stk) => (
                      <tr key={stk.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400 font-bold">
                          {stk.count_cycle_code}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          <div>{stk.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{stk.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {stk.storage_location}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{stk.system_book_quantity}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          {stk.physical_counted_quantity}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`font-bold ${
                              stk.variance_quantity < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : stk.variance_quantity > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {stk.variance_quantity > 0 ? `+${stk.variance_quantity}` : stk.variance_quantity}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{stk.counted_by}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {stk.reconciled_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {stockTakings.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          No physical stock taking cycles recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DAMAGED ITEMS */}
        {activeTab === "DAMAGED" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Incident #</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Scrapped Qty</th>
                      <th className="px-5 py-3.5">Estimated Loss</th>
                      <th className="px-5 py-3.5">Damage Reason</th>
                      <th className="px-5 py-3.5">Disposal Action</th>
                      <th className="px-5 py-3.5 text-right">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {damagedItems.map((dmg) => (
                      <tr key={dmg.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">
                          {dmg.incident_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          <div>{dmg.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{dmg.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                          {dmg.damaged_quantity} {dmg.uom}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{dmg.estimated_loss_value.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {dmg.damage_reason}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {dmg.disposal_action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 text-right">
                          {dmg.approved_by}
                        </td>
                      </tr>
                    ))}
                    {damagedItems.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          Zero damaged stock recorded. Warehouse operations intact.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ITEM PRICES */}
        {activeTab === "PRICES" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Change #</th>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Previous Price</th>
                      <th className="px-5 py-3.5">New Selling Price</th>
                      <th className="px-5 py-3.5">Variance</th>
                      <th className="px-5 py-3.5">Effective Date</th>
                      <th className="px-5 py-3.5 text-right">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {priceChanges.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                          {p.change_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          <div>{p.material_name}</div>
                          <span className="font-mono text-slate-400 text-[11px]">{p.material_code}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 line-through">₹{p.old_selling_price.toLocaleString()}</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{p.new_selling_price.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {(((p.new_selling_price - p.old_selling_price) / p.old_selling_price) * 100).toFixed(1)}%
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(p.effective_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 text-right">{p.reason}</td>
                      </tr>
                    ))}
                    {priceChanges.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No price changes logged. Current prices match Material Master standard rates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: ALERTS & REORDER LEVEL */}
        {activeTab === "ALERTS" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Safety Threshold Alert Engine</h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Items highlighted below are currently at or below minimum safety buffer levels. Generate Purchase Requisitions immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Material SKU</th>
                      <th className="px-5 py-3.5">Name</th>
                      <th className="px-5 py-3.5">Storage Godown</th>
                      <th className="px-5 py-3.5">Current Stock</th>
                      <th className="px-5 py-3.5">Minimum Safety Level</th>
                      <th className="px-5 py-3.5">Reorder Recommendation</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {materials
                      .filter((m) => m.current_stock <= m.safety_stock)
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-5 py-3.5 font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">
                            {m.material_code}
                          </td>
                          <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{m.name}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{m.storage_location}</td>
                          <td className="px-5 py-3.5 font-bold text-rose-600 dark:text-rose-400">
                            {m.current_stock} {m.base_uom}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">
                            {m.safety_stock} {m.base_uom}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            Order +{Math.max(20, m.safety_stock * 2)} {m.base_uom}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              LOW STOCK
                            </span>
                          </td>
                        </tr>
                      ))}
                    {materials.filter((m) => m.current_stock <= m.safety_stock).length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-emerald-600 font-semibold">
                          All materials are above safety thresholds. Zero reorder shortages detected!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE GODOWN TRANSFER */}
        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Post Godown Stock Transfer</h3>
                <button
                  onClick={() => setIsTransferModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Select Material SKU *</label>
                  <select
                    required
                    value={transferForm.material_code}
                    onChange={(e) => {
                      const m = materials.find((mat) => mat.material_code === e.target.value);
                      if (m) {
                        setTransferForm({
                          ...transferForm,
                          material_code: m.material_code,
                          material_name: m.name,
                          uom: m.base_uom,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="">Choose Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.material_code}>
                        {m.name} ({m.material_code}) - Stock: {m.current_stock} {m.base_uom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Source Godown *</label>
                    <input
                      type="text"
                      required
                      value={transferForm.source_godown}
                      onChange={(e) => setTransferForm({ ...transferForm, source_godown: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Destination Godown *</label>
                    <input
                      type="text"
                      required
                      value={transferForm.destination_godown}
                      onChange={(e) => setTransferForm({ ...transferForm, destination_godown: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Transfer Quantity</label>
                    <input
                      type="number"
                      required
                      value={transferForm.quantity}
                      onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Authorized Officer</label>
                    <input
                      type="text"
                      required
                      value={transferForm.authorized_by}
                      onChange={(e) => setTransferForm({ ...transferForm, authorized_by: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTransferModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Posting..." : "Confirm Godown Transfer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: PHYSICAL STOCK COUNT */}
        {isTakingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Physical Stock Count</h3>
                <button
                  onClick={() => setIsTakingModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTaking} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Select Material SKU *</label>
                  <select
                    required
                    value={takingForm.material_code}
                    onChange={(e) => {
                      const m = materials.find((mat) => mat.material_code === e.target.value);
                      if (m) {
                        setTakingForm({
                          ...takingForm,
                          material_code: m.material_code,
                          material_name: m.name,
                          system_book_quantity: m.current_stock,
                          physical_counted_quantity: m.current_stock,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="">Choose Material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.material_code}>
                        {m.name} ({m.material_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">System Book Stock</label>
                    <input
                      type="number"
                      disabled
                      value={takingForm.system_book_quantity}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Physical Counted Quantity *</label>
                    <input
                      type="number"
                      required
                      value={takingForm.physical_counted_quantity}
                      onChange={(e) => setTakingForm({ ...takingForm, physical_counted_quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-emerald-600 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Auditor Name *</label>
                  <input
                    type="text"
                    required
                    value={takingForm.counted_by}
                    onChange={(e) => setTakingForm({ ...takingForm, counted_by: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTakingModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Submitting..." : "Submit Physical Count"}
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
