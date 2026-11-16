"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Bot,
} from "lucide-react";
import { crmApi, getErrorMessage } from "@/lib/api";
import { CrmDeal } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CrmDealsPage() {
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState(0);
  const [stage, setStage] = useState("DISCOVERY");
  const [probability, setProbability] = useState(25);
  const [expectedDate, setExpectedDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dealNotes, setDealNotes] = useState("");

  // AI Deal Analysis Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiActiveDeal, setAiActiveDeal] = useState<CrmDeal | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const data = await crmApi.listDeals({
        search: search.trim() || undefined,
        stage: stageFilter,
      });
      setDeals(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load deals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals();
  }, [stageFilter]);

  const openCreateModal = () => {
    setEditingDeal(null);
    setTitle("");
    setCustomerName("");
    setAmount(100000);
    setStage("DISCOVERY");
    setProbability(25);
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    setExpectedDate(in30Days);
    setAssignedTo("");
    setDealNotes("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: CrmDeal) => {
    setEditingDeal(d);
    setTitle(d.title);
    setCustomerName(d.customer_name);
    setAmount(d.amount);
    setStage(d.stage);
    setProbability(d.probability);
    setExpectedDate(d.expected_close_date ? d.expected_close_date.split("T")[0] : "");
    setAssignedTo(d.assigned_to_name || "");
    setDealNotes(d.notes || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !customerName.trim() || amount <= 0) {
      setFormError("Title, Customer Name, and Amount (> 0) are required.");
      return;
    }
    setFormLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        customer_name: customerName.trim(),
        amount: Number(amount) || 0,
        stage: stage,
        probability: Number(probability) || 25,
        expected_close_date: expectedDate ? new Date(expectedDate).toISOString() : undefined,
        assigned_to_name: assignedTo.trim() || undefined,
        notes: dealNotes.trim() || undefined,
      };

      if (editingDeal) {
        await crmApi.updateDeal(editingDeal.id, payload);
      } else {
        await crmApi.createDeal(payload);
      }
      setIsModalOpen(false);
      loadDeals();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleRunAiWinPredictor = async (deal: CrmDeal) => {
    setAiActiveDeal(deal);
    setIsAiModalOpen(true);
    setAiAnalyzing(true);
    try {
      const res = await crmApi.analyzeDeal(deal.id);
      setAiActiveDeal((prev) =>
        prev
          ? {
              ...prev,
              ai_win_probability: res.ai_win_probability,
              ai_deal_risks: res.ai_deal_risks,
              ai_deal_recommendations: res.ai_deal_recommendations,
            }
          : null
      );
      setDeals((prev) =>
        prev.map((item) =>
          item.id === deal.id
            ? {
                ...item,
                ai_win_probability: res.ai_win_probability,
                ai_deal_risks: res.ai_deal_risks,
                ai_deal_recommendations: res.ai_deal_recommendations,
              }
            : item
        )
      );
    } catch (err) {
      alert("AI Win Predictor Error: " + getErrorMessage(err));
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleDeleteDeal = async (id: string, title: string) => {
    if (!window.confirm(`Delete deal opportunity '${title}'?`)) return;
    try {
      await crmApi.deleteDeal(id);
      loadDeals();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getStageBadge = (stg: string) => {
    switch (stg) {
      case "DISCOVERY":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "PROPOSAL":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "NEGOTIATION":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "CLOSED_WON":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "CLOSED_LOST":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/crm"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>CRM Suite</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs font-medium text-slate-500">Pipeline & Revenue</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Sales Pipeline & Opportunities</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Stage progression, deal forecasting, AI closing recommendations and win probabilities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDeals}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadDeals()}
            placeholder="Search deals by code, title, customer, representative..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Stages</option>
          <option value="DISCOVERY">Discovery (25%)</option>
          <option value="PROPOSAL">Proposal (50%)</option>
          <option value="NEGOTIATION">Negotiation (75%)</option>
          <option value="CLOSED_WON">Closed Won (100%)</option>
          <option value="CLOSED_LOST">Closed Lost (0%)</option>
        </select>
      </div>

      {/* Deals Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Deal Code & Title</th>
                <th className="py-3.5 px-4">Customer Account</th>
                <th className="py-3.5 px-4">Stage</th>
                <th className="py-3.5 px-4">AI Win Prediction</th>
                <th className="py-3.5 px-4">Close Date</th>
                <th className="py-3.5 px-4 text-right">Target Value</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading deals pipeline...
                  </td>
                </tr>
              ) : deals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No deals found matching your criteria.
                  </td>
                </tr>
              ) : (
                deals.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        {d.deal_code}
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{d.title}</div>
                      {d.assigned_to_name && (
                        <div className="text-[11px] text-slate-400">Rep: {d.assigned_to_name}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {d.customer_name}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getStageBadge(
                          d.stage
                        )}`}
                      >
                        {d.stage}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleRunAiWinPredictor(d)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 hover:scale-105 transition-transform cursor-pointer"
                        title="View AI Closing Strategy"
                      >
                        <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>{d.ai_win_probability}% Win Prob</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : "—"}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                      ₹{d.amount.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleRunAiWinPredictor(d)}
                          className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                          title="Run AI Win Predictor"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(d)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Edit Deal"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDeal(d.id, d.title)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Deal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT DEAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <span>{editingDeal ? `Edit Deal: ${editingDeal.deal_code}` : "New Opportunity"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDeal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Metro Extension Genset Contract"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Account *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Southern Infra Projects"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deal Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sales Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => {
                      const newStage = e.target.value;
                      setStage(newStage);
                      if (newStage === "DISCOVERY") setProbability(25);
                      if (newStage === "PROPOSAL") setProbability(50);
                      if (newStage === "NEGOTIATION") setProbability(75);
                      if (newStage === "CLOSED_WON") setProbability(100);
                      if (newStage === "CLOSED_LOST") setProbability(0);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="DISCOVERY">Discovery (25%)</option>
                    <option value="PROPOSAL">Proposal (50%)</option>
                    <option value="NEGOTIATION">Negotiation (75%)</option>
                    <option value="CLOSED_WON">Closed Won (100%)</option>
                    <option value="CLOSED_LOST">Closed Lost (0%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Close Date
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Account Representative
                </label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Strategic Notes
                </label>
                <textarea
                  rows={2}
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  placeholder="Key decision makers, procurement criteria, competitor details..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : editingDeal ? "Save Changes" : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI DEAL PREDICTION INSIGHTS MODAL */}
      {isAiModalOpen && aiActiveDeal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>AI Deal Win Predictor & Risk Engine</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {aiActiveDeal.title}
                  </h3>
                  <div className="text-xs text-slate-500">
                    Client: {aiActiveDeal.customer_name} • Deal Value: ₹{aiActiveDeal.amount.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-extrabold bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span>{aiActiveDeal.ai_win_probability}% Win Prob</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Stage: {aiActiveDeal.stage}</div>
                </div>
              </div>
            </div>

            {aiAnalyzing ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Calculating budget approvals, timeline friction and closing conditions...
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Identified Risk Factors</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {aiActiveDeal.ai_deal_risks || "Standard transaction governance factors."}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>AI Recommended Closing Strategy</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {aiActiveDeal.ai_deal_recommendations || "Conduct executive debrief and finalize agreement terms."}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href="/crm/ai-agent"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Draft Sales Proposal with AI</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 text-xs rounded-xl bg-slate-900 text-white dark:bg-slate-800 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}
