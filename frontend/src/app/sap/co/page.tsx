"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  Target,
  DollarSign,
  AlertCircle,
  X,
  Building2,
  Layers,
  Scale,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapCostCenter, SapProfitCenter } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapCoPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"cost" | "profit">("cost");
  const [costCenters, setCostCenters] = useState<SapCostCenter[]>([]);
  const [profitCenters, setProfitCenters] = useState<SapProfitCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [isCcModalOpen, setIsCcModalOpen] = useState(false);
  const [ccCode, setCcCode] = useState("");
  const [ccName, setCcName] = useState("");
  const [ccManager, setCcManager] = useState("");
  const [ccDept, setCcDept] = useState("Operations");
  const [ccBudget, setCcBudget] = useState(0);

  const [isPcModalOpen, setIsPcModalOpen] = useState(false);
  const [pcCode, setPcCode] = useState("");
  const [pcName, setPcName] = useState("");
  const [pcHead, setPcHead] = useState("");
  const [pcTarget, setPcTarget] = useState(0);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ccData, pcData] = await Promise.all([
        sapApi.listCostCenters({ search: search.trim() || undefined }),
        sapApi.listProfitCenters({ search: search.trim() || undefined }),
      ]);
      setCostCenters(ccData);
      setProfitCenters(pcData);
    } catch (err) {
      console.error("Failed to load SAP CO data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateCc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ccCode.trim() || !ccName.trim() || !ccManager.trim()) {
      setFormError("Please fill in Code, Name and Manager");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createCostCenter({
        center_code: ccCode.trim(),
        name: ccName.trim(),
        manager_name: ccManager.trim(),
        department: ccDept.trim(),
        budget_amount: Number(ccBudget) || 0,
        actual_spent: 0,
        currency: "INR",
        is_active: true,
      });
      setIsCcModalOpen(false);
      setCcCode("");
      setCcName("");
      setCcManager("");
      setCcBudget(0);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreatePc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pcCode.trim() || !pcName.trim() || !pcHead.trim()) {
      setFormError("Please fill in Code, Name and Head");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createProfitCenter({
        center_code: pcCode.trim(),
        name: pcName.trim(),
        head_name: pcHead.trim(),
        target_revenue: Number(pcTarget) || 0,
        actual_revenue: 0,
        currency: "INR",
        is_active: true,
      });
      setIsPcModalOpen(false);
      setPcCode("");
      setPcName("");
      setPcHead("");
      setPcTarget(0);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const totalBudget = costCenters.reduce((sum, c) => sum + c.budget_amount, 0);
  const totalSpent = costCenters.reduce((sum, c) => sum + c.actual_spent, 0);
  const totalTargetRevenue = profitCenters.reduce((sum, p) => sum + p.target_revenue, 0);
  const totalActualRevenue = profitCenters.reduce((sum, p) => sum + p.actual_revenue, 0);

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header - Exact Hierarchy Style */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/sap"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>SAP ERP</span>
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-medium text-slate-500">Cost & Profit Management (SAP CO)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              <span>SAP CO — Controlling & Profitability Architecture</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cost center budgeting, divisional profit centers, internal order tracking, and managerial variance analysis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => {
                setFormError(null);
                setIsCcModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Cost Center</span>
            </button>
            <button
              onClick={() => {
                setFormError(null);
                setIsPcModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Profit Center</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid - Exact Hierarchy 4-Column Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Total Allocated Budget
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                ₹{totalBudget.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Actual Operating Spent
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ₹{totalSpent.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Targeted Profit Revenue
              </p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{totalTargetRevenue.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Actual Profit Generated
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{totalActualRevenue.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("cost")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "cost"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cost Centers ({costCenters.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("profit")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "profit"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Profit Centers ({profitCenters.length})</span>
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, manager, division..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </form>
        </div>

        {/* Content Table Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {activeTab === "cost" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Center Code</th>
                    <th className="px-5 py-3.5">Cost Center Name</th>
                    <th className="px-5 py-3.5">Manager</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5 text-right">Budget Limit</th>
                    <th className="px-5 py-3.5 text-right">Actual Spent</th>
                    <th className="px-5 py-3.5 text-right">Budget Consumption</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {costCenters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        No cost centers registered yet. Click "New Cost Center" to add one.
                      </td>
                    </tr>
                  ) : (
                    costCenters.map((cc) => {
                      const pct = cc.budget_amount > 0 ? (cc.actual_spent / cc.budget_amount) * 100 : 0;
                      return (
                        <tr
                          key={cc.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {cc.center_code}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                            {cc.name}
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                            {cc.manager_name}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">{cc.department}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">
                            ₹{cc.budget_amount.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-amber-600 dark:text-amber-400">
                            ₹{cc.actual_spent.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                pct > 90
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : pct > 60
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Center Code</th>
                    <th className="px-5 py-3.5">Profit Center Name</th>
                    <th className="px-5 py-3.5">Division Head</th>
                    <th className="px-5 py-3.5 text-right">Target Revenue</th>
                    <th className="px-5 py-3.5 text-right">Actual Realized</th>
                    <th className="px-5 py-3.5 text-right">Target Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {profitCenters.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No profit centers registered yet.
                      </td>
                    </tr>
                  ) : (
                    profitCenters.map((pc) => {
                      const ach = pc.target_revenue > 0 ? (pc.actual_revenue / pc.target_revenue) * 100 : 0;
                      return (
                        <tr
                          key={pc.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                            {pc.center_code}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                            {pc.name}
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                            {pc.head_name}
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-slate-700 dark:text-slate-300">
                            ₹{pc.target_revenue.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{pc.actual_revenue.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                ach >= 100
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {ach.toFixed(1)}% Achieved
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create Cost Center */}
        {isCcModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <span>Register SAP Cost Center</span>
                </h3>
                <button
                  onClick={() => setIsCcModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateCc} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Center Code
                  </label>
                  <input
                    type="text"
                    required
                    value={ccCode}
                    onChange={(e) => setCcCode(e.target.value)}
                    placeholder="e.g. CC-LOG-104"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Cost Center Name
                  </label>
                  <input
                    type="text"
                    required
                    value={ccName}
                    onChange={(e) => setCcName(e.target.value)}
                    placeholder="e.g. South Zone Logistics Fleet"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    required
                    value={ccManager}
                    onChange={(e) => setCcManager(e.target.value)}
                    placeholder="e.g. Manoj Sharma"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={ccDept}
                    onChange={(e) => setCcDept(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Fiscal Budget Allocation (INR)
                  </label>
                  <input
                    type="number"
                    value={ccBudget}
                    onChange={(e) => setCcBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCcModalOpen(false)}
                    className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? "Saving..." : "Create Cost Center"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Profit Center */}
        {isPcModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  <span>Register SAP Profit Center</span>
                </h3>
                <button
                  onClick={() => setIsPcModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreatePc} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Center Code
                  </label>
                  <input
                    type="text"
                    required
                    value={pcCode}
                    onChange={(e) => setPcCode(e.target.value)}
                    placeholder="e.g. PC-HEAVY-204"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Profit Center Name
                  </label>
                  <input
                    type="text"
                    required
                    value={pcName}
                    onChange={(e) => setPcName(e.target.value)}
                    placeholder="e.g. Heavy Earthmoving Equipment Unit"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Division Head
                  </label>
                  <input
                    type="text"
                    required
                    value={pcHead}
                    onChange={(e) => setPcHead(e.target.value)}
                    placeholder="e.g. Sunil Narayanan"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Annual Target Revenue (INR)
                  </label>
                  <input
                    type="number"
                    value={pcTarget}
                    onChange={(e) => setPcTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsPcModalOpen(false)}
                    className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? "Saving..." : "Create Profit Center"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
