"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Database,
  Clock,
  HardDrive,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { backupApi, getErrorMessage } from "@/lib/api";
import { BackupItem, BackupStatus, RestoreResult } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function BackupPage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();

  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [restoringMessage, setRestoringMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const loadBackupData = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statusData, listData] = await Promise.all([
        backupApi.getStatus(),
        backupApi.list(),
      ]);
      setStatus(statusData);
      setBackups(listData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBackupData();
    }
  }, [user]);

  // Create manual backup immediately
  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      const res = await backupApi.createManual();
      await alert({
        title: "Backup Created Successfully",
        message: `Database backup "${res.filename}" (${res.formatted_size}) has been saved to the local system storage.`,
        type: "success",
      });
      await loadBackupData();
    } catch (err) {
      await alert({
        title: "Backup Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Restore from uploaded file chosen from local system
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = "";

    const confirmed = await confirm({
      title: "Confirm Database Restore",
      message: `WARNING: Are you sure you want to restore the database from "${file.name}" (${(file.size / 1024).toFixed(1)} KB)?\n\nThis will replace current database tables and data with the backup contents. An automatic safety snapshot of the current database will be saved before the restore begins.`,
      confirmText: "Yes, Restore Database",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) return;

    setRestoringMessage(`Restoring database from "${file.name}"... Please do not refresh or close this tab.`);
    setActionLoading(true);

    try {
      const res = await backupApi.restoreUpload(file);
      await alert({
        title: "Database Restore Successful",
        message: `Database was successfully restored in ${res.duration_seconds}s.\n\nRestored from: ${res.restored_file}\nSafety pre-restore backup: ${res.safety_backup || "Created"}\n\nAll tables and services are now synchronized.`,
        type: "success",
      });
      await loadBackupData();
    } catch (err) {
      await alert({
        title: "Restore Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setRestoringMessage(null);
      setActionLoading(false);
    }
  };

  // Restore from an existing local backup
  const handleRestoreExisting = async (backupItem: BackupItem) => {
    const confirmed = await confirm({
      title: "Confirm Database Restore",
      message: `WARNING: Are you sure you want to restore the database from "${backupItem.filename}" (${backupItem.formatted_size})?\n\nThis will replace current database tables with data from this snapshot. A safety pre-restore backup will be taken automatically.`,
      confirmText: "Restore Database",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) return;

    setRestoringMessage(`Restoring database from "${backupItem.filename}"... Please wait.`);
    setActionLoading(true);

    try {
      const res = await backupApi.restoreExisting(backupItem.filename);
      await alert({
        title: "Database Restore Successful",
        message: `Database was successfully restored in ${res.duration_seconds}s.\n\nRestored from: ${res.restored_file}\nSafety snapshot: ${res.safety_backup || "Created"}`,
        type: "success",
      });
      await loadBackupData();
    } catch (err) {
      await alert({
        title: "Restore Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setRestoringMessage(null);
      setActionLoading(false);
    }
  };

  // Download backup to user's computer
  const handleDownload = async (filename: string) => {
    try {
      await backupApi.download(filename);
    } catch (err) {
      await alert({
        title: "Download Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  // Delete backup
  const handleDelete = async (filename: string) => {
    const confirmed = await confirm({
      title: "Delete Backup File",
      message: `Are you sure you want to delete backup "${filename}"? This action cannot be undone.`,
      confirmText: "Delete Backup",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await backupApi.delete(filename);
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  // Filtered backups
  const filteredBackups = backups.filter((b) =>
    b.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTagBadge = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.includes("daily") || lower.includes("auto")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Clock className="w-2.5 h-2.5" />
          Daily (10:00 PM)
        </span>
      );
    }
    if (lower.includes("safety_pre_restore")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <ShieldCheck className="w-2.5 h-2.5" />
          Pre-Restore Safety
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        <Database className="w-2.5 h-2.5" />
        Manual Backup
      </span>
    );
  };

  if (!isSuperAdmin) {
    return (
      <ProtectedRoute>
        <div className="p-8 max-w-xl mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Super Admin Access Only
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Database backup and restore operations contain full organizational data and are strictly restricted to the Super Administrator role.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-500 transition shadow-md"
          >
            Return to Dashboard
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Database Backup & Restore
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automated daily schedule (10:00 PM) and local system data file restore
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={loadBackupData}
              disabled={loading || actionLoading}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Hidden File Input for Restore */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".sql,.dump,.backup"
              className="hidden"
            />

            {/* Restore by Choosing File from Local System */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Restore from File</span>
            </button>

            {/* Immediate Manual Backup */}
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Create Backup Now</span>
            </button>
          </div>
        </div>

        {/* Restore in progress banner */}
        {restoringMessage && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 rounded-2xl flex items-center gap-3 text-xs shadow-md animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold">{restoringMessage}</span>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-2xl flex items-center gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Daily Schedule */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Automated Backup
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Every Day at 10:00 PM
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                APScheduler Active (22:00)
              </h3>
            </div>
          </div>

          {/* Card 2: Local System Storage */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Local Storage Folder
              </span>
              <p className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate mt-1" title={status?.backup_directory}>
                {status?.backup_directory || "backend/backups"}
              </p>
            </div>
          </div>

          {/* Card 3: Total Backups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Stored Backups
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {backups.length} Files
              </h3>
            </div>
          </div>
        </div>

        {/* Backups List Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Backup Archives
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download copies to your machine or restore previous states directly
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search backups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <span>Scanning backup archives...</span>
            </div>
          ) : filteredBackups.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileCode className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No backup archives found
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Automated backups will run daily at 10:00 PM (22:00), or you can click "Create Backup Now" to make one immediately.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-slate-400 text-[10px] border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Filename</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Size</th>
                    <th className="px-5 py-3.5">Created Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBackups.map((b) => (
                    <tr
                      key={b.filename}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4 font-mono font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate max-w-md">{b.filename}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getTagBadge(b.filename)}
                      </td>
                      <td className="px-5 py-4 font-semibold whitespace-nowrap">
                        {b.formatted_size}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Download to local computer */}
                          <button
                            type="button"
                            onClick={() => handleDownload(b.filename)}
                            title="Download backup file"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Restore database from this backup */}
                          <button
                            type="button"
                            onClick={() => handleRestoreExisting(b)}
                            disabled={actionLoading}
                            title="Restore database from this backup"
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>

                          {/* Delete backup */}
                          <button
                            type="button"
                            onClick={() => handleDelete(b.filename)}
                            disabled={actionLoading}
                            title="Delete backup"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

