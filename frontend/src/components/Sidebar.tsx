"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarCheck2,
  ListTodo,
  ShieldAlert,
  Network,
  Users,
  LogOut,
  KeyRound,
  ShoppingBag,
  Boxes,
  Truck,
  Database,
  Building2,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Wrench,
  ShieldCheck,
  Palette,
  Sparkles,
  Target,
  Briefcase,
  LifeBuoy,
  Bot,
  FileText,
  UserCheck,
  Landmark,
  PieChart,
  PackageCheck,
  Factory,
  Warehouse,
  Code2,
  Percent,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";
import { RoleBadge } from "./RoleBadge";
import { ThemeToggle } from "./ThemeToggle";
import { ChangePasswordModal } from "./ChangePasswordModal";

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isMobileOpen, closeMobile, isCollapsed, toggleCollapsed } = useSidebar();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  if (!user) return null;

  const isSap = pathname.startsWith("/sap");
  const isCrm = pathname.startsWith("/crm");
  const activeSuite = isSap ? "SAP" : isCrm ? "CRM" : "HIERARCHY";

  // -----------------------------------------------------------------
  // 1. SAP ERP NAVIGATION ITEMS (CORE + EXTENDED COMMERCIAL SUITES)
  // -----------------------------------------------------------------
  const sapNavItems = [
    { label: "ERP Dashboard", href: "/sap", icon: LayoutDashboard },
    { label: "Sales & POS Suite", href: "/sap/sales", icon: ShoppingBag, badge: "SD" },
    { label: "Purchasing & AP", href: "/sap/purchasing", icon: ShoppingBag, badge: "MM" },
    { label: "Inventory & Godown", href: "/sap/inventory", icon: Boxes, badge: "INV" },
    { label: "Finance & Accounts", href: "/sap/finance", icon: Landmark, badge: "FI" },
    { label: "Billing & Invoices", href: "/sap/billing", icon: FileText, badge: "BILL" },
    { label: "Administration & Migration", href: "/sap/admin", icon: ShieldCheck, badge: "ADM" },
    { label: "Tax Management & GST", href: "/sap/tax", icon: Percent, badge: "TAX" },
    { label: "SAP FI Financial Accounting", href: "/sap/fi", icon: Landmark, badge: "FI" },
    { label: "SAP CO Cost & Profit", href: "/sap/co", icon: PieChart, badge: "CO" },
    { label: "SAP MM Material & Requisitions", href: "/sap/mm", icon: PackageCheck, badge: "MM" },
    { label: "SAP SD Sales Quotations", href: "/sap/sd", icon: FileText, badge: "SD" },
    { label: "SAP HCM Human Resources", href: "/sap/hcm", icon: Users, badge: "HCM" },
    { label: "SAP PP Production Planning", href: "/sap/pp", icon: Factory, badge: "PP" },
    { label: "SAP WM Warehouse Bins", href: "/sap/wm", icon: Warehouse, badge: "WM" },
    { label: "SAP ABAP Workbench", href: "/sap/abap", icon: Code2, badge: "ABAP" },
    { label: "Product Service & Repairs", href: "/sap/services", icon: Wrench },
    { label: "Rent Products & Fleet", href: "/sap/rentals", icon: Truck },
    { label: "Wholesale Accounts", href: "/wholesale", icon: Truck },
    ...(user.role === "SUPER_ADMIN" || user.role === "ADMIN"
      ? [
          { label: "Branches", href: "/branches", icon: Building2 },
          { label: "Departments", href: "/departments", icon: Layers },
        ]
      : []),
  ];

  // -----------------------------------------------------------------
  // 2. CRM & COMMERCIAL AI NAVIGATION ITEMS
  // -----------------------------------------------------------------
  const crmNavItems = [
    { label: "CRM Dashboard", href: "/crm", icon: LayoutDashboard },
    { label: "Leads & AI Scoring", href: "/crm/leads", icon: Target },
    { label: "Deals Pipeline", href: "/crm/deals", icon: Briefcase },
    { label: "Customer 360", href: "/crm/customers", icon: Users },
    { label: "Support Tickets & SLA", href: "/crm/tickets", icon: LifeBuoy },
    { label: "CRM AI Copilot & Agent", href: "/crm/ai-agent", icon: Bot },
    { label: "Wholesale Accounts", href: "/wholesale", icon: Truck },
    { label: "Commercial Team", href: "/users", icon: UserCheck },
  ];

  // -----------------------------------------------------------------
  // 3. HIERARCHY MANAGEMENT NAVIGATION ITEMS (ORIGINAL)
  // -----------------------------------------------------------------
  const hierarchyNavItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, windowKey: "dashboard" },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck2, windowKey: "attendance" },
    { label: "Tasks", href: "/tasks", icon: CheckSquare, windowKey: "tasks" },
    { label: "My Checklist", href: "/checklist", icon: ListTodo, windowKey: "checklist" },
    { label: "Approvals", href: "/approvals", icon: ShieldAlert, windowKey: "approvals" },
    { label: "Purchase Desk", href: "/purchases", icon: ShoppingBag, windowKey: "purchases" },
    { label: "Inventory", href: "/inventory", icon: Boxes, windowKey: "inventory" },
    { label: "Warranty", href: "/warranty", icon: Wrench, windowKey: "warranty" },
    { label: "Wholesale Orders", href: "/wholesale", icon: Truck, windowKey: "wholesale" },
    { label: "Org Hierarchy", href: "/hierarchy", icon: Network, windowKey: "hierarchy" },
    { label: "Team & Users", href: "/users", icon: Users, windowKey: "users" },
    ...(user.role === "SUPER_ADMIN" || user.role === "ADMIN"
      ? [
          { label: "Accessible Windows", href: "/accessible-windows", icon: ShieldCheck, windowKey: "accessible_windows" },
          { label: "Branches", href: "/branches", icon: Building2, windowKey: "branches" },
          { label: "Departments", href: "/departments", icon: Layers, windowKey: "departments" },
        ]
      : []),
    ...(user.role === "SUPER_ADMIN"
      ? [{ label: "Backup & Restore", href: "/backup", icon: Database, windowKey: "backup" }]
      : []),
  ];

  const currentNavItems = isSap
    ? sapNavItems
    : isCrm
    ? crmNavItems
    : hierarchyNavItems.filter((item) => {
        if (user.role === "SUPER_ADMIN") return true;
        if (!item.windowKey) return true;
        if (user.permissions && user.permissions[item.windowKey]) {
          return user.permissions[item.windowKey].display !== false;
        }
        return true;
      });

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Responsive Sidebar Drawer & Desktop Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 shrink-0 h-full h-[100dvh] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ease-in-out ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${
          isCollapsed ? "lg:w-20 w-72 max-w-[85vw]" : "w-72 lg:w-64 max-w-[85vw]"
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 min-h-[64px]">
          {/* Logo and Brand Title (hidden on collapsed desktop) */}
          <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? "lg:hidden" : ""}`}>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 ${
                isSap
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/20"
                  : isCrm
                  ? "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-500/20"
                  : "bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-500/20"
              }`}
            >
              {isSap ? <Boxes className="w-6 h-6" /> : isCrm ? <Sparkles className="w-6 h-6" /> : <Network className="w-6 h-6" />}
            </div>
            <div className="truncate">
              <h1 className="font-bold text-slate-900 dark:text-white leading-tight truncate">
                {isSap ? "SAP Business ERP" : isCrm ? "CRM 360 & AI" : "Team Littad"}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isSap ? "Service & Rentals Fleet" : isCrm ? "Commercial Intelligence" : "Hierarchy & Workflow"}
              </p>
            </div>
          </div>

          {/* Centered Logo in Collapsed Desktop Mode */}
          {isCollapsed && (
            <div className="hidden lg:flex w-full justify-center">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md cursor-pointer ${
                  isSap
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/20"
                    : isCrm
                    ? "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-500/20"
                    : "bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-500/20"
                }`}
                onClick={toggleCollapsed}
                title="Expand sidebar"
              >
                {isSap ? <Boxes className="w-5 h-5" /> : isCrm ? <Sparkles className="w-5 h-5" /> : <Network className="w-5 h-5" />}
              </div>
            </div>
          )}

          {/* Action controls in header */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Theme Toggle (hidden when collapsed on desktop) */}
            <div className={isCollapsed ? "lg:hidden" : ""}>
              <ThemeToggle />
            </div>

            {/* Minimize / Collapse Toggle Button (Desktop >= lg) */}
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Close Drawer Button (Mobile/Tablet < lg) */}
            <button
              type="button"
              onClick={closeMobile}
              title="Close navigation"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {!isCollapsed && (
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span>{isSap ? "SAP ERP Modules" : isCrm ? "CRM & AI Modules" : "Hierarchy Navigation"}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  isSap
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : isCrm
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                }`}
              >
                {activeSuite}
              </span>
            </div>
          )}

          {currentNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            const activeClass = isSap
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold"
              : isCrm
              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold"
              : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold";

            const activeIconClass = isSap
              ? "text-emerald-600 dark:text-emerald-400"
              : isCrm
              ? "text-purple-600 dark:text-purple-400"
              : "text-indigo-600 dark:text-indigo-400";

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-colors group relative ${
                  isCollapsed
                    ? "lg:justify-center px-3.5 py-3 lg:px-0 lg:py-2.5"
                    : "gap-3 px-3.5 py-2.5"
                } ${
                  isActive
                    ? activeClass
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? activeIconClass
                      : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                  }`}
                />

                {/* Label (hidden in collapsed desktop mode) */}
                <span className={`truncate ${isCollapsed ? "lg:hidden" : ""}`}>
                  {item.label}
                </span>

                {(item as any).badge && !isCollapsed && (
                  <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono shrink-0">
                    {(item as any).badge}
                  </span>
                )}

                {/* Collapsed Tooltip on hover */}
                {isCollapsed && (
                  <span className="hidden lg:group-hover:block absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white dark:bg-slate-800 text-xs rounded-md shadow-lg whitespace-nowrap z-50 pointer-events-none">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Workspace Switcher Footer (Same Tab) */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
              Switch Workspace (Same Tab)
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  router.push("/");
                }}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold text-center truncate transition-colors cursor-pointer ${
                  activeSuite === "HIERARCHY"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/60"
                }`}
              >
                Hierarchy
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  router.push("/sap");
                }}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold text-center truncate transition-colors cursor-pointer ${
                  activeSuite === "SAP"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700/60"
                }`}
              >
                SAP ERP
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  router.push("/crm");
                }}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-semibold text-center truncate transition-colors cursor-pointer ${
                  activeSuite === "CRM"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-700/60"
                }`}
              >
                CRM AI
              </button>
            </div>
          </div>
        )}

        {/* Mobile View Dedicated Theme & Appearance Selector */}
        <div className="lg:hidden px-3.5 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Theme & Appearance
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* User Footer Profile */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {!isCollapsed ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="truncate pr-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user.full_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user.email}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setIsChangePasswordOpen(true)}
                    title="Change Password"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <RoleBadge role={user.role} />
                {user.is_purchase_manager && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    Purchase Mgr
                  </span>
                )}
                {user.branch && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {user.branch}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Compact Collapsed User Footer (Desktop w-20) */
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full text-white flex items-center justify-center font-bold text-xs ring-1 ${
                  isSap
                    ? "bg-emerald-600 ring-emerald-500/30"
                    : isCrm
                    ? "bg-purple-600 ring-purple-500/30"
                    : "bg-indigo-600 ring-indigo-500/30"
                }`}
                title={`${user.full_name} (${user.role}) - ${user.email}`}
              >
                {user.full_name.charAt(0)}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  title="Change Password"
                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </aside>
    </>
  );
};
