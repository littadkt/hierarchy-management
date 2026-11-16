"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Network,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Boxes,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { User } from "@/lib/types";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

  // Post-login workspace selection modal state
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [launchedSuite, setLaunchedSuite] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("expired") === "1") {
        setExpiredNotice(true);
      }
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    if (!cleanEmail || !cleanPassword) return;
    setLoading(true);
    setError(null);
    try {
      // Pass redirect=false to prompt user with workspace choice
      const user = await login(cleanEmail, cleanPassword, false);
      setAuthenticatedUser(user);
      setShowWorkspaceModal(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchNewTab = (url: string, suiteName: string) => {
    setLaunchedSuite(suiteName);
    window.open(url, "_blank");
  };

  const handleLaunchSameTab = (url: string) => {
    router.push(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 dark:text-white relative transition-colors duration-200">
      {/* Top Header Actions (Theme Toggle) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo & Intro */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 mb-4">
            <Network className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Team Littad</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise Management: Hierarchy • SAP ERP • CRM Suite
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700/60 p-6 sm:p-8 rounded-3xl shadow-xl dark:shadow-2xl transition-colors duration-200">
          {expiredNotice && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Authenticating..." : "Sign In & Choose Workspace"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ========================================================= */}
      {/* POST-LOGIN WORKSPACE SELECTION MODAL (OPENS IN NEW TAB) */}
      {/* ========================================================= */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authentication Successful</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Welcome, {authenticatedUser?.full_name || "Team Member"}!
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                Select the workspace you want to launch. Clicking an application will open it in a{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">new tab</span>.
              </p>
            </div>

            {launchedSuite && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>
                    Launched <strong>{launchedSuite}</strong> in a new tab! You can launch another or switch tabs.
                  </span>
                </div>
              </div>
            )}

            {/* 3 Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Hierarchy Management */}
              <button
                type="button"
                onClick={() => handleLaunchNewTab("/", "Hierarchy Management")}
                className="flex flex-col text-left p-5 rounded-2xl border-2 border-indigo-100 hover:border-indigo-500 dark:border-slate-800 dark:hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 dark:bg-slate-800/40 dark:hover:bg-indigo-950/30 transition-all cursor-pointer group shadow-xs hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                  <Network className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between w-full mb-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Hierarchy</h3>
                  <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                  Task workflow, attendance tracking, hierarchical approvals & team management.
                </p>
                <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Option 2: SAP ERP Suite */}
              <button
                type="button"
                onClick={() => handleLaunchNewTab("/sap", "SAP ERP Suite")}
                className="flex flex-col text-left p-5 rounded-2xl border-2 border-emerald-100 hover:border-emerald-500 dark:border-slate-800 dark:hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 dark:bg-slate-800/40 dark:hover:bg-emerald-950/30 transition-all cursor-pointer group shadow-xs hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-md shadow-emerald-600/30 group-hover:scale-105 transition-transform">
                  <Boxes className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between w-full mb-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">SAP ERP</h3>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                  Product service & repairs, equipment rentals fleet, sales orders & procurement.
                </p>
                <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </button>

              {/* Option 3: CRM 360 & AI */}
              <button
                type="button"
                onClick={() => handleLaunchNewTab("/crm", "CRM & AI Suite")}
                className="flex flex-col text-left p-5 rounded-2xl border-2 border-purple-100 hover:border-purple-500 dark:border-slate-800 dark:hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/80 dark:bg-slate-800/40 dark:hover:bg-purple-950/30 transition-all cursor-pointer group shadow-xs hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between w-full mb-1">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">CRM & AI</h3>
                  <ArrowUpRight className="w-4 h-4 text-purple-600 dark:text-purple-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                  Customer 360, sales deals pipeline, predictive AI lead scoring & smart copilot.
                </p>
                <div className="mt-4 pt-3 border-t border-purple-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>

            {/* Same Tab Fallback Option */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>Or continue directly in this current window:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLaunchSameTab("/")}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-colors font-medium cursor-pointer"
                >
                  Hierarchy
                </button>
                <button
                  type="button"
                  onClick={() => handleLaunchSameTab("/sap")}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950 dark:hover:text-emerald-400 transition-colors font-medium cursor-pointer"
                >
                  SAP ERP
                </button>
                <button
                  type="button"
                  onClick={() => handleLaunchSameTab("/crm")}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950 dark:hover:text-purple-400 transition-colors font-medium cursor-pointer"
                >
                  CRM & AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
