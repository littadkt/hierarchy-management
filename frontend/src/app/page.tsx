"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  ShieldAlert,
  Repeat,
  Users,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  ShoppingBag,
  Boxes,
  Truck,
  ListTodo,
  KeyRound,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { statsApi, tasksApi, getErrorMessage } from "@/lib/api";
import { DashboardStats, Task } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { QuickChecklistWidget } from "@/components/QuickChecklistWidget";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [taskScopeTab, setTaskScopeTab] = useState<"today" | "all">("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSecurityBannerDismissed, setIsSecurityBannerDismissed] = useState(false);

  const isDefaultAdmin = user?.email === "superadmin@example.com";

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const taskParams: any = { limit: 6 };
      if (taskScopeTab === "today") {
        taskParams.due_date_scope = "today";
      }
      const [statsData, tasksData] = await Promise.all([
        statsApi.getDashboard(),
        tasksApi.list(taskParams),
      ]);
      setStats(statsData);
      setRecentTasks(tasksData.items);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, taskScopeTab]);

  useRealtimeEvent(
    [
      "USER_LOGIN",
      "TASK_STATUS_UPDATED",
      "TASK_CREATED",
      "TASK_UPDATED",
      "TASK_DELETED",
      "APPROVAL_STATUS_UPDATED",
      "PURCHASE_STATUS_UPDATED",
      "PURCHASE_CREATED",
      "PURCHASE_UPDATED",
      "PURCHASE_DELETED",
      "WHOLESALE_ORDER_STATUS_UPDATED",
      "WHOLESALE_ORDER_CREATED",
      "WHOLESALE_ORDER_UPDATED",
      "WHOLESALE_ORDER_DELETED",
      "RESYNC",
    ],
    (event) => {
      if (event.type === "USER_LOGIN" && event.data?.user_id) {
        setStats((prev) => {
          if (!prev) return prev;
          const existingList = prev.today_logins || [];
          const exists = existingList.some((u) => u.id === event.data.user_id);
          const updatedLogins = exists
            ? existingList.map((u) =>
                u.id === event.data.user_id
                  ? {
                      ...u,
                      today_first_login_at: event.data.today_first_login_at || u.today_first_login_at,
                      last_login_at: event.data.last_login_at || u.last_login_at,
                    }
                  : u
              )
            : [
                {
                  id: event.data.user_id,
                  full_name: event.data.full_name,
                  email: event.data.email,
                  role: event.data.role,
                  branch: event.data.branch,
                  department: event.data.department,
                  today_first_login_at: event.data.today_first_login_at,
                  last_login_at: event.data.last_login_at,
                },
                ...existingList,
              ];
          return {
            ...prev,
            today_logins: updatedLogins,
            today_logged_in_count: updatedLogins.length,
          };
        });
      }
      loadDashboardData(true);
    }
  );

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Private Network Security Reminder Banner for Default Admin */}
        {isDefaultAdmin && !isSecurityBannerDismissed && (
          <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Private Network Security Precaution
                </p>
                <p className="text-amber-700 dark:text-amber-300/90 mt-0.5">
                  You are signed in with the default seed account (<code>superadmin@example.com</code>). Please update your password to secure the system on your private network.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSecurityBannerDismissed(true)}
                title="Dismiss"
                className="p-1 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-white/90">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Hierarchical Role-Based Task Engine</span>
              </div>
              {user?.today_first_login_at && (
                <div
                  title={`Your first check-in today: ${new Date(user.today_first_login_at).toLocaleString()}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 backdrop-blur-md shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Clock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    Your Today&apos;s Check-in:{" "}
                    {new Date(user.today_first_login_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-sm text-indigo-100/90 leading-relaxed">
              Your organizational role is <strong className="underline">{user?.role}</strong>. Task
              provisions, assignment ceilings, and approval restrictions are automatically enforced.
            </p>
            <div className="pt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => setIsCreateTaskOpen(true)}
                className="px-4 py-2 rounded-xl bg-white text-indigo-700 font-bold text-xs hover:bg-indigo-50 shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
              <Link
                href="/approvals"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Review Approvals</span>
              </Link>
              <Link
                href="/purchases"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Purchase Desk</span>
              </Link>
              <Link
                href="/inventory"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Boxes className="w-4 h-4" />
                <span>Inventory</span>
              </Link>
              <Link
                href="/wholesale"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Truck className="w-4 h-4" />
                <span>Wholesale Orders</span>
              </Link>
              <Link
                href="/checklist"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <ListTodo className="w-4 h-4" />
                <span>My Checklist</span>
              </Link>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Metric Cards Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
          {/* Card 1: My Pending Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                My Assigned Tasks
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats?.my_tasks_count ?? 0}
              </h3>
            </div>
          </div>

          {/* Card 2: Approvals Awaiting Me */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Awaiting My Approval
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.my_pending_approvals_count ?? 0}
              </h3>
            </div>
          </div>

          {/* Card 3: Recurring Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Recurring Schedules
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats?.recurring_tasks_count ?? 0}
              </h3>
            </div>
          </div>

          {/* Card 4: Total Org Users */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Organization Size
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats
                  ? Object.values(stats.user_counts_by_role).reduce((a, b) => a + b, 0)
                  : 0}
              </h3>
            </div>
          </div>

          {/* Card 5: Today's Team Check-ins (Super Admin & Admin) */}
          {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Today&apos;s Check-ins
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats?.today_logged_in_count ?? 0}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Today's Team Check-ins Panel (Super Admin & Admin) */}
        {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && stats && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Today&apos;s Team Check-ins</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5">
                    {stats.today_logged_in_count || 0} active today
                  </span>
                </h3>
              </div>
              <Link
                href="/users"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Team Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {stats.today_logins && stats.today_logins.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.today_logins.map((member) => (
                  <div
                    key={member.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {member.full_name}
                        </span>
                        <RoleBadge role={member.role} />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {member.email}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                        {member.branch && <span>{member.branch}</span>}
                        {member.branch && member.department && <span>•</span>}
                        {member.department && <span>{member.department}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {member.today_first_login_at ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {new Date(member.today_first_login_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Not logged in</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No team check-ins recorded for today yet.
              </div>
            )}
          </div>
        )}

        {/* Roles Distribution Bar */}
        {stats && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Team Structure by Hierarchy
              </h3>
              <Link
                href="/hierarchy"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Hierarchy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 text-center">
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold block">
                  Super Admin
                </span>
                <span className="text-xl font-bold text-purple-900 dark:text-purple-200">
                  {stats.user_counts_by_role["SUPER_ADMIN"] || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-center">
                <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold block">
                  Admins
                </span>
                <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                  {stats.user_counts_by_role["ADMIN"] || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block">
                  In-Charge
                </span>
                <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
                  {stats.user_counts_by_role["IN_CHARGE"] || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-center">
                <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold block">
                  Team Leaders
                </span>
                <span className="text-xl font-bold text-amber-900 dark:text-amber-200">
                  {stats.user_counts_by_role["TEAM_LEADER"] || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-center">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold block">
                  Staff
                </span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {stats.user_counts_by_role["STAFF"] || 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tasks List (Today's Tasks / All Scope Tasks) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Tasks</h3>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setTaskScopeTab("today")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      taskScopeTab === "today"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Today's Tasks</span>
                  </button>
                  <button
                    onClick={() => setTaskScopeTab("all")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      taskScopeTab === "all"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <span>All Recent Tasks</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {taskScopeTab === "today"
                  ? "Showing tasks due for today under your hierarchical scope"
                  : "All recent tasks visible under your hierarchical scope"}
              </p>
            </div>
            <Link
              href={taskScopeTab === "today" ? "/tasks" : "/tasks"}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All Tasks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Task Title</th>
                  <th className="px-5 py-3.5">Assignee</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Approval Required</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      {taskScopeTab === "today"
                        ? "No tasks due for today. All caught up!"
                        : 'No tasks found in your scope. Click "Create Task" above to get started.'}
                    </td>
                  </tr>
                ) : (
                  recentTasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-xs">{t.title}</span>
                          {t.is_recurring && (
                            <Repeat className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {t.assigned_to?.full_name}
                          </span>
                          {t.assigned_to?.role && <RoleBadge role={t.assigned_to.role} />}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {t.requires_approval ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Approver: {t.approver?.full_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Standard</span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap"
                        title={t.created_at ? new Date(t.created_at).toLocaleString() : undefined}
                      >
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskId(t.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Personal Checklist Widget */}
        <QuickChecklistWidget />
      </div>

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onTaskCreated={() => {
          loadDashboardData();
        }}
      />

      {/* Task Details Drawer/Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={() => {
          loadDashboardData();
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </ProtectedRoute>
  );
}
