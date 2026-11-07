"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Search,
  Scan,
  AlertCircle,
  Tag,
  Building,
  Layers,
  ShoppingBag,
  Boxes,
  Camera,
  Edit,
  Trash2,
  Sliders,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { inventoryApi, getErrorMessage } from "@/lib/api";
import { InventoryItem } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CreateInventoryModal } from "@/components/CreateInventoryModal";
import { EditInventoryModal } from "@/components/EditInventoryModal";
import { ScanPurchaseRequestModal } from "@/components/ScanPurchaseRequestModal";
import { ExcelUploadModal } from "@/components/ExcelUploadModal";

export default function InventoryPage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExcelUploadOpen, setIsExcelUploadOpen] = useState(false);
  const [selectedScanCode, setSelectedScanCode] = useState<string | undefined>(undefined);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Edit / Delete states
  const [selectedEditItem, setSelectedEditItem] = useState<InventoryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isQuickQtyOnly, setIsQuickQtyOnly] = useState(false);

  const canManageInventory = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  // Multi-select for bulk delete (Admin & Super Admin only)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);

  const allItemsSelected =
    items.length > 0 && items.every((i) => selectedItemIds.includes(i.id));
  const someItemsSelected =
    items.length > 0 &&
    items.some((i) => selectedItemIds.includes(i.id)) &&
    !allItemsSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someItemsSelected;
    }
  }, [someItemsSelected]);

  const handleToggleSelectAll = () => {
    if (allItemsSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((i) => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteItems = async () => {
    if (!canManageInventory || selectedItemIds.length === 0) return;
    const count = selectedItemIds.length;
    const ok = await confirm({
      title: "Delete Selected Inventory Items",
      message: `Are you sure you want to permanently delete the ${count} selected inventory item(s)? This action cannot be undone.`,
      confirmText: `Delete ${count} Item(s)`,
      type: "danger",
    });
    if (!ok) return;

    try {
      const res = await inventoryApi.bulkDelete(selectedItemIds);
      setSelectedItemIds([]);
      loadInventory();

      if (res.failed_count > 0 && res.errors.length > 0) {
        await alert({
          title: "Partial Delete Complete",
          message: `Successfully deleted ${res.deleted_count} item(s).\n\n${res.failed_count} item(s) could not be deleted:\n${res.errors.join("\n")}`,
          type: "warning",
        });
      } else {
        await alert({
          title: "Items Deleted",
          message: `Successfully deleted ${res.deleted_count} inventory item(s).`,
          type: "success",
        });
      }
    } catch (err) {
      await alert({
        title: "Bulk Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    const ok = await confirm({
      title: "Delete Inventory Item",
      message: `Are you sure you want to delete inventory item "${item.name}" (${item.code})?`,
      confirmText: "Delete Item",
      type: "danger",
    });
    if (!ok) return;

    try {
      await inventoryApi.delete(item.id);
      setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
      loadInventory();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await inventoryApi.list({
        search: search.trim() || undefined,
        category: categoryFilter.trim() || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadInventory();
    }
  }, [user, categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInventory();
  };

  const handleQuickRequest = (code: string) => {
    setSelectedScanCode(code);
    setIsScanOpen(true);
  };

  // Distinct categories from loaded items
  const categories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Boxes className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <span>Inventory Database</span>
            </h1>
            <p className="text-xs text-slate-500">
              Track stock levels, barcode identifiers, unit rates, and vendor assignments
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                setSelectedScanCode(undefined);
                setIsCameraOpen(true);
                setIsScanOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Scan with Camera</span>
            </button>
            <button
              onClick={() => {
                setSelectedScanCode(undefined);
                setIsCameraOpen(false);
                setIsScanOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Scan className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Enter / Scan Code</span>
            </button>
            {canManageInventory && selectedItemIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDeleteItems}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected ({selectedItemIds.length})</span>
              </button>
            )}
            {canManageInventory && (
              <button
                onClick={() => setIsExcelUploadOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-semibold text-xs flex items-center gap-2 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Import Excel</span>
              </button>
            )}
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Inventory Item</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Inventory Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Products
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{total}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Units In Stock
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {items.reduce((acc, curr) => acc + curr.quantity, 0)}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Product Categories
              </p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {categories.length}
              </h3>
            </div>
          </div>
        </div>

        {/* Inventory Catalog Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, name, vendor..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-full"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors shrink-0"
              >
                Search
              </button>
            </form>
          </div>

          {/* Selection Banner for Bulk Delete */}
          {canManageInventory && selectedItemIds.length > 0 && (
            <div className="mx-4 my-3 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-800 dark:text-rose-200">
                  {selectedItemIds.length} of {items.length} item{items.length > 1 ? "s" : ""} selected
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 underline font-medium"
                >
                  Deselect all
                </button>
              </div>
              <button
                type="button"
                onClick={handleBulkDeleteItems}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedItemIds.length})</span>
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {canManageInventory && (
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        ref={selectAllRef}
                        checked={allItemsSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer align-middle"
                        title={allItemsSelected ? "Deselect all items" : "Select all items"}
                      />
                    </th>
                  )}
                  <th className="px-5 py-3.5">Barcode / Code</th>
                  <th className="px-5 py-3.5">Product Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Brand</th>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Rate</th>
                  <th className="px-5 py-3.5">Stock Qty</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={canManageInventory ? 9 : 8} className="px-5 py-12 text-center text-slate-400">
                      Loading inventory items...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={canManageInventory ? 9 : 8} className="px-5 py-12 text-center text-slate-400">
                      No inventory items found. Click "Add Inventory Item" to register products.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/30" : ""
                        }`}
                      >
                        {canManageInventory && (
                          <td className="w-10 px-4 py-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer align-middle"
                            />
                          </td>
                        )}
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {item.code}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                        {item.name || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.category ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                        {item.brand || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{item.vendor || "—"}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                        ₹{(item.rate ?? 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.quantity > 5
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : item.quantity > 0
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {item.quantity} in stock
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {canManageInventory && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedEditItem(item);
                                setIsQuickQtyOnly(true);
                                setIsEditOpen(true);
                              }}
                              title="Quick stock edit"
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900 transition-colors inline-flex items-center gap-1"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Qty</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEditItem(item);
                                setIsQuickQtyOnly(false);
                                setIsEditOpen(true);
                              }}
                              title="Edit item details"
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              title="Delete item"
                              className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleQuickRequest(item.code)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors inline-flex items-center gap-1"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Request Purchase</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateInventoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onItemCreated={() => loadInventory()}
      />

      <EditInventoryModal
        item={selectedEditItem}
        isOpen={isEditOpen}
        quickQuantityOnly={isQuickQtyOnly}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedEditItem(null);
        }}
        onItemUpdated={() => loadInventory()}
      />

      <ScanPurchaseRequestModal
        isOpen={isScanOpen}
        initialCode={selectedScanCode}
        initialCameraOpen={isCameraOpen}
        onClose={() => {
          setIsScanOpen(false);
          setIsCameraOpen(false);
          setSelectedScanCode(undefined);
        }}
        onRequestCreated={() => loadInventory()}
      />

      <ExcelUploadModal
        isOpen={isExcelUploadOpen}
        onClose={() => setIsExcelUploadOpen(false)}
        title="Import Inventory Items"
        description="Upload an Excel (.xlsx/.xls) or CSV (.csv) file to bulk add or update inventory items."
        expectedColumns={[
          "Barcode",
          "Product Name",
          "Rate",
          "Category",
          "Brand",
          "Vendor",
          "Quantity",
        ]}
        onDownloadTemplate={inventoryApi.downloadTemplate}
        templateFilename="inventory_import_template.xlsx"
        onUpload={inventoryApi.uploadExcel}
        onSuccess={() => loadInventory()}
      />
    </ProtectedRoute>
  );
}

