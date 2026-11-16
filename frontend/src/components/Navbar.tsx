"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  KeyRound,
  Download,
  ChevronDown,
  Boxes,
  Sparkles,
  Network,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { usePwa } from "@/context/PwaContext";
import { approvalsApi, attendanceApi } from "@/lib/api";
import { RoleBadge } from "./RoleBadge";
import { ThemeToggle } from "./ThemeToggle";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { AttendanceQuickButton } from "./AttendanceQuickButton";
import { NotificationDropdown } from "./NotificationDropdown";

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { toggleMobileOpen, isCollapsed, toggleCollapsed } = useSidebar();
  const { isInstalled, promptInstall } = usePwa();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const isSap = pathname.startsWith("/sap");
  const isCrm = pathname.startsWith("/crm");
  const activeSuite = isSap ? "SAP" : isCrm ? "CRM" : "HIERARCHY";

  // Close switcher on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshPendingCount = () => {
    if (user) {
      Promise.all([
        approvalsApi.getPending().catch(() => []),
        user.role === "SUPER_ADMIN" || user.role === "ADMIN"
          ? attendanceApi.getPendingApprovals().catch(() => [])
          : Promise.resolve([]),
      ]).then(([tasks, checkins]) => {
        setPendingCount(tasks.length + checkins.length);
      });
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
      "CHECKIN_APPROVAL_REQUESTED",
      "ATTENDANCE_UPDATED",
      "RESYNC",
    ],
    refreshPendingCount
  );

  if (!user) return null;

  return (
    <header className="h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-2.5 sm:px-6 z-20 sticky top-0">
      {/* Left side: Hamburger (Mobile) / Collapse Toggle (Desktop) & Role / Identity */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
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

        {/* Logged in role indicator (hidden on small mobile screens to save space) */}
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium hidden md:inline truncate">
            Logged in as
          </span>
          <RoleBadge role={user.role} />
        </div>

        {/* ========================================================= */}
        {/* TOP BAR SUITE SWITCHER (SWITCHES IN SAME TAB) */}
        {/* ========================================================= */}
        <div className="relative" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
            title="Switch Workspace Suite (Hierarchy, SAP ERP, CRM AI)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
              isSap
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                : isCrm
                ? "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800 hover:bg-purple-100"
                : "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-100"
            }`}
          >
            {isSap ? (
              <>
                <Boxes className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden xs:inline">SAP ERP</span>
                <span className="xs:hidden">SAP</span>
              </>
            ) : isCrm ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="hidden xs:inline">CRM & AI</span>
                <span className="xs:hidden">CRM</span>
              </>
            ) : (
              <>
                <Network className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="hidden xs:inline">Hierarchy</span>
                <span className="xs:hidden">HR</span>
              </>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                isSwitcherOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Switcher Dropdown (Switches in Same Tab) */}
          {isSwitcherOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Switch Workspace Suite
              </div>

              {/* Hierarchy Option */}
              <button
                type="button"
                onClick={() => {
                  setIsSwitcherOpen(false);
                  router.push("/");
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  activeSuite === "HIERARCHY"
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">Hierarchy Management</div>
                    <div className="text-[10px] text-slate-400">Tasks, Attendance, Approvals</div>
                  </div>
                </div>
                {activeSuite === "HIERARCHY" && (
                  <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                )}
              </button>

              {/* SAP ERP Option */}
              <button
                type="button"
                onClick={() => {
                  setIsSwitcherOpen(false);
                  router.push("/sap");
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  activeSuite === "SAP"
                    ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">SAP Business ERP</div>
                    <div className="text-[10px] text-slate-400">Product Service & Fleet Rentals</div>
                  </div>
                </div>
                {activeSuite === "SAP" && (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </button>

              {/* CRM & AI Option */}
              <button
                type="button"
                onClick={() => {
                  setIsSwitcherOpen(false);
                  router.push("/crm");
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  activeSuite === "CRM"
                    ? "bg-purple-50 dark:bg-purple-950/50 text-purple-950 dark:text-purple-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">CRM 360 & Sales AI</div>
                    <div className="text-[10px] text-slate-400">Leads, Deals & Smart Copilot</div>
                  </div>
                </div>
                {activeSuite === "CRM" && (
                  <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Alerts, Theme, and Profile */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Quick Attendance Punch & Timer */}
        <AttendanceQuickButton />

        {/* Notifications Dropdown (Always visible in top bar for both mobile & desktop) */}
        <NotificationDropdown />

        {/* Approvals Alert Notification (Hidden on mobile phones per user request) */}
        {pendingCount > 0 && (
          <Link
            href="/approvals"
            title={`${pendingCount} Pending Approvals`}
            className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 transition-colors shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{pendingCount} Approvals Pending</span>
          </Link>
        )}

        {/* PWA Install Button (if not already installed, desktop top bar) */}
        {!isInstalled && (
          <button
            type="button"
            onClick={promptInstall}
            title="Install Team Littad App on this device"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Install App</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle (Desktop only in top bar; placed in mobile navigation menu per user request) */}
        <div className="hidden sm:inline-flex shrink-0">
          <ThemeToggle />
        </div>

        {/* User Account Button */}
        <div className="flex items-center pl-0.5 sm:pl-2.5 border-l border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            title={`Account: ${user.full_name} (${user.role}) - Change Password`}
            className="flex items-center gap-2 py-0.5 px-0.5 sm:px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
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
