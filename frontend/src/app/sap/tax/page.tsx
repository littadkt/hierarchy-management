"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Percent,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Receipt,
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  Building,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapTaxRate, SapTaxLedger, SapTaxSummary } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapTaxPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"summary" | "slabs" | "ledger">("summary");
  const [taxRates, setTaxRates] = useState<SapTaxRate[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<SapTaxLedger[]>([]);
  const [taxSummary, setTaxSummary] = useState<SapTaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState("ALL");

  // Modal State: Create Tax Rate
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [taxCode, setTaxCode] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxType, setTaxType] = useState("GST");
  const [ratePct, setRatePct] = useState<number>(18);
  const [description, setDescription] = useState("");

  // Modal State: Post Tax Ledger
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [txnNumber, setTxnNumber] = useState("");
  const [sourceModule, setSourceModule] = useState("SD");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [hsnSac, setHsnSac] = useState("");
  const [taxableAmount, setTaxableAmount] = useState<number>(0);
  const [selectedTaxCode, setSelectedTaxCode] = useState("GST_18");
  const [entryType, setEntryType] = useState<"OUTPUT_TAX" | "INPUT_TAX_CREDIT" | "TDS_DEDUCTED">("OUTPUT_TAX");
  const [partyName, setPartyName] = useState("");
  const [partyGstin, setPartyGstin] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ratesData, ledgersData, summaryData] = await Promise.all([
        sapApi.listTaxRates({ search: search.trim() || undefined }),
        sapApi.listTaxLedgers({
          entry_type: entryTypeFilter !== "ALL" ? entryTypeFilter : undefined,
          search: search.trim() || undefined,
        }),
        sapApi.getTaxSummary(),
      ]);
      setTaxRates(ratesData);
      setTaxLedgers(ledgersData);
      setTaxSummary(summaryData);
    } catch (err) {
      console.error("Failed to load SAP Tax data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [entryTypeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreateTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxCode.trim() || !taxName.trim()) {
      setFormError("Please enter Tax Code and Name");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const rate = Number(ratePct) || 0;
      const cgst = taxType === "GST" ? rate / 2 : 0;
      const sgst = taxType === "GST" ? rate / 2 : 0;
      const igst = taxType === "IGST" ? rate : 0;

      await sapApi.createTaxRate({
        tax_code: taxCode.trim().toUpperCase(),
        tax_name: taxName.trim(),
        tax_type: taxType,
        rate_percentage: rate,
        cgst_rate: cgst,
        sgst_rate: sgst,
        igst_rate: igst,
        description: description.trim() || undefined,
        is_active: true,
      });
      setIsRateModalOpen(false);
      setTaxCode("");
      setTaxName("");
      setDescription("");
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateTaxLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim() || taxableAmount <= 0) {
      setFormError("Please enter valid Party Name and Taxable Amount");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      // Find matching tax rate
      const matchedRate = taxRates.find((r) => r.tax_code === selectedTaxCode);
      const ratePctVal = matchedRate ? matchedRate.rate_percentage : 18;
      const calculatedTax = (taxableAmount * ratePctVal) / 100;
      const cgstVal = matchedRate?.tax_type === "GST" ? calculatedTax / 2 : 0;
      const sgstVal = matchedRate?.tax_type === "GST" ? calculatedTax / 2 : 0;
      const igstVal = matchedRate?.tax_type === "IGST" ? calculatedTax : 0;

      await sapApi.createTaxLedger({
        transaction_number: txnNumber.trim() || `TX-${Date.now().toString().slice(-6)}`,
        source_module: sourceModule,
        invoice_reference: invoiceRef.trim() || `INV-${Date.now().toString().slice(-5)}`,
        hsn_sac_code: hsnSac.trim() || "998311",
        taxable_amount: Number(taxableAmount),
        tax_rate_pct: ratePctVal,
        cgst_amount: cgstVal,
        sgst_amount: sgstVal,
        igst_amount: igstVal,
        total_tax: calculatedTax,
        entry_type: entryType,
        party_name: partyName.trim(),
        party_gstin: partyGstin.trim() || undefined,
        posting_date: new Date().toISOString(),
      });
      setIsLedgerModalOpen(false);
      setTxnNumber("");
      setInvoiceRef("");
      setPartyName("");
      setPartyGstin("");
      setTaxableAmount(0);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 text-slate-800 dark:text-slate-100">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top Bar / Breadcrumb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                <Link
                  href="/sap"
                  className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> SAP Hub
                </Link>
                <span>/</span>
                <span className="text-slate-700 dark:text-slate-200">Tax Option & Slabs</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Percent className="w-7 h-7" />
                </div>
                Enterprise Tax Hub & GST Slabs
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                GST/VAT multi-slab management, ITC (Input Tax Credit) ledgers, and automated tax accounting across SAP modules.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsRateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                Add Tax Slab
              </button>
              <button
                onClick={() => setIsLedgerModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
              >
                <Receipt className="w-4 h-4" />
                Post Tax Ledger
              </button>
            </div>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Tax Payable */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Net Tax Payable
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  ₹{(taxSummary?.net_tax_payable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Output Tax − Input Tax Credit (ITC)</span>
              </div>
            </div>

            {/* Total Output Tax */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Output Tax Liability
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  ₹{(taxSummary?.total_output_tax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                GST collected on Sales, Rentals & Services
              </div>
            </div>

            {/* Total ITC */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Input Tax Credit (ITC)
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ₹{(taxSummary?.total_input_credit ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Eligible GST credit on MM procurement
              </div>
            </div>

            {/* Configured Slabs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Configured Slabs
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {taxRates.length} Slabs
                </span>
              </div>
              <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                Standard GST 0%, 5%, 12%, 18%, 28% + TDS
              </div>
            </div>
          </div>

          {/* Segmented Tabs & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "summary"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tax Breakdown Summary
              </button>
              <button
                onClick={() => setActiveTab("slabs")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "slabs"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tax Slabs ({taxRates.length})
              </button>
              <button
                onClick={() => setActiveTab("ledger")}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === "ledger"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tax Ledgers ({taxLedgers.length})
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, party, GSTIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {activeTab === "ledger" && (
                <select
                  value={entryTypeFilter}
                  onChange={(e) => setEntryTypeFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">All Entries</option>
                  <option value="OUTPUT_TAX">Output Tax</option>
                  <option value="INPUT_TAX_CREDIT">Input Tax Credit (ITC)</option>
                  <option value="TDS_DEDUCTED">TDS Deducted</option>
                </select>
              )}

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </form>
          </div>

          {/* TAB 1: BREAKDOWN SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Rate-wise tax breakdown */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    GST Slab Breakdown Liability
                  </h3>
                  {taxSummary?.tax_breakdown_by_rate &&
                  Object.keys(taxSummary.tax_breakdown_by_rate).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(taxSummary.tax_breakdown_by_rate).map(([slab, amount]) => {
                        const total = taxSummary.total_output_tax || 1;
                        const pct = Math.min(100, Math.round((amount / total) * 100));
                        return (
                          <div key={slab} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>GST Slab {slab}%</span>
                              <span>₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No tax breakdown records posted yet.
                    </div>
                  )}
                </div>

                {/* Tax Compliance Info */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-600" />
                      Statutory GST Compliance
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                      All sales, services, rentals, and purchase requisitions in this SAP instance
                      automatically calculate CGST, SGST, or IGST based on place of supply and HSN/SAC codes.
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">HSN / SAC Master</span>
                        <span className="font-semibold text-slate-900 dark:text-white">Active (Auto Lookup)</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">GSTR-1 Sales Report</span>
                        <span className="text-emerald-600 font-semibold">Ready for E-Filing</span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">GSTR-2B ITC Reconciliation</span>
                        <span className="text-blue-600 font-semibold">Matched (100%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Corporate GSTIN: 29AABCL8291M1Z5</span>
                    <button
                      onClick={() => setActiveTab("ledger")}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      View All Postings →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAX SLABS */}
          {activeTab === "slabs" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Tax Code</th>
                      <th className="py-3 px-4">Tax Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Total Rate</th>
                      <th className="py-3 px-4 text-right">CGST %</th>
                      <th className="py-3 px-4 text-right">SGST %</th>
                      <th className="py-3 px-4 text-right">IGST %</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading tax slabs...
                        </td>
                      </tr>
                    ) : taxRates.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No tax slabs found.
                        </td>
                      </tr>
                    ) : (
                      taxRates.map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {rate.tax_code}
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                            {rate.tax_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {rate.tax_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {rate.rate_percentage}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                            {rate.cgst_rate}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                            {rate.sgst_rate}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">
                            {rate.igst_rate}%
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                            {rate.description || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TAX LEDGERS */}
          {activeTab === "ledger" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Txn #</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Module / Ref</th>
                      <th className="py-3 px-4">Party & GSTIN</th>
                      <th className="py-3 px-4">HSN/SAC</th>
                      <th className="py-3 px-4 text-right">Taxable Amt</th>
                      <th className="py-3 px-4 text-right">Rate</th>
                      <th className="py-3 px-4 text-right">CGST + SGST</th>
                      <th className="py-3 px-4 text-right">Total Tax</th>
                      <th className="py-3 px-4">Posting Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading tax ledgers...
                        </td>
                      </tr>
                    ) : taxLedgers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No tax ledger postings found.
                        </td>
                      </tr>
                    ) : (
                      taxLedgers.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {entry.transaction_number}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                entry.entry_type === "OUTPUT_TAX"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                  : entry.entry_type === "INPUT_TAX_CREDIT"
                                  ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                                  : "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300"
                              }`}
                            >
                              {entry.entry_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {entry.source_module}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {entry.invoice_reference}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {entry.party_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {entry.party_gstin || "—"}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {entry.hsn_sac_code}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-800 dark:text-slate-200">
                            ₹{entry.taxable_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-700 dark:text-slate-300">
                            {entry.tax_rate_pct}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 font-mono">
                            ₹{(entry.cgst_amount + entry.sgst_amount).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{entry.total_tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(entry.posting_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL 1: ADD TAX SLAB */}
        {isRateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsRateModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Configure New Tax Slab
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Define statutory tax code for automated GST/VAT billing.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTaxRate} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tax Code (e.g., GST_18, TDS_194C)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="GST_18"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tax Name / Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Standard GST 18% (9% CGST + 9% SGST)"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tax Type
                    </label>
                    <select
                      value={taxType}
                      onChange={(e) => setTaxType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="GST">GST (Intra-state)</option>
                      <option value="IGST">IGST (Inter-state)</option>
                      <option value="VAT">VAT</option>
                      <option value="TDS">TDS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Rate Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={ratePct}
                      onChange={(e) => setRatePct(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Reference Slabs
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Applicable to electrical spare parts and repairs"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Saving..." : "Save Slab"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: POST TAX LEDGER */}
        {isLedgerModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Post Statutory Tax Entry
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Record an Output Tax invoice liability or Input Tax Credit (ITC) voucher.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTaxLedger} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Entry Type
                    </label>
                    <select
                      value={entryType}
                      onChange={(e: any) => setEntryType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="OUTPUT_TAX">Output Tax (Sales/Rental)</option>
                      <option value="INPUT_TAX_CREDIT">Input Tax Credit (ITC)</option>
                      <option value="TDS_DEDUCTED">TDS Deducted</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Source Module
                    </label>
                    <select
                      value={sourceModule}
                      onChange={(e) => setSourceModule(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="SD">SAP SD (Sales & Dist)</option>
                      <option value="MM">SAP MM (Materials)</option>
                      <option value="RENTAL">Equipment Rentals</option>
                      <option value="SERVICES">Product Services</option>
                      <option value="FI">SAP FI (Financials)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Invoice Reference
                    </label>
                    <input
                      type="text"
                      placeholder="INV-2026-009"
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      placeholder="998311"
                      value={hsnSac}
                      onChange={(e) => setHsnSac(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Party Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Client or Vendor Name"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Party GSTIN
                    </label>
                    <input
                      type="text"
                      placeholder="29ABCDE1234F1Z5"
                      value={partyGstin}
                      onChange={(e) => setPartyGstin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Taxable Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      placeholder="50000"
                      value={taxableAmount || ""}
                      onChange={(e) => setTaxableAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tax Rate Slab
                    </label>
                    <select
                      value={selectedTaxCode}
                      onChange={(e) => setSelectedTaxCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {taxRates.map((rate) => (
                        <option key={rate.id} value={rate.tax_code}>
                          {rate.tax_code} ({rate.rate_percentage}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLedgerModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Posting..." : "Post Tax Entry"}
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
