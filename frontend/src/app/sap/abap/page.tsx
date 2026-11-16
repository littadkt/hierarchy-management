"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Code2,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Play,
  Terminal,
  FileCode,
  Layers,
  Cpu,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { sapApi, getErrorMessage } from "@/lib/api";
import { SapAbapScript, SapAbapRunResponse } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapAbapPage() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState<SapAbapScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<SapAbapScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  // Run output
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult] = useState<SapAbapRunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scriptName, setScriptName] = useState("");
  const [title, setTitle] = useState("");
  const [moduleTarget, setModuleTarget] = useState("FI");
  const [code, setCode] = useState("");
  const [version, setVersion] = useState("1.0.0");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async (preferredSelectId?: string) => {
    setLoading(true);
    try {
      const data = await sapApi.listAbapScripts({
        module: moduleFilter !== "ALL" ? moduleFilter : undefined,
        search: search.trim() || undefined,
      });
      setScripts(data);
      if (data.length > 0) {
        if (preferredSelectId) {
          const match = data.find((s) => s.id === preferredSelectId);
          setSelectedScript(match || data[0]);
        } else if (!selectedScript || !data.some((s) => s.id === selectedScript.id)) {
          setSelectedScript(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load SAP ABAP scripts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [moduleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExecuteScript = async () => {
    if (!selectedScript) return;
    setRunLoading(true);
    setRunResult(null);
    setRunError(null);
    try {
      const result = await sapApi.runAbapScript(selectedScript.id);
      setRunResult(result);
      // Update execution count locally
      setSelectedScript({
        ...selectedScript,
        execution_count: (selectedScript.execution_count || 0) + 1,
        last_run_at: new Date().toISOString(),
        last_output: result.output_log,
      });
    } catch (err) {
      setRunError(getErrorMessage(err));
    } finally {
      setRunLoading(false);
    }
  };

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptName.trim() || !title.trim() || !code.trim()) {
      setFormError("Please provide Script Name, Title, and ABAP Code");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const newScript = await sapApi.createAbapScript({
        script_name: scriptName.trim().toUpperCase(),
        title: title.trim(),
        module: moduleTarget,
        code: code.trim(),
        author: user?.full_name || "ABAP Developer",
        version: version.trim() || "1.0.0",
        is_active: true,
      });
      setIsModalOpen(false);
      setScriptName("");
      setTitle("");
      setCode("");
      loadData(newScript.id);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  // Metrics
  const totalExecutions = scripts.reduce((acc, s) => acc + (s.execution_count || 0), 0);
  const activeCount = scripts.filter((s) => s.is_active).length;
  const modulesList = Array.from(new Set(scripts.map((s) => s.module).filter(Boolean)));

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
                <span className="text-slate-700 dark:text-slate-200">SAP ABAP</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Code2 className="w-7 h-7" />
                </div>
                SAP ABAP — Programming & Workbench (SE38 / SE80)
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Custom Z-program development, statutory reporting routines, data interfaces, and live execution runtime.
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              New ABAP Program (SE38)
            </button>
          </div>

          {/* Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Scripts */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Z-Programs Catalog
                </span>
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {scripts.length} Programs
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Custom ABAP reports & batch jobs
              </div>
            </div>

            {/* Total Runs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Execution Runtime
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Play className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {totalExecutions} Runs
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Triggered via Direct F8 / Background Task
              </div>
            </div>

            {/* Modules Covered */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Modules Extended
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {modulesList.length} Modules
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                FI, CO, MM, SD, HCM, WM, TAX
              </div>
            </div>

            {/* Active System Status */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ABAP Stack Version
                </span>
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  7.58 Cloud
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Active ABAP sandbox with live execution
              </div>
            </div>
          </div>

          {/* WORKBENCH TWO-COLUMN LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 4 Cols: Program Explorer */}
            <div className="lg:col-span-4 space-y-4">
              {/* Filter */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search program (Z_...)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <select
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="ALL">All Modules</option>
                    <option value="FI">SAP FI</option>
                    <option value="CO">SAP CO</option>
                    <option value="MM">SAP MM</option>
                    <option value="SD">SAP SD</option>
                    <option value="HCM">SAP HCM</option>
                    <option value="WM">SAP WM</option>
                    <option value="PP">SAP PP</option>
                    <option value="TAX">Enterprise TAX</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => loadData()}
                    disabled={loading}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* List of Programs */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[580px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading ABAP programs...
                  </div>
                ) : scripts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No ABAP programs found.
                  </div>
                ) : (
                  scripts.map((s) => {
                    const isSelected = selectedScript?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedScript(s);
                          setRunResult(null);
                          setRunError(null);
                        }}
                        className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 ${
                          isSelected
                            ? "bg-violet-50/80 dark:bg-violet-950/40 border-l-4 border-l-violet-600"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                            {s.script_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {s.module}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 font-medium">
                          {s.title}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>v{s.version} by {s.author}</span>
                          <span>{s.execution_count} runs</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 8 Cols: ABAP Code Editor & Output Console */}
            <div className="lg:col-span-8 space-y-4">
              {selectedScript ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  {/* Editor Header */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                          {selectedScript.script_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                          SAP {selectedScript.module}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          v{selectedScript.version}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {selectedScript.title}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExecuteScript}
                        disabled={runLoading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                      >
                        {runLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Execute Program (F8)
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Code View */}
                  <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-[260px] overflow-y-auto leading-relaxed border-b border-slate-800">
                    <pre>{selectedScript.code}</pre>
                  </div>

                  {/* Live Runtime Output Console */}
                  <div className="p-4 space-y-3 bg-slate-900 text-slate-100 min-h-[220px]">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        ABAP Execution Console & Dataset (ALV Grid)
                      </div>
                      {runResult && (
                        <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Status: {runResult.status}</span>
                          <span>•</span>
                          <span>{runResult.execution_time_ms}ms</span>
                        </div>
                      )}
                    </div>

                    {runLoading ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-mono">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-violet-400" />
                        Compiling and running ABAP bytecode...
                      </div>
                    ) : runError ? (
                      <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-mono">
                        ABAP DUMP / EXECUTION ERROR: {runError}
                      </div>
                    ) : runResult ? (
                      <div className="space-y-4">
                        {/* Output Log */}
                        <div className="text-xs font-mono text-emerald-400 whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {runResult.output_log}
                        </div>

                        {/* ALV Result Dataset */}
                        {runResult.result_dataset && runResult.result_dataset.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full text-left border-collapse text-xs font-mono">
                              <thead>
                                <tr className="bg-slate-800 text-slate-300 uppercase tracking-wider text-[10px]">
                                  {Object.keys(runResult.result_dataset[0]).map((key) => (
                                    <th key={key} className="py-2 px-3">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 bg-slate-950/60">
                                {runResult.result_dataset.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-800/50">
                                    {Object.values(row).map((val: any, valIdx) => (
                                      <td key={valIdx} className="py-2 px-3 text-slate-200">
                                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-500 text-xs font-mono">
                        Click "Execute Program (F8)" above to run this ABAP routine and render ALV grid output.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                  Select a program from the explorer to view ABAP code and execute.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL: CREATE ABAP PROGRAM */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Create ABAP Program (SE38)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Define a custom Z-report or data routine.
              </p>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateScript} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Program Name (e.g., Z_SD_DISCOUNT_CALC)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Z_FI_CUSTOM_TAX_AUDIT"
                      value={scriptName}
                      onChange={(e) => setScriptName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Module
                    </label>
                    <select
                      value={moduleTarget}
                      onChange={(e) => setModuleTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="FI">SAP FI (Financials)</option>
                      <option value="CO">SAP CO (Controlling)</option>
                      <option value="MM">SAP MM (Materials)</option>
                      <option value="SD">SAP SD (Sales & Dist)</option>
                      <option value="HCM">SAP HCM (HR)</option>
                      <option value="PP">SAP PP (Production)</option>
                      <option value="WM">SAP WM (Warehouse)</option>
                      <option value="TAX">Enterprise TAX Hub</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Program Title / Purpose
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Automated GST Tax Audit and Reversal Checker"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ABAP Code Body
                  </label>
                  <textarea
                    rows={7}
                    required
                    placeholder={`REPORT Z_CUSTOM_PROGRAM.
TABLES: BKPF, BSEG.
SELECT * FROM BSEG INTO TABLE @DATA(LT_POSTINGS) WHERE MANDT = '100'.
WRITE: / 'Audit check completed. Records audited:', lines(LT_POSTINGS).`}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-all shadow-sm"
                  >
                    {formLoading ? "Saving..." : "Activate Program"}
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
