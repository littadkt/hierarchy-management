"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Scan,
  UserCheck,
  ShoppingBag,
  Filter,
  Search,
  History,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Building,
  Camera,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  Calendar,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { purchaseApi, getErrorMessage } from "@/lib/api";
import { PurchaseRequest, PurchaseRequestStatus, UserBrief } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { PurchaseStatusBadge } from "@/components/PurchaseStatusBadge";
import { ScanPurchaseRequestModal } from "@/components/ScanPurchaseRequestModal";
import { PurchaseStatusModal } from "@/components/PurchaseStatusModal";
import { PurchaseHistoryModal } from "@/components/PurchaseHistoryModal";
import { EditPurchaseRequestModal } from "@/components/EditPurchaseRequestModal";

function toLocalDateStr(dateVal?: string | null): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

export default function PurchasesPage() {
  const { user, hasPermission } = useAuth();
  const { confirm, alert } = useConfirm();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter, Date Picker, Managed by User Filter, Search, and Sorting
  type SortField = "user" | "date" | "total" | "product";
  type SortOrder = "asc" | "desc";

  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [pmFilter, setPmFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Modals state
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCameraAutoOpen, setIsCameraAutoOpen] = useState(false);
  const [statusModalRequest, setStatusModalRequest] = useState<PurchaseRequest | null>(null);
  const [historyModalRequest, setHistoryModalRequest] = useState<PurchaseRequest | null>(null);
  const [editModalRequest, setEditModalRequest] = useState<PurchaseRequest | null>(null);

  const handleSortToggle = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "user" || field === "product" ? "asc" : "desc");
    }
  };

  const canModifyRequest = (r: PurchaseRequest) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    return r.requested_by_id === user.id && r.status === "OPEN";
  };

  const handleDeleteRequest = async (r: PurchaseRequest) => {
    const ok = await confirm({
      title: "Delete Purchase Request",
      message: `Are you sure you want to delete the purchase request for "${r.name}" (${r.code})?`,
      confirmText: "Delete Request",
      type: "danger",
    });
    if (!ok) return;

    try {
      await purchaseApi.deleteRequest(r.id);
      loadData();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  // Load PM / TL managers from backend API
  const [pmManagersList, setPmManagersList] = useState<UserBrief[]>([]);

  useEffect(() => {
    const fetchManagers = async () => {
      try {
        const mgrs = await purchaseApi.getManagers();
        setPmManagersList(mgrs);
      } catch (err) {
        console.error("Failed to load PM/TL managers:", err);
      }
    };
    if (user) {
      fetchManagers();
    }
  }, [user]);

  // Combine fetched PM / TL managers and any active managers in loaded requests
  const pmManagers = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; role?: string; department?: string | null }>();

    // 1. Add from backend list
    pmManagersList.forEach((u) => {
      map.set(u.id, {
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
      });
    });

    // 2. Include any managers present on existing requests
    requests.forEach((r) => {
      if (r.purchase_manager?.id && !map.has(r.purchase_manager.id)) {
        map.set(r.purchase_manager.id, {
          id: r.purchase_manager.id,
          full_name: r.purchase_manager.full_name,
          role: r.purchase_manager.role,
          department: r.purchase_manager.department,
        });
      }
      if (
        r.requested_by?.id &&
        (r.requested_by.role === "TEAM_LEADER" || r.requested_by.role === "IN_CHARGE") &&
        !map.has(r.requested_by.id)
      ) {
        map.set(r.requested_by.id, {
          id: r.requested_by.id,
          full_name: r.requested_by.full_name,
          role: r.requested_by.role,
          department: r.requested_by.department,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [pmManagersList, requests]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filters = {
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
        sort_by: sortBy,
        order: sortOrder,
        date: dateFilter || undefined,
        pm_filter: pmFilter !== "ALL" ? pmFilter : undefined,
      };

      const reqData = await purchaseApi.listRequests(filters);

      setRequests(reqData.items);
      setTotalCount(reqData.total);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, statusFilter, dateFilter, pmFilter, sortBy, sortOrder]);

  // Instant client-side filtering and sorting
  const sortedRequests = useMemo(() => {
    let list = [...requests];

    // Filter by Date Picker (instant client-side match)
    if (dateFilter) {
      list = list.filter((r) => {
        const localD = toLocalDateStr(r.created_at);
        return localD === dateFilter || (r.created_at && r.created_at.startsWith(dateFilter));
      });
    }

    // Filter by Managed by each user option
    if (pmFilter === "SELF_MANAGED") {
      list = list.filter((r) => r.requested_by?.role !== "STAFF");
    } else if (pmFilter !== "ALL") {
      list = list.filter(
        (r) =>
          r.purchase_manager_id === pmFilter ||
          r.purchase_manager?.id === pmFilter ||
          (r.requested_by?.role === "STAFF" && r.requested_by?.reports_to_id === pmFilter) ||
          (r.requested_by_id === pmFilter && r.requested_by?.role !== "STAFF")
      );
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "user") {
        const nameA = a.requested_by?.full_name || "";
        const nameB = b.requested_by?.full_name || "";
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "total") {
        const totalA = (a.rate || 0) * (a.quantity || 0);
        const totalB = (b.rate || 0) * (b.quantity || 0);
        comparison = totalA - totalB;
      } else if (sortBy === "product") {
        comparison = (a.name || "").localeCompare(b.name || "");
      } else {
        // "date" (created_at)
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    return list;
  }, [requests, dateFilter, pmFilter, sortBy, sortOrder]);

  useRealtimeEvent(
    [
      "PURCHASE_STATUS_UPDATED",
      "PURCHASE_CREATED",
      "PURCHASE_UPDATED",
      "PURCHASE_DELETED",
      "RESYNC",
    ],
    () => {
      loadData(true);
    }
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Determine if current user can update status
  const canUpdateStatus = (req: PurchaseRequest) => {
    if (!user) return false;
    // Super Admin has ultimate power
    if (user.role === "SUPER_ADMIN") return true;

    const requesterRole = req.requested_by?.role;

    if (requesterRole !== "STAFF") {
      // Non-staff order (Team Leader, In-Charge, Admin, Super Admin):
      // Managed by themselves only!
      return req.requested_by_id === user.id;
    } else {
      // Staff order:
      // Managed by their assigned Team Leader or supervising In-Charge
      if (req.purchase_manager_id && req.purchase_manager_id === user.id) return true;
      if (
        user.role === "TEAM_LEADER" &&
        ((req.requested_by?.department && user.department === req.requested_by.department) ||
          req.requested_by?.reports_to_id === user.id)
      ) {
        return true;
      }
      if (
        user.role === "IN_CHARGE" &&
        (((!user.department || user.department === req.requested_by?.department) &&
          (!user.branch || user.branch === req.requested_by?.branch)) ||
          req.requested_by?.reports_to_id === user.id)
      ) {
        return true;
      }
      return false;
    }
  };

  // Determine if current user can view full history
  const canViewHistory = (req: PurchaseRequest) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    if (req.requested_by_id === user.id) return true;
    if (req.purchase_manager_id && req.purchase_manager_id === user.id) return true;
    if (
      user.role === "TEAM_LEADER" &&
      req.requested_by?.role === "STAFF" &&
      ((req.requested_by?.department && user.department === req.requested_by.department) ||
        req.requested_by?.reports_to_id === user.id)
    ) {
      return true;
    }
    if (
      user.role === "IN_CHARGE" &&
      req.requested_by?.role === "STAFF" &&
      (((!user.department || user.department === req.requested_by?.department) &&
        (!user.branch || user.branch === req.requested_by?.branch)) ||
        req.requested_by?.reports_to_id === user.id)
    ) {
      return true;
    }
    return false;
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShoppingBag className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <span>Purchase Desk & Requests</span>
            </h1>
            <p className="text-xs text-slate-500">
              Submit barcode-scanned requests and track procurement across team leaders and self-managed orders
            </p>
          </div>

          {/* Provision for users: Scan & Submit Request */}
          {hasPermission("purchases", "add") && (
            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              <button
                onClick={() => {
                  setIsCameraAutoOpen(true);
                  setIsScanModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all"
              >
                <Camera className="w-4 h-4" />
                <span>Scan with Camera</span>
              </button>
              <button
                onClick={() => {
                  setIsCameraAutoOpen(false);
                  setIsScanModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
              >
                <Scan className="w-4 h-4" />
                <span>Enter / Scan Code</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Requests Table & Filter Controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Row 1: Status Filter Tabs */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/60 dark:bg-slate-800/25">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ALL", "OPEN", "ORDERED", "NOT_IN_STOCK", "RECEIVED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                  }`}
                >
                  {st === "ALL" ? "All Requests" : st.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              <span>{sortedRequests.length} {sortedRequests.length === 1 ? "request" : "requests"}</span>
            </div>
          </div>

          {/* Row 2: Filtration, Search & Sorting Controls (One under the other) */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 sm:flex-initial">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search code, product, vendor..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-full sm:w-56 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  Search
                </button>
              </form>

              {/* Date Picker Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
                  Date:
                </span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                  title="Filter purchase requests by date"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    title="Clear date filter"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Managed By Each User Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
                  Managed By:
                </span>
                <select
                  value={pmFilter}
                  onChange={(e) => setPmFilter(e.target.value)}
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none cursor-pointer pr-1 max-w-[200px] truncate"
                  title="Filter by each manager user"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    All Managers
                  </option>
                  {pmManagers.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      {m.full_name} ({m.role === "TEAM_LEADER" ? "TL" : m.role === "IN_CHARGE" ? "In-Charge" : m.role}{m.department ? ` • ${m.department}` : ""})
                    </option>
                  ))}
                  <option value="SELF_MANAGED" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    Self-Managed Orders
                  </option>
                </select>
                {pmFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setPmFilter("ALL")}
                    title="Clear manager filter"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center gap-2">
              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
                  Sort:
                </span>
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split("_") as [SortField, SortOrder];
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="date_desc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Date (Newest first)</option>
                  <option value="date_asc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Date (Oldest first)</option>
                  <option value="total_desc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Total Value (Highest)</option>
                  <option value="total_asc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Total Value (Lowest)</option>
                  <option value="user_asc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Requested By (A → Z)</option>
                  <option value="user_desc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Requested By (Z → A)</option>
                  <option value="product_asc" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Product (A → Z)</option>
                </select>
              </div>

              {/* Sort Direction Toggle Button */}
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                title={sortOrder === "asc" ? "Sort Ascending (Click to switch to Descending)" : "Sort Descending (Click to switch to Ascending)"}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
              >
                {sortOrder === "asc" ? (
                  <ArrowUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </button>

              {(search || dateFilter || pmFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDateFilter("");
                    setPmFilter("ALL");
                  }}
                  title="Reset all filters"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("date")}
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Barcode / Date</span>
                      {sortBy === "date" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3.5">Product Details</th>
                  <th className="px-5 py-3.5">Brand & Vendor</th>
                  <th className="px-5 py-3.5">Qty × Unit Rate</th>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("total")}
                    title="Click to sort by Total Value"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Total Value</span>
                      {sortBy === "total" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("user")}
                    title="Click to sort by User"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Requested By (User)</span>
                      {sortBy === "user" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-50 group-hover:opacity-100" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3.5">Managed By / PM</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      Loading purchase requests...
                    </td>
                  </tr>
                ) : sortedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      No purchase requests found matching current filter.
                    </td>
                  </tr>
                ) : (
                  sortedRequests.map((r) => {
                    const totalVal = r.rate * r.quantity;
                    const canEdit = canUpdateStatus(r);
                    const canHist = canViewHistory(r);

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          <div>{r.code}</div>
                          {r.created_at && (
                            <div className="text-[10px] font-normal text-slate-400 font-sans mt-0.5">
                              {toLocalDateStr(r.created_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          <div>
                            <span className="block">{r.name}</span>
                            {r.category ? (
                              <span className="text-[11px] text-slate-400 font-normal">
                                {r.category}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          <div>
                            {r.brand ? (
                              <span className="block font-medium text-slate-700 dark:text-slate-300">
                                {r.brand}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-slate-400">{r.vendor}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                          {r.quantity} × ₹{r.rate.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{totalVal.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {r.requested_by?.full_name || "Unknown"}
                            </span>
                            {r.requested_by?.role && <RoleBadge role={r.requested_by.role} />}
                          </div>
                          {r.requested_by?.branch && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <Building className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{r.requested_by.branch}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {r.requested_by?.role === "STAFF" ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                {r.purchase_manager?.id ? (
                                  <button
                                    type="button"
                                    onClick={() => setPmFilter(r.purchase_manager!.id)}
                                    title={`Click to filter by manager ${r.purchase_manager.full_name}`}
                                    className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left cursor-pointer"
                                  >
                                    {r.purchase_manager.full_name}
                                  </button>
                                ) : (
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    Team Leader
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                  Team Leader
                                </span>
                              </div>
                              {r.purchase_manager?.department && (
                                <span className="text-[10px] text-slate-400 block">
                                  Dept: {r.purchase_manager.department}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPmFilter("SELF_MANAGED")}
                              title="Click to filter by Self-Managed orders"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3 h-3" />
                              Self-Managed
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <PurchaseStatusBadge status={r.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Edit & Delete (Super Admin, Admin, PM, or Requester if OPEN) */}
                          {canModifyRequest(r) && (
                            <>
                              {hasPermission("purchases", "edit") && (
                                <button
                                  onClick={() => setEditModalRequest(r)}
                                  title="Edit request"
                                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}
                              {hasPermission("purchases", "delete") && (
                                <button
                                  onClick={() => handleDeleteRequest(r)}
                                  title="Delete request"
                                  className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}

                          {/* Update Status (Purchase Manager & Super Admin provision) */}
                          {canEdit && (
                            <button
                              onClick={() => setStatusModalRequest(r)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900 transition-colors"
                            >
                              Update Status
                            </button>
                          )}

                          {/* View History (Super Admin & Admin visibility, PM, and Requester) */}
                          {canHist && (
                            <button
                              onClick={() => setHistoryModalRequest(r)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>History</span>
                            </button>
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
      </div>

      {/* Modals */}
      <ScanPurchaseRequestModal
        isOpen={isScanModalOpen}
        initialCameraOpen={isCameraAutoOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setIsCameraAutoOpen(false);
        }}
        onRequestCreated={() => loadData()}
      />

      <EditPurchaseRequestModal
        request={editModalRequest}
        isOpen={!!editModalRequest}
        onClose={() => setEditModalRequest(null)}
        onRequestUpdated={() => loadData()}
      />

      <PurchaseStatusModal
        request={statusModalRequest}
        isOpen={!!statusModalRequest}
        onClose={() => setStatusModalRequest(null)}
        onStatusUpdated={() => loadData()}
      />

      <PurchaseHistoryModal
        request={historyModalRequest}
        isOpen={!!historyModalRequest}
        onClose={() => setHistoryModalRequest(null)}
      />
    </ProtectedRoute>
  );
}

