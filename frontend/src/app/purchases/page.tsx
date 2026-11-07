"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { purchaseApi, getErrorMessage } from "@/lib/api";
import { PurchaseRequest, PurchaseRequestStatus } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { PurchaseStatusBadge } from "@/components/PurchaseStatusBadge";
import { ScanPurchaseRequestModal } from "@/components/ScanPurchaseRequestModal";
import { PurchaseStatusModal } from "@/components/PurchaseStatusModal";
import { PurchaseHistoryModal } from "@/components/PurchaseHistoryModal";
import { EditPurchaseRequestModal } from "@/components/EditPurchaseRequestModal";

export default function PurchasesPage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Filter & Search
  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // Modals state
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isCameraAutoOpen, setIsCameraAutoOpen] = useState(false);
  const [statusModalRequest, setStatusModalRequest] = useState<PurchaseRequest | null>(null);
  const [historyModalRequest, setHistoryModalRequest] = useState<PurchaseRequest | null>(null);
  const [editModalRequest, setEditModalRequest] = useState<PurchaseRequest | null>(null);

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

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filters = {
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
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
  }, [user, statusFilter]);

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

          {/* Provision for ALL user types: Scan & Submit Request */}
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
          {/* Table Header Filter Toolbar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(["ALL", "OPEN", "ORDERED", "NOT_IN_STOCK", "RECEIVED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {st === "ALL" ? "All Requests" : st.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, product, vendor..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-full sm:w-64"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Search
              </button>
            </form>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Barcode / Code</th>
                  <th className="px-5 py-3.5">Product Details</th>
                  <th className="px-5 py-3.5">Brand & Vendor</th>
                  <th className="px-5 py-3.5">Qty × Unit Rate</th>
                  <th className="px-5 py-3.5">Total Value</th>
                  <th className="px-5 py-3.5">Requested By</th>
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
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      No purchase requests found matching current filter.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => {
                    const totalVal = r.rate * r.quantity;
                    const canEdit = canUpdateStatus(r);
                    const canHist = canViewHistory(r);

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {r.code}
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {r.requested_by?.full_name || "Unknown"}
                            </span>
                            {r.requested_by?.role && <RoleBadge role={r.requested_by.role} />}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {r.requested_by?.role === "STAFF" ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {r.purchase_manager?.full_name || "Team Leader"}
                                </span>
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <UserCheck className="w-3 h-3" />
                              Self-Managed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <PurchaseStatusBadge status={r.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* Edit & Delete (Super Admin, Admin, PM, or Requester if OPEN) */}
                          {canModifyRequest(r) && (
                            <>
                              <button
                                onClick={() => setEditModalRequest(r)}
                                title="Edit request"
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteRequest(r)}
                                title="Delete request"
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

