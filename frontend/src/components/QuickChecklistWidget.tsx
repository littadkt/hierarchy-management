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
} from "lucide-react";
import { ChecklistItem } from "@/lib/types";
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

  // New item form state
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit item state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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

  useEffect(() => {
    loadItems();
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
      });
      setItems([created, ...items]);
      setNewTitle("");
      setNewDueDate("");
      setShowDatePicker(false);
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
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline px-2.5 py-1 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/40"
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
            className={`p-2 rounded-xl text-xs transition ${
              newDueDate || showDatePicker
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700"
            }`}
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={submitting || !newTitle.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Due Date Input Reveal */}
        {showDatePicker && (
          <div className="flex items-center gap-2 px-2 text-xs animate-in fade-in duration-150">
            <span className="text-slate-400 text-[11px]">Due Date:</span>
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
                className="text-slate-400 hover:text-rose-500 text-xs"
              >
                Clear date
              </button>
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
          displayedItems.map((item) => {
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
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={savingEdit || !editTitle.trim()}
                        className="px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
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
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 group ${
                  item.is_completed
                    ? "bg-slate-50/60 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60"
                    : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300"
                }`}
              >
                {/* Left: Checkbox & Title */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
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

                    {item.due_date && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
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

