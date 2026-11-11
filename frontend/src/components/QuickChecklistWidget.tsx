"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Edit2,
  X,
  Calendar,
  Loader2,
  Sparkles,
  ListTodo,
  Check,
  CheckSquare,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  User as UserIcon,
} from "lucide-react";
import { ChecklistItem, UserBrief } from "@/lib/types";
import { checklistApi, getErrorMessage } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";

interface QuickChecklistWidgetProps {
  initialLimit?: number;
  showTitle?: boolean;
  className?: string;
}

export const QuickChecklistWidget: React.FC<QuickChecklistWidgetProps> = ({
  initialLimit,
  showTitle = true,
  className = "",
}) => {
  const { confirm } = useConfirm();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selectable users
  const [users, setUsers] = useState<UserBrief[]>([]);

  // New item form state
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTargetUserId, setNewTargetUserId] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);

  // Edit item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTargetUserId, setEditTargetUserId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Drag and drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const previous = [...items];
    const reordered = [...items];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setItems(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);

    try {
      await checklistApi.reorder(reordered.map((i) => i.id));
    } catch (err) {
      console.error("Failed to reorder checklist items:", err);
      setItems(previous);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await checklistApi.list();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await checklistApi.getUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load selectable users:", err);
    }
  };

  useEffect(() => {
    loadItems();
    loadUsers();
  }, []);

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.is_completed).length;
  const activeCount = totalCount - completedCount;
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      const created = await checklistApi.create({
        title: newTitle.trim(),
        due_date: newDueDate ? new Date(newDueDate).toISOString() : null,
        target_user_id: newTargetUserId || null,
      });
      setItems([created, ...items]);
      setNewTitle("");
      setNewDueDate("");
      setNewTargetUserId("");
      setShowDatePicker(false);
      setShowUserPicker(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Item
  const handleToggle = async (item: ChecklistItem) => {
    try {
      setTogglingId(item.id);
      const nextStatus = !item.is_completed;
      // Optimistic update
      setItems(items.map((i) => (i.id === item.id ? { ...i, is_completed: nextStatus } : i)));
      await checklistApi.toggle(item.id, nextStatus);
    } catch (err) {
      setError(getErrorMessage(err));
      // Revert on error
      loadItems();
    } finally {
      setTogglingId(null);
    }
  };

  // Start Edit
  const handleStartEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDueDate(item.due_date ? new Date(item.due_date).toISOString().slice(0, 10) : "");
    setEditTargetUserId(item.target_user_id || "");
  };

  // Save Edit
  const handleSaveEdit = async (itemId: string) => {
    if (!editTitle.trim()) return;
    try {
      setSavingEdit(true);
      setError(null);
      const updated = await checklistApi.update(itemId, {
        title: editTitle.trim(),
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
        target_user_id: editTargetUserId || null,
      });
      setItems(items.map((i) => (i.id === itemId ? updated : i)));
      setEditingId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Item
  const handleDelete = async (itemId: string) => {
    try {
      setDeletingId(itemId);
      setItems(items.filter((i) => i.id !== itemId));
      await checklistApi.delete(itemId);
    } catch (err) {
      setError(getErrorMessage(err));
      loadItems();
    } finally {
      setDeletingId(null);
    }
  };

  // Clear Completed
  const handleClearCompleted = async () => {
    const ok = await confirm({
      title: "Clear Completed Tasks",
      message: "Are you sure you want to clear all completed tasks from your checklist?",
      confirmText: "Clear Tasks",
      type: "warning",
    });
    if (!ok) return;

    try {
      setClearing(true);
      await checklistApi.clearCompleted();
      setItems(items.filter((i) => !i.is_completed));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setClearing(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === "active") return !item.is_completed;
    if (filter === "completed") return item.is_completed;
    return true;
  });

  const hasLimit = Boolean(initialLimit && !isExpanded);
  const displayedItems = hasLimit ? filteredItems.slice(0, initialLimit!) : filteredItems;

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 ${className}`}
    >
      {/* Header with Title & Progress */}
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Personal Checklist</span>
                <span className="text-xs font-normal text-slate-400">Quick tasks</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Private checklist for your daily action items
              </p>
            </div>
          </div>

          {/* Progress Pill & Full Page Link */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/checklist"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline px-2.5 py-1 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/40"
            >
              <span>Full Page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {completedCount} / {totalCount} done
              </span>
              <span className="text-[11px] text-slate-400 block">{percentCompleted}%</span>
            </div>
            <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${percentCompleted}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Bar */}
      <form onSubmit={handleAddItem} className="space-y-2">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition shadow-inner">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a quick task... (e.g. Call vendor, submit invoice)"
            className="flex-1 px-3 py-2 text-xs bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />

          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            title="Set due date"
            className={`p-2 rounded-xl text-xs transition cursor-pointer ${
              newDueDate || showDatePicker
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700"
            }`}
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowUserPicker(!showUserPicker)}
            title="Select user for this checklist item (optional)"
            className={`p-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer ${
              newTargetUserId || showUserPicker
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700"
            }`}
          >
            <UserIcon className="w-4 h-4" />
            {newTargetUserId && (
              <span className="max-w-[70px] truncate text-[10px] font-semibold hidden sm:inline">
                {users.find((u) => u.id === newTargetUserId)?.full_name.split(" ")[0]}
              </span>
            )}
          </button>

          <button
            type="submit"
            disabled={submitting || !newTitle.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Due Date & Select User Option Reveal */}
        {(showDatePicker || showUserPicker || newDueDate || newTargetUserId) && (
          <div className="flex items-center gap-3 px-2 text-xs animate-in fade-in duration-150 flex-wrap pt-1">
            {/* Due Date */}
            {(showDatePicker || newDueDate) && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due Date:
                </span>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                />
                {newDueDate && (
                  <button
                    type="button"
                    onClick={() => setNewDueDate("")}
                    className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                  >
                    Clear date
                  </button>
                )}
              </div>
            )}

            {/* Select User Option */}
            {(showUserPicker || newTargetUserId) && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 font-medium">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Select User:</span>
                </span>
                <select
                  value={newTargetUserId}
                  onChange={(e) => setNewTargetUserId(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none max-w-xs cursor-pointer"
                >
                  <option value="">No user selected (None)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role.replace("_", " ")}{u.branch ? ` - ${u.branch}` : ""})
                    </option>
                  ))}
                </select>
                {newTargetUserId && (
                  <button
                    type="button"
                    onClick={() => setNewTargetUserId("")}
                    className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                  >
                    Clear user
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Filter Tabs & Clear Actions */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 text-xs">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "all", label: `All (${totalCount})` },
              { id: "active", label: `Pending (${activeCount})` },
              { id: "completed", label: `Done (${completedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === tab.id
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {completedCount > 0 && (
          <button
            type="button"
            onClick={handleClearCompleted}
            disabled={clearing}
            className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
          >
            {clearing ? "Clearing..." : "Clear Completed"}
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading your checklist...</span>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <Sparkles className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              {filter === "completed"
                ? "No completed checklist items yet."
                : filter === "active"
                ? "All clear! No pending quick tasks."
                : "Your personal checklist is empty."}
            </p>
            <p className="text-[11px]">Type in the box above to add your own quick tasks.</p>
          </div>
        ) : (
          displayedItems.map((item, index) => {
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-indigo-300 dark:border-indigo-700 space-y-2.5 animate-in fade-in duration-150"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <select
                          value={editTargetUserId}
                          onChange={(e) => setEditTargetUserId(e.target.value)}
                          className="px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none max-w-xs cursor-pointer"
                        >
                          <option value="">No user selected (None)</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} ({u.role.replace("_", " ")})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={savingEdit || !editTitle.trim()}
                        className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer"
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 group ${
                  item.is_completed
                    ? "bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60"
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300"
                } ${
                  draggedIndex === index
                    ? "opacity-35 border-dashed border-indigo-400 bg-indigo-50/40"
                    : ""
                } ${
                  dragOverIndex === index && draggedIndex !== index
                    ? "border-t-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20"
                    : ""
                }`}
              >
                {/* Drag Handle */}
                <div
                  className="text-slate-300 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag ⠿ to rearrange order"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Left: Checkbox & Title */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    disabled={togglingId === item.id}
                    className="shrink-0 text-slate-300 hover:text-indigo-600 dark:text-slate-600 dark:hover:text-indigo-400 transition"
                  >
                    {togglingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    ) : item.is_completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-indigo-600" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium leading-snug break-words ${
                        item.is_completed
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {item.title}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {item.target_user && (
                        <span
                          title={`Selected User: ${item.target_user.full_name} (${item.target_user.role.replace("_", " ")})`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800"
                        >
                          <UserIcon className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span>{item.target_user.full_name}</span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            ({item.target_user.role.replace("_", " ")})
                          </span>
                        </span>
                      )}

                      {item.due_date && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(item)}
                    title="Edit quick task"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="Delete quick task"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {initialLimit && filteredItems.length > initialLimit && (
        <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Less (First {initialLimit})</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>
                  Show All {filteredItems.length} Items ({filteredItems.length - initialLimit} more)
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

