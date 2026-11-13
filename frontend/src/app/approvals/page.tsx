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
  Filter,
  RotateCcw,
  Sparkles,
  Users,
  MapPin,
  ExternalLink,
  Wifi,
  CheckSquare,
  LogIn,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { approvalsApi, attendanceApi, usersApi, getErrorMessage } from "@/lib/api";
import { Task, UserBrief, AttendanceRecord } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { getGoogleMapsUrl } from "@/lib/geolocation";

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
  const [submittedByFilter, setSubmittedByFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [submittedDateFilter, setSubmittedDateFilter] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<string>("");
  const [approverFilter, setApproverFilter] = useState("");

  const [usersList, setUsersList] = useState<UserBrief[]>([]);

  // Main Tab State: Tasks vs Check-ins
  const [activeMainTab, setActiveMainTab] = useState<"TASKS" | "CHECKINS">("TASKS");

  // Check-in approvals state
  const [checkinApprovals, setCheckinApprovals] = useState<AttendanceRecord[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [activeCheckin, setActiveCheckin] = useState<AttendanceRecord | null>(null);
  const [checkinDecision, setCheckinDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [checkinReason, setCheckinReason] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

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
        submitted_by_id: submittedByFilter || undefined,
        priority: priorityFilter || undefined,
        submitted_date: submittedDateFilter || undefined,
        approver_id: approverFilter || undefined,
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
  }, [user, sortBy, sortOrder, submittedByFilter, priorityFilter, submittedDateFilter, approverFilter]);

  // Load assignable / company users for filters
  useEffect(() => {
    if (user) {
      const fetchUsers =
        user.role === "SUPER_ADMIN" || user.role === "ADMIN"
          ? usersApi.list().then((list) => list as unknown as UserBrief[])
          : usersApi.getAssignable();

      fetchUsers
        .then((data) => {
          const sorted = [...data].sort((a, b) => a.full_name.localeCompare(b.full_name));
          setUsersList(sorted);
        })
        .catch((err) => {
          console.error("Failed to load users for approvals filter:", err);
        });
    }
  }, [user]);

  const loadCheckins = async (silent = false) => {
    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") return;
    if (!silent) setLoadingCheckins(true);
    try {
      const data = await attendanceApi.getPendingApprovals();
      setCheckinApprovals(data);
    } catch (err) {
      console.error("Failed to load checkin approvals:", err);
    } finally {
      if (!silent) setLoadingCheckins(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
      loadCheckins();
    }
  }, [user]);

  useRealtimeEvent(
    [
      "APPROVAL_STATUS_UPDATED",
      "TASK_STATUS_UPDATED",
      "CHECKIN_APPROVAL_REQUESTED",
      "ATTENDANCE_UPDATED",
      "RESYNC",
    ],
    () => {
      loadApprovals(true);
      loadCheckins(true);
    }
  );

  const handleCheckinDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCheckin) return;
    setCheckinSubmitting(true);
    setError(null);
    try {
      if (checkinDecision === "APPROVE") {
        await attendanceApi.approveCheckIn(activeCheckin.id);
      } else {
        await attendanceApi.rejectCheckIn(activeCheckin.id, checkinReason.trim() || undefined);
      }
      setActiveCheckin(null);
      setCheckinReason("");
      await loadCheckins();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCheckinSubmitting(false);
    }
  };

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

  // Submitter options (assignees / creators of pending approvals + usersList)
  const submitterOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    tasks.forEach((t) => {
      if (t.assigned_to) {
        map.set(t.assigned_to.id, {
          id: t.assigned_to.id,
          name: t.assigned_to.full_name,
          role: t.assigned_to.role,
        });
      }
      if (t.created_by) {
        map.set(t.created_by.id, {
          id: t.created_by.id,
          name: t.created_by.full_name,
          role: t.created_by.role,
        });
      }
    });
    usersList.forEach((u) => {
      if (!map.has(u.id)) {
        map.set(u.id, { id: u.id, name: u.full_name, role: u.role });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, usersList]);

  // Approver options (designated approvers of pending approvals + eligible users)
  const approverOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role?: string }>();
    tasks.forEach((t) => {
      if (t.approver) {
        map.set(t.approver.id, {
          id: t.approver.id,
          name: t.approver.full_name,
          role: t.approver.role,
        });
      }
    });
    usersList.forEach((u) => {
      if (
        u.role === "SUPER_ADMIN" ||
        u.role === "ADMIN" ||
        u.role === "IN_CHARGE" ||
        u.role === "TEAM_LEADER"
      ) {
        if (!map.has(u.id)) {
          map.set(u.id, { id: u.id, name: u.full_name, role: u.role });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, usersList]);

  const hasActiveFilters = Boolean(
    searchQuery ||
    submittedByFilter ||
    priorityFilter ||
    submittedDateFilter ||
    approverFilter
  );

  const resetAllFilters = () => {
    setSearchQuery("");
    setSubmittedByFilter("");
    setPriorityFilter("");
    setSubmittedDateFilter("");
    setActiveDatePreset("");
    setApproverFilter("");
  };

  // Instant client-side filtering and sorting
  const filteredAndSortedTasks = useMemo(() => {
    let list = [...tasks];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assigned_to?.full_name?.toLowerCase().includes(q) ||
          t.created_by?.full_name?.toLowerCase().includes(q) ||
          t.approver?.full_name?.toLowerCase().includes(q) ||
          t.priority.toLowerCase().includes(q)
      );
    }

    // Filter by Submitted By
    if (submittedByFilter) {
      list = list.filter(
        (t) =>
          t.assigned_to_id === submittedByFilter ||
          t.assigned_to?.id === submittedByFilter ||
          t.created_by_id === submittedByFilter ||
          t.created_by?.id === submittedByFilter
      );
    }

    // Filter by Priority
    if (priorityFilter) {
      list = list.filter((t) => t.priority.toUpperCase() === priorityFilter.toUpperCase());
    }

    // Filter by Submitted Date
    if (submittedDateFilter) {
      list = list.filter((t) => {
        const submittedStr = toLocalDateStr(t.updated_at || t.created_at);
        return (
          submittedStr === submittedDateFilter ||
          (t.updated_at && t.updated_at.startsWith(submittedDateFilter)) ||
          (t.created_at && t.created_at.startsWith(submittedDateFilter))
        );
      });
    }

    // Filter by Designated Approver
    if (approverFilter) {
      list = list.filter(
        (t) => t.approver_id === approverFilter || t.approver?.id === approverFilter
      );
    }

    // Sort
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
  }, [tasks, sortBy, sortOrder, searchQuery, submittedByFilter, priorityFilter, submittedDateFilter, approverFilter]);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-500" />
            <span>Higher-Level Approvals Queue</span>
          </h1>
          <p className="text-xs text-slate-500">
            Review and approve tasks and off-network employee check-ins
          </p>
        </div>

        {/* Navigation Tabs (Tasks vs Check-in Approvals) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveMainTab("TASKS")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              activeMainTab === "TASKS"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Task Approvals</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeMainTab === "TASKS"
                  ? "bg-white/20 text-white font-bold"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {tasks.length}
            </span>
          </button>

          {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
            <button
              type="button"
              onClick={() => setActiveMainTab("CHECKINS")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeMainTab === "CHECKINS"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Check-in Approvals</span>
              {checkinApprovals.length > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {checkinApprovals.length} pending
                </span>
              ) : (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeMainTab === "CHECKINS"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  0
                </span>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
          </div>
        )}

        {/* Approvals Table Card */}
        {activeMainTab === "TASKS" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {/* Filter Toolbar Section */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200 dark:border-amber-800">
                  <Filter className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Filter Approvals Queue
                    </h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {filteredAndSortedTasks.length} of {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Filter by submitter, priority, submission date, or designated approver
                  </p>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* 1. Submitted By Filter */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Submitted By</span>
                </label>
                <select
                  value={submittedByFilter}
                  onChange={(e) => setSubmittedByFilter(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    All Submitters
                  </option>
                  {submitterOptions.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      {s.name} {s.role ? `(${s.role.replace("_", " ")})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Priority Filter */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Priority</span>
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    All Priorities
                  </option>
                  <option value="URGENT" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    Urgent
                  </option>
                  <option value="HIGH" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    High
                  </option>
                  <option value="MEDIUM" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    Medium
                  </option>
                  <option value="LOW" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    Low
                  </option>
                </select>
              </div>

              {/* 3. Submitted Date Filter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Submitted Date</span>
                  </label>
                  {submittedDateFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmittedDateFilter("");
                        setActiveDatePreset("");
                      }}
                      className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={submittedDateFilter}
                  onChange={(e) => {
                    setSubmittedDateFilter(e.target.value);
                    setActiveDatePreset("");
                  }}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>

              {/* 4. Designated Approver Filter */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
                  <span>Designated Approver</span>
                </label>
                <select
                  value={approverFilter}
                  onChange={(e) => setApproverFilter(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    All Approvers
                  </option>
                  {approverOptions.map((a) => (
                    <option
                      key={a.id}
                      value={a.id}
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      {a.name} {a.role ? `(${a.role.replace("_", " ")})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Search Bar */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>Search</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Title, description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Presets & Active Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400 mr-1">Date Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setSubmittedDateFilter(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                    setActiveDatePreset("today");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeDatePreset === "today"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    setSubmittedDateFilter(`${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`);
                    setActiveDatePreset("yesterday");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                    activeDatePreset === "yesterday"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Yesterday
                </button>
                {submittedDateFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedDateFilter("");
                      setActiveDatePreset("");
                    }}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    All Dates
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Filtered view active</span>
                </div>
              )}
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
                      {hasActiveFilters ? (
                        <div className="space-y-2">
                          <p>No approval requests match your selected filters.</p>
                          <button
                            type="button"
                            onClick={resetAllFilters}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            Reset all filters
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
        )}

        {/* Check-in Approvals Queue */}
        {activeMainTab === "CHECKINS" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Header Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200 dark:border-amber-800">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Off-Network Check-In Requests
                    </h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {checkinApprovals.length} pending
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Employees who clicked check-in outside designated office Wi-Fi with GPS location captured
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadCheckins()}
                disabled={loadingCheckins}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loadingCheckins ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Check-ins Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Branch / Dept</th>
                    <th className="py-3 px-4">Punch Time</th>
                    <th className="py-3 px-4">Network / IP</th>
                    <th className="py-3 px-4">GPS Location</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingCheckins ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading pending check-in requests...
                      </td>
                    </tr>
                  ) : checkinApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          All caught up!
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          No pending check-in requests. All employees are checking in from authorized Wi-Fi networks.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    checkinApprovals.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                              {item.user?.full_name?.charAt(0) || "U"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.user?.full_name}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {item.user?.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[11px]">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.user?.branch || "General Branch"}
                          </div>
                          <div className="text-slate-400">
                            {item.user?.department || "General"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[11px] font-mono">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.date}
                          </div>
                          <div className="text-slate-400">
                            {new Date(item.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Wifi className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Outside Office Wi-Fi</span>
                          </span>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            IP: {item.ip_address || "Unknown"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {item.latitude != null && item.longitude != null ? (
                            <div className="space-y-1">
                              <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                              </div>
                              {item.accuracy != null && (
                                <div className="text-[10px] text-slate-400">
                                  Acc: ±{Math.round(item.accuracy)}m
                                </div>
                              )}
                              {getGoogleMapsUrl(item.latitude, item.longitude) && (
                                <a
                                  href={getGoogleMapsUrl(item.latitude, item.longitude)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>View on Google Maps</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              GPS not available
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[11px] text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {item.check_in_note || "—"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCheckin(item);
                                setCheckinDecision("REJECT");
                                setCheckinReason("");
                              }}
                              className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition cursor-pointer flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCheckin(item);
                                setCheckinDecision("APPROVE");
                                setCheckinReason("");
                              }}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1"
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
        )}

        {/* Task Decision Modal */}
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

        {/* Check-in Decision Modal */}
        {activeCheckin && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {checkinDecision === "APPROVE" ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Approve Off-Network Check-In</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Reject Check-In Request</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Employee: <strong className="text-slate-900 dark:text-white">{activeCheckin.user?.full_name}</strong> ({activeCheckin.date})
              </p>

              {activeCheckin.latitude != null && activeCheckin.longitude != null && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{activeCheckin.latitude.toFixed(5)}, {activeCheckin.longitude.toFixed(5)}</span>
                  </div>
                  {getGoogleMapsUrl(activeCheckin.latitude, activeCheckin.longitude) && (
                    <a
                      href={getGoogleMapsUrl(activeCheckin.latitude, activeCheckin.longitude)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}

              {checkinDecision === "REJECT" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    value={checkinReason}
                    onChange={(e) => setCheckinReason(e.target.value)}
                    placeholder="e.g. Unverified location, outside service territory..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCheckin(null)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCheckinDecisionSubmit}
                  disabled={checkinSubmitting}
                  className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-md ${
                    checkinDecision === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {checkinSubmitting ? "Processing..." : `Confirm ${checkinDecision}`}
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


