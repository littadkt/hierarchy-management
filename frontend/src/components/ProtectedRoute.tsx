"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  featureKey?: string;
}> = ({ children, featureKey: explicitFeatureKey }) => {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Resolve feature key and friendly label from path or explicit prop
  const getFeatureInfo = (): { key: string; name: string } | null => {
    if (explicitFeatureKey) {
      return { key: explicitFeatureKey, name: explicitFeatureKey.replace("_", " ") };
    }
    const path = pathname || "";
    if (path === "/" || path === "") return { key: "dashboard", name: "Dashboard" };
    if (path.startsWith("/tasks")) return { key: "tasks", name: "Tasks Management" };
    if (path.startsWith("/attendance")) return { key: "attendance", name: "Attendance & Check-in" };
    if (path.startsWith("/checklist")) return { key: "checklist", name: "My Checklist" };
    if (path.startsWith("/approvals")) return { key: "approvals", name: "Approvals & Decisions" };
    if (path.startsWith("/purchases")) return { key: "purchases", name: "Purchase Desk" };
    if (path.startsWith("/inventory")) return { key: "inventory", name: "Inventory Stock" };
    if (path.startsWith("/warranty")) return { key: "warranty", name: "Warranty Management" };
    if (path.startsWith("/wholesale")) return { key: "wholesale", name: "Wholesale Orders" };
    if (path.startsWith("/hierarchy")) return { key: "hierarchy", name: "Org Hierarchy" };
    if (path.startsWith("/users")) return { key: "users", name: "Team & Users" };
    if (path.startsWith("/branches")) return { key: "branches", name: "Branches" };
    if (path.startsWith("/departments")) return { key: "departments", name: "Departments" };
    if (path.startsWith("/backup")) return { key: "backup", name: "Backup & Restore" };
    if (path.startsWith("/accessible-windows")) return { key: "accessible_windows", name: "Accessible Windows" };
    return null;
  };

  const featureInfo = getFeatureInfo();

  const isAccessible = (() => {
    if (user.role === "SUPER_ADMIN") return true;
    if (featureInfo?.key === "accessible_windows") {
      return user.role === "ADMIN";
    }
    if (!featureInfo) return true;
    return hasPermission(featureInfo.key, "display");
  })();

  if (!isAccessible && featureInfo) {
    return (
      <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8 min-w-0 flex items-center justify-center">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-md animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-500 mx-auto mb-4">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Access Restricted
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                You do not have permission to access the{" "}
                <strong className="text-slate-800 dark:text-slate-200">{featureInfo.name}</strong>{" "}
                window.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Please contact an Administrator or Super Administrator to request access.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};


