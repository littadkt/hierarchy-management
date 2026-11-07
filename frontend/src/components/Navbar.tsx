"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  KeyRound,
  Download,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { usePwa } from "@/context/PwaContext";
import { approvalsApi } from "@/lib/api";
import { RoleBadge } from "./RoleBadge";
import { ThemeToggle } from "./ThemeToggle";
import { ChangePasswordModal } from "./ChangePasswordModal";

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { toggleMobileOpen, isCollapsed, toggleCollapsed } = useSidebar();
  const { isInstalled, promptInstall } = usePwa();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const refreshPendingCount = () => {
    if (user) {
      approvalsApi
        .getPending()
        .then((tasks) => setPendingCount(tasks.length))
        .catch(() => {});
    }
  };

  useEffect(() => {
    refreshPendingCount();
  }, [user]);

  useRealtimeEvent(
    [
      "APPROVAL_STATUS_UPDATED",
      "TASK_STATUS_UPDATED",
      "TASK_CREATED",
      "TASK_DELETED",
      "RESYNC",
    ],
    refreshPendingCount
  );

  if (!user) return null;

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 z-10 sticky top-0">
      {/* Left side: Hamburger (Mobile) / Collapse Toggle (Desktop) & Role / Identity */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile & Tablet (< lg) Hamburger Menu Button */}
        <button
          type="button"
          onClick={toggleMobileOpen}
          title="Open menu"
          aria-label="Open navigation sidebar"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop (>= lg) Minimize / Expand Toggle Button */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
          aria-label="Toggle sidebar width"
          className="hidden lg:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-slate-500" />
          )}
        </button>

        {/* Logged in role indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium hidden md:inline truncate">
            Logged in as
          </span>
          <RoleBadge role={user.role} />
        </div>
      </div>

      {/* Right side: Alerts, Theme, and Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Approvals Alert Notification */}
        {pendingCount > 0 && (
          <Link
            href="/approvals"
            title={`${pendingCount} Pending Approvals`}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 transition-colors shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="hidden sm:inline">{pendingCount} Approvals Pending</span>
            <span className="sm:hidden font-bold">{pendingCount}</span>
          </Link>
        )}

        {/* PWA Install Button (if not already installed) */}
        {!isInstalled && (
          <button
            type="button"
            onClick={promptInstall}
            title="Install Team Littad App on this device"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle */}
        <ThemeToggle />

        {/* User Account Button */}
        <div className="flex items-center pl-1 sm:pl-3 border-l border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            title="Change Account Password"
            className="flex items-center gap-2 py-1 px-1.5 sm:px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs group-hover:ring-2 group-hover:ring-indigo-500 transition-all shrink-0">
              {user.full_name.charAt(0)}
            </div>
            <div className="text-left hidden md:block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block leading-tight truncate max-w-[140px]">
                {user.full_name}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {user.today_first_login_at ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    In: {new Date(user.today_first_login_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : (
                  <>
                    <KeyRound className="w-2.5 h-2.5" /> Password
                  </>
                )}
              </span>
            </div>
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
};
