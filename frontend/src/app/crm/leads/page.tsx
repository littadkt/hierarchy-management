"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Bot,
  ArrowUpRight,
  User,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import { crmApi, getErrorMessage } from "@/lib/api";
import { CrmLead } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CrmLeadsPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("WEBSITE");
  const [leadStatus, setLeadStatus] = useState("NEW");
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  // AI Analysis Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiActiveLead, setAiActiveLead] = useState<CrmLead | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await crmApi.listLeads({
        search: search.trim() || undefined,
        status: statusFilter,
        source: sourceFilter,
      });
      setLeads(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, sourceFilter]);

  const openCreateModal = () => {
    setEditingLead(null);
    setFullName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setSource("WEBSITE");
    setLeadStatus("NEW");
    setEstimatedValue(25000);
    setAssignedTo("");
    setNotes("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (l: CrmLead) => {
    setEditingLead(l);
    setFullName(l.full_name);
    setCompanyName(l.company_name || "");
    setEmail(l.email || "");
    setPhone(l.phone);
    setSource(l.source);
    setLeadStatus(l.status);
    setEstimatedValue(l.estimated_value);
    setAssignedTo(l.assigned_to_name || "");
    setNotes(l.notes || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      setFormError("Full Name and Phone number are required.");
      return;
    }
    setFormLoading(true);
    try {
      const payload: any = {
        full_name: fullName.trim(),
        company_name: companyName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim(),
        source: source,
        status: leadStatus,
        estimated_value: Number(estimatedValue) || 0,
        assigned_to_name: assignedTo.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingLead) {
        await crmApi.updateLead(editingLead.id, payload);
      } else {
        await crmApi.createLead(payload);
      }
      setIsModalOpen(false);
      loadLeads();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleRunAiScoring = async (lead: CrmLead) => {
    setAiActiveLead(lead);
    setIsAiModalOpen(true);
    setAiAnalyzing(true);
    try {
      const res = await crmApi.analyzeLead(lead.id);
      setAiActiveLead((prev) =>
        prev
          ? {
              ...prev,
              ai_score: res.ai_score,
              ai_qualification_summary: res.ai_qualification_summary,
              ai_recommended_action: res.ai_recommended_action,
            }
          : null
      );
      // update local list
      setLeads((prev) =>
        prev.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                ai_score: res.ai_score,
                ai_qualification_summary: res.ai_qualification_summary,
                ai_recommended_action: res.ai_recommended_action,
              }
            : item
        )
      );
    } catch (err) {
      alert("AI Scoring Error: " + getErrorMessage(err));
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (!window.confirm(`Delete lead ${name}?`)) return;
    try {
      await crmApi.deleteLead(id);
      loadLeads();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700";
    if (score >= 60) return "bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700";
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
            <span className="text-xs font-medium text-slate-500">Pipeline Generation</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            <span>Leads & Predictive AI Scoring</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Capture prospective clients, run heuristic AI lead qualification and assign sales representatives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadLeads}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Capture New Lead</span>
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
            onKeyDown={(e) => e.key === "Enter" && loadLeads()}
            placeholder="Search leads by code, name, company, email, phone..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="PROPOSAL_SENT">Proposal Sent</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Sources</option>
            <option value="WEBSITE">Website</option>
            <option value="REFERRAL">Referral</option>
            <option value="COLD_CALL">Cold Call</option>
            <option value="EXHIBITION">Exhibition / Expo</option>
            <option value="SOCIAL_MEDIA">Social Media</option>
            <option value="PARTNER">Partner Channel</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Lead Code</th>
                <th className="py-3.5 px-4">Contact & Company</th>
                <th className="py-3.5 px-4">Source & Status</th>
                <th className="py-3.5 px-4">Est. Value (₹)</th>
                <th className="py-3.5 px-4">AI Score</th>
                <th className="py-3.5 px-4">Representative</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    Loading leads database...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-purple-700 dark:text-purple-400">
                      {l.lead_code}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{l.full_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {l.company_name ? `${l.company_name} • ` : ""}
                        {l.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          {l.status}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">
                          {l.source}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      ₹{l.estimated_value.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleRunAiScoring(l)}
                        title="Click to view AI Qualification details"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-transform hover:scale-105 cursor-pointer ${getScoreColor(
                          l.ai_score
                        )}`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{l.ai_score}/100</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      {l.assigned_to_name || <span className="text-slate-400 italic">Unassigned</span>}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleRunAiScoring(l)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/60 text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                          title="Run AI Insights"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(l)}
                          className="p-1.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/60 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                          title="Edit Lead"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(l.id, l.full_name)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete Lead"
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

      {/* CREATE / EDIT LEAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span>{editingLead ? `Edit Lead: ${editingLead.lead_code}` : "Capture New Commercial Lead"}</span>
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

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Malabar Smart Infra"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98471 00000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rajesh@company.in"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lead Source
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="WEBSITE">Website</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="COLD_CALL">Cold Call</option>
                    <option value="EXHIBITION">Exhibition</option>
                    <option value="SOCIAL_MEDIA">Social Media</option>
                    <option value="PARTNER">Partner Channel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="PROPOSAL_SENT">Proposal Sent</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Est. Value (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Sales Representative
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
                  Notes & Inquired Requirements
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Specific product interest, fleet requirements or timeline..."
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
                  className="px-4 py-2 text-xs rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : editingLead ? "Save Changes" : "Register Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI QUALIFICATION INSIGHTS MODAL */}
      {isAiModalOpen && aiActiveLead && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>AI Lead Intelligence Engine</span>
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
                    {aiActiveLead.full_name}
                  </h3>
                  <div className="text-xs text-slate-500">
                    {aiActiveLead.company_name || "Independent"} • Budget: ₹{aiActiveLead.estimated_value.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-sm font-extrabold border ${getScoreColor(
                      aiActiveLead.ai_score
                    )}`}
                  >
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>{aiActiveLead.ai_score}/100</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Calculated Fit</div>
                </div>
              </div>
            </div>

            {aiAnalyzing ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                Evaluating contact verification, budget weight & conversion probability...
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    AI Qualification Summary
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {aiActiveLead.ai_qualification_summary || "Standard inquiry under evaluation."}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Recommended Sales Action
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {aiActiveLead.ai_recommended_action || "Schedule initial qualification call within 24 hours."}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                href="/crm/ai-agent"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Open CRM AI Copilot</span>
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
