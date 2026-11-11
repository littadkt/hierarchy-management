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
} from "lucide-react";
import { statsApi, getErrorMessage } from "@/lib/api";
import { TaskPerformanceStats, UserPerformance } from "@/lib/types";
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
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<"score" | "tasks" | "subtasks" | "name">("score");

  const isManagement =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "IN_CHARGE" ||
    user?.role === "TEAM_LEADER";

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedBranch) params.branch = selectedBranch;
      if (selectedDepartment) params.department = selectedDepartment;
      if (selectedUserFilter) params.user_id = selectedUserFilter;

      const data = await statsApi.getPerformance(params);
      setStats(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData && !selectedBranch && !selectedDepartment && !selectedUserFilter) {
      setStats(initialData);
      setLoading(false);
    } else {
      fetchPerformance();
    }
  }, [initialData, selectedBranch, selectedDepartment, selectedUserFilter]);

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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Task & Subtask Performance Analytics</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {stats.scope === "all" ? "Org Scope" : `${stats.scope.toUpperCase()}`}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Granular productivity metrics combining primary task milestones with subtask checklist completion.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredTeam.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No team members found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredTeam.map((member) => {
                    const memberRating = getScoreRating(member.overall_performance_score);
                    return (
                      <tr
                        key={member.user_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
