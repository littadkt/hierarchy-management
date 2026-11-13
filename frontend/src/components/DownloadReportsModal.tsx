"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  User as UserIcon,
  CalendarCheck2,
  TrendingUp,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
  Filter,
  RotateCcw,
} from "lucide-react";
import { attendanceApi, statsApi, usersApi, branchesApi, departmentsApi, getErrorMessage } from "@/lib/api";
import { Branch, Department, UserBrief } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

interface DownloadReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReportType?: "attendance" | "performance";
  defaultUserId?: string;
}

export const DownloadReportsModal: React.FC<DownloadReportsModalProps> = ({
  isOpen,
  onClose,
  defaultReportType = "attendance",
  defaultUserId = "",
}) => {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Form State
  const [reportType, setReportType] = useState<"attendance" | "performance">(defaultReportType);
  const [selectedUserId, setSelectedUserId] = useState<string>(defaultUserId);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Options State
  const [usersList, setUsersList] = useState<UserBrief[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);

  // Derived filtered users based on selected branch
  const selectedBranchObj = branches.find((b) => b.id === selectedBranchId);

  const branchUsersList = useMemo(() => {
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

  // Status State
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize dates with "This Month" as default
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const firstDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      if (!startDate) setStartDate(firstDayStr);
      if (!endDate) setEndDate(todayStr);
      if (defaultUserId) setSelectedUserId(defaultUserId);
      if (defaultReportType) setReportType(defaultReportType);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, defaultReportType, defaultUserId]);

  // Load Users & Branches
  useEffect(() => {
    if (isOpen) {
      setLoadingOptions(true);
      const fetchUsers =
        user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
          ? usersApi.list().then((list) => list as unknown as UserBrief[])
          : usersApi.getAssignable();

      Promise.all([
        fetchUsers
          .then((list) => {
            const sorted = [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));
            setUsersList(sorted);
          })
          .catch(() => {}),
        branchesApi
          .list(true)
          .then(setBranches)
          .catch(() => {}),
        departmentsApi
          .list(true)
          .then(setDepartments)
          .catch(() => {}),
      ]).finally(() => {
        setLoadingOptions(false);
      });
    }
  }, [isOpen, user]);

  if (!isOpen || !mounted) return null;

  // Quick Preset Helper
  const applyPreset = (preset: "today" | "yesterday" | "this_month" | "last_month" | "last_30_days" | "all") => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    if (preset === "today") {
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_month") {
      const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(`${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-${pad(firstDayLastMonth.getDate())}`);
      setEndDate(`${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`);
    } else if (preset === "last_30_days") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(`${past30.getFullYear()}-${pad(past30.getMonth() + 1)}-${pad(past30.getDate())}`);
      setEndDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setDownloading(true);
    setError(null);
    setSuccessMessage(null);

    const selectedUserObj = usersList.find((u) => u.id === selectedUserId);
    const userPrefix = selectedUserObj ? `${selectedUserObj.full_name.replace(/\s+/g, "_")}_` : "";

    try {
      if (reportType === "attendance") {
        const blob = await attendanceApi.exportReportBlob({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          user_id: selectedUserId || undefined,
          branch_id: selectedBranchId || undefined,
          department: selectedDept || undefined,
          status: selectedStatus !== "ALL" ? selectedStatus : undefined,
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_report_${userPrefix}${startDate || "all"}_to_${endDate || "all"}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setSuccessMessage("Attendance Excel report successfully downloaded!");
      } else {
        const blob = await statsApi.exportPerformanceBlob({
          user_id: selectedUserId || undefined,
          branch: selectedBranchObj?.name || undefined,
          department: selectedDept || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `task_performance_report_${userPrefix}${startDate || "all"}_to_${endDate || "all"}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setSuccessMessage("Task & Subtask Performance Excel report successfully downloaded!");
      }

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-reports-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200 dark:border-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="download-reports-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Download Management Reports
              </h2>
              <p className="text-xs text-slate-500">
                Generate official Excel (.xlsx) reports with custom date ranges and user filtering.
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

        {/* Content Form */}
        <form onSubmit={handleDownload} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              1. Select Report Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Type 1: Attendance */}
              <button
                type="button"
                onClick={() => setReportType("attendance")}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  reportType === "attendance"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    reportType === "attendance"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  <CalendarCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Attendance Report
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Check-in/out logs, working hours, active punch records, and presence status.
                  </p>
                </div>
              </button>

              {/* Type 2: Task Performance */}
              <button
                type="button"
                onClick={() => setReportType("performance")}
                className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  reportType === "performance"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    reportType === "performance"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Task Performance Report
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Composite efficiency scores, task milestones, overdue counts, and subtask checklists.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Branch Location Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>2. Select Branch Location</span>
              </label>
              {selectedBranchId && (
                <button
                  type="button"
                  onClick={() => handleBranchChange("")}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Clear Branch (All Branches)
                </button>
              )}
            </div>
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              disabled={loadingOptions}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
            >
              <option value="">All Branches (All Locations)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.code ? `(${b.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: User Selector Dropdown (Filtered by Branch) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  3. Choose User / Employee
                  {selectedBranchObj && (
                    <span className="ml-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold lowercase">
                      ({branchUsersList.length} in {selectedBranchObj.name})
                    </span>
                  )}
                </span>
              </label>
              {selectedUserId && (
                <button
                  type="button"
                  onClick={() => setSelectedUserId("")}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  {selectedBranchObj ? `All in ${selectedBranchObj.name}` : "Select All Users"}
                </button>
              )}
            </div>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loadingOptions}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
            >
              {selectedBranchObj ? (
                <option value="">
                  All Employees in {selectedBranchObj.name} ({branchUsersList.length} employees)
                </option>
              ) : (
                <option value="">
                  All Organization Users (All Branches)
                </option>
              )}
              {branchUsersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role ? u.role.replace("_", " ") : "User"}{u.branch ? ` • ${u.branch}` : ""})
                </option>
              ))}
            </select>
            {selectedBranchId && branchUsersList.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                No active employees are currently assigned to {selectedBranchObj?.name}.
              </p>
            )}
          </div>

          {/* Step 4: Date Range Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              4. Date Range (Start Date & End Date)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  End Date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("today")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this_month")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last_month")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last_30_days")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => applyPreset("all")}
                className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition cursor-pointer"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Step 5: Department & Optional Filters */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className={`grid grid-cols-1 ${reportType === "attendance" ? "sm:grid-cols-2" : ""} gap-3`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    5. Department (Optional)
                  </label>
                  {selectedDept && (
                    <button
                      type="button"
                      onClick={() => setSelectedDept("")}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Clear Dept
                    </button>
                  )}
                </div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
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

              {reportType === "attendance" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Attendance Status (Optional)
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="ALL">All Statuses (Full Report)</option>
                    <option value="PRESENT">Present (Full Day)</option>
                    <option value="HALF_DAY">Half Day (&lt;4h or Late past buffer)</option>
                    <option value="CHECKED_IN">Currently Checked In</option>
                    <option value="LATE">Late</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Alerts / Feedback */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={downloading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              <Download className={`w-4 h-4 ${downloading ? "animate-bounce" : ""}`} />
              <span>{downloading ? "Generating Excel Report..." : "Download Excel Report (.xlsx)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
