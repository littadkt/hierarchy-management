"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { attendanceApi, getErrorMessage } from "@/lib/api";
import { AttendanceTodayStatus } from "@/lib/types";
import { getBrowserLocation } from "@/lib/geolocation";

export const AttendanceQuickButton: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<AttendanceTodayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [modalType, setModalType] = useState<"CHECK_IN" | "CHECK_OUT" | null>(null);
  const [note, setNote] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Live timer tick
  const [liveSeconds, setLiveSeconds] = useState(0);

  const fetchStatus = async () => {
    if (!user) return;
    try {
      const data = await attendanceApi.getToday();
      setStatus(data);
      setLiveSeconds(data.worked_seconds);
    } catch {
      // Soft fail
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  // Real-time auto sync
  useRealtimeEvent(["ATTENDANCE_UPDATED"], () => {
    fetchStatus();
  });

  // Timer tick for active working session
  useEffect(() => {
    if (status?.is_checked_in && !status?.is_checked_out) {
      const interval = setInterval(() => {
        setLiveSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status?.is_checked_in, status?.is_checked_out]);

  if (!user) return null;

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType) return;
    setSubmitting(true);
    setError(null);
    try {
      if (modalType === "CHECK_IN") {
        const coords = await getBrowserLocation();
        await attendanceApi.checkIn({
          note: note.trim() || undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
      } else {
        await attendanceApi.checkOut(note.trim() || undefined);
      }
      setModalType(null);
      setNote("");
      await fetchStatus();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {!status?.is_checked_in ? (
          /* Check In Button */
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNote("");
              setModalType("CHECK_IN");
            }}
            title="Punch In for Today's Attendance"
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Check In</span>
          </button>
        ) : status?.record?.approval_status === "REJECTED" ? (
          /* Rejected Check-in */
          <Link
            href="/attendance"
            title={`Check-in Rejected: ${status.record.rejection_reason || "Location not verified"}`}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 transition-colors shrink-0"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="hidden sm:inline">Check-in Rejected</span>
            <span className="sm:hidden font-bold text-[10px]">Rejected</span>
          </Link>
        ) : !status?.is_checked_out ? (
          /* Active Working Session - Live Timer & Check Out Button (both regular and off-network pending) */
          <div className="flex items-center gap-1 sm:gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl px-2 sm:px-2.5 py-1 text-xs shrink-0">
            {status?.record?.approval_status === "PENDING" ? (
              <Link
                href="/attendance"
                title="Off-network check-in recorded! Shift is active. Admin review is pending."
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold"
              >
                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="hidden md:inline">Off-Network (Pending)</span>
                <span className="hidden sm:inline md:hidden">Pending</span>
              </Link>
            ) : (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200 text-[11px] sm:text-xs">
              {formatTimer(liveSeconds)}
            </span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNote("");
                setModalType("CHECK_OUT");
              }}
              title="Punch Out"
              className="ml-0.5 sm:ml-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] sm:text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Check Out</span>
            </button>
          </div>
        ) : (
          /* Checked Out Badge */
          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px]">
              Done ({status?.record?.total_hours || 0}h)
            </span>
            {status?.record?.approval_status === "PENDING" && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium hidden sm:inline">
                (Pending)
              </span>
            )}
          </div>
        )}

        {/* Quick link to Attendance Page */}
        <Link
          href="/attendance"
          title="Attendance Dashboard & Reports"
          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors hidden md:inline-flex"
        >
          <Clock className="w-4 h-4" />
        </Link>
      </div>

      {/* Confirmation Modal - Rendered via portal to prevent stacking context bleed */}
      {modalType && mounted && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white ${
                    modalType === "CHECK_IN" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {modalType === "CHECK_IN" ? (
                    <LogIn className="w-4 h-4" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {modalType === "CHECK_IN"
                      ? "Attendance Check-In"
                      : "Attendance Check-Out"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {modalType === "CHECK_IN"
                      ? "Start your work session for today"
                      : "Complete your work session and record total hours"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmAction} className="p-4 sm:p-5 space-y-4">
              {error && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {modalType === "CHECK_OUT" && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs flex justify-between items-center">
                  <span className="text-slate-500">Current Session Time</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {formatTimer(liveSeconds)}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {modalType === "CHECK_IN"
                    ? "Work Note / Location (Optional)"
                    : "Handover / Work Summary Note (Optional)"}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    modalType === "CHECK_IN"
                      ? "e.g. Office desk, Remote, Client site..."
                      : "e.g. Completed inventory audit and resolved tasks..."
                  }
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/attendance"
                  onClick={() => setModalType(null)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>Attendance Page</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                      modalType === "CHECK_IN"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>
                      {modalType === "CHECK_IN" ? "Confirm Check In" : "Confirm Check Out"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
