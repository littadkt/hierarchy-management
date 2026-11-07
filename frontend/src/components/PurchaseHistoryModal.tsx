"use client";

import React, { useEffect, useState } from "react";
import { X, History, Clock, ArrowRight, User as UserIcon, AlertCircle } from "lucide-react";
import { purchaseApi, getErrorMessage } from "@/lib/api";
import { PurchaseRequest, PurchaseRequestHistory } from "@/lib/types";
import { PurchaseStatusBadge } from "./PurchaseStatusBadge";
import { RoleBadge } from "./RoleBadge";

interface PurchaseHistoryModalProps {
  request: PurchaseRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseHistoryModal: React.FC<PurchaseHistoryModalProps> = ({
  request,
  isOpen,
  onClose,
}) => {
  const [history, setHistory] = useState<PurchaseRequestHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && request) {
      setLoading(true);
      setError(null);
      purchaseApi
        .getHistory(request.id)
        .then((data) => setHistory(data))
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false));
    }
  }, [isOpen, request]);

  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                Purchase Request Audit History
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {request.name} (Code: {request.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Request Overview Summary */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-slate-500">Requested by: </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {request.requested_by?.full_name || "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Current Status: </span>
            <PurchaseStatusBadge status={request.status} />
          </div>
        </div>

        {/* Content / Timeline */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading audit history...</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No status change entries found.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {history.map((entry) => (
                <div key={entry.id} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />

                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-2xs space-y-2">
                    {/* Header: Date + User */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {entry.changed_by?.full_name || "System"}
                        </span>
                        {entry.changed_by?.role && (
                          <RoleBadge role={entry.changed_by.role} />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Status change representation */}
                    <div className="flex items-center gap-2 pt-1">
                      {entry.old_status ? (
                        <>
                          <PurchaseStatusBadge status={entry.old_status} />
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <PurchaseStatusBadge status={entry.new_status} />
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-semibold">Initial Status:</span>
                          <PurchaseStatusBadge status={entry.new_status} />
                        </div>
                      )}
                    </div>

                    {/* Remarks */}
                    {entry.remarks && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-500 block text-[10px] uppercase">
                          Remarks / Details:
                        </span>
                        <p className="mt-0.5">{entry.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

