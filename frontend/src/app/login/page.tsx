"use client";

import React, { useEffect, useState } from "react";
import { Network, ArrowRight, AlertCircle, ShieldCheck, Download, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePwa } from "@/context/PwaContext";
import { getErrorMessage } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { login } = useAuth();
  const { isInstalled, promptInstall } = usePwa();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

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
      await login(cleanEmail, cleanPassword);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: "Super Admin", email: "littadkt@gmail.com", pass: "littad#404", badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
    { role: "Admin", email: "admin@example.com", pass: "Admin@123", desc: "Kochi Branch", badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    { role: "In-Charge", email: "incharge@example.com", pass: "InCharge@123", desc: "Operations", badge: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
    { role: "Team Leader", email: "teamleader@example.com", pass: "TeamLeader@123", desc: "Engineering", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    { role: "Staff", email: "staff1@example.com", pass: "Staff@123", desc: "Eng / Kochi", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-900 dark:text-white relative transition-colors duration-200">
      {/* Top Header Actions (Theme Toggle & Install Button) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {!isInstalled && (
          <button
            type="button"
            onClick={promptInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}
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
            Role-Based Provisions & Approval Governance
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
              {loading ? "Signing in..." : "Sign In"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          {/* <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
              Quick Test Accounts (Click to Fill)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.pass);
                    setError(null);
                  }}
                  className="flex items-center justify-between text-left p-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                >
                  <div className="truncate mr-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{account.role}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{account.email}</div>
                  </div>
                  {account.desc && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                      {account.desc}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div> */}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          {/* FastAPI + PostgreSQL + Next.js App Router */}
        </p>
      </div>
    </div>
  );
}

