"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarCheck2,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Search,
  Building2,
  Filter,
  RotateCcw,
  Users,
  Timer,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Calendar,
  Coffee,
  User as UserIcon,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { attendanceApi, branchesApi, departmentsApi, usersApi, getErrorMessage } from "@/lib/api";
import { getBrowserLocation, getGoogleMapsUrl } from "@/lib/geolocation";
import {
  AttendanceRecord,
  AttendanceTodayStatus,
  AttendanceReportSummary,
  Branch,
  Department,
  UserBrief,
  BufferStatus,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { ManageSchedulesModal } from "@/components/ManageSchedulesModal";

function formatTime(isoStr?: string | null) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    // Note: if dateStr is YYYY-MM-DD, parse year, month, day to avoid timezone off-by-one
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString([], {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString([], {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatHoursMinutes(hoursNum?: number | null) {
  if (hoursNum == null || hoursNum === 0) return "0h 0m";
  const h = Math.floor(hoursNum);
  const m = Math.round((hoursNum - h) * 60);
  return `${h}h ${m}m`;
}

function formatSeconds(totalSec: number) {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function AttendancePage() {
  const { user } = useAuth();

  // Current wall-clock live time and formatted date
  const [currentWallClock, setCurrentWallClock] = useState<string>("");
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentWallClock(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Today's punch state & grace buffer
  const [todayStatus, setTodayStatus] = useState<AttendanceTodayStatus | null>(null);
  const [bufferStatus, setBufferStatus] = useState<BufferStatus | null>(null);
  const [isManageSchedulesOpen, setIsManageSchedulesOpen] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [punchNote, setPunchNote] = useState("");
  const [isPunching, setIsPunching] = useState(false);
  const [punchMessage, setPunchMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  // Tabs
  const canViewReports =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN" ||
    user?.role === "IN_CHARGE" ||
    user?.role === "TEAM_LEADER";
  const [activeTab, setActiveTab] = useState<"my_history" | "team_report">(
    canViewReports ? "team_report" : "my_history"
  );

  // My History state
  const [myRecords, setMyRecords] = useState<AttendanceRecord[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myStartDate, setMyStartDate] = useState("");
  const [myEndDate, setMyEndDate] = useState("");

  // Team Report state
  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);
  const [reportSummary, setReportSummary] = useState<AttendanceReportSummary | null>(null);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [usersList, setUsersList] = useState<UserBrief[]>([]);

  // Team Report Filters
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [reportPage, setReportPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 15;

  const selectedBranchObj = branches.find((b) => b.id === selectedBranchId);

  const filteredUsersList = useMemo(() => {
    if (!selectedBranchId || !selectedBranchObj) {
      return usersList;
    }
    return usersList.filter((u) => {
      if (!u.branch) return false;
      const uBranch = u.branch.toLowerCase().trim();
      const bName = selectedBranchObj.name.toLowerCase().trim();
      const bCode = selectedBranchObj.code ? selectedBranchObj.code.toLowerCase().trim() : "";
      return uBranch === bName || (bCode && uBranch === bCode);
    });
  }, [usersList, selectedBranchId, selectedBranchObj]);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setReportPage(0);
    if (branchId) {
      const bObj = branches.find((b) => b.id === branchId);
      if (bObj && selectedUserId) {
        const currentUser = usersList.find((u) => u.id === selectedUserId);
        const matches =
          currentUser?.branch &&
          (currentUser.branch.toLowerCase().trim() === bObj.name.toLowerCase().trim() ||
            (bObj.code && currentUser.branch.toLowerCase().trim() === bObj.code.toLowerCase().trim()));
        if (!matches) {
          setSelectedUserId("");
        }
      }
    }
  };

  // Initialize dates client-side only to preserve static prerendering
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const firstDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

    setMyStartDate(firstDayStr);
    setMyEndDate(todayStr);
    setReportStartDate(firstDayStr);
    setReportEndDate(todayStr);
    setCurrentDateFormatted(
      now.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  // 1. Fetch Today Status & Grace Buffer
  const fetchTodayStatus = useCallback(async () => {
    try {
      const [data, bufferData] = await Promise.all([
        attendanceApi.getToday(),
        attendanceApi.getBufferStatus().catch(() => null),
      ]);
      setTodayStatus(data);
      setLiveSeconds(data.worked_seconds);
      if (bufferData) {
        setBufferStatus(bufferData);
      }
    } catch (err) {
      console.error("Failed to fetch today status", err);
    }
  }, []);

  // Timer tick for active checked-in session
  useEffect(() => {
    if (todayStatus?.is_checked_in && !todayStatus?.is_checked_out) {
      const timer = setInterval(() => {
        setLiveSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [todayStatus?.is_checked_in, todayStatus?.is_checked_out]);

  // 2. Fetch My History
  const fetchMyHistory = useCallback(async () => {
    setMyLoading(true);
    try {
      const res = await attendanceApi.getMyHistory({
        start_date: myStartDate || undefined,
        end_date: myEndDate || undefined,
        skip: 0,
        limit: 100,
      });
      setMyRecords(res.items);
    } catch (err) {
      console.error("Failed to fetch my attendance history", err);
    } finally {
      setMyLoading(false);
    }
  }, [myStartDate, myEndDate]);

  // 3. Fetch Team Report
  const fetchTeamReport = useCallback(async () => {
    if (!canViewReports) return;
    setReportLoading(true);
    try {
      const res = await attendanceApi.getReport({
        start_date: reportStartDate || undefined,
        end_date: reportEndDate || undefined,
        branch_id: selectedBranchId || undefined,
        department: selectedDept.trim() || undefined,
        user_id: selectedUserId || undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        skip: reportPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setReportRecords(res.items);
      setReportSummary(res.summary);
      setReportTotal(res.total);
    } catch (err) {
      console.error("Failed to fetch attendance report", err);
    } finally {
      setReportLoading(false);
    }
  }, [canViewReports, reportStartDate, reportEndDate, selectedBranchId, selectedDept, selectedUserId, selectedStatus, reportPage]);

  // Load initial data
  useEffect(() => {
    fetchTodayStatus();
    branchesApi
      .list(true)
      .then(setBranches)
      .catch(() => {});
    departmentsApi
      .list(true)
      .then(setDepartments)
      .catch(() => {});
  }, [fetchTodayStatus]);

  // Load assignable / all users for attendance filter
  useEffect(() => {
    if (canViewReports) {
      const fetchPromise =
        user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
          ? usersApi.list().then((list) => list as unknown as UserBrief[])
          : usersApi.getAssignable();

      fetchPromise
        .then((data) => {
          const sorted = [...data].sort((a, b) => a.full_name.localeCompare(b.full_name));
          setUsersList(sorted);
        })
        .catch((err) => {
          console.error("Failed to load users for attendance filter:", err);
          usersApi
            .getAssignable()
            .then(setUsersList)
            .catch(() => {});
        });
    }
  }, [user, canViewReports]);

  useEffect(() => {
    if (activeTab === "my_history") {
      fetchMyHistory();
    }
  }, [activeTab, fetchMyHistory]);

  useEffect(() => {
    if (activeTab === "team_report" && canViewReports) {
      fetchTeamReport();
    }
  }, [activeTab, canViewReports, fetchTeamReport]);

  // Real-time synchronization
  useRealtimeEvent(["ATTENDANCE_UPDATED"], () => {
    fetchTodayStatus();
    if (activeTab === "my_history") {
      fetchMyHistory();
    } else if (activeTab === "team_report") {
      fetchTeamReport();
    }
  });

  // Check In Handler
  const handleCheckIn = async () => {
    setIsPunching(true);
    setPunchMessage(null);
    try {
      const coords = await getBrowserLocation();
      const res = await attendanceApi.checkIn({
        note: punchNote.trim() || undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setPunchNote("");
      if (res.approval_status === "PENDING") {
        setPunchMessage({
          type: "warning",
          text: "Check-in recorded! You checked in outside office Wi-Fi network; your session is active and your GPS location has been submitted to Admins for review.",
        });
      } else {
        setPunchMessage({ type: "success", text: "Successfully checked in! Have a productive workday." });
      }
      await fetchTodayStatus();
      if (activeTab === "my_history") fetchMyHistory();
      if (activeTab === "team_report") fetchTeamReport();
    } catch (err) {
      setPunchMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setIsPunching(false);
    }
  };

  // Check Out Handler
  const handleCheckOut = async () => {
    setIsPunching(true);
    setPunchMessage(null);
    try {
      await attendanceApi.checkOut(punchNote.trim() || undefined);
      setPunchNote("");
      setPunchMessage({ type: "success", text: "Successfully checked out! Great work today." });
      await fetchTodayStatus();
      if (activeTab === "my_history") fetchMyHistory();
      if (activeTab === "team_report") fetchTeamReport();
    } catch (err) {
      setPunchMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setIsPunching(false);
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const blob = await attendanceApi.exportReportBlob({
        start_date: reportStartDate || undefined,
        end_date: reportEndDate || undefined,
        branch_id: selectedBranchId || undefined,
        department: selectedDept.trim() || undefined,
        user_id: selectedUserId || undefined,
        status: selectedStatus !== "ALL" ? selectedStatus : undefined,
      });
      const selectedUserObj = usersList.find((u) => u.id === selectedUserId);
      const userPrefix = selectedUserObj ? `${selectedUserObj.full_name.replace(/\s+/g, "_")}_` : "";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_report_${userPrefix}${reportStartDate || "all"}_to_${reportEndDate || "all"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export attendance report: " + getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: AttendanceRecord["status"]) => {
    switch (status) {
      case "CHECKED_IN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Checked In
          </span>
        );
      case "PRESENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Present
          </span>
        );
      case "HALF_DAY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Half Day Leave
          </span>
        );
      case "LATE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Late
          </span>
        );
      case "ON_LEAVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            On Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {status}
          </span>
        );
    }
  };

  // 8h workday progress percentage
  const targetSeconds = 8 * 3600;
  const progressPercent = Math.min(100, Math.round((liveSeconds / targetSeconds) * 100));

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Hero Banner with Wall Clock */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-indigo-900/40 dark:border-slate-800">
          <div className="relative z-[1] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md text-xs font-medium text-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Team Littad Attendance & Workforce Tracking</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <CalendarCheck2 className="w-8 h-8 text-indigo-400 shrink-0" />
                <span>Attendance & Work Logs</span>
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Check in and check out each working day with live time tracking, detailed attendance history,
                and comprehensive reporting scoped by organization hierarchy.
              </p>
            </div>

            {/* Live Digital Wall Clock Card */}
            <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md border border-white/10 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shrink-0 min-w-[220px]">
              <div className="text-xs uppercase tracking-widest text-indigo-300 font-semibold mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Current Time</span>
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-white drop-shadow">
                {currentWallClock || "--:--:--"}
              </div>
              <div className="text-xs text-slate-300 mt-1 font-medium">
                {currentDateFormatted || "Today"}
              </div>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-indigo-600/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Punch In / Out Interactive Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Punch Status & Details */}
            <div className="space-y-3 max-w-lg">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Today&apos;s Status
                </span>
                {todayStatus?.is_checked_in && !todayStatus?.is_checked_out ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Currently Checked In
                  </span>
                ) : todayStatus?.is_checked_out ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                    Completed for Today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    Not Checked In Yet
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Shift Schedule</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
                    {todayStatus?.scheduled_check_in
                      ? `${todayStatus.scheduled_check_in} - ${todayStatus.scheduled_check_out || ""}`
                      : bufferStatus?.scheduled_check_in
                      ? `${bufferStatus.scheduled_check_in} - ${bufferStatus.scheduled_check_out || ""}`
                      : "Flexible"}
                  </div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                    {bufferStatus?.schedule_name || "General Shift"}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Check In</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatTime(todayStatus?.record?.check_in_time)}
                  </div>
                  {todayStatus?.record?.is_late && (
                    <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                      +{todayStatus.record.late_minutes}m late
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Check Out</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {formatTime(todayStatus?.record?.check_out_time)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Total Worked</div>
                  <div className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {formatHoursMinutes(todayStatus?.record?.total_hours || liveSeconds / 3600)}
                  </div>
                </div>
              </div>

              {/* Grace Buffer Status Info */}
              <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    <strong>10-Min Grace Buffer:</strong>{" "}
                    {bufferStatus ? (
                      <span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{bufferStatus.buffer_days_used}</span> / {bufferStatus.monthly_limit} used this month ({bufferStatus.remaining_days} remaining)
                      </span>
                    ) : (
                      "Max 3 days/month allowed with 10 min window"
                    )}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Late past buffer is marked as Half Day
                </span>
              </div>

              {/* Late check-in alert notice */}
              {todayStatus?.record?.status === "HALF_DAY" && todayStatus?.record?.is_late && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Late Check-in Notice:</strong> Checked in at {formatTime(todayStatus.record.check_in_time)} ({todayStatus.record.late_minutes}m late). Buffer limit was exceeded or elapsed, so today is recorded as <strong>Half Day Leave</strong>.
                  </span>
                </div>
              )}
              {todayStatus?.record?.is_buffer_used && (
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    <strong>Grace Buffer Used Today:</strong> 10-minute buffer window applied.
                  </span>
                </div>
              )}

              {/* Off-Network Check-in Pending Approval Alert */}
              {todayStatus?.record?.approval_status === "PENDING" && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Off-Network Check-In: Awaiting Admin Approval</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                    You checked in outside the designated office Wi-Fi network. Your work session is actively recorded from your punch-in time; your GPS location has been submitted to Admins and Super Admins for review.
                  </p>
                  {todayStatus.record.latitude && todayStatus.record.longitude && (
                    <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>GPS: {todayStatus.record.latitude.toFixed(5)}, {todayStatus.record.longitude.toFixed(5)}</span>
                      {getGoogleMapsUrl(todayStatus.record.latitude, todayStatus.record.longitude) && (
                        <a
                          href={getGoogleMapsUrl(todayStatus.record.latitude, todayStatus.record.longitude)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 ml-1 inline-flex items-center gap-0.5"
                        >
                          View Map
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Check-in Rejected Alert */}
              {todayStatus?.record?.approval_status === "REJECTED" && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Off-Network Check-In Rejected</span>
                  </div>
                  <p className="text-[11px] text-rose-800/90 dark:text-rose-300/90">
                    Reason: {todayStatus.record.rejection_reason || "Location not verified"}
                  </p>
                </div>
              )}

              {/* Progress towards standard 8 hours */}
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span>8h Workday Goal</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      progressPercent >= 100
                        ? "bg-emerald-500"
                        : progressPercent >= 50
                        ? "bg-indigo-600"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Live Working Timer & Punch Action */}
            <div className="flex flex-col items-center lg:items-end justify-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 min-w-[280px]">
              <div className="text-center lg:text-right">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center justify-center lg:justify-end gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Elapsed Work Timer</span>
                </div>
                <div className="text-4xl font-mono font-extrabold text-slate-900 dark:text-white mt-1">
                  {formatSeconds(liveSeconds)}
                </div>
              </div>

              {/* Optional Note Input */}
              <input
                type="text"
                placeholder={
                  todayStatus?.is_checked_in && !todayStatus?.is_checked_out
                    ? "Optional check-out note..."
                    : "Optional check-in note..."
                }
                value={punchNote}
                onChange={(e) => setPunchNote(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Big Punch Button */}
              {todayStatus?.is_checked_in && !todayStatus?.is_checked_out ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={isPunching}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 transition shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-5 h-5" />
                  <span>{isPunching ? "Recording Punch..." : "Check Out"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={isPunching}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-5 h-5" />
                  <span>
                    {isPunching
                      ? "Recording Punch..."
                      : todayStatus?.is_checked_out
                      ? "Resume / Check In Again"
                      : "Check In"}
                  </span>
                </button>
              )}

              {/* Status/Error message */}
              {punchMessage && (
                <div
                  className={`w-full text-xs p-2.5 rounded-xl text-center font-medium ${
                    punchMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                      : punchMessage.type === "warning"
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                  }`}
                >
                  {punchMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 overflow-x-auto pb-0.5">
          {canViewReports && (
            <button
              type="button"
              onClick={() => setActiveTab("team_report")}
              className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "team_report"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Attendance & Reports</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("my_history")}
            className={`pb-3 px-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === "my_history"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>My Attendance History</span>
          </button>
        </div>

        {/* TAB 1: TEAM ATTENDANCE & REPORTS */}
        {activeTab === "team_report" && canViewReports && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {reportSummary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <span>Total Logs</span>
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                    {reportSummary.total_records}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Logged sessions</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                    <span>Total Hours</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                    {formatHoursMinutes(reportSummary.total_hours)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {reportSummary.total_hours.toFixed(1)} hrs logged
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    <span>Avg Hours / Day</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                    {reportSummary.average_hours_per_day.toFixed(1)}h
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Per recorded session</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold">
                    <span>Active Now</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {reportSummary.currently_checked_in}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Currently working</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <span>Full Present</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    {reportSummary.present_count}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&ge; 4 hours shift</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
                    <span>Half Days</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                    {reportSummary.half_day_count}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">&lt; 4 hours shift</div>
                </div>
              </div>
            )}

            {/* Filter Bar & Export Actions */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Filter Attendance Records
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
                    <button
                      type="button"
                      onClick={() => setIsManageSchedulesOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Manage Time Schedules</span>
                    </button>
                  )}

                  {/* Export Excel Button */}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={exporting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{exporting ? "Generating Excel..." : "Export Excel Report"}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Start Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => {
                      setReportStartDate(e.target.value);
                      setReportPage(0);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => {
                      setReportEndDate(e.target.value);
                      setReportPage(0);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Branch selector (Select Branch First) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Branch
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee / User selector (Filtered by chosen Branch) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Employee / User {selectedBranchObj && `(${filteredUsersList.length})`}
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      setSelectedUserId(e.target.value);
                      setReportPage(0);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {selectedBranchObj ? (
                      <option value="">All in {selectedBranchObj.name} ({filteredUsersList.length})</option>
                    ) : (
                      <option value="">All Employees / Users</option>
                    )}
                    {filteredUsersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role ? u.role.replace("_", " ") : "User"}{u.branch ? ` • ${u.branch}` : ""})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setReportPage(0);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} {d.code ? `(${d.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setReportPage(0);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="CHECKED_IN">Currently Checked In</option>
                    <option value="PRESENT">Present (Full Day)</option>
                    <option value="HALF_DAY">Half Day (&lt;4h)</option>
                    <option value="LATE">Late</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <span className="text-[11px] font-medium text-slate-400">Quick Range:</span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    setReportStartDate(todayStr);
                    setReportEndDate(todayStr);
                    setReportPage(0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const firstDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
                    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    setReportStartDate(firstDayStr);
                    setReportEndDate(todayStr);
                    setReportPage(0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                    const s = `${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-${pad(firstDayLastMonth.getDate())}`;
                    const e = `${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`;
                    setReportStartDate(s);
                    setReportEndDate(e);
                    setReportPage(0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    const s = `${past30.getFullYear()}-${pad(past30.getMonth() + 1)}-${pad(past30.getDate())}`;
                    const e = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    setReportStartDate(s);
                    setReportEndDate(e);
                    setReportPage(0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer text-[11px]"
                >
                  Last 30 Days
                </button>
                {(reportStartDate || reportEndDate || selectedUserId || selectedBranchId || selectedDept || selectedStatus !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setReportStartDate("");
                      setReportEndDate("");
                      setSelectedUserId("");
                      setSelectedBranchId("");
                      setSelectedDept("");
                      setSelectedStatus("ALL");
                      setReportPage(0);
                    }}
                    className="ml-auto text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium text-[11px] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Report Data Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Branch & Dept</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Shift Schedule</th>
                      <th className="py-3.5 px-4">Check In</th>
                      <th className="py-3.5 px-4">Check Out</th>
                      <th className="py-3.5 px-4">Working Duration</th>
                      <th className="py-3.5 px-4">Status & Buffer</th>
                      <th className="py-3.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {reportLoading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5 animate-spin text-indigo-500" />
                            <span>Loading attendance records...</span>
                          </div>
                        </td>
                      </tr>
                    ) : reportRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          No attendance records found matching the specified filters.
                        </td>
                      </tr>
                    ) : (
                      reportRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {r.user?.full_name?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-white truncate">
                                  {r.user?.full_name || "Unknown"}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {r.user?.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {r.user?.branch || "Company Wide"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {r.user?.department || "General"}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {formatDate(r.date)}
                          </td>

                          <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {r.schedule_check_in ? (
                              <span>
                                {r.schedule_check_in} - {r.schedule_check_out || ""}
                              </span>
                            ) : (
                              <span className="text-slate-400">Flexible</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {formatTime(r.check_in_time)}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {r.check_out_time ? (
                              formatTime(r.check_out_time)
                            ) : (
                              <span className="text-blue-500 font-semibold italic text-[11px]">
                                Active Session
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatHoursMinutes(r.total_hours)}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {getStatusBadge(r.status)}
                              {r.approval_status === "PENDING" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Pending Approval
                                </span>
                              )}
                              {r.approval_status === "REJECTED" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Rejected
                                </span>
                              )}
                              {r.latitude && r.longitude && getGoogleMapsUrl(r.latitude, r.longitude) && (
                                <a
                                  href={getGoogleMapsUrl(r.latitude, r.longitude)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`GPS: ${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>Map</span>
                                </a>
                              )}
                              {r.is_buffer_used && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Grace Buffer
                                </span>
                              )}
                              {r.is_late && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Late (+{r.late_minutes}m)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {r.check_in_note && (
                              <span title={`In: ${r.check_in_note}`}>In: {r.check_in_note} </span>
                            )}
                            {r.check_out_note && (
                              <span title={`Out: ${r.check_out_note}`}>| Out: {r.check_out_note}</span>
                            )}
                            {!r.check_in_note && !r.check_out_note && "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">
                  Showing {reportRecords.length} of {reportTotal} records
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportPage((p) => Math.max(0, p - 1))}
                    disabled={reportPage === 0}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Page {reportPage + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportPage((p) => p + 1)}
                    disabled={(reportPage + 1) * PAGE_SIZE >= reportTotal}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE HISTORY */}
        {activeTab === "my_history" && (
          <div className="space-y-4">
            {/* Filter Date Range for My Attendance */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Filter My Personal Logs
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={myStartDate}
                  onChange={(e) => setMyStartDate(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={myEndDate}
                  onChange={(e) => setMyEndDate(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* My History Table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Shift Schedule</th>
                      <th className="py-3.5 px-4">Check In</th>
                      <th className="py-3.5 px-4">Check Out</th>
                      <th className="py-3.5 px-4">Total Worked</th>
                      <th className="py-3.5 px-4">Status & Buffer</th>
                      <th className="py-3.5 px-4">Check In Note</th>
                      <th className="py-3.5 px-4">Check Out Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {myLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <Clock className="w-5 h-5 animate-spin text-indigo-500" />
                            <span>Loading your attendance records...</span>
                          </div>
                        </td>
                      </tr>
                    ) : myRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No personal attendance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      myRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {formatDate(r.date)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {r.schedule_check_in ? (
                              <span>
                                {r.schedule_check_in} - {r.schedule_check_out || ""}
                              </span>
                            ) : (
                              <span className="text-slate-400">Flexible</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {formatTime(r.check_in_time)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {r.check_out_time ? (
                              formatTime(r.check_out_time)
                            ) : (
                              <span className="text-blue-500 font-semibold italic text-[11px]">
                                Active Session
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatHoursMinutes(r.total_hours)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {getStatusBadge(r.status)}
                              {r.approval_status === "PENDING" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Pending Approval
                                </span>
                              )}
                              {r.approval_status === "REJECTED" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Rejected
                                </span>
                              )}
                              {r.latitude && r.longitude && getGoogleMapsUrl(r.latitude, r.longitude) && (
                                <a
                                  href={getGoogleMapsUrl(r.latitude, r.longitude)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`GPS: ${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>Map</span>
                                </a>
                              )}
                              {r.is_buffer_used && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  Grace Buffer
                                </span>
                              )}
                              {r.is_late && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Late (+{r.late_minutes}m)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                            {r.check_in_note || "-"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                            {r.check_out_note || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Manage Schedules Modal */}
        <ManageSchedulesModal
          isOpen={isManageSchedulesOpen}
          onClose={() => setIsManageSchedulesOpen(false)}
          onSchedulesUpdated={() => {
            fetchTodayStatus();
            if (activeTab === "team_report") fetchTeamReport();
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
