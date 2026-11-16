"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Target,
  Briefcase,
  Users,
  LifeBuoy,
  Bot,
  TrendingUp,
  ArrowRight,
  Plus,
  RefreshCw,
  Award,
  Zap,
  Truck,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { crmApi } from "@/lib/api";
import {
  CrmCustomer,
  CrmDashboardStats,
  CrmDeal,
  CrmLead,
  CrmTicket,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CrmDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CrmDashboardStats | null>(null);
  const [topLeads, setTopLeads] = useState<CrmLead[]>([]);
  const [topDeals, setTopDeals] = useState<CrmDeal[]>([]);
  const [topTickets, setTopTickets] = useState<CrmTicket[]>([]);
  const [scopeTab, setScopeTab] = useState<"leads" | "deals" | "tickets">("leads");
  const [loading, setLoading] = useState(true);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsData, leadsData, dealsData, ticketsData] = await Promise.all([
        crmApi.getDashboardStats().catch(() => null),
        crmApi.listLeads({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
        crmApi.listDeals({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
        crmApi.listTickets({ limit: 6 }).catch(() => ({ items: [], total: 0 })),
      ]);
      if (statsData) setStats(statsData);
      setTopLeads(leadsData.items);
      setTopDeals(dealsData.items);
      setTopTickets(ticketsData.items);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDealStageBadge = (stage: string) => {
    switch (stage) {
      case "DISCOVERY":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "PROPOSAL":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      case "NEGOTIATION":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
      case "CLOSED_WON":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "CLOSED_LOST":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const getLeadStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      case "QUALIFIED":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
      case "CONTACTED":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      case "CONVERTED":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
      case "LOST":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  const getTicketPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800";
      case "HIGH":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
      case "MEDIUM":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  };

  // High priority opportunities for live panel
  const highPriorityItems = [
    ...topDeals
      .filter((d) => d.stage === "NEGOTIATION" || d.stage === "PROPOSAL")
      .slice(0, 3)
      .map((d) => ({
        id: d.id,
        kind: "DEAL" as const,
        code: d.deal_code,
        title: d.title,
        subtitle: `Client: ${d.customer_name} • Win Prob: ${d.ai_win_probability}%`,
        badgeText: d.stage,
        badgeClass: getDealStageBadge(d.stage),
        amountText: `₹${d.amount.toLocaleString()}`,
        scoreTag: `${d.ai_win_probability}% Win Prob`,
        link: "/crm/deals",
      })),
    ...topLeads
      .filter((l) => l.ai_score >= 60)
      .slice(0, 3)
      .map((l) => ({
        id: l.id,
        kind: "LEAD" as const,
        code: l.lead_code,
        title: `${l.full_name} ${l.company_name ? `(${l.company_name})` : ""}`,
        subtitle: `Source: ${l.source} • Rep: ${l.assigned_to_name || "Unassigned"}`,
        badgeText: l.status,
        badgeClass: getLeadStatusBadge(l.status),
        amountText: `₹${l.estimated_value.toLocaleString()}`,
        scoreTag: `AI Score: ${l.ai_score}/100`,
        link: "/crm/leads",
      })),
  ].slice(0, 6);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Welcome Banner - Exact Hierarchy Style */}
        <div className="bg-gradient-to-r from-purple-800 via-indigo-700 to-purple-900 dark:from-slate-900 dark:via-purple-950/70 dark:to-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-transparent dark:border-slate-800">
          <div className="relative z-[1] max-w-2xl space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md text-xs font-medium text-white/90">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Commercial Intelligence & Sales AI</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/25 border border-amber-400/40 text-amber-200 backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <Bot className="w-3.5 h-3.5 text-amber-300" />
                <span>AI Agent Online</span>
              </div>
              {user?.today_first_login_at && (
                <div
                  title={`Your first check-in today: ${new Date(user.today_first_login_at).toLocaleString()}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 backdrop-blur-md shadow-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Clock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    Your Today&apos;s Check-in:{" "}
                    {new Date(user.today_first_login_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-sm text-purple-100/90 dark:text-slate-300 leading-relaxed">
              Full lifecycle commercial management: Predictive AI lead qualification, sales opportunity velocity,
              customer 360 intelligence, and resolution ticketing.
            </p>
            <div className="pt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
              <Link
                href="/crm/ai-agent"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Bot className="w-4 h-4 text-slate-950" />
                <span>Ask CRM AI Agent</span>
              </Link>
              <Link
                href="/crm/leads"
                className="px-4 py-2 rounded-xl bg-white text-purple-800 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-500 font-bold text-xs hover:bg-purple-50 shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-purple-600 dark:text-white" />
                <span>New Lead</span>
              </Link>
              <Link
                href="/crm/deals"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Briefcase className="w-4 h-4" />
                <span>Deals Pipeline</span>
              </Link>
              <Link
                href="/crm/customers"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Customer 360</span>
              </Link>
              <Link
                href="/crm/tickets"
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5"
              >
                <LifeBuoy className="w-4 h-4" />
                <span>Support SLA</span>
              </Link>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 text-white font-semibold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="Refresh Insights"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-500/20 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Metric Cards Grid - Exact Hierarchy 5-Column Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Open Pipeline Value */}
          <Link
            href="/crm/deals"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Open Pipeline
              </p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{(stats?.open_pipeline_value ?? 0).toLocaleString()}
              </h3>
            </div>
          </Link>

          {/* Card 2: Total Inbound Leads */}
          <Link
            href="/crm/leads"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Leads In Pipeline
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats?.total_leads ?? 0}
              </h3>
            </div>
          </Link>

          {/* Card 3: AI Qualified Leads */}
          <Link
            href="/crm/leads"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Qualified Leads
              </p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats?.qualified_leads ?? 0}
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
            </div>
          </Link>

          {/* Card 4: AI Average Lead Score */}
          <Link
            href="/crm/leads"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Avg AI Lead Score
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats?.avg_ai_lead_score ?? 50}/100
              </h3>
            </div>
          </Link>

          {/* Card 5: Total Customer Accounts */}
          <Link
            href="/crm/customers"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Customer Accounts
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats?.total_customers ?? 0}
              </h3>
            </div>
          </Link>
        </div>

        {/* Live Opportunities Panel - Exact Hierarchy "Today's Team Check-ins" Style */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>High-Priority Inquiries & Deals in Motion</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 rounded-full px-2 py-0.5">
                  {(stats?.qualified_leads ?? 0) + (stats?.won_deals_count ?? 0)} active
                </span>
              </h3>
            </div>
            <Link
              href="/crm/deals"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <span>View Full Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {highPriorityItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {highPriorityItems.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.link}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-purple-700 dark:text-purple-300">
                        {item.code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass}`}>
                        {item.badgeText}
                      </span>
                    </div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate mt-1">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {item.amountText}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 block">
                      {item.scoreTag}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No active qualified leads or deals in motion currently.
            </div>
          )}
        </div>

        {/* Commercial Pipeline Distribution - Exact Hierarchy "Team Structure" Style */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Commercial Pipeline by Deal Stage
            </h3>
            <Link
              href="/crm/deals"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <span>View Deals Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-center">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold block">
                Discovery
              </span>
              <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {topDeals.filter((d) => d.stage === "DISCOVERY").length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-center">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold block">
                Proposal
              </span>
              <span className="text-xl font-bold text-amber-900 dark:text-amber-200">
                {topDeals.filter((d) => d.stage === "PROPOSAL").length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 text-center">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold block">
                Negotiation
              </span>
              <span className="text-xl font-bold text-purple-900 dark:text-purple-200">
                {topDeals.filter((d) => d.stage === "NEGOTIATION").length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold block">
                Closed Won
              </span>
              <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
                {stats?.won_deals_count ?? topDeals.filter((d) => d.stage === "CLOSED_WON").length}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-center">
              <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold block">
                Closed Lost
              </span>
              <span className="text-xl font-bold text-rose-900 dark:text-rose-200">
                {topDeals.filter((d) => d.stage === "CLOSED_LOST").length}
              </span>
            </div>
          </div>
        </div>

        {/* Commercial Hub - Segmented Tabbed Section (Exact Hierarchy Tasks Section Style) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Commercial Hub</h3>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setScopeTab("leads")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "leads"
                        ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Inbound Leads</span>
                  </button>
                  <button
                    onClick={() => setScopeTab("deals")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "deals"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Sales Deals</span>
                  </button>
                  <button
                    onClick={() => setScopeTab("tickets")}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      scopeTab === "tickets"
                        ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    <span>Support SLA</span>
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {scopeTab === "leads"
                  ? "Predictive lead inquiries ranked with AI conversion scores"
                  : scopeTab === "deals"
                  ? "Active sales deals with automated win probability modeling"
                  : "Customer resolution tickets and response SLA monitors"}
              </p>
            </div>
            <Link
              href={
                scopeTab === "leads"
                  ? "/crm/leads"
                  : scopeTab === "deals"
                  ? "/crm/deals"
                  : "/crm/tickets"
              }
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>
                {scopeTab === "leads"
                  ? "View All Leads"
                  : scopeTab === "deals"
                  ? "View Deals Pipeline"
                  : "View All Tickets"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            {scopeTab === "leads" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Lead Code</th>
                    <th className="px-5 py-3.5">Contact Name & Company</th>
                    <th className="px-5 py-3.5">Source</th>
                    <th className="px-5 py-3.5">AI Score</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Assigned Rep</th>
                    <th className="px-5 py-3.5 text-right">Est. Value</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No leads captured yet. Click "New Lead" above to record one.
                      </td>
                    </tr>
                  ) : (
                    topLeads.map((l) => (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-purple-700 dark:text-purple-300">
                          {l.lead_code}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-xs">{l.full_name}</div>
                          {l.company_name && (
                            <span className="text-[10px] text-slate-400">{l.company_name}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 uppercase">
                          {l.source}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                            <Zap className="w-3 h-3 text-amber-500" />
                            <span>{l.ai_score}/100</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getLeadStatusBadge(l.status)}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {l.assigned_to_name || "Unassigned"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{l.estimated_value.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/crm/leads"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {scopeTab === "deals" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Deal Code</th>
                    <th className="px-5 py-3.5">Deal Title</th>
                    <th className="px-5 py-3.5">Customer Account</th>
                    <th className="px-5 py-3.5">Stage</th>
                    <th className="px-5 py-3.5">AI Win Probability</th>
                    <th className="px-5 py-3.5">Close Target</th>
                    <th className="px-5 py-3.5 text-right">Deal Value</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topDeals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No sales deals in pipeline currently.
                      </td>
                    </tr>
                  ) : (
                    topDeals.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {d.deal_code}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-xs">{d.title}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          {d.customer_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDealStageBadge(d.stage)}`}>
                            {d.stage}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                            <span>{d.ai_win_probability}%</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{d.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/crm/deals"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {scopeTab === "tickets" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Ticket #</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Priority</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Assigned Agent</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        No open support tickets. All customer requests resolved!
                      </td>
                    </tr>
                  ) : (
                    topTickets.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-teal-700 dark:text-teal-300">
                          {t.ticket_number}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-xs">{t.subject}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          {t.customer_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getTicketPriorityBadge(t.priority)}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {t.assigned_agent_name || "Unassigned"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href="/crm/tickets"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Integrated CRM Operational Modules - Exact Hierarchy Pattern */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Commercial Management Suite
            </h3>
            <span className="text-xs text-slate-400">CRM 360 & AI Integration</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Link
              href="/crm/leads"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Leads Pipeline</div>
              <div className="text-[10px] text-slate-400 mt-0.5">AI Scoring & Inbound</div>
            </Link>

            <Link
              href="/crm/deals"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Sales Deals</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Stages & Forecasting</div>
            </Link>

            <Link
              href="/crm/customers"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Customer 360</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Accounts & Tiers</div>
            </Link>

            <Link
              href="/crm/tickets"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:border-teal-300 dark:hover:border-teal-700 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Support & SLA</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tickets & Resolution</div>
            </Link>

            <Link
              href="/crm/ai-agent"
              className="p-3.5 rounded-xl border border-amber-300/80 dark:border-amber-700/50 bg-gradient-to-br from-amber-500/10 to-purple-500/10 hover:from-amber-500/20 hover:to-purple-500/20 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform shadow-md shadow-amber-500/20">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">CRM AI Agent</div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">Smart Copilot</div>
            </Link>

            <Link
              href="/wholesale"
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Wholesale Orders</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bulk Deliveries</div>
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
