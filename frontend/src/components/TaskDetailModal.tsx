"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Clock,
  User,
  ShieldAlert,
  Repeat,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  Send,
  AlertTriangle,
  Trash2,
  Edit,
  CheckSquare,
  Paperclip,
  Loader2,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { approvalsApi, attachmentsApi, tasksApi, getErrorMessage } from "@/lib/api";
import { Subtask, Task, TaskActivity, TaskAttachment, TaskComment, TaskStatus } from "@/lib/types";
import { RoleBadge } from "./RoleBadge";
import { StatusBadge } from "./StatusBadge";
import { EditTaskModal } from "./EditTaskModal";
import { SubtasksList } from "./SubtasksList";
import { TaskAttachmentsView } from "./TaskAttachmentsView";

interface TaskDetailModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showApprovalBox, setShowApprovalBox] = useState(false);
  const [actionType, setActionType] = useState<"SUBMIT" | "APPROVE" | "REJECT">("SUBMIT");
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [subordinateStatus, setSubordinateStatus] = useState<{
    can_complete_or_submit: boolean;
    subordinates_count: number;
    pending_tasks_count: number;
    pending_tasks: Array<{
      id: string;
      title: string;
      status: string;
      assigned_to_name: string;
      assigned_to_role: string;
    }>;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "subtasks" | "attachments" | "comments" | "history">("details");

  const loadData = async (silent = false) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const taskData = await tasksApi.get(taskId);
      setTask(taskData);
      if (taskData.subtasks) setSubtasks(taskData.subtasks);
      if (taskData.attachments) setTaskAttachments(taskData.attachments);

      // Fetch comments, activities, and fresh subtasks/attachments safely in parallel
      Promise.allSettled([
        tasksApi.getComments(taskId),
        tasksApi.getActivities(taskId),
        tasksApi.getSubtasks(taskId),
        (attachmentsApi?.list || tasksApi?.getAttachments)?.(taskId),
        user && user.role !== "STAFF" ? tasksApi.getSubordinateTodayStatus() : Promise.resolve(null),
      ]).then(([cRes, aRes, sRes, attRes, subRes]) => {
        if (cRes.status === "fulfilled") setComments(cRes.value);
        if (aRes.status === "fulfilled") setActivities(aRes.value);
        if (sRes.status === "fulfilled") setSubtasks(sRes.value);
        if (attRes.status === "fulfilled" && attRes.value) setTaskAttachments(attRes.value);
        if (subRes.status === "fulfilled" && subRes.value) setSubordinateStatus(subRes.value);
      });
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSubtasksChanged = async () => {
    if (!taskId) return;
    try {
      const updated = await tasksApi.getSubtasks(taskId);
      setSubtasks(updated);
      onTaskUpdated();
    } catch (err) {
      console.error("Failed to refresh subtasks", err);
    }
  };

  const handleAttachmentsChanged = async () => {
    if (!taskId) return;
    try {
      const fetcher = attachmentsApi?.list || tasksApi?.getAttachments;
      if (fetcher) {
        const updated = await fetcher(taskId);
        setTaskAttachments(updated);
      }
      onTaskUpdated();
    } catch (err) {
      console.error("Failed to refresh attachments", err);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      loadData();
    } else if (!isOpen) {
      setTask(null);
      setError(null);
    }
  }, [isOpen, taskId]);

  useRealtimeEvent(
    [
      "TASK_STATUS_UPDATED",
      "TASK_UPDATED",
      "APPROVAL_STATUS_UPDATED",
      "TASK_ATTACHMENT_ADDED",
      "TASK_ATTACHMENT_DELETED",
    ],
    (event) => {
      if (isOpen && taskId && event.data?.task_id === taskId) {
        loadData(true);
      }
    }
  );

  if (!isOpen) return null;

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4 z-10">
            {loading ? (
              <div className="py-6 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Loading task details...
                </p>
              </div>
            ) : error ? (
              <div className="py-4 space-y-3">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Determine permissions for current user
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isAssignee = user?.id === task.assigned_to_id;
  const isApprover = task.approver_id === user?.id || isSuperAdmin;
  const isPendingApproval = task.status === "PENDING_APPROVAL";
  const isCompleted = task.status === "COMPLETED";

  // Check role restrictions on Edit & Delete: only for who created the task (or Super Admin)
  const canEditOrDelete = () => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return task.created_by_id === user.id;
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!taskId) return;
    setSubmitting(true);
    setError(null);
    try {
      await tasksApi.updateStatus(taskId, newStatus);
      await loadData();
      onTaskUpdated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!taskId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (actionType === "SUBMIT") {
        await approvalsApi.submit(taskId, approvalNotes);
      } else if (actionType === "APPROVE") {
        await approvalsApi.decide(taskId, "APPROVE", approvalNotes);
      } else if (actionType === "REJECT") {
        await approvalsApi.decide(taskId, "REJECT", approvalNotes);
      }
      setShowApprovalBox(false);
      setApprovalNotes("");
      await loadData();
      onTaskUpdated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !newComment.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await tasksApi.addComment(taskId, newComment.trim());
      setNewComment("");
      const updated = await tasksApi.getComments(taskId);
      setComments(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;
    const ok = await confirm({
      title: "Delete Task",
      message: `Are you sure you want to delete task "${task?.title || "this task"}"?`,
      confirmText: "Delete Task",
      type: "danger",
    });
    if (!ok) return;

    setSubmitting(true);
    setError(null);
    try {
      await tasksApi.delete(taskId);
      onTaskUpdated();
      onClose();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setSubmitting(false);
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
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[85vh] z-10"
        >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <StatusBadge status={task.status} />
              <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {task.priority} Priority
              </span>
              {task.is_recurring && (
                <span className="text-xs px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {task.recurrence_pattern} Recurring
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "details"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("subtasks")}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "subtasks"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Subtasks ({subtasks.length})
          </button>
          <button
            onClick={() => setActiveTab("attachments")}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "attachments"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attachments ({taskAttachments.length})
          </button>
          <button
            onClick={() => setActiveTab("comments")}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "comments"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Discussion ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit History ({activities.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="whitespace-pre-line leading-relaxed">{error}</span>
            </div>
          )}

          {subordinateStatus && !subordinateStatus.can_complete_or_submit && task && task.assigned_to_id === user?.id && task.status !== "COMPLETED" && (
            <div className="p-3 text-xs bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
                <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Hierarchy Prerequisite Notice</span>
              </div>
              <p className="leading-relaxed">
                You cannot complete or submit this task for approval until all subordinates finish or submit today's tasks ({subordinateStatus.pending_tasks_count} pending).
              </p>
              <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                Pending: {subordinateStatus.pending_tasks.slice(0, 3).map((p) => `${p.assigned_to_name} ('${p.title}')`).join(", ")}
                {subordinateStatus.pending_tasks.length > 3 && ` ...+${subordinateStatus.pending_tasks.length - 3} more`}
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <>
              {/* Approval Requirement Banner */}
              {task.requires_approval && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    isPendingApproval
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : isCompleted
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                  }`}
                >
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-sm">
                      {isCompleted
                        ? "Task Approved & Completed"
                        : isPendingApproval
                        ? "Higher-Level Approval Pending"
                        : "Higher-Level Approval Required"}
                    </p>
                    <p>
                      Designated Approver:{" "}
                      <span className="font-semibold underline">
                        {task.approver?.full_name || "Higher Authority"} (
                        {task.approver?.role})
                      </span>
                    </p>
                    {!isCompleted && !isApprover && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        * Restriction: You cannot directly close this task. Submit it for approval
                        once finished.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Task Details
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                  {task.description || "No description provided."}
                </p>
              </div>

              {/* Assignment & Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Assigned To</span>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {task.assigned_to?.full_name}
                    </span>
                    {task.assigned_to?.role && <RoleBadge role={task.assigned_to.role} />}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Created By</span>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {task.created_by?.full_name}
                    </span>
                    {task.created_by?.role && <RoleBadge role={task.created_by.role} />}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Due Date</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {task.due_date ? new Date(task.due_date).toLocaleString() : "No deadline"}
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-400 font-medium">Created On</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {new Date(task.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Recurrence Details */}
              {task.is_recurring && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-300">
                    <Repeat className="w-4 h-4" />
                    <span>Recurrence Configuration</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                    <div>
                      Pattern: <span className="font-semibold">{task.recurrence_pattern}</span>
                    </div>
                    <div>
                      Interval:{" "}
                      <span className="font-semibold">Every {task.recurrence_interval}</span>
                    </div>
                    {task.recurrence_days_of_week && task.recurrence_days_of_week.length > 0 && (
                      <div className="col-span-2">
                        Active Days:{" "}
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {task.recurrence_days_of_week.length === 7
                            ? "All Days"
                            : task.recurrence_days_of_week.length === 6 && !task.recurrence_days_of_week.includes(6)
                            ? "Mon - Sat (Sundays skipped)"
                            : task.recurrence_days_of_week.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(", ")}
                        </span>
                      </div>
                    )}
                    {task.next_run_date && (
                      <div className="col-span-2">
                        Next Run:{" "}
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                          {new Date(task.next_run_date).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Approval Modal Action Box */}
              {showApprovalBox && (
                <div className="p-4 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {actionType === "SUBMIT"
                        ? "Submit Task for Approval"
                        : actionType === "APPROVE"
                        ? "Approve Task"
                        : "Reject Task"}
                    </h4>
                    <button
                      onClick={() => setShowApprovalBox(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder={
                      actionType === "SUBMIT"
                        ? "Add notes about completed work for the reviewer..."
                        : "Add comments or rejection reasons..."
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApprovalBox(false)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApprovalAction}
                      disabled={submitting}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white ${
                        actionType === "REJECT"
                          ? "bg-rose-600 hover:bg-rose-700"
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {submitting ? "Processing..." : "Confirm"}
                    </button>
                  </div>
                </div>
              )}

              {/* Subtasks Checklist Section */}
              <div className="pt-2">
                <SubtasksList
                  taskId={task.id}
                  taskCreatorId={task.created_by_id}
                  subtasks={subtasks}
                  onSubtasksChanged={handleSubtasksChanged}
                  canManage={true}
                  isRecurring={Boolean(task.is_recurring)}
                />
              </div>

              {/* Task Attachments Section */}
              <div className="pt-2">
                <TaskAttachmentsView
                  taskId={task.id}
                  attachments={taskAttachments}
                  onAttachmentsChanged={handleAttachmentsChanged}
                  canUpload={true}
                  canDelete={true}
                  compact={true}
                />
              </div>
            </>
          )}

          {activeTab === "subtasks" && (
            <div className="space-y-4">
              <SubtasksList
                taskId={task.id}
                taskCreatorId={task.created_by_id}
                subtasks={subtasks}
                onSubtasksChanged={handleSubtasksChanged}
                canManage={true}
                isRecurring={Boolean(task.is_recurring)}
              />
            </div>
          )}

          {activeTab === "attachments" && (
            <div className="space-y-4">
              <TaskAttachmentsView
                taskId={task.id}
                attachments={taskAttachments}
                onAttachmentsChanged={handleAttachmentsChanged}
                canUpload={true}
                canDelete={true}
              />
            </div>
          )}

          {activeTab === "comments" && (
            <div className="space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No comments yet. Start the discussion below.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {c.user?.full_name} ({c.user?.role})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type a comment or question..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No activity records.</p>
              ) : (
                activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {a.action.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      {a.details && (
                        <p className="text-slate-600 dark:text-slate-400">{a.details}</p>
                      )}
                      {a.user && (
                        <span className="text-[10px] text-slate-400">
                          By: {a.user.full_name} ({a.user.role})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions with Workflow Controls */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between flex-wrap gap-2">
          {/* Edit & Delete actions (restricted according to hierarchy rules) */}
          {canEditOrDelete() ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditTaskOpen(true)}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Edit/Delete restricted by hierarchy
            </span>
          )}

          {/* Workflow Status Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Start Progress */}
            {task.status === "PENDING" && (
              <button
                onClick={() => handleStatusChange("IN_PROGRESS")}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                Start Task
              </button>
            )}

            {/* If task requires approval & is in progress, show Submit for Approval */}
            {task.requires_approval &&
              (task.status === "IN_PROGRESS" || task.status === "PENDING") && (
                <button
                  onClick={() => {
                    setActionType("SUBMIT");
                    setShowApprovalBox(true);
                  }}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Submit for Approval</span>
                </button>
              )}

            {/* If task requires approval and user is Approver / SuperAdmin and status is PENDING_APPROVAL */}
            {task.requires_approval && isPendingApproval && isApprover && (
              <>
                <button
                  onClick={() => {
                    setActionType("REJECT");
                    setShowApprovalBox(true);
                  }}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
                <button
                  onClick={() => {
                    setActionType("APPROVE");
                    setShowApprovalBox(true);
                  }}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Complete</span>
                </button>
              </>
            )}

            {/* Standard completion for tasks that DO NOT require approval */}
            {!task.requires_approval && task.status !== "COMPLETED" && (
              <button
                onClick={() => handleStatusChange("COMPLETED")}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark as Complete</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    <EditTaskModal
        task={task}
        isOpen={isEditTaskOpen}
        onClose={() => setIsEditTaskOpen(false)}
        onTaskUpdated={() => {
          loadData();
          onTaskUpdated();
        }}
      />
    </div>
  );
};

