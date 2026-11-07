"use client";

import React, { useState } from "react";
import { X, CheckCircle, AlertCircle, ShoppingCart, PackageCheck, Ban, Clock } from "lucide-react";
import { purchaseApi, getErrorMessage } from "@/lib/api";
import { PurchaseRequest, PurchaseRequestStatus } from "@/lib/types";

interface PurchaseStatusModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export const PurchaseStatusModal: React.FC<PurchaseStatusModalProps> = ({
  request,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const [status, setStatus] = useState<PurchaseRequestStatus>(request?.status || "OPEN");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when request prop changes
  React.useEffect(() => {
    if (request) {
      setStatus(request.status);
      setRemarks("");
      setError(null);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await purchaseApi.updateStatus(request.id, status, remarks.trim() || undefined);
      onStatusUpdated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const statusOptions: {
    value: PurchaseRequestStatus;
    title: string;
    desc: string;
    icon: any;
    color: string;
  }[] = [
    {
      value: "OPEN",
      title: "Open (Default)",
      desc: "Request received and awaiting procurement review.",
      icon: Clock,
      color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800",
    },
    {
      value: "ORDERED",
      title: "Ordered",
      desc: "Purchase order placed with vendor/supplier.",
      icon: ShoppingCart,
      color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/60 dark:border-purple-800",
    },
    {
      value: "NOT_IN_STOCK",
      title: "Not in Stock",
      desc: "Vendor out of stock or item discontinued.",
      icon: Ban,
      color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/60 dark:border-rose-800",
    },
    {
      value: "RECEIVED",
      title: "Received (Complete)",
      desc: "Items received and verified. Automatically increments inventory stock!",
      icon: PackageCheck,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-lg">
              Update Purchase Request Status
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Item: {request.name} ({request.code})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Status radio list */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Select Status
            </label>
            <div className="space-y-2">
              {statusOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = status === opt.value;
                return (
                  <label
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name="purchase_status"
                      checked={isSelected}
                      onChange={() => setStatus(opt.value)}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {opt.title}
                        </span>
                        {opt.value === "RECEIVED" && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.2 rounded-full font-bold">
                            Completes Order
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Status Change Remarks (Optional)
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. PO #99482 dispatched via FedEx, expected delivery on Friday"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden resize-none"
            />
          </div>

          {/* Actions */}
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
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? "Updating..." : "Confirm Status Update"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

