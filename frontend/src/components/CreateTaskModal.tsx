"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Calendar,
  AlertCircle,
  Repeat,
  Check,
  ArrowRight,
  Plus,
  Trash2,
  ListTodo,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { tasksApi, usersApi, getErrorMessage } from "@/lib/api";
import { RecurrencePattern, TaskPriority, UserBrief } from "@/lib/types";
import { RoleBadge } from "./RoleBadge";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
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

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  // Assignee selection
  const [assignableUsers, setAssignableUsers] = useState<UserBrief[]>([]);
  const [assignedToId, setAssignedToId] = useState("");

  // Approval checkbox & dropdown
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [eligibleApprovers, setEligibleApprovers] = useState<UserBrief[]>([]);
  const [approverId, setApproverId] = useState("");

  // Recurrence settings
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

  // Subtasks list
  const [subtasks, setSubtasks] = useState<{ title: string; description?: string }[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState("");

  const handleAddSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    setSubtasks((prev) => [...prev, { title: newSubtaskInput.trim() }]);
    setNewSubtaskInput("");
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch assignable users when modal opens
  useEffect(() => {
    if (isOpen && user) {
      usersApi
        .getAssignable()
        .then((users) => {
          setAssignableUsers(users);
          setAssignedToId((prev) => {
            if (prev) return prev;
            const defaultUser = users.find((u) => u.id === user.id) || users[0];
            return defaultUser ? defaultUser.id : "";
          });
        })
        .catch((err) => setError(getErrorMessage(err)));
    }
  }, [isOpen, user?.id]);

  // When assignedToId or requiresApproval changes, dynamically fetch eligible approvers
  useEffect(() => {
    if (requiresApproval && assignedToId) {
      usersApi
        .getEligibleApprovers(assignedToId)
        .then((approvers) => {
          setEligibleApprovers(approvers);
          setApproverId((prev) => {
            if (prev && approvers.some((a) => a.id === prev)) return prev;
            return approvers.length > 0 ? approvers[0].id : "";
          });
        })
        .catch((err) => setError(getErrorMessage(err)));
    } else {
      setEligibleApprovers([]);
      setApproverId("");
    }
  }, [requiresApproval, assignedToId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!assignedToId) {
      setError("Please select an assignee.");
      return;
    }
    if (requiresApproval && !approverId) {
      setError("Please designate an approver from the dropdown.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        title,
        description: description || null,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to_id: assignedToId,
        requires_approval: requiresApproval,
        approver_id: requiresApproval ? approverId : null,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : "NONE",
        recurrence_interval: isRecurring ? Number(recurrenceInterval) : 1,
        recurrence_days_of_week:
          isRecurring && recurrencePattern !== "MONTHLY" ? recurrenceDaysOfWeek : undefined,
        recurrence_day_of_week:
          isRecurring && recurrenceDaysOfWeek.length > 0 ? recurrenceDaysOfWeek[0] : null,
        recurrence_day_of_month:
          isRecurring && recurrencePattern === "MONTHLY" && recurrenceDayOfMonth !== ""
            ? Number(recurrenceDayOfMonth)
            : null,
        recurrence_end_date:
          isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : null,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
      };

      await tasksApi.create(payload);
      onTaskCreated();
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setRequiresApproval(false);
      setIsRecurring(false);
      setRecurrenceDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
      setSubtasks([]);
      setNewSubtaskInput("");
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
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 z-10"
        >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Task</h2>
            <p className="text-xs text-slate-500">
              Configure assignment, approval workflow, and recurrence
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Conduct Q3 Sprint Retrospective"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide actionable specifications and requirements..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Due Date
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Assignee Selection (Scoped to permissions) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                Assignee *
              </label>
              <span className="text-[11px] text-slate-400">
                Filtered by your role ({user?.role})
              </span>
            </div>
            <select
              required
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) - {u.email}
                </option>
              ))}
            </select>
          </div>

          {/* HIGHER LEVEL APPROVAL CHECKBOX & CONDITIONAL DROPDOWN */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requiresApproval"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label
                htmlFor="requiresApproval"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Needs approval from a higher level
              </label>
            </div>

            {/* Dropdown opens only if checkbox is ticked */}
            {requiresApproval && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  From whom? (Select Approver) *
                </label>
                {eligibleApprovers.length > 0 ? (
                  <select
                    value={approverId}
                    onChange={(e) => setApproverId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {eligibleApprovers.map((appr) => (
                      <option key={appr.id} value={appr.id}>
                        {appr.full_name} ({appr.role.replace("_", " ")}
                        {appr.branch ? ` - Branch: ${appr.branch}` : ""}
                        {appr.department ? ` - Dept: ${appr.department}` : ""})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No users with higher rank than the selected assignee were found.
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  The task cannot be closed until this approver approves it.
                </p>
              </div>
            )}
          </div>

          {/* RECURRENCE CHECKBOX & CONFIGURATION */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label
                htmlFor="isRecurring"
                className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Repeat className="w-4 h-4 text-indigo-600" />
                <span>Recurring Task</span>
              </label>
            </div>

            {isRecurring && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Pattern *
                    </label>
                    <select
                      value={recurrencePattern}
                      onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="CUSTOM">Custom Interval</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Interval (Every N steps)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {recurrencePattern !== "MONTHLY" && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                        Choose Days in Week *
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px]">
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
                            recurrenceDaysOfWeek.length === 5 && !recurrenceDaysOfWeek.includes(5) && !recurrenceDaysOfWeek.includes(6)
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
                            className={`py-2 text-xs font-semibold rounded-xl border transition flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                            }`}
                            title={`Toggle ${d.full}`}
                          >
                            <span>{d.label}</span>
                            <span className={`text-[9px] font-bold ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Day of Month (1 - 31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={recurrenceDayOfMonth}
                      onChange={(e) =>
                        setRecurrenceDayOfMonth(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      placeholder="e.g. 15"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Recurrence End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SUBTASKS / CHECKLIST SECTION */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-indigo-600" />
                <span>Subtasks / Daily Checklist Items</span>
                {subtasks.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {subtasks.length}
                  </span>
                )}
              </label>
            </div>

            <p className="text-[11px] text-slate-500">
              {isRecurring
                ? "Subtasks added here will automatically repeat with this task on each recurring cycle."
                : "Add individual checklist action items that must be completed for this task."}
            </p>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Enter subtask title (e.g. Inspect equipment, Take meter reading)..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!newSubtaskInput.trim()}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 flex items-center gap-1.5 transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Subtask items list */}
            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">{st.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(idx)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                      title="Remove subtask"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Creating..." : "Create Task"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
};

