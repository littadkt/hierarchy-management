"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Calendar,
  UserCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { approvalsApi, getErrorMessage } from "@/lib/api";
import { Task } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { TaskDetailModal } from "@/components/TaskDetailModal";

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

type SortField = "date" | "approver" | "due_date" | "created_at";
type SortOrder = "asc" | "desc";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Selected for decision
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [decisionAction, setDecisionAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  const loadApprovals = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await approvalsApi.getPending({
        sort_by: sortBy,
        order: sortOrder,
        date: dateFilter || undefined,
      });
      setTasks(data);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadApprovals();
    }
  }, [user, sortBy, sortOrder, dateFilter]);

  useRealtimeEvent(
    ["APPROVAL_STATUS_UPDATED", "TASK_STATUS_UPDATED", "RESYNC"],
    () => {
      loadApprovals(true);
    }
  );

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    setSubmitting(true);
    setError(null);
    try {
      await approvalsApi.decide(activeTask.id, decisionAction, decisionNotes);
      setActiveTask(null);
      setDecisionNotes("");
      await loadApprovals();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSortToggle = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "approver" ? "asc" : "desc");
    }
  };

  // Instant client-side filtering and sorting
  const filteredAndSortedTasks = useMemo(() => {
    let list = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.assigned_to?.full_name?.toLowerCase().includes(q) ||
          t.approver?.full_name?.toLowerCase().includes(q) ||
          t.priority.toLowerCase().includes(q)
      );
    }

    if (dateFilter) {
      list = list.filter((t) => {
        const submittedStr = toLocalDateStr(t.updated_at || t.created_at);
        const dueStr = toLocalDateStr(t.due_date);
        const createdStr = toLocalDateStr(t.created_at);
        return (
          submittedStr === dateFilter ||
          dueStr === dateFilter ||
          createdStr === dateFilter ||
          (t.due_date && t.due_date.startsWith(dateFilter))
        );
      });
    }

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "approver") {
        const nameA = a.approver?.full_name || "";
        const nameB = b.approver?.full_name || "";
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === "due_date") {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === "created_at") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
      } else {
        // "date" (submission / updated_at)
        const dateA = a.updated_at
          ? new Date(a.updated_at).getTime()
          : a.created_at
          ? new Date(a.created_at).getTime()
          : 0;
        const dateB = b.updated_at
          ? new Date(b.updated_at).getTime()
          : b.created_at
          ? new Date(b.created_at).getTime()
          : 0;
        comparison = dateA - dateB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  }, [tasks, sortBy, sortOrder, searchQuery, dateFilter]);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            <span>Higher-Level Approvals Queue</span>
          </h1>
          <p className="text-xs text-slate-500">
            Tasks submitted by subordinates awaiting your review and approval before they can close
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
          </div>
        )}

        {/* Approvals Table Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Header Controls: Count, Search, and Sort Dropdowns */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {filteredAndSortedTasks.length} Pending Tasks Awaiting Approval
              </span>
            </div>

            {/* Sorting & Search Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search bar */}
              <div className="relative min-w-[180px] sm:min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by title, approver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Date Filter Picker */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">
                  Date:
                </span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-slate-900 dark:text-white font-medium text-xs focus:outline-none cursor-pointer"
                  title="Filter approvals by date"
                />
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    title="Clear date filter"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Task Title</th>
                  <th className="px-5 py-3.5">Submitted By (Assignee)</th>
                  <th className="px-5 py-3.5">Priority</th>

                  {/* Sortable: Submission Date */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("date")}
                    title="Click to sort by Submission Date"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Submitted Date</span>
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

                  {/* Sortable: Due Date */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("due_date")}
                    title="Click to sort by Due Date"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Due Date</span>
                      {sortBy === "due_date" ? (
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

                  {/* Sortable: Designated Approver */}
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group select-none"
                    onClick={() => handleSortToggle("approver")}
                    title="Click to sort by Designated Approver"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Designated Approver</span>
                      {sortBy === "approver" ? (
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

                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      Loading approvals...
                    </td>
                  </tr>
                ) : filteredAndSortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      {searchQuery || dateFilter ? (
                        <div className="space-y-2">
                          <p>No approval requests match your search or date filter.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery("");
                              setDateFilter("");
                            }}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Reset filters
                          </button>
                        </div>
                      ) : (
                        "No pending approval requests. All tasks are up to date!"
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedDetailId(t.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        <span className="font-semibold">{t.title}</span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {t.assigned_to?.full_name || "Unassigned"}
                          </span>
                          {t.assigned_to?.role && <RoleBadge role={t.assigned_to.role} />}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                            t.priority === "URGENT"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : t.priority === "HIGH"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                        {t.updated_at
                          ? new Date(t.updated_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : t.created_at
                          ? new Date(t.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }) : "—"}
                      </td>

                      {/* Designated Approver */}
                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                        {t.approver ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {t.approver.full_name?.charAt(0) || "?"}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold block leading-tight truncate">
                                {t.approver.full_name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {t.approver.role}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setActiveTask(t);
                              setDecisionAction("REJECT");
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveTask(t);
                              setDecisionAction("APPROVE");
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decision Modal */}
        {activeTask && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {decisionAction === "APPROVE" ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Approve & Close Task</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Reject Task (Return to In Progress)</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Task: <strong className="text-slate-900 dark:text-white">{activeTask.title}</strong>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Review Feedback / Comments
                </label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder={
                    decisionAction === "APPROVE"
                      ? "Optional praise or completion note..."
                      : "Explain what revisions or changes are required before this task can be approved..."
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTask(null)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDecisionSubmit}
                  disabled={submitting}
                  className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-md ${
                    decisionAction === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting ? "Processing..." : `Confirm ${decisionAction}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        <TaskDetailModal
          taskId={selectedDetailId}
          isOpen={!!selectedDetailId}
          onClose={() => setSelectedDetailId(null)}
          onTaskUpdated={() => {
            loadApprovals();
          }}
        />
      </div>
    </ProtectedRoute>
  );
}


