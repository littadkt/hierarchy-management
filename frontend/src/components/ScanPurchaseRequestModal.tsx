"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Scan,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Building,
  Tag,
  Sparkles,
  Camera,
  Minus,
  Plus,
  Loader2,
  UserCheck,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { inventoryApi, purchaseApi, getErrorMessage } from "@/lib/api";
import { InventoryItem, UserBrief } from "@/lib/types";
import { CameraBarcodeScanner } from "./CameraBarcodeScanner";

interface ScanPurchaseRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: () => void;
  initialCode?: string;
  initialCameraOpen?: boolean;
}

const SAMPLE_BARCODES = [
  { code: "8901030383921", name: "Dell 27\" 4K Monitor" },
  { code: "8901234567890", name: "Apple MacBook Pro 16\"" },
  { code: "8909876543210", name: "Logitech MX Master 3S" },
  { code: "8905556667778", name: "Herman Miller Chair" },
];

export const ScanPurchaseRequestModal: React.FC<ScanPurchaseRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
  initialCode = "",
  initialCameraOpen = false,
}) => {
  const { user } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [quickPicks, setQuickPicks] = useState<{ code: string; name: string }[]>(SAMPLE_BARCODES);
  const [suggestions, setSuggestions] = useState<InventoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Assigned Purchase Manager for Staff
  const [myManager, setMyManager] = useState<UserBrief | null>(null);
  const [loadingManager, setLoadingManager] = useState(false);

  const resetForm = () => {
    setCode("");
    setQuantity(1);
    setNotes("");
    setLookupState("idle");
    setFoundItem(null);
    setSuggestions([]);
    setError(null);
    setSuccessMsg(null);
  };

  // Fetch assigned Team Leader purchase manager for Staff
  useEffect(() => {
    if (isOpen && user?.role === "STAFF") {
      setLoadingManager(true);
      purchaseApi
        .getMyManager()
        .then((m) => setMyManager(m))
        .catch(() => {})
        .finally(() => setLoadingManager(false));
    }
  }, [isOpen, user]);

  // Load quick-pick inventory items on open
  useEffect(() => {
    if (isOpen) {
      inventoryApi
        .list({ limit: 6 })
        .then((res) => {
          if (res.items && res.items.length > 0) {
            setQuickPicks(res.items.map((i) => ({ code: i.code, name: i.name || i.code })));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Initial code / camera handling on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      if (initialCameraOpen) {
        setIsCameraOpen(true);
      }
      if (initialCode) {
        setCode(initialCode);
        handleLookup(initialCode, true);
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialCode, initialCameraOpen]);

  // Debounced auto-lookup when user types barcode
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setLookupState("idle");
      setFoundItem(null);
      setSuggestions([]);
      return;
    }

    if (foundItem && foundItem.code.toLowerCase() === trimmed.toLowerCase()) {
      return;
    }

    const timer = setTimeout(() => {
      // Auto-lookup only checks for an exact barcode match without mutating user input
      handleLookup(trimmed, false);
    }, 450);

    return () => clearTimeout(timer);
  }, [code, isOpen]);

  const handleCameraScan = (scannedCode: string) => {
    setCode(scannedCode);
    handleLookup(scannedCode, true);
    setIsCameraOpen(false);
  };

  const handleLookup = async (codeToLookup?: string, isExplicit = false) => {
    const targetCode = (codeToLookup ?? code).trim();
    if (!targetCode) {
      if (isExplicit) {
        setError("Please enter or scan a barcode first.");
      }
      return;
    }

    if (isExplicit) {
      setLookupState("loading");
      setError(null);
      setSuccessMsg(null);
      setSuggestions([]);
    }

    try {
      // 1. Direct barcode lookup (exact match)
      const item = await inventoryApi.byCode(targetCode);
      if (item) {
        setFoundItem(item);
        setLookupState("found");
        setSuggestions([]);
        setError(null);
        if (isExplicit) {
          setCode(item.code);
        }
        return;
      }
    } catch {
      // Direct lookup 404
    }

    // If auto-looking up while typing (not explicit button click), do NOT overwrite user input or guess
    if (!isExplicit) {
      setFoundItem(null);
      setLookupState("idle");
      return;
    }

    // 2. Explicit search fallback: Search inventory by query (in case user entered product name or partial code)
    try {
      const searchRes = await inventoryApi.list({ search: targetCode, limit: 6 });
      if (searchRes.items && searchRes.items.length > 0) {
        // If single match found
        if (searchRes.items.length === 1) {
          const item = searchRes.items[0];
          setFoundItem(item);
          setCode(item.code);
          setLookupState("found");
          setSuggestions([]);
          setError(null);
          return;
        }

        // Multiple matches: show suggestions to pick
        setSuggestions(searchRes.items);
        setFoundItem(null);
        setLookupState("idle");
        setError(null);
        return;
      }
    } catch {
      // Search error fallback
    }

    setFoundItem(null);
    setSuggestions([]);
    setLookupState("not_found");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundItem) {
      setError("Please scan or select a registered inventory product first.");
      return;
    }
    if (quantity < 1) {
      setError("Requested quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await purchaseApi.createRequest({
        code: foundItem.code,
        name: foundItem.name,
        rate: foundItem.rate,
        category: foundItem.category,
        brand: foundItem.brand,
        vendor: foundItem.vendor,
        quantity: Number(quantity),
        notes: notes.trim() || null,
      });

      setSuccessMsg(
        user?.role === "STAFF"
          ? `Purchase request submitted successfully to Team Leader ${myManager?.full_name ? `(${myManager.full_name})` : ""}!`
          : "Purchase order created successfully! Managed directly by you."
      );
      setTimeout(() => {
        onRequestCreated();
        onClose();
      }, 1000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const totalCost = Number(foundItem?.rate || 0) * Number(quantity || 0);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Submit Purchase Request
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Scan or enter barcode to display matched product details
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Hierarchy Purchase Manager Resolution Notice */}
          {user?.role === "STAFF" ? (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="text-xs flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Purchase Manager (Assigned)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                    <Lock className="w-2.5 h-2.5" /> Locked (Default)
                  </span>
                </div>
                {loadingManager ? (
                  <p className="text-slate-400 mt-1">Resolving assigned Team Leader...</p>
                ) : myManager ? (
                  <div className="mt-1">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                      {myManager.full_name}
                    </span>
                    <span className="text-slate-500 ml-1.5">
                      ({myManager.email} {myManager.department ? `• ${myManager.department}` : ""})
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      As Staff, your purchase orders are automatically directed to and managed by your Team Leader. Changing this option is not allowed.
                    </p>
                  </div>
                ) : (
                  <p className="text-amber-600 dark:text-amber-400 mt-1">
                    Department Team Leader will manage this request automatically. Changing option is not allowed for Staff.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Management Mode: Self-Managed
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                    {user?.role?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  As a <strong className="text-emerald-700 dark:text-emerald-300">{user?.role?.replace(/_/g, " ")}</strong>, you do not have an external purchase manager. This purchase order is managed directly by yourself only.
                </p>
              </div>
            </div>
          )}

          {/* Barcode input & scan section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Product Barcode / Code <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup(code, true);
                    }
                  }}
                  placeholder="Scan or enter barcode (e.g. 8901030383921)"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                  title="Scan using device webcam / camera"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLookup(code, true)}
                  disabled={lookupState === "loading" || !code.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs disabled:opacity-50 flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                >
                  {lookupState === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{lookupState === "loading" ? "Searching..." : "Check"}</span>
                </button>
              </div>
            </div>

            {/* Quick-pick barcodes */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400 font-medium">Quick pick:</span>
              {quickPicks.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setCode(s.code);
                    handleLookup(s.code, true);
                  }}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  {s.name}
                </button>
              ))}
            </div>

            {/* Multiple Search Match Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Matching products found in inventory. Click to select:</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFoundItem(item);
                        setCode(item.code);
                        setLookupState("found");
                        setSuggestions([]);
                      }}
                      className="p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 text-left transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          {item.code}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        ₹{(item.rate || 0).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barcode Match Result / Product Details View */}
          {lookupState === "found" && foundItem ? (
            <div className="space-y-4">
              {/* Product Details Card (Automatic, No Manual Inputs) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/50 dark:from-indigo-950/40 dark:via-slate-900/60 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/60 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300">
                          {foundItem.code}
                        </span>
                        {foundItem.branch_name && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Building className="w-2.5 h-2.5" />
                            <span>{foundItem.branch_name}</span>
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            foundItem.quantity > 5
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                              : foundItem.quantity > 0
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                          }`}
                        >
                          {foundItem.quantity > 0
                            ? `${foundItem.quantity} in stock`
                            : "0 in stock (Out of stock)"}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                        {foundItem.name || "Unnamed Product"}
                      </h3>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      Unit Rate
                    </span>
                    <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">
                      ₹{(foundItem.rate || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Read-only Product Details Badges */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-indigo-100/80 dark:border-indigo-900/50 text-xs">
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-50 dark:border-indigo-950/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Tag className="w-3 h-3 text-indigo-500" /> Category
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {foundItem.category || "—"}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-50 dark:border-indigo-950/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-500" /> Brand
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {foundItem.brand || "—"}
                    </span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-50 dark:border-indigo-950/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <Building className="w-3 h-3 text-indigo-500" /> Vendor
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {foundItem.vendor || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Quantity & Notes Form */}
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Requested Quantity <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))}
                      className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 text-center font-bold text-base py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Number(q) + 1)}
                      className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Justification for Purchase Manager{" "}
                    <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Replenishment for project or customer demand (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden resize-none"
                  />
                </div>

                {/* Cost Calculation Summary */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Estimated Total ({quantity} × ₹{(foundItem.rate || 0).toLocaleString()}):
                  </span>
                  <span className="font-extrabold text-base text-indigo-700 dark:text-indigo-400">
                    ₹{totalCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : lookupState === "not_found" ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Product Not Found in Inventory
                </p>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                  No inventory item matched barcode <span className="font-mono font-bold">"{code}"</span>.
                  Please verify the barcode or select an existing product from inventory.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Clear & Try Another
                  </button>
                </div>
              </div>
            </div>
          ) : lookupState === "loading" ? (
            <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Searching inventory database...</p>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Scan className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Scan or Enter Product Barcode
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Scan a barcode or choose from quick pick above. The product details will appear automatically when matched.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !foundItem || quantity < 1}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {submitting
                  ? "Submitting..."
                  : user?.role === "STAFF"
                  ? (myManager ? `Submit to ${myManager.full_name}` : "Submit to Team Leader")
                  : "Submit Order (Self-Managed)"}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Camera Barcode Scanner Viewport Modal */}
      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onScan={handleCameraScan}
        onClose={() => setIsCameraOpen(false)}
      />
    </div>,
    document.body
  );
};
