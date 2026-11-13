"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Plus,
  Trash2,
  Edit,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Users,
  Timer,
  Save,
} from "lucide-react";
import { schedulesApi, getErrorMessage } from "@/lib/api";
import { TimeSchedule } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

interface ManageSchedulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedulesUpdated?: () => void;
}

export const ManageSchedulesModal: React.FC<ManageSchedulesModalProps> = ({
  isOpen,
  onClose,
  onSchedulesUpdated,
}) => {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [schedules, setSchedules] = useState<TimeSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Mode: "list" | "create" | "edit"
  const [isAdding, setIsAdding] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [checkInTime, setCheckInTime] = useState("09:00");
  const [checkOutTime, setCheckOutTime] = useState("18:00");
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [monthlyBufferLimit, setMonthlyBufferLimit] = useState(3);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await schedulesApi.list();
      setSchedules(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSchedules();
      setIsAdding(false);
      setEditingScheduleId(null);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleStartCreate = () => {
    setIsAdding(true);
    setEditingScheduleId(null);
    setName("");
    setCheckInTime("09:00");
    setCheckOutTime("18:00");
    setBufferMinutes(10);
    setMonthlyBufferLimit(3);
    setDescription("");
    setError(null);
    setSuccess(null);
  };

  const handleStartEdit = (sched: TimeSchedule) => {
    setEditingScheduleId(sched.id);
    setIsAdding(false);
    setName(sched.name);
    setCheckInTime(sched.check_in_time);
    setCheckOutTime(sched.check_out_time);
    setBufferMinutes(sched.buffer_minutes);
    setMonthlyBufferLimit(sched.monthly_buffer_limit);
    setDescription(sched.description || "");
    setError(null);
    setSuccess(null);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingScheduleId(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !checkInTime || !checkOutTime) {
      setError("Please fill in schedule name, check-in time, and check-out time.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingScheduleId) {
        await schedulesApi.update(editingScheduleId, {
          name: name.trim(),
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          buffer_minutes: bufferMinutes,
          monthly_buffer_limit: monthlyBufferLimit,
          description: description.trim() || undefined,
        });
        setSuccess(`Schedule "${name}" updated successfully!`);
      } else {
        await schedulesApi.create({
          name: name.trim(),
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          buffer_minutes: bufferMinutes,
          monthly_buffer_limit: monthlyBufferLimit,
          description: description.trim() || undefined,
        });
        setSuccess(`Schedule "${name}" created successfully!`);
      }

      await loadSchedules();
      setIsAdding(false);
      setEditingScheduleId(null);
      if (onSchedulesUpdated) onSchedulesUpdated();

      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sched: TimeSchedule) => {
    if (!confirm(`Are you sure you want to delete "${sched.name}"? Users assigned to this schedule will be unlinked.`)) {
      return;
    }

    setError(null);
    try {
      await schedulesApi.delete(sched.id);
      setSuccess(`Schedule "${sched.name}" deleted.`);
      await loadSchedules();
      if (onSchedulesUpdated) onSchedulesUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-schedules-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="manage-schedules-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Time Schedules & Shifts
              </h2>
              <p className="text-xs text-slate-500">
                Configure check-in / check-out hours, 10-minute grace buffers, and monthly allowances.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Notifications */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Create or Edit Form */}
          {(isAdding || editingScheduleId) && (
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/80 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{editingScheduleId ? "Edit Time Schedule" : "Add New Time Schedule"}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Schedule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. General Shift (09:00 AM - 06:00 PM)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Check-in Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Check-out Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Grace Buffer Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Default: 10 minutes grace window</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Allowed Grace Days Per Month
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={monthlyBufferLimit}
                    onChange={(e) => setMonthlyBufferLimit(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Default: 3 days in a month</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard morning shift for operations team"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  disabled={submitting}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{submitting ? "Saving..." : editingScheduleId ? "Update Schedule" : "Save Schedule"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Schedules List Header & Add Button */}
          {!isAdding && !editingScheduleId && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Active Schedules ({schedules.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Time Schedule</span>
              </button>
            </div>
          )}

          {/* Schedules Table / Cards */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading schedules...</div>
            ) : schedules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                No time schedules found. Click "Add Time Schedule" to create one.
              </div>
            ) : (
              schedules.map((sched) => (
                <div
                  key={sched.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {sched.name}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Clock className="w-3 h-3" />
                        {sched.check_in_time} &rarr; {sched.check_out_time}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3 text-amber-500" />
                        Buffer: <strong>{sched.buffer_minutes} mins</strong>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-blue-500" />
                        Monthly Grace: <strong>{sched.monthly_buffer_limit} days</strong>
                      </span>
                      {sched.employee_count !== undefined && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                            <Users className="w-3 h-3 text-slate-400" />
                            {sched.employee_count} {sched.employee_count === 1 ? "employee" : "employees"}
                          </span>
                        </>
                      )}
                    </div>

                    {sched.description && (
                      <p className="text-[11px] text-slate-400 italic">
                        {sched.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(sched)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Edit Schedule"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sched)}
                      className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete Schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-[11px] text-slate-400">
            Rule: Late check-in beyond 10 mins (or exceeding 3 days/month) is marked as <strong>Half Day Leave</strong>.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
