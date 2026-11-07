"use client";

import React from "react";
import { ListTodo, CheckSquare, Sparkles, ShieldCheck, Clock } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { QuickChecklistWidget } from "@/components/QuickChecklistWidget";
import { useAuth } from "@/context/AuthContext";

export default function ChecklistPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-white/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Personal Quick Tasks</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <ListTodo className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-200 shrink-0" />
              <span>My Checklist</span>
            </h1>
            <p className="text-sm text-indigo-100/90 leading-relaxed max-w-2xl">
              A private, fast checklist for your personal daily action items, quick notes, and reminders.
              Items here are completely private to you ({user?.full_name}) and do not require assignment, approval, or hierarchy workflows.
            </p>
            <div className="pt-2 flex items-center gap-3 flex-wrap text-xs text-indigo-200">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                100% Private to your account
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 backdrop-blur-sm">
                <Clock className="w-4 h-4 text-amber-300" />
                Instant quick checkboxes
              </span>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Main Checklist Card */}
        <QuickChecklistWidget showTitle={false} className="shadow-lg" />
      </div>
    </ProtectedRoute>
  );
}

