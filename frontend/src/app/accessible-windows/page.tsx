"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Search,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Folder,
  FolderOpen,
  FileText,
  User as UserIcon,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { permissionsApi, usersApi, getErrorMessage } from "@/lib/api";
import { Role, User, UserPermissions, WindowDefinition, WindowPermission } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";

export default function AccessibleWindowsPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { alert } = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [windows, setWindows] = useState<WindowDefinition[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [windowFilter, setWindowFilter] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const canManage = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

  // 1. Initial Load: Windows & Users
  useEffect(() => {
    if (!canManage) return;

    const loadInitial = async () => {
      setLoading(true);
      try {
        const [windowsList, usersList] = await Promise.all([
          permissionsApi.getWindows(),
          usersApi.list(),
        ]);

        setWindows(windowsList);
        // Filter out inactive users, sort alphabetically
        const activeUsers = usersList.filter((u) => u.is_active);
        setUsers(activeUsers);

        // Pick first user by default (prefer Staff or In-Charge if present, otherwise first)
        if (activeUsers.length > 0) {
          const defaultUser =
            activeUsers.find((u) => u.role === "STAFF" || u.role === "TEAM_LEADER") ||
            activeUsers[0];
          setSelectedUserId(defaultUser.id);
        }
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Failed to load data: ${getErrorMessage(err)}`,
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, [canManage]);

  // 2. Load Permissions when selected user changes
  useEffect(() => {
    if (!selectedUserId) return;

    const loadUserPermissions = async () => {
      setStatusMessage(null);
      try {
        const userPerms = await permissionsApi.getUserPermissions(selectedUserId);
        setPermissions(userPerms);
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: `Failed to load user permissions: ${getErrorMessage(err)}`,
        });
      }
    };

    loadUserPermissions();
  }, [selectedUserId]);

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId);
  }, [users, selectedUserId]);

  const isTargetSuperAdmin = selectedUser?.role === "SUPER_ADMIN";

  // Filter users in dropdown
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    const q = userSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.branch && u.branch.toLowerCase().includes(q))
    );
  }, [users, userSearchQuery]);

  // Helper: map child window IDs for parent windows
  const childMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    windows.forEach((w) => {
      if (w.parent_id) {
        if (!map[w.parent_id]) map[w.parent_id] = [];
        map[w.parent_id].push(w.id);
      }
    });
    return map;
  }, [windows]);

  // Recursive descendant IDs
  const getAllDescendants = (parentId: string): string[] => {
    const direct = childMap[parentId] || [];
    let all = [...direct];
    direct.forEach((c) => {
      all = all.concat(getAllDescendants(c));
    });
    return all;
  };

  // Toggle Collapse
  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Check if a window should be hidden due to collapsed ancestor
  const isWindowHidden = (w: WindowDefinition): boolean => {
    if (!w.parent_id) return false;
    if (collapsedGroups[w.parent_id]) return true;

    // Check parent's parent
    const parentWin = windows.find((item) => item.id === w.parent_id);
    if (parentWin && parentWin.parent_id && collapsedGroups[parentWin.parent_id]) {
      return true;
    }
    return false;
  };

  // Visible filtered windows
  const visibleWindows = useMemo(() => {
    return windows.filter((w) => {
      if (windowFilter) {
        const matchesName = w.name.toLowerCase().includes(windowFilter.toLowerCase());
        const matchesId = w.id.toLowerCase().includes(windowFilter.toLowerCase());
        return matchesName || matchesId;
      }
      return !isWindowHidden(w);
    });
  }, [windows, windowFilter, collapsedGroups]);

  // Row permissions helper
  const getRowPerm = (wid: string): WindowPermission => {
    return (
      permissions[wid] || {
        add: false,
        display: false,
        edit: false,
        delete: false,
      }
    );
  };

  // Check if all permissions for a row are true
  const isRowAllChecked = (wid: string): boolean => {
    const p = getRowPerm(wid);
    return p.add && p.display && p.edit && p.delete;
  };

  // Check if any permission for a row is true
  const isRowAnyChecked = (wid: string): boolean => {
    const p = getRowPerm(wid);
    return p.add || p.display || p.edit || p.delete;
  };

  // Check if ALL visible windows have all permissions checked (for top right "Select All")
  const isGlobalAllChecked = useMemo(() => {
    if (windows.length === 0) return false;
    return windows.every((w) => {
      const p = getRowPerm(w.id);
      return p.add && p.display && p.edit && p.delete;
    });
  }, [windows, permissions]);

  // Check if column action is all checked
  const isColAllChecked = (action: keyof WindowPermission): boolean => {
    if (visibleWindows.length === 0) return false;
    return visibleWindows.every((w) => getRowPerm(w.id)[action]);
  };

  // --- MUTATION HANDLERS ---

  // 1. Single cell toggle
  const handleCellToggle = (wid: string, action: keyof WindowPermission) => {
    if (isTargetSuperAdmin) return;
    const current = getRowPerm(wid);
    const newValue = !current[action];

    const updated = { ...permissions };
    updated[wid] = {
      ...current,
      [action]: newValue,
    };

    // If this is a group, cascade this action to all descendants
    const descendants = getAllDescendants(wid);
    descendants.forEach((dwid) => {
      const dp = getRowPerm(dwid);
      updated[dwid] = {
        ...dp,
        [action]: newValue,
      };
    });

    setPermissions(updated);
  };

  // 2. Entire row toggle (left checkbox)
  const handleRowToggle = (wid: string) => {
    if (isTargetSuperAdmin) return;
    const allChecked = isRowAllChecked(wid);
    const targetState = !allChecked;

    const updated = { ...permissions };
    updated[wid] = {
      add: targetState,
      display: targetState,
      edit: targetState,
      delete: targetState,
    };

    // Cascade to all descendants
    const descendants = getAllDescendants(wid);
    descendants.forEach((dwid) => {
      updated[dwid] = {
        add: targetState,
        display: targetState,
        edit: targetState,
        delete: targetState,
      };
    });

    setPermissions(updated);
  };

  // 3. Column toggle (Add, Display, Edit, Delete column header)
  const handleColumnToggle = (action: keyof WindowPermission) => {
    if (isTargetSuperAdmin) return;
    const allColChecked = isColAllChecked(action);
    const targetState = !allColChecked;

    const updated = { ...permissions };
    visibleWindows.forEach((w) => {
      const p = getRowPerm(w.id);
      updated[w.id] = {
        ...p,
        [action]: targetState,
      };
    });

    setPermissions(updated);
  };

  // 4. Top-Right "Select All" toggle
  const handleSelectAllToggle = () => {
    if (isTargetSuperAdmin) return;
    const targetState = !isGlobalAllChecked;

    const updated: UserPermissions = {};
    windows.forEach((w) => {
      updated[w.id] = {
        add: targetState,
        display: targetState,
        edit: targetState,
        delete: targetState,
      };
    });

    setPermissions(updated);
  };

  // 5. Reset to Role Defaults
  const handleResetDefaults = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const resetPerms = await permissionsApi.resetUserPermissions(selectedUserId);
      setPermissions(resetPerms);
      setStatusMessage({
        type: "success",
        text: `Permissions for ${selectedUser?.full_name} have been reset to role defaults.`,
      });
      if (selectedUserId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to reset permissions: ${getErrorMessage(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // 6. Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const savedPerms = await permissionsApi.updateUserPermissions(selectedUserId, permissions);
      setPermissions(savedPerms);
      setStatusMessage({
        type: "success",
        text: `Permissions for ${selectedUser?.full_name} successfully saved and applied!`,
      });
      if (selectedUserId === currentUser?.id) {
        await refreshUser();
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Failed to save permissions: ${getErrorMessage(err)}`,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <ProtectedRoute>
        <div className="max-w-4xl mx-auto p-6 text-center">
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-8 shadow-sm">
            <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Access Restricted
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Accessible Windows configuration is restricted exclusively to Admin and Super Admin
              users.
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5 animate-in fade-in duration-300">
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  {/* Title styled with blue link/accent matching user reference picture */}
                  <h1 className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer tracking-tight">
                    Accessible Windows
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Control View (Display), Add, Edit, and Delete privileges per feature for each
                    user.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick User Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Configure User:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500 focus:outline-hidden shadow-xs cursor-pointer min-w-[220px]"
                >
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role.replace("_", " ")})
                      {u.branch ? ` - ${u.branch}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                    {selectedUser.full_name}
                  </span>
                  <RoleBadge role={selectedUser.role} />
                </div>
              )}
            </div>
          </div>

          {/* Super Admin Notice if selected */}
          {isTargetSuperAdmin && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Super Admin Notice:</strong> Super Administrator accounts maintain full
                universal permissions across all windows by default.
              </span>
            </div>
          )}

          {/* Feedback banner */}
          {statusMessage && (
            <div
              className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : statusMessage.type === "error"
                  ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                  : "bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Toolbar & Select All Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:px-4 shadow-xs">
          {/* Search Windows */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search windows or features..."
              value={windowFilter}
              onChange={(e) => setWindowFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Action buttons & Select All */}
          <div className="flex items-center gap-3 justify-end flex-wrap">
            {/* Top right "Select All" checkbox exactly like in screenshot */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={isGlobalAllChecked}
                onChange={handleSelectAllToggle}
                disabled={isTargetSuperAdmin}
                className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
              />
              <span>Select All</span>
            </label>

            {/* Reset to defaults */}
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving || isTargetSuperAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              title="Reset to default permissions for this role"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSavePermissions}
              disabled={saving || isTargetSuperAdmin}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Accessible Windows Grid Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-none">
              {/* Header Row */}
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border-b border-slate-300 dark:border-slate-700">
                  {/* Left row select toggle indicator column */}
                  <th className="w-10 sm:w-12 px-2 py-2.5 text-center border-r border-slate-300 dark:border-slate-700">
                    <span className="sr-only">Toggle</span>
                  </th>

                  {/* Window Column */}
                  <th className="px-4 py-2.5 border-r border-slate-300 dark:border-slate-700 font-bold">
                    Window
                  </th>

                  {/* Add Column */}
                  <th className="w-20 sm:w-24 px-2 py-2.5 text-center border-r border-slate-300 dark:border-slate-700 font-bold">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span>Add</span>
                      <input
                        type="checkbox"
                        checked={isColAllChecked("add")}
                        onChange={() => handleColumnToggle("add")}
                        disabled={isTargetSuperAdmin}
                        title="Toggle Add for all windows"
                        className="w-3.5 h-3.5 text-sky-600 rounded border-slate-400 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  </th>

                  {/* Display Column */}
                  <th className="w-20 sm:w-24 px-2 py-2.5 text-center border-r border-slate-300 dark:border-slate-700 font-bold">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span>Display</span>
                      <input
                        type="checkbox"
                        checked={isColAllChecked("display")}
                        onChange={() => handleColumnToggle("display")}
                        disabled={isTargetSuperAdmin}
                        title="Toggle Display (View) for all windows"
                        className="w-3.5 h-3.5 text-sky-600 rounded border-slate-400 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  </th>

                  {/* Edit Column */}
                  <th className="w-20 sm:w-24 px-2 py-2.5 text-center border-r border-slate-300 dark:border-slate-700 font-bold">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span>Edit</span>
                      <input
                        type="checkbox"
                        checked={isColAllChecked("edit")}
                        onChange={() => handleColumnToggle("edit")}
                        disabled={isTargetSuperAdmin}
                        title="Toggle Edit for all windows"
                        className="w-3.5 h-3.5 text-sky-600 rounded border-slate-400 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  </th>

                  {/* Delete Column */}
                  <th className="w-20 sm:w-24 px-2 py-2.5 text-center font-bold">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span>Delete</span>
                      <input
                        type="checkbox"
                        checked={isColAllChecked("delete")}
                        onChange={() => handleColumnToggle("delete")}
                        disabled={isTargetSuperAdmin}
                        title="Toggle Delete for all windows"
                        className="w-3.5 h-3.5 text-sky-600 rounded border-slate-400 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Rows with Alternating Banding (matching reference image) */}
              <tbody className="text-xs divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <div className="inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p>Loading accessible windows...</p>
                    </td>
                  </tr>
                ) : visibleWindows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No matching windows found.
                    </td>
                  </tr>
                ) : (
                  visibleWindows.map((w, idx) => {
                    const rowPerm = getRowPerm(w.id);
                    const rowAll = isRowAllChecked(w.id);
                    const rowAny = isRowAnyChecked(w.id);
                    const isIndeterminate = rowAny && !rowAll;

                    // Alternating row styling: light blue band vs white (matching ERP image)
                    const isBanded = idx % 2 === 1;
                    const rowBgClass = isBanded
                      ? "bg-[#cce5f8]/70 dark:bg-sky-950/30 hover:bg-[#bfe0f8] dark:hover:bg-sky-900/40"
                      : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60";

                    const isGroup = w.is_group || childMap[w.id]?.length > 0;
                    const isCollapsed = collapsedGroups[w.id];

                    return (
                      <tr
                        key={w.id}
                        className={`${rowBgClass} transition-colors border-b border-slate-200 dark:border-slate-800`}
                      >
                        {/* 1. Left Row Checkbox */}
                        <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={rowAll}
                            ref={(el) => {
                              if (el) el.indeterminate = isIndeterminate;
                            }}
                            onChange={() => handleRowToggle(w.id)}
                            disabled={isTargetSuperAdmin}
                            title="Toggle all permissions for this window"
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>

                        {/* 2. Window Name with Tree Indentation */}
                        <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-800">
                          <div
                            className="flex items-center gap-1.5"
                            style={{ paddingLeft: `${w.level * 1.5}rem` }}
                          >
                            {/* Expand/Collapse Chevron for Groups */}
                            {isGroup ? (
                              <button
                                type="button"
                                onClick={() => toggleGroupCollapse(w.id)}
                                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                title={isCollapsed ? "Expand" : "Collapse"}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="w-3.5 h-3.5 inline-block shrink-0" />
                            )}

                            {/* Group / File Icon */}
                            {isGroup ? (
                              isCollapsed ? (
                                <Folder className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                              ) : (
                                <FolderOpen className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                              )
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}

                            {/* Label */}
                            <span
                              className={`${
                                w.level === 0
                                  ? "font-bold text-slate-900 dark:text-slate-100 text-[13px]"
                                  : w.level === 1
                                  ? "font-semibold text-slate-800 dark:text-slate-200"
                                  : "font-normal text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {w.name}
                            </span>
                          </div>
                        </td>

                        {/* 3. Add Checkbox */}
                        <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={rowPerm.add}
                            onChange={() => handleCellToggle(w.id, "add")}
                            disabled={isTargetSuperAdmin}
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>

                        {/* 4. Display Checkbox */}
                        <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={rowPerm.display}
                            onChange={() => handleCellToggle(w.id, "display")}
                            disabled={isTargetSuperAdmin}
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>

                        {/* 5. Edit Checkbox */}
                        <td className="px-2 py-2 text-center border-r border-slate-200 dark:border-slate-800">
                          <input
                            type="checkbox"
                            checked={rowPerm.edit}
                            onChange={() => handleCellToggle(w.id, "edit")}
                            disabled={isTargetSuperAdmin}
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>

                        {/* 6. Delete Checkbox */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={rowPerm.delete}
                            onChange={() => handleCellToggle(w.id, "delete")}
                            disabled={isTargetSuperAdmin}
                            className="w-4 h-4 text-sky-600 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Save Bar for easy accessibility when scrolling long tables */}
        <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changes will take effect immediately upon saving and apply to the user's active session.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving || isTargetSuperAdmin}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSavePermissions}
              disabled={saving || isTargetSuperAdmin}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md shadow-sky-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
