"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Layers,
  Percent,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapGlAccount, SapJournalEntry } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapFiPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"gl" | "jv">("gl");
  const [glAccounts, setGlAccounts] = useState<SapGlAccount[]>([]);
  const [journalEntries, setJournalEntries] = useState<SapJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Create GL Modal
  const [isGlModalOpen, setIsGlModalOpen] = useState(false);
  const [accNumber, setAccNumber] = useState("");
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("ASSET");
  const [accBalance, setAccBalance] = useState(0);

  // Create JV Modal
  const [isJvModalOpen, setIsJvModalOpen] = useState(false);
  const [jvRef, setJvRef] = useState("");
  const [jvDebit, setJvDebit] = useState("");
  const [jvCredit, setJvCredit] = useState("");
  const [jvAmount, setJvAmount] = useState(0);
  const [jvNarration, setJvNarration] = useState("");
  const [jvTaxAmount, setJvTaxAmount] = useState(0);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [glData, jvData] = await Promise.all([
        sapApi.listGlAccounts({
          account_type: typeFilter !== "ALL" ? typeFilter : undefined,
          search: search.trim() || undefined,
        }),
        sapApi.listJournalEntries({ search: search.trim() || undefined }),
      ]);
      setGlAccounts(glData);
      setJournalEntries(jvData);
    } catch (err) {
      console.error("Failed to load SAP FI data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateGl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accNumber.trim() || !accName.trim()) {
      setFormError("Please provide Account Number and Name");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createGlAccount({
        account_number: accNumber.trim(),
        account_name: accName.trim(),
        account_type: accType,
        balance: Number(accBalance) || 0,
        currency: "INR",
        is_active: true,
      });
      setIsGlModalOpen(false);
      setAccNumber("");
      setAccName("");
      setAccBalance(0);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateJv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jvRef.trim() || !jvDebit.trim() || !jvCredit.trim() || !jvAmount) {
      setFormError("Please fill in reference, debit account, credit account and amount");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await sapApi.createJournalEntry({
        reference: jvRef.trim(),
        debit_account: jvDebit.trim(),
        credit_account: jvCredit.trim(),
        amount: Number(jvAmount),
        tax_amount: Number(jvTaxAmount) || 0,
        narration: jvNarration.trim() || "Manual posting",
        currency: "INR",
        status: "POSTED",
      });
      setIsJvModalOpen(false);
      setJvRef("");
      setJvDebit("");
      setJvCredit("");
      setJvAmount(0);
      setJvNarration("");
      setJvTaxAmount(0);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const totalAssets = glAccounts
    .filter((a) => a.account_type === "ASSET")
    .reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = glAccounts
    .filter((a) => a.account_type === "LIABILITY")
    .reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = glAccounts
    .filter((a) => a.account_type === "REVENUE")
    .reduce((sum, a) => sum + a.balance, 0);
  const totalExpense = glAccounts
    .filter((a) => a.account_type === "EXPENSE")
    .reduce((sum, a) => sum + a.balance, 0);

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
              <span className="text-xs font-medium text-slate-500">Financial Accounting (SAP FI)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              <span>SAP FI — General Ledger & Financial Accounting</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Chart of accounts, double-entry journal vouchers, balance sheet ledgers, and audit-ready fiscal reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/sap/tax"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              <Percent className="w-4 h-4 text-emerald-600" />
              <span>Tax Configuration</span>
            </Link>
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
                setIsGlModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New GL Account</span>
            </button>
            <button
              onClick={() => {
                setFormError(null);
                setIsJvModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post Journal Voucher</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid - Exact Hierarchy 5-Column Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Total Asset Ledger
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                ₹{totalAssets.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Total Liabilities
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                ₹{totalLiabilities.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Recognized Revenue
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ₹{totalRevenue.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">
                Total Operating Expenses
              </p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ₹{totalExpense.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("gl")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "gl"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Chart of Accounts ({glAccounts.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("jv")}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "jv"
                  ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Journal Entries ({journalEntries.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account name, number, reference..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </form>

            {activeTab === "gl" && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Account Types</option>
                <option value="ASSET">Assets</option>
                <option value="LIABILITY">Liabilities</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
            )}
          </div>
        </div>

        {/* Content Table Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          {activeTab === "gl" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Account #</th>
                    <th className="px-5 py-3.5">Account Name</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Currency</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {glAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No general ledger accounts matching your filter.
                      </td>
                    </tr>
                  ) : (
                    glAccounts.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {a.account_number}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          {a.account_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              a.account_type === "ASSET"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                                : a.account_type === "LIABILITY"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                                : a.account_type === "REVENUE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {a.account_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono">{a.currency}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{a.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Voucher #</th>
                    <th className="px-5 py-3.5">Posting Date</th>
                    <th className="px-5 py-3.5">Reference / Doc</th>
                    <th className="px-5 py-3.5">Debit (Dr)</th>
                    <th className="px-5 py-3.5">Credit (Cr)</th>
                    <th className="px-5 py-3.5">Narration</th>
                    <th className="px-5 py-3.5 text-right">Tax Impact</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        No journal entries posted yet. Click "Post Journal Voucher" to record one.
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map((jv) => (
                      <tr
                        key={jv.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {jv.entry_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(jv.posting_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                          {jv.reference}
                        </td>
                        <td className="px-5 py-3.5 text-blue-700 dark:text-blue-300 font-semibold">
                          {jv.debit_account}
                        </td>
                        <td className="px-5 py-3.5 text-amber-700 dark:text-amber-300 font-semibold">
                          {jv.credit_account}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 truncate max-w-xs">
                          {jv.narration}
                        </td>
                        <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">
                          {jv.tax_amount > 0 ? `₹${jv.tax_amount.toLocaleString()}` : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{jv.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Create GL Account */}
        {isGlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  <span>Create GL Account</span>
                </h3>
                <button
                  onClick={() => setIsGlModalOpen(false)}
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

              <form onSubmit={handleCreateGl} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    required
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    placeholder="e.g. 100300"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="e.g. Petty Cash Kochi Branch"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Account Type
                  </label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="ASSET">Asset</option>
                    <option value="LIABILITY">Liability</option>
                    <option value="EQUITY">Equity</option>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Initial Balance (INR)
                  </label>
                  <input
                    type="number"
                    value={accBalance}
                    onChange={(e) => setAccBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsGlModalOpen(false)}
                    className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Post Journal Voucher */}
        {isJvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <span>Post Double-Entry Journal Voucher (JV)</span>
                </h3>
                <button
                  onClick={() => setIsJvModalOpen(false)}
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

              <form onSubmit={handleCreateJv} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Reference / Invoice #
                    </label>
                    <input
                      type="text"
                      required
                      value={jvRef}
                      onChange={(e) => setJvRef(e.target.value)}
                      placeholder="e.g. INV-2026-0044"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Posting Amount (INR)
                    </label>
                    <input
                      type="number"
                      required
                      value={jvAmount}
                      onChange={(e) => setJvAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Debit Account (Dr)
                    </label>
                    <input
                      type="text"
                      required
                      value={jvDebit}
                      onChange={(e) => setJvDebit(e.target.value)}
                      placeholder="e.g. 500100 Workshop Expense"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Credit Account (Cr)
                    </label>
                    <input
                      type="text"
                      required
                      value={jvCredit}
                      onChange={(e) => setJvCredit(e.target.value)}
                      placeholder="e.g. 100200 Bank Current Acc"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tax Amount (GST / TDS Impact if applicable)
                  </label>
                  <input
                    type="number"
                    value={jvTaxAmount}
                    onChange={(e) => setJvTaxAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Narration / Purpose
                  </label>
                  <textarea
                    rows={2}
                    value={jvNarration}
                    onChange={(e) => setJvNarration(e.target.value)}
                    placeholder="Describe transaction details..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsJvModalOpen(false)}
                    className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {formLoading ? "Posting..." : "Post Voucher"}
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
