"use client";

import React, { useEffect, useState } from "react";
import { Network, ArrowRight, AlertCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [supersededNotice, setSupersededNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("superseded") === "1") {
        setSupersededNotice(true);
      } else if (params.get("expired") === "1") {
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
            Role-Based Provisions & Approval Governance
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700/60 p-6 sm:p-8 rounded-3xl shadow-xl dark:shadow-2xl transition-colors duration-200">
          {supersededNotice && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>You have been logged out because your account was logged in from another device, tab, or window. Only one active login session is permitted.</span>
            </div>
          )}

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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          {/* FastAPI + PostgreSQL + Next.js App Router */}
        </p>
      </div>
    </div>
  );
}

