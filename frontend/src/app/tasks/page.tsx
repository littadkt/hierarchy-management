"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Repeat,
  ShieldAlert,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  CheckSquare,
  Users,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { tasksApi, usersApi, getErrorMessage } from "@/lib/api";
import { Task, TaskPriority, TaskStatus, UserBrief } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { EditTaskModal } from "@/components/EditTaskModal";

export default function TasksPage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "">("");
  const [isRecurringFilter, setIsRecurringFilter] = useState<string>("");
  const [requiresApprovalFilter, setRequiresApprovalFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(""); // "" (All in scope), "ME", "SUBORDINATES", or userId
  const [subordinateUsers, setSubordinateUsers] = useState<UserBrief[]>([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Load assignable subordinate users for filtering (excluding self)
  useEffect(() => {
    if (user && user.role !== "STAFF") {
      usersApi
        .getAssignable()
        .then((assignable) => {
          const subs = assignable.filter((u) => u.id !== user.id);
          setSubordinateUsers(subs);
        })
        .catch((err) => {
          console.error("Failed to load assignable subordinate users:", err);
        });
    } else {
      setSubordinateUsers([]);
    }
  }, [user]);

  const canEditOrDeleteTask = (t: Task) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return t.created_by_id === user.id;
  };

  const deletableTasks = tasks.filter((t) => canEditOrDeleteTask(t));
  const deletableTaskIds = deletableTasks.map((t) => t.id);
  const isAllSelected = deletableTasks.length > 0 && deletableTasks.every((t) => selectedTaskIds.includes(t.id));
  const isSomeSelected = selectedTaskIds.length > 0;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(deletableTaskIds);
    }
  };

  const handleToggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    const count = selectedTaskIds.length;
    const ok = await confirm({
      title: "Delete Selected Tasks",
      message: `Are you sure you want to delete ${count} selected ${count === 1 ? "task" : "tasks"}? This action cannot be undone.`,
      confirmText: `Delete ${count} ${count === 1 ? "Task" : "Tasks"}`,
      type: "danger",
    });
    if (!ok) return;

    setBulkDeleting(true);
    try {
      const res = await tasksApi.bulkDelete(selectedTaskIds);
      setSelectedTaskIds([]);
      loadTasks();
      await alert({
        title: "Tasks Deleted",
        message: `Successfully deleted ${res.deleted_count} ${res.deleted_count === 1 ? "task" : "tasks"}.`,
        type: "info",
      });
    } catch (err) {
      await alert({
        title: "Bulk Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteTask = async (t: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete Task",
      message: `Are you sure you want to delete task "${t.title}"?`,
      confirmText: "Delete Task",
      type: "danger",
    });
    if (!ok) return;

    try {
      await tasksApi.delete(t.id);
      loadTasks();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const loadTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filters: any = { limit: 100 };
      if (search) filters.search = search;
      if (statusFilter) filters.status = statusFilter;
      if (priorityFilter) filters.priority = priorityFilter;
      if (isRecurringFilter !== "") filters.is_recurring = isRecurringFilter === "true";
      if (requiresApprovalFilter !== "") filters.requires_approval = requiresApprovalFilter === "true";
      if (dateFilter) filters.due_date_scope = dateFilter;
      if (assigneeFilter === "ME") {
        filters.user_scope = "me";
      } else if (assigneeFilter === "SUBORDINATES") {
        filters.user_scope = "subordinates";
      } else if (assigneeFilter) {
        filters.assigned_to_id = assigneeFilter;
      }

      const data = await tasksApi.list(filters);
      setTasks(data.items);
      setTotal(data.total);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [
    user,
    statusFilter,
    priorityFilter,
    isRecurringFilter,
    requiresApprovalFilter,
    dateFilter,
    assigneeFilter,
  ]);

  useRealtimeEvent(
    [
      "TASK_STATUS_UPDATED",
      "TASK_CREATED",
      "TASK_UPDATED",
      "TASK_DELETED",
      "APPROVAL_STATUS_UPDATED",
      "RESYNC",
    ],
    () => {
      loadTasks(true);
    }
  );

  useEffect(() => {
    setSelectedTaskIds((prev) =>
      prev.filter((id) => tasks.some((t) => t.id === id && canEditOrDeleteTask(t)))
    );
  }, [tasks, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTasks();
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Task Management</h1>
            <p className="text-xs text-slate-500">
              Create, view, and track tasks according to organizational hierarchy
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks by title or description..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              Search
            </button>
          </form>

          {/* Quick Date Scope Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Scope:</span>
            </span>
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                dateFilter === ""
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              All Tasks
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("today")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                dateFilter === "today"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Today's Tasks</span>
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("upcoming")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                dateFilter === "upcoming"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setDateFilter("overdue")}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                dateFilter === "overdue"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              Overdue Only
            </button>
          </div>

          {/* Quick Assignee / Team Scope Filter Pills (for non-staff) */}
          {user && user.role !== "STAFF" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] font-bold text-slate-400 uppercase mr-1 flex items-center gap-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>Team:</span>
              </span>
              <button
                type="button"
                onClick={() => setAssigneeFilter("")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 ${
                  assigneeFilter === ""
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                All in Scope
              </button>
              <button
                type="button"
                onClick={() => setAssigneeFilter("ME")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  assigneeFilter === "ME"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>My Tasks</span>
              </button>
              <button
                type="button"
                onClick={() => setAssigneeFilter("SUBORDINATES")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                  assigneeFilter === "SUBORDINATES"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{user.role === "TEAM_LEADER" ? "Staff Under Me" : "Users Under Me"}</span>
                {subordinateUsers.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      assigneeFilter === "SUBORDINATES"
                        ? "bg-white/20 text-white"
                        : "bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                    }`}
                  >
                    {subordinateUsers.length}
                  </span>
                )}
              </button>
            </div>
          )}

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 ${
              user && user.role !== "STAFF" ? "lg:grid-cols-6" : "lg:grid-cols-5"
            } gap-3 text-xs`}
          >
            {user && user.role !== "STAFF" && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Assignee / Team
                </label>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <option value="">All in Scope</option>
                  <option value="ME">Assigned to Me</option>
                  <option value="SUBORDINATES">
                    {user.role === "TEAM_LEADER" ? "All Staff Under Me" : "All Users Under Me"} (
                    {subordinateUsers.length})
                  </option>
                  {subordinateUsers.length > 0 && (
                    <optgroup label="Individual Subordinates">
                      {subordinateUsers.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.full_name} ({sub.role.replace("_", " ")})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING_APPROVAL">Awaiting Approval</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Recurrence
              </label>
              <select
                value={isRecurringFilter}
                onChange={(e) => setIsRecurringFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Tasks</option>
                <option value="true">Recurring Only</option>
                <option value="false">Non-recurring Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Approval Flow
              </label>
              <select
                value={requiresApprovalFilter}
                onChange={(e) => setRequiresApprovalFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Tasks</option>
                <option value="true">Needs Approval Only</option>
                <option value="false">Standard Tasks</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                Due Date
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                <option value="">All Dates</option>
                <option value="today">Due Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Selection Action Bar */}
        {isSomeSelected && (
          <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-850 rounded-2xl p-3 px-4 shadow-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center min-w-5 px-1.5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                {selectedTaskIds.length}
              </span>
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                {selectedTaskIds.length} {selectedTaskIds.length === 1 ? "task" : "tasks"} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTaskIds([])}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              >
                Deselect All
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{bulkDeleting ? "Deleting..." : `Delete Selected (${selectedTaskIds.length})`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tasks Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Showing {tasks.length} of {total} Tasks
            </span>
            {deletableTasks.length > 0 && (
              <span className="text-[11px] text-slate-400">
                {selectedTaskIds.length} of {deletableTasks.length} deletable selected
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = isSomeSelected && !isAllSelected;
                        }
                      }}
                      onChange={handleToggleSelectAll}
                      disabled={deletableTasks.length === 0}
                      title={deletableTasks.length === 0 ? "No deletable tasks" : "Select all deletable tasks"}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Assignee</th>
                  <th className="px-5 py-3.5">Creator</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Approval Flow</th>
                  <th className="px-5 py-3.5">Schedule</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                      Loading tasks...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                      No tasks found matching criteria.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        selectedTaskIds.includes(t.id) ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {canEditOrDeleteTask(t) ? (
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(t.id)}
                            onChange={(e) => handleToggleSelectTask(t.id, e as any)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 select-none text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate max-w-xs">{t.title}</span>
                          {(t.subtasks_count ?? 0) > 0 && (
                            <span
                              title={`${t.completed_subtasks_count || 0} of ${t.subtasks_count} subtasks completed`}
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                (t.completed_subtasks_count ?? 0) >= (t.subtasks_count ?? 0)
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                              }`}
                            >
                              <CheckSquare className="w-2.5 h-2.5" />
                              <span>
                                {t.completed_subtasks_count || 0}/{t.subtasks_count}
                              </span>
                            </span>
                          )}
                          {t.is_recurring && (
                            <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
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
                        <span className="text-slate-600 dark:text-slate-400">
                          {t.created_by?.full_name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        {t.requires_approval ? (
                          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>{t.approver?.full_name} ({t.approver?.role})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Standard</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {t.is_recurring ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                            Every {t.recurrence_interval} {t.recurrence_pattern.toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">One-time</span>
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
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {canEditOrDeleteTask(t) && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditTask(t);
                                setIsEditOpen(true);
                              }}
                              title="Edit task"
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteTask(t, e)}
                              title="Delete task"
                              className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onTaskCreated={() => {
          loadTasks();
        }}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={() => {
          loadTasks();
        }}
      />

      <EditTaskModal
        task={editTask}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditTask(null);
        }}
        onTaskUpdated={() => {
          loadTasks();
        }}
      />
    </ProtectedRoute>
  );
}

