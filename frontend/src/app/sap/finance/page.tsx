"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Search,
  RefreshCw,
  ArrowLeft,
  Plus,
  FileText,
  DollarSign,
  TrendingUp,
  Scale,
  BookOpen,
  PieChart,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Download,
  X,
  CreditCard,
  Building,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import {
  SapAccountingVoucher,
  SapBankReconciliation,
  SapTrialBalanceReport,
  SapProfitLossReport,
  SapBalanceSheetReport,
  SapGlAccount,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapFinanceSuitePage() {
  const [activeTab, setActiveTab] = useState<
    | "VOUCHERS"
    | "DAY_BOOK"
    | "CASH_BANK"
    | "BRS"
    | "LEDGER"
    | "TRIAL_BALANCE"
    | "PROFIT_LOSS"
    | "BALANCE_SHEET"
  >("VOUCHERS");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data states
  const [vouchers, setVouchers] = useState<SapAccountingVoucher[]>([]);
  const [brsList, setBrsList] = useState<SapBankReconciliation[]>([]);
  const [glAccounts, setGlAccounts] = useState<SapGlAccount[]>([]);
  const [trialBalance, setTrialBalance] = useState<SapTrialBalanceReport | null>(null);
  const [profitLoss, setProfitLoss] = useState<SapProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<SapBalanceSheetReport | null>(null);

  // Modals
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isBrsModalOpen, setIsBrsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Forms
  const [voucherForm, setVoucherForm] = useState({
    voucher_type: "PAYMENT_VOUCHER",
    debit_ledger: "200100 - Trade Creditors",
    credit_ledger: "100200 - HDFC Commercial Current Account",
    amount: 15000,
    narration: "Vendor payment settlement via NEFT",
    reference_number: "",
    cheque_or_utr_number: "UTR-99128374",
  });

  const [brsForm, setBrsForm] = useState({
    bank_account_ledger: "100200 - HDFC Commercial Current Account",
    period_date: "",
    balance_as_per_company_books: 890000,
    balance_as_per_bank_statement: 890000,
    uncredited_deposits: 0,
    unpresented_cheques: 0,
    bank_charges_not_booked: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "VOUCHERS" || activeTab === "DAY_BOOK") {
        const res = await sapApi.listAccountingVouchers({ search: search.trim() || undefined });
        setVouchers(res.items);
      } else if (activeTab === "CASH_BANK" || activeTab === "LEDGER") {
        const accounts = await sapApi.listGlAccounts();
        setGlAccounts(accounts);
      } else if (activeTab === "BRS") {
        const res = await sapApi.listBankReconciliations({ search: search.trim() || undefined });
        setBrsList(res.items);
      } else if (activeTab === "TRIAL_BALANCE") {
        const res = await sapApi.getTrialBalanceReport();
        setTrialBalance(res);
      } else if (activeTab === "PROFIT_LOSS") {
        const res = await sapApi.getProfitLossReport();
        setProfitLoss(res);
      } else if (activeTab === "BALANCE_SHEET") {
        const res = await sapApi.getBalanceSheetReport();
        setBalanceSheet(res);
      }
    } catch (err) {
      console.error("Failed to load finance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createAccountingVoucher(voucherForm);
      setIsVoucherModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to post accounting voucher"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBrs = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);
    try {
      await sapApi.createBankReconciliation({
        ...brsForm,
        period_date: brsForm.period_date || new Date().toISOString(),
      });
      setIsBrsModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(getErrorMessage(err, "Failed to record bank reconciliation"));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/sap"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  SAP FI Finance Suite
                </span>
                <span className="text-xs text-slate-500 font-mono">Double-Entry Financial Accounting & Statements</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                Finance & Accounting Master
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {activeTab === "VOUCHERS" && (
              <button
                onClick={() => setIsVoucherModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Post Accounting Voucher
              </button>
            )}
            {activeTab === "BRS" && (
              <button
                onClick={() => setIsBrsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                New Bank Reconciliation
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          {[
            { id: "VOUCHERS", label: "Accounting Vouchers", icon: FileText },
            { id: "DAY_BOOK", label: "Day Book Register", icon: BookOpen },
            { id: "CASH_BANK", label: "Cash & Bank Books", icon: CreditCard },
            { id: "BRS", label: "Bank Reconciliation (BRS)", icon: Scale },
            { id: "LEDGER", label: "General Ledger Drill-Down", icon: Building },
            { id: "TRIAL_BALANCE", label: "Trial Balance", icon: Scale },
            { id: "PROFIT_LOSS", label: "Profit & Loss Account", icon: PieChart },
            { id: "BALANCE_SHEET", label: "Balance Sheet", icon: Landmark },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadData()}
              placeholder="Search voucher number, reference, ledger name, or narration..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 cursor-pointer"
          >
            Search
          </button>
        </div>

        {/* TAB 1 & 2: VOUCHERS & DAY BOOK */}
        {(activeTab === "VOUCHERS" || activeTab === "DAY_BOOK") && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Voucher #</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5">Debit Ledger (Dr.)</th>
                      <th className="px-5 py-3.5">Credit Ledger (Cr.)</th>
                      <th className="px-5 py-3.5">Amount</th>
                      <th className="px-5 py-3.5">Narration / Ref</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {vouchers.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {v.voucher_number}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                              v.voucher_type.includes("RECEIPT")
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : v.voucher_type.includes("PAYMENT")
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : v.voucher_type.includes("CONTRA")
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {v.voucher_type.replace("_VOUCHER", "")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{v.debit_ledger}</td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-semibold">{v.credit_ledger}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{v.amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {v.narration}
                          {v.reference_number && (
                            <span className="block font-mono text-[11px] text-slate-400">Ref: {v.reference_number}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                          {new Date(v.voucher_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {vouchers.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          No accounting vouchers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CASH & BANK BOOKS */}
        {activeTab === "CASH_BANK" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">100100 Main Cash Ledger</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    Physical Cash
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ₹{glAccounts.find((a) => a.account_number === "100100")?.balance.toLocaleString() || "145,000"}
                </p>
                <p className="text-xs text-slate-500">Counter petty cash, cash receipt safe deposit</p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">100200 HDFC Commercial Current</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    Bank Account
                  </span>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  ₹{glAccounts.find((a) => a.account_number === "100200")?.balance.toLocaleString() || "890,000"}
                </p>
                <p className="text-xs text-slate-500">NEFT / RTGS settlement, commercial vendor payouts, client direct credits</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BANK RECONCILIATION (BRS) */}
        {activeTab === "BRS" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">BRS Statement #</th>
                      <th className="px-5 py-3.5">Bank Ledger</th>
                      <th className="px-5 py-3.5">Company Book Balance</th>
                      <th className="px-5 py-3.5">Bank Statement Balance</th>
                      <th className="px-5 py-3.5">Reconciled Diff</th>
                      <th className="px-5 py-3.5">Period Date</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {brsList.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                          {b.statement_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">
                          {b.bank_account_ledger}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          ₹{b.balance_as_per_company_books.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          ₹{b.balance_as_per_bank_statement.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">
                          ₹{b.reconciled_difference.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {new Date(b.period_date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {brsList.length === 0 && !loading && (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                          No bank reconciliation statements generated yet. Click "New Bank Reconciliation" above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: GENERAL LEDGER */}
        {activeTab === "LEDGER" && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Account Code</th>
                      <th className="px-5 py-3.5">GL Account Name</th>
                      <th className="px-5 py-3.5">Account Type</th>
                      <th className="px-5 py-3.5 text-right">Closing Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {glAccounts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {a.account_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{a.account_name}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                              a.account_type === "ASSET"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : a.account_type === "LIABILITY"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : a.account_type === "REVENUE"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : a.account_type === "EXPENSE"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                            }`}
                          >
                            {a.account_type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white text-right">
                          ₹{a.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TRIAL BALANCE */}
        {activeTab === "TRIAL_BALANCE" && trialBalance && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Trial Balance Statement</h3>
                <p className="text-xs text-slate-500">Summary of all GL Debit & Credit Postings</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  trialBalance.is_balanced
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                }`}
              >
                {trialBalance.is_balanced ? "✓ BOOKS BALANCED" : "⚠️ VARIANCE DETECTED"}
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Account Code</th>
                      <th className="px-5 py-3.5">Account Description</th>
                      <th className="px-5 py-3.5">Account Type</th>
                      <th className="px-5 py-3.5 text-right">Debit Balance (Dr.)</th>
                      <th className="px-5 py-3.5 text-right">Credit Balance (Cr.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {trialBalance.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{item.account_number}</td>
                        <td className="px-5 py-3.5 text-slate-900 dark:text-white font-semibold">{item.account_name}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{item.account_type}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white text-right">
                          {item.debit_balance > 0 ? `₹${item.debit_balance.toLocaleString()}` : "-"}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white text-right">
                          {item.credit_balance > 0 ? `₹${item.credit_balance.toLocaleString()}` : "-"}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/60 dark:bg-slate-950 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                      <td colSpan={3} className="px-5 py-4 text-slate-900 dark:text-white uppercase tracking-wider">
                        Total Sum
                      </td>
                      <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 text-right">
                        ₹{trialBalance.total_debits.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-emerald-600 dark:text-emerald-400 text-right">
                        ₹{trialBalance.total_credits.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PROFIT & LOSS */}
        {activeTab === "PROFIT_LOSS" && profitLoss && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Total Operating Revenues</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ₹{profitLoss.total_revenue.toLocaleString()}
                </p>
                <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                  <div>Equipment Rentals: ₹{profitLoss.rental_revenue.toLocaleString()}</div>
                  <div>Repairs & Services: ₹{profitLoss.service_revenue.toLocaleString()}</div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Cost of Goods & Operating Expenses</span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  ₹{(profitLoss.cost_of_goods_sold + profitLoss.operating_expenses).toLocaleString()}
                </p>
                <div className="mt-2 text-xs text-slate-400 space-y-0.5">
                  <div>COGS & Spares: ₹{profitLoss.cost_of_goods_sold.toLocaleString()}</div>
                  <div>Operating Overhead: ₹{profitLoss.operating_expenses.toLocaleString()}</div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Net Profit Before Tax</span>
                <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                  ₹{profitLoss.net_profit.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                  Gross Profit Margin: {((profitLoss.gross_profit / (profitLoss.total_revenue || 1)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: BALANCE SHEET */}
        {activeTab === "BALANCE_SHEET" && balanceSheet && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                Assets (Application of Funds)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Current Assets (Cash, Bank, Debtors, ITC)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{balanceSheet.current_assets.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Fixed Assets & Capital Plant</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{balanceSheet.fixed_assets.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-4 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-base text-emerald-600">
                  <span>Total Assets</span>
                  <span>₹{balanceSheet.total_assets.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                Liabilities & Equity (Sources of Funds)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Current Liabilities (Creditors, GST Payable)</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{balanceSheet.current_liabilities.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Long Term Loans & Borrowings</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    ₹{balanceSheet.long_term_liabilities.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-slate-600 dark:text-slate-400">Owner Equity & Retained Net Profit</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400">
                    ₹{balanceSheet.equity_retained_earnings.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-4 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-base text-emerald-600">
                  <span>Total Liabilities & Equity</span>
                  <span>₹{balanceSheet.total_liabilities_and_equity.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: POST VOUCHER */}
        {isVoucherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Post Financial Accounting Voucher</h3>
                <button
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateVoucher} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Voucher Type *</label>
                  <select
                    value={voucherForm.voucher_type}
                    onChange={(e) => setVoucherForm({ ...voucherForm, voucher_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  >
                    <option value="PAYMENT_VOUCHER">Payment Voucher (Cash/Bank Outflow)</option>
                    <option value="RECEIPT_VOUCHER">Receipt Voucher (Customer Inflow)</option>
                    <option value="CONTRA_VOUCHER">Contra Voucher (Cash to Bank / Bank to Cash)</option>
                    <option value="JOURNAL_VOUCHER">Journal Voucher (Adjustments / Depreciation)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Debit Ledger (Dr.) *</label>
                    <input
                      type="text"
                      required
                      value={voucherForm.debit_ledger}
                      onChange={(e) => setVoucherForm({ ...voucherForm, debit_ledger: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Credit Ledger (Cr.) *</label>
                    <input
                      type="text"
                      required
                      value={voucherForm.credit_ledger}
                      onChange={(e) => setVoucherForm({ ...voucherForm, credit_ledger: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={voucherForm.amount}
                      onChange={(e) => setVoucherForm({ ...voucherForm, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Cheque / UTR #</label>
                    <input
                      type="text"
                      value={voucherForm.cheque_or_utr_number}
                      onChange={(e) => setVoucherForm({ ...voucherForm, cheque_or_utr_number: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Narration *</label>
                  <textarea
                    rows={2}
                    required
                    value={voucherForm.narration}
                    onChange={(e) => setVoucherForm({ ...voucherForm, narration: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsVoucherModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Posting..." : "Post Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BRS */}
        {isBrsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Bank Reconciliation Statement (BRS)</h3>
                <button
                  onClick={() => setIsBrsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateBrs} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Bank Account Ledger</label>
                  <input
                    type="text"
                    required
                    value={brsForm.bank_account_ledger}
                    onChange={(e) => setBrsForm({ ...brsForm, bank_account_ledger: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Balance as per Company Books</label>
                    <input
                      type="number"
                      required
                      value={brsForm.balance_as_per_company_books}
                      onChange={(e) => setBrsForm({ ...brsForm, balance_as_per_company_books: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Balance as per Bank Statement</label>
                    <input
                      type="number"
                      required
                      value={brsForm.balance_as_per_bank_statement}
                      onChange={(e) => setBrsForm({ ...brsForm, balance_as_per_bank_statement: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-emerald-600 mt-1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsBrsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                  >
                    {actionLoading ? "Reconciling..." : "Save BRS Statement"}
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
