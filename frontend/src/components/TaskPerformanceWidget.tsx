"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  CheckCircle2,
  ListTodo,
  Clock,
  AlertTriangle,
  Award,
  Users,
  Target,
  RefreshCw,
  Search,
  ArrowUpRight,
  ShieldCheck,
  CheckSquare,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  Sparkles,
  User as UserIcon,
  X,
  FileSpreadsheet,
  Download,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { statsApi, usersApi, getErrorMessage } from "@/lib/api";
import { TaskPerformanceStats, UserBrief, UserPerformance } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "./RoleBadge";

interface TaskPerformanceWidgetProps {
  initialData?: TaskPerformanceStats | null;
  onRefresh?: () => void;
  compact?: boolean;
}

export function TaskPerformanceWidget({
  initialData,
  onRefresh,
  compact = false,
}: TaskPerformanceWidgetProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<TaskPerformanceStats | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "tasks" | "subtasks" | "name">("score");

  // User directory for filter dropdown
  const [usersList, setUsersList] = useState<UserBrief[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  const isManagement =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "IN_CHARGE" ||
    user?.role === "TEAM_LEADER";

  const canFilterByUser =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "IN_CHARGE" ||
    user?.role === "TEAM_LEADER";

  useEffect(() => {
    if (canFilterByUser) {
      setLoadingUsers(true);
      const fetchPromise =
        user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
          ? usersApi.list().then((list) => list as unknown as UserBrief[])
          : usersApi.getAssignable();

      fetchPromise
        .then((data) => {
          const sorted = [...data].sort((a, b) => a.full_name.localeCompare(b.full_name));
          setUsersList(sorted);
        })
        .catch((err) => {
          console.error("Failed to load users for performance filter:", err);
          usersApi
            .getAssignable()
            .then(setUsersList)
            .catch(() => {});
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [user, canFilterByUser]);

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedBranch) params.branch = selectedBranch;
      if (selectedDepartment) params.department = selectedDepartment;
      if (selectedUserFilter) params.user_id = selectedUserFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const data = await statsApi.getPerformance(params);
      setStats(data);
      if (onRefresh && !selectedUserFilter && !startDate && !endDate) onRefresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserFilter || startDate || endDate) {
      fetchPerformance();
    } else if (initialData && !selectedBranch && !selectedDepartment) {
      setStats(initialData);
      setLoading(false);
    } else {
      fetchPerformance();
    }
  }, [initialData, selectedBranch, selectedDepartment, selectedUserFilter, startDate, endDate]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const blob = await statsApi.exportPerformanceBlob({
        user_id: selectedUserFilter || undefined,
        branch: selectedBranch || undefined,
        department: selectedDepartment || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      const selectedUserObj = usersList.find((u) => u.id === selectedUserFilter);
      const userPrefix = selectedUserObj ? `${selectedUserObj.full_name.replace(/\s+/g, "_")}_` : "";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task_performance_report_${userPrefix}${startDate || "all"}_to_${endDate || "all"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export performance report: " + getErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-5 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Failed to load performance statistics: {error}</span>
        </div>
        <button
          onClick={fetchPerformance}
          className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { task_metrics, subtask_metrics, overall_performance_score, team_performance } = stats;

  // Filter and sort team members
  const filteredTeam = team_performance
    .filter((m) => {
      if (!memberSearch) return true;
      const q = memberSearch.toLowerCase();
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.branch && m.branch.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "score") return b.overall_performance_score - a.overall_performance_score;
      if (sortBy === "tasks") return b.task_completion_rate - a.task_completion_rate;
      if (sortBy === "subtasks") return b.subtask_completion_rate - a.subtask_completion_rate;
      if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
      return 0;
    });

  const getScoreRating = (score: number) => {
    if (score >= 85)
      return {
        label: "Outstanding",
        color: "text-emerald-700 dark:text-emerald-300",
        bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
        badgeBg: "bg-emerald-600 text-white",
      };
    if (score >= 70)
      return {
        label: "High Performer",
        color: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
        badgeBg: "bg-blue-600 text-white",
      };
    if (score >= 50)
      return {
        label: "On Track",
        color: "text-amber-700 dark:text-amber-300",
        bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
        badgeBg: "bg-amber-600 text-white",
      };
    return {
      label: "Needs Attention",
      color: "text-rose-700 dark:text-rose-300",
      bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
      badgeBg: "bg-rose-600 text-white",
    };
  };

  const rating = getScoreRating(overall_performance_score);
  const selectedUserObj = usersList.find((u) => u.id === selectedUserFilter);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>Task & Subtask Performance Analytics</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {selectedUserFilter && selectedUserObj
                    ? `USER: ${selectedUserObj.full_name.toUpperCase()}`
                    : stats.scope === "all"
                    ? "ORG SCOPE"
                    : stats.scope.toUpperCase()}
                </span>
                {(startDate || endDate) && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {startDate || "Start"} &rarr; {endDate || "Present"}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Granular productivity metrics combining primary task milestones with subtask checklist completion.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Download comprehensive performance Excel report"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? "Exporting..." : "Download Excel"}</span>
          </button>

          <button
            onClick={fetchPerformance}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            title="Refresh Performance Statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Date Range & User Performance Filters Bar */}
      {isManagement && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* User Selector */}
              {canFilterByUser && (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedUserFilter}
                      onChange={(e) => setSelectedUserFilter(e.target.value)}
                      disabled={loadingUsers}
                      aria-label="Filter performance analytics by user"
                      className="pl-8 pr-7 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs max-w-[240px] sm:max-w-[280px] truncate"
                    >
                      <option value="">
                        {user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
                          ? "All Users (Organization Scope)"
                          : "All Team Members (Scope Overview)"}
                      </option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.role ? u.role.replace("_", " ") : "User"}{u.branch ? ` • ${u.branch}` : ""})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedUserFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserFilter("")}
                      title="Reset to All Users"
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  aria-label="Filter tasks starting from date"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  aria-label="Filter tasks ending at date"
                />
              </div>
            </div>

            {/* Right side: Report info */}
            <div className="flex items-center gap-2 self-start lg:self-auto text-xs text-slate-500 dark:text-slate-400">
              <span className="text-[11px]">
                Report format: <strong className="text-slate-700 dark:text-slate-300">Excel (.xlsx)</strong>
              </span>
            </div>
          </div>

          {/* Quick Date Range Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-xs">
            <span className="text-[11px] font-medium text-slate-400">Quick Range:</span>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                setStartDate(todayStr);
                setEndDate(todayStr);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const firstDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
                const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                setStartDate(firstDayStr);
                setEndDate(todayStr);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                const s = `${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-${pad(firstDayLastMonth.getDate())}`;
                const e = `${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`;
                setStartDate(s);
                setEndDate(e);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const s = `${past30.getFullYear()}-${pad(past30.getMonth() + 1)}-${pad(past30.getDate())}`;
                const e = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                setStartDate(s);
                setEndDate(e);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
            >
              Last 30 Days
            </button>

            {(startDate || endDate || selectedUserFilter) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedUserFilter("");
                }}
                className="ml-auto text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium text-[11px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active User Filter Notification Banner */}
      {selectedUserFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-gradient-to-r from-indigo-50/90 via-indigo-50/50 to-purple-50/70 dark:from-indigo-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl sm:rounded-2xl shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                  User Performance View:
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedUserObj?.full_name || stats.scope.replace(/^User:\s*/i, "")}
                </span>
                {selectedUserObj && <RoleBadge role={selectedUserObj.role} />}
                {selectedUserObj?.branch && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    • Branch: <strong className="text-slate-700 dark:text-slate-300">{selectedUserObj.branch}</strong>
                  </span>
                )}
                {selectedUserObj?.department && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    • Dept: <strong className="text-slate-700 dark:text-slate-300">{selectedUserObj.department}</strong>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Displaying individual task completion rates, milestone delivery, and subtask checklist completion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedUserFilter("")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-700 transition shrink-0 shadow-2xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset to All Users</span>
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Combined Overall Score */}
        <div
          className={`rounded-2xl p-4 sm:p-5 border transition-all relative overflow-hidden flex flex-col justify-between ${rating.bg}`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Overall Performance Score</span>
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-xs ${rating.badgeBg}`}
              >
                {rating.label}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {overall_performance_score}%
              </span>
              <span className="text-xs text-slate-500">efficiency</span>
            </div>

            {/* Combined Visual Bar */}
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, overall_performance_score))}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block">Task Rate:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {task_metrics.task_completion_rate}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Subtask Rate:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {subtask_metrics.subtask_completion_rate}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Task Milestone Execution */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Task Milestones</span>
              </span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {task_metrics.completed_tasks} / {task_metrics.total_tasks} Done
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {task_metrics.task_completion_rate}%
              </span>
              <span className="text-xs text-slate-500">completed</span>
            </div>

            {/* Task Progress Bar */}
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, task_metrics.task_completion_rate))}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-1 text-[11px] text-center">
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">In Progress</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {task_metrics.in_progress_tasks}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Pending</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {task_metrics.pending_tasks + task_metrics.pending_approval_tasks}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Overdue</span>
              <span
                className={`font-bold ${
                  task_metrics.overdue_tasks > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500"
                }`}
              >
                {task_metrics.overdue_tasks}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Subtask Checklist Progress */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Subtask Checklists</span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {subtask_metrics.completed_subtasks} / {subtask_metrics.total_subtasks} Checked
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {subtask_metrics.subtask_completion_rate}%
              </span>
              <span className="text-xs text-slate-500">checklist items</span>
            </div>

            {/* Subtask Progress Bar */}
            <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, subtask_metrics.subtask_completion_rate))}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Avg Subtasks / Task:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {subtask_metrics.avg_subtasks_per_task}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">On-Time Delivery:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {task_metrics.on_time_rate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Team Performance Breakdown & Leaderboard (Management Roles or Multi-member scope) */}
      {!compact && team_performance.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Team Member Performance Breakdown (Including Subtasks)
              </h3>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                {team_performance.length} {team_performance.length === 1 ? "member" : "members"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search team member..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="score">Sort by: Score</option>
                <option value="tasks">Sort by: Task %</option>
                <option value="subtasks">Sort by: Subtask %</option>
                <option value="name">Sort by: Name</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Composite Score</th>
                  <th className="px-4 py-3">Task Completion</th>
                  <th className="px-4 py-3">Subtask Checklist Progress</th>
                  <th className="px-4 py-3 text-center">Status Breakdown</th>
                  {canFilterByUser && <th className="px-4 py-3 text-right">Analytics</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredTeam.length === 0 ? (
                  <tr>
                    <td colSpan={canFilterByUser ? 6 : 5} className="px-4 py-8 text-center text-slate-400">
                      {selectedUserFilter
                        ? "No task activity recorded yet for this user."
                        : "No team members found matching your search."}
                    </td>
                  </tr>
                ) : (
                  filteredTeam.map((member) => {
                    const memberRating = getScoreRating(member.overall_performance_score);
                    const isSelected = selectedUserFilter === member.user_id;
                    return (
                      <tr
                        key={member.user_id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-indigo-50/60 dark:bg-indigo-950/30 border-l-4 border-l-indigo-600"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Member Identity */}
                        <td className="px-4 py-3.5">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {member.full_name}
                              </span>
                              <RoleBadge role={member.role} />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              {member.branch && <span>{member.branch}</span>}
                              {member.branch && member.department && <span>•</span>}
                              {member.department && <span>{member.department}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Overall Composite Score */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-lg border ${memberRating.bg} ${memberRating.color}`}
                            >
                              {member.overall_performance_score}%
                            </span>
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, member.overall_performance_score)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Task Completion */}
                        <td className="px-4 py-3.5">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {member.tasks_completed} / {member.tasks_assigned} Done
                              </span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {member.task_completion_rate}%
                              </span>
                            </div>
                            <div className="w-28 sm:w-36 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, member.task_completion_rate)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Subtask Checklist */}
                        <td className="px-4 py-3.5">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {member.subtasks_completed} / {member.subtasks_total} Checked
                              </span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {member.subtask_completion_rate}%
                              </span>
                            </div>
                            <div className="w-28 sm:w-36 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full rounded-full"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(0, member.subtask_completion_rate)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Active status badges */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center text-[10px]">
                            {member.tasks_in_progress > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                                {member.tasks_in_progress} In-prog
                              </span>
                            )}
                            {member.tasks_pending > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                                {member.tasks_pending} Pend
                              </span>
                            )}
                            {member.tasks_overdue > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                                {member.tasks_overdue} Overdue
                              </span>
                            ) : (
                              <span className="text-slate-400">0 Overdue</span>
                            )}
                          </div>
                        </td>

                        {/* User Analytics Quick Action */}
                        {canFilterByUser && (
                          <td className="px-4 py-3.5 text-right">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedUserFilter(member.user_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                                title={`Inspect individual performance analytics for ${member.full_name}`}
                              >
                                <span>View Analytics</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedUserFilter && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span>
                  Currently inspecting performance analytics for{" "}
                  <strong>{selectedUserObj?.full_name || "selected user"}</strong>.
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedUserFilter("")}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline cursor-pointer"
              >
                Show All Organization Members
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
