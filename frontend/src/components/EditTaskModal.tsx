"use client";

import React, { useEffect, useState } from "react";
import { X, CheckSquare, AlertCircle, Clock, ShieldAlert, Repeat, Paperclip } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { tasksApi, attachmentsApi, usersApi, getErrorMessage } from "@/lib/api";
import { RecurrencePattern, Task, TaskAttachment, TaskPriority, User, UserBrief } from "@/lib/types";
import { TaskAttachmentsView } from "./TaskAttachmentsView";

interface EditTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Mon", full: "Monday" },
  { value: 1, label: "Tue", full: "Tuesday" },
  { value: 2, label: "Wed", full: "Wednesday" },
  { value: 3, label: "Thu", full: "Thursday" },
  { value: 4, label: "Fri", full: "Friday" },
  { value: 5, label: "Sat", full: "Saturday" },
  { value: 6, label: "Sun", full: "Sunday" },
];

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const isCreator = Boolean(
    user && (user.id === task?.created_by_id || user.role === "SUPER_ADMIN")
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approverId, setApproverId] = useState("");

  // Recurrence settings (only editable by task creator)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>("DAILY");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number | "">("");
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | "">("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const toggleDayOfWeek = (day: number) => {
    setRecurrenceDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  };

  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);
  const [eligibleApprovers, setEligibleApprovers] = useState<UserBrief[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAttachments = async () => {
    if (!task) return;
    try {
      const fetcher = attachmentsApi?.list || tasksApi?.getAttachments;
      if (fetcher) {
        const atts = await fetcher(task.id);
        setAttachments(atts);
      }
      onTaskUpdated();
    } catch {
      // Soft fail
    }
  };

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
      setAssignedToId(task.assigned_to_id);
      setRequiresApproval(task.requires_approval);
      setApproverId(task.approver_id || "");

      setIsRecurring(Boolean(task.is_recurring));
      setRecurrencePattern(task.recurrence_pattern || "DAILY");
      setRecurrenceInterval(task.recurrence_interval || 1);

      if (
        task.recurrence_days_of_week &&
        Array.isArray(task.recurrence_days_of_week) &&
        task.recurrence_days_of_week.length > 0
      ) {
        setRecurrenceDaysOfWeek(task.recurrence_days_of_week);
      } else if (
        task.recurrence_day_of_week !== null &&
        task.recurrence_day_of_week !== undefined
      ) {
        setRecurrenceDaysOfWeek([task.recurrence_day_of_week]);
      } else {
        setRecurrenceDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      }
      setRecurrenceDayOfWeek(
        task.recurrence_day_of_week !== null && task.recurrence_day_of_week !== undefined
          ? task.recurrence_day_of_week
          : ""
      );
      setRecurrenceDayOfMonth(
        task.recurrence_day_of_month !== null && task.recurrence_day_of_month !== undefined
          ? task.recurrence_day_of_month
          : ""
      );
      setRecurrenceEndDate(
        task.recurrence_end_date ? task.recurrence_end_date.slice(0, 10) : ""
      );

      setError(null);

      usersApi.list()
        .then((users) => {
          setAssignableUsers(users);
        })
        .catch(() => {});

      refreshAttachments();
    }
  }, [isOpen, task]);

  // Fetch scoped eligible approvers based on assignee branch & department
  useEffect(() => {
    if (isOpen && requiresApproval && assignedToId) {
      usersApi
        .getEligibleApprovers(assignedToId)
        .then((approvers) => {
          setEligibleApprovers(approvers);
          // If current approver is not in eligible list, choose first eligible or clear
          if (approverId && !approvers.some((a) => a.id === approverId)) {
            setApproverId(approvers.length > 0 ? approvers[0].id : "");
          } else if (!approverId && approvers.length > 0) {
            setApproverId(approvers[0].id);
          }
        })
        .catch(() => setEligibleApprovers([]));
    } else {
      setEligibleApprovers([]);
    }
  }, [isOpen, requiresApproval, assignedToId]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to_id: assignedToId || undefined,
        requires_approval: requiresApproval,
        approver_id: requiresApproval ? approverId || undefined : null,
      };

      if (isCreator) {
        payload.is_recurring = isRecurring;
        payload.recurrence_pattern = isRecurring ? recurrencePattern : "NONE";
        payload.recurrence_interval = isRecurring ? Math.max(1, Number(recurrenceInterval) || 1) : 1;
        payload.recurrence_days_of_week =
          isRecurring && recurrencePattern !== "MONTHLY" ? recurrenceDaysOfWeek : undefined;
        payload.recurrence_day_of_week =
          isRecurring && recurrenceDaysOfWeek.length > 0 ? recurrenceDaysOfWeek[0] : null;
        payload.recurrence_day_of_month =
          isRecurring && recurrencePattern === "MONTHLY" && recurrenceDayOfMonth !== ""
            ? Number(recurrenceDayOfMonth)
            : null;
        payload.recurrence_end_date =
          isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null;
      }

      await tasksApi.update(task.id, payload);
      onTaskUpdated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col z-10"
        >
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Edit Task</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Update task details and assignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assignee
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Requires Approval Checkbox */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Needs higher-level approval to complete
              </span>
            </label>

            {requiresApproval && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Approver *
                </label>
                <select
                  required={requiresApproval}
                  value={approverId}
                  onChange={(e) => setApproverId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="">-- Choose Approver --</option>
                  {eligibleApprovers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role.replace("_", " ")}
                      {u.branch ? ` - Branch: ${u.branch}` : ""}
                      {u.department ? ` - Dept: ${u.department}` : ""})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Recurrence Toggle & Configuration (Available only to task creator) */}
          {isCreator && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="editIsRecurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                    Recurring Task (Auto-repeat)
                  </span>
                </label>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isRecurring
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {isRecurring ? "Enabled" : "Disabled"}
                </span>
              </div>

              {isRecurring && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Pattern *
                      </label>
                      <select
                        value={recurrencePattern}
                        onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="CUSTOM">Custom Interval</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Repeat Every *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={recurrenceInterval}
                          onChange={(e) =>
                            setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {recurrencePattern === "DAILY"
                            ? "day(s)"
                            : recurrencePattern === "WEEKLY"
                            ? "week(s)"
                            : recurrencePattern === "MONTHLY"
                            ? "month(s)"
                            : "unit(s)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {recurrencePattern !== "MONTHLY" && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase">
                          Choose Days in Week *
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setRecurrenceDaysOfWeek([0, 1, 2, 3, 4, 5, 6])}
                            className={`px-2 py-0.5 rounded-md transition font-medium ${
                              recurrenceDaysOfWeek.length === 7
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                            }`}
                          >
                            All Days
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecurrenceDaysOfWeek([0, 1, 2, 3, 4, 5])}
                            className={`px-2 py-0.5 rounded-md transition font-medium ${
                              recurrenceDaysOfWeek.length === 6 && !recurrenceDaysOfWeek.includes(6)
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                            }`}
                            title="Exclude Sunday from recurring"
                          >
                            Mon - Sat (No Sun)
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecurrenceDaysOfWeek([0, 1, 2, 3, 4])}
                            className={`px-2 py-0.5 rounded-md transition font-medium ${
                              recurrenceDaysOfWeek.length === 5 &&
                              !recurrenceDaysOfWeek.includes(5) &&
                              !recurrenceDaysOfWeek.includes(6)
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                            }`}
                          >
                            Mon - Fri
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {DAYS_OF_WEEK.map((d) => {
                          const isSelected = recurrenceDaysOfWeek.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleDayOfWeek(d.value)}
                              className={`py-1.5 text-xs font-semibold rounded-xl border transition flex flex-col items-center justify-center gap-0.5 ${
                                isSelected
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                              }`}
                              title={`Toggle ${d.full}`}
                            >
                              <span>{d.label}</span>
                              <span
                                className={`text-[8px] font-bold ${
                                  isSelected ? "text-indigo-100" : "text-slate-400"
                                }`}
                              >
                                {isSelected ? "ON" : "OFF"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {!recurrenceDaysOfWeek.includes(6) ? (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                          <span>• Every Sunday is excluded from recurrence.</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Select which days of the week this task should recur on.
                        </p>
                      )}
                    </div>
                  )}

                  {recurrencePattern === "MONTHLY" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Day of Month (1 - 31)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="e.g. 15 (leave blank for same date)"
                        value={recurrenceDayOfMonth}
                        onChange={(e) =>
                          setRecurrenceDayOfMonth(e.target.value === "" ? "" : parseInt(e.target.value))
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Leave empty to continue repeating indefinitely.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task File Attachments */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <TaskAttachmentsView
              taskId={task.id}
              attachments={attachments}
              onAttachmentsChanged={refreshAttachments}
              canUpload={true}
              canDelete={true}
              compact={true}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
};

