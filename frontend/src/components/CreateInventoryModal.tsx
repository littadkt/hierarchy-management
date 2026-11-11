"use client";

import React, { useEffect, useState } from "react";
import { X, PackagePlus, AlertCircle, Sparkles, Building } from "lucide-react";
import { inventoryApi, branchesApi, getErrorMessage } from "@/lib/api";
import { Branch } from "@/lib/types";

interface CreateInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated: () => void;
  initialBranchId?: string;
  branches?: Branch[];
}

export const CreateInventoryModal: React.FC<CreateInventoryModalProps> = ({
  isOpen,
  onClose,
  onItemCreated,
  initialBranchId,
  branches: propBranches,
}) => {
  const [branchId, setBranchId] = useState(initialBranchId || "");
  const [availableBranches, setAvailableBranches] = useState<Branch[]>(propBranches || []);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [vendor, setVendor] = useState("");
  const [quantity, setQuantity] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBranchId) {
      setBranchId(initialBranchId);
    }
  }, [initialBranchId, isOpen]);

  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
      setAvailableBranches(propBranches);
    } else if (isOpen) {
      branchesApi.list(true).then((bList) => {
        setAvailableBranches(bList);
        if (!branchId && bList.length > 0) {
          setBranchId(initialBranchId || bList[0].id);
        }
      }).catch(() => {});
    }
  }, [propBranches, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rate !== "" && Number(rate) < 0) {
      setError("Rate cannot be negative.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await inventoryApi.create({
        branch_id: branchId || undefined,
        code: code.trim() || undefined,
        name: name.trim(),
        rate: rate === "" ? 0 : Number(rate),
        category: category.trim(),
        brand: brand.trim(),
        vendor: vendor.trim(),
        quantity: Math.max(0, parseInt(String(quantity)) || 0),
      });

      // Reset and notify
      setCode("");
      setName("");
      setRate("");
      setCategory("");
      setBrand("");
      setVendor("");
      setQuantity(0);
      onItemCreated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                Add Inventory Product
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Register a new stock item into the inventory database (all fields optional)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Branch Selection */}
            {availableBranches.length > 0 && (
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Branch Assignment</span>
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="">Default Branch (Auto)</option>
                  {availableBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.city ? `(${b.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Barcode / Code <span className="text-slate-400 font-normal">(Optional - auto-generated if blank)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Unique barcode (e.g. 8901030383921 or leave empty)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Product Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Logitech MX Master 3S (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Unit Rate (₹ / $) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Initial In-Stock Quantity <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Category <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Peripherals (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Brand <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Logitech (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Vendor / Supplier <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Ingram Micro India (Optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? "Saving..." : "Save Product"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

