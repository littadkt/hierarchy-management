"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit2,
  X,
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  CheckSquare,
  Repeat,
} from "lucide-react";
import { Subtask, UserBrief } from "@/lib/types";
import { tasksApi, usersApi, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";

interface SubtasksListProps {
  taskId: string;
  taskCreatorId?: string;
  subtasks: Subtask[];
  onSubtasksChanged: () => void;
  canManage?: boolean;
  isRecurring?: boolean;
}

export const SubtasksList: React.FC<SubtasksListProps> = ({
  taskId,
  taskCreatorId,
  subtasks,
  onSubtasksChanged,
  canManage = true,
  isRecurring = false,
}) => {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [assignableUsers, setAssignableUsers] = useState<UserBrief[]>([]);

  // Add subtask form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit subtask state
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Toggling state tracker
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await usersApi.getAssignable();
        setAssignableUsers(users);
      } catch {
        // Soft fail if users endpoint can't be fetched
      }
    };
    loadUsers();
  }, []);

  const totalCount = subtasks.length;
  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Check if current user is allowed to edit or delete subtasks (only creator of task/subtask or super admin)
  const canEditOrDeleteSubtask = (subtask: Subtask) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return taskCreatorId === user.id || subtask.created_by_id === user.id;
  };

  // Toggle subtask completion
  const handleToggle = async (subtask: Subtask) => {
    try {
      setTogglingId(subtask.id);
      await tasksApi.toggleSubtask(taskId, subtask.id, !subtask.is_completed);
      onSubtasksChanged();
    } catch (err) {
      await alert({
        title: "Toggle Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setTogglingId(null);
    }
  };

  // Add Subtask
  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmittingAdd(true);
    setAddError(null);
    try {
      await tasksApi.createSubtask(taskId, {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : null,
        assigned_to_id: newAssigneeId || null,
      });
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      setNewAssigneeId("");
      setShowAddDetails(false);
      setIsAdding(false);
      onSubtasksChanged();
    } catch (err) {
      setAddError(getErrorMessage(err));
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Start Editing Subtask
  const handleStartEdit = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditTitle(subtask.title);
    setEditDescription(subtask.description || "");
    setEditDueDate(
      subtask.due_date ? new Date(subtask.due_date).toISOString().slice(0, 10) : ""
    );
    setEditAssigneeId(subtask.assigned_to_id || "");
    setEditError(null);
  };

  // Save Edit
  const handleSaveEdit = async (subtaskId: string) => {
    if (!editTitle.trim()) return;
    setSubmittingEdit(true);
    setEditError(null);
    try {
      await tasksApi.updateSubtask(taskId, subtaskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
        assigned_to_id: editAssigneeId || null,
      });
      setEditingSubtaskId(null);
      onSubtasksChanged();
    } catch (err) {
      setEditError(getErrorMessage(err));
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Subtask
  const handleDelete = async (subtask: Subtask) => {
    const ok = await confirm({
      title: "Delete Subtask",
      message: `Are you sure you want to delete subtask "${subtask.title}"?`,
      confirmText: "Delete Subtask",
      type: "danger",
    });
    if (!ok) return;

    try {
      setDeletingId(subtask.id);
      await tasksApi.deleteSubtask(taskId, subtask.id);
      onSubtasksChanged();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Progress Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Subtasks Checklist ({completedCount}/{totalCount})
            </h4>
          </div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {percentCompleted}%
          </span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              percentCompleted === 100
                ? "bg-emerald-500"
                : "bg-indigo-600 dark:bg-indigo-500"
            }`}
            style={{ width: `${percentCompleted}%` }}
          />
        </div>
      </div>

      {/* Recurring Series Notice */}
      {isRecurring && (
        <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 px-3.5 py-2.5 rounded-xl shadow-xs">
          <Repeat className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span>
            <strong>Recurring Task:</strong> Subtasks added, updated, or removed here automatically sync across all recurring days.
          </span>
        </div>
      )}

      {/* Subtasks Items List */}
      <div className="space-y-2">
        {subtasks.length === 0 && !isAdding ? (
          <div className="text-center py-6 px-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
            <p>No subtasks created for this task yet.</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Subtask
              </button>
            )}
          </div>
        ) : (
          subtasks.map((subtask) => {
            const isEditing = editingSubtaskId === subtask.id;

            if (isEditing) {
              return (
                <div
                  key={subtask.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-indigo-300 dark:border-indigo-700 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Edit Subtask
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingSubtaskId(null)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {editError && (
                    <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/50 p-2 rounded border border-rose-200 dark:border-rose-900">
                      {editError}
                    </div>
                  )}

                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Subtask title..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />

                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Optional description / instructions..."
                    rows={2}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Assignee
                      </label>
                      <select
                        value={editAssigneeId}
                        onChange={(e) => setEditAssigneeId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingSubtaskId(null)}
                      className="px-3 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(subtask.id)}
                      disabled={submittingEdit || !editTitle.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                    >
                      {submittingEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={subtask.id}
                className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 group ${
                  subtask.is_completed
                    ? "bg-slate-50/70 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800"
                    : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs"
                }`}
              >
                {/* Left: Checkbox & Subtask Title/Details */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(subtask)}
                    disabled={togglingId === subtask.id}
                    className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                  >
                    {togglingId === subtask.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : subtask.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-indigo-500" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium leading-snug break-words ${
                        subtask.is_completed
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {subtask.title}
                    </p>

                    {subtask.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">
                        {subtask.description}
                      </p>
                    )}

                    {/* Metadata chips */}
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      {subtask.due_date && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(subtask.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {subtask.assigned_to && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                          <UserIcon className="w-2.5 h-2.5" />
                          {subtask.assigned_to.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Edit & Delete - only creator or super admin) */}
                <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition shrink-0">
                  {canEditOrDeleteSubtask(subtask) && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(subtask)}
                        title="Edit subtask"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(subtask)}
                        disabled={deletingId === subtask.id}
                        title="Delete subtask"
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      >
                        {deletingId === subtask.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Subtask Section */}
      {canManage && (
        <div>
          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subtask</span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateSubtask}
              className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-indigo-200 dark:border-indigo-900 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  New Subtask
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setShowAddDetails(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/50 p-2 rounded border border-rose-200 dark:border-rose-900">
                  {addError}
                </div>
              )}

              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
              />

              {showAddDetails && (
                <div className="space-y-3 pt-1">
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Optional notes or details..."
                    rows={2}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        Assignee
                      </label>
                      <select
                        value={newAssigneeId}
                        onChange={(e) => setNewAssigneeId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="">Unassigned</option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddDetails(!showAddDetails)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline inline-flex items-center gap-1"
                >
                  {showAddDetails ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Less details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      More details (assignee, due date)
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setShowAddDetails(false);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd || !newTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submittingAdd && <Loader2 className="w-3 h-3 animate-spin" />}
                    Add Subtask
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

