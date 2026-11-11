"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Wrench,
  User as UserIcon,
  Phone,
  Mail,
  MapPin,
  Barcode,
  Tag,
  Cpu,
  Shield,
  FileText,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  Printer,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { warrantyApi, getErrorMessage } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
import {
  WarrantyJob,
  WarrantySerialHistory,
  WarrantyStatus,
} from "@/lib/types";

interface WarrantyJobDetailModalProps {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: () => void;
  onEditJob?: (job: WarrantyJob) => void;
  onJobDeleted?: () => void;
}

export const WarrantyJobDetailModal: React.FC<WarrantyJobDetailModalProps> = ({
  jobId,
  isOpen,
  onClose,
  onJobUpdated,
  onEditJob,
  onJobDeleted,
}) => {
  const { confirm, alert } = useConfirm();
  const [job, setJob] = useState<WarrantyJob | null>(null);
  const [serialHistory, setSerialHistory] = useState<WarrantySerialHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [showStatusNoteInput, setShowStatusNoteInput] = useState(false);
  const [targetStatus, setTargetStatus] = useState<WarrantyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchJob = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await warrantyApi.getJob(jobId);
      setJob(data);
      if (data.serial_number) {
        const hist = await warrantyApi.getSerialHistory(data.serial_number);
        setSerialHistory(hist);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && jobId) {
      fetchJob();
    } else {
      setJob(null);
      setSerialHistory(null);
      setShowStatusNoteInput(false);
    }
  }, [isOpen, jobId]);

  const handleQuickStatusChange = async (newStatus: WarrantyStatus) => {
    if (!job) return;
    setTargetStatus(newStatus);
    setShowStatusNoteInput(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!job || !targetStatus) return;
    setStatusUpdating(true);
    try {
      const updated = await warrantyApi.updateStatus(
        job.id,
        targetStatus,
        statusNotes.trim() || undefined
      );
      setJob(updated);
      setShowStatusNoteInput(false);
      setStatusNotes("");
      setTargetStatus(null);
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      await alert({
        title: "Status Update Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    const ok = await confirm({
      title: "Delete Warranty Job",
      message: `Are you sure you want to delete Warranty Job #${job.job_number}? This cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
    });
    if (!ok) return;

    try {
      await warrantyApi.deleteJob(job.id);
      onClose();
      if (onJobDeleted) onJobDeleted();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !jobId) return null;

  const getStatusBadge = (st: WarrantyStatus) => {
    switch (st) {
      case "RECEIVED":
        return {
          label: "Received",
          bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        };
      case "SEND_TO_COMPANY":
        return {
          label: "Send to Company",
          bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800",
        };
      case "WARRANTY_COMPLETED":
        return {
          label: "Warranty Completed",
          bg: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800",
        };
      case "REJECTED":
        return {
          label: "Rejected",
          bg: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800",
        };
      case "DELIVERED":
        return {
          label: "Delivered",
          bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Warranty Job #{job?.job_number || "..."}
                </h2>
                {job && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      getStatusBadge(job.status).bg
                    }`}
                  >
                    {getStatusBadge(job.status).label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Detailed warranty service record, customer profile, and serial history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Print Warranty Slip"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            {job && onEditJob && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditJob(job);
                }}
                title="Edit Warranty Job"
                className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Loading warranty job details...</span>
            </div>
          ) : error || !job ? (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl">
              {error || "Job not found"}
            </div>
          ) : (
            <>
              {/* Quick Status Update Bar */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Update Job Status:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(
                      [
                        { id: "RECEIVED", label: "Received" },
                        { id: "SEND_TO_COMPANY", label: "Send to Company" },
                        { id: "WARRANTY_COMPLETED", label: "Completed" },
                        { id: "REJECTED", label: "Rejected" },
                        { id: "DELIVERED", label: "Delivered" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleQuickStatusChange(st.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          job.status === st.id
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {showStatusNoteInput && targetStatus && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-in fade-in">
                    <input
                      type="text"
                      placeholder={`Add note for changing status to "${targetStatus.replace(/_/g, " ")}" (optional)`}
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmStatusChange}
                      disabled={statusUpdating}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {statusUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStatusNoteInput(false)}
                      className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Grid: Customer Details & Service Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Details Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                    <UserIcon className="w-4 h-4" />
                    <span>Customer Information</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Customer Name
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {job.customer_name}
                      </span>
                    </div>
                    {job.customer_phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.customer_phone}</span>
                      </div>
                    )}
                    {job.customer_email && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.customer_email}</span>
                      </div>
                    )}
                    {job.customer_address && (
                      <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{job.customer_address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product & Service Details Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                    <Barcode className="w-4 h-4" />
                    <span>Product & Service</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Product
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {job.product_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Serial Number
                      </span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {job.serial_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Brand / Model
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {job.brand_name || "—"} {job.model_name ? `/ ${job.model_name}` : ""}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Service Type
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {job.service_type_name || "Standard Warranty"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Assigned Staff
                      </span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {job.staff_name || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Received Date
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {new Date(job.received_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Description & Notes */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Work Description / Issue Reported</span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {job.work_description}
                </p>

                {job.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                      Internal Notes & Logs
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono text-[11px] bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      {job.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* PRODUCT SERIAL NUMBER COMPLETE HISTORY TIMELINE */}
              {serialHistory && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        Complete Product Service History (Serial #{job.serial_number})
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {serialHistory.total_services} service {serialHistory.total_services === 1 ? "time" : "times"}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    All jobs recorded for this serial number across previous and current customer ownerships:
                  </p>

                  <div className="space-y-2">
                    {serialHistory.jobs.map((histJob) => {
                      const isCurrent = histJob.id === job.id;
                      return (
                        <div
                          key={histJob.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isCurrent
                              ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-2xs"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  #{histJob.job_number}
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Customer: {histJob.customer_name}
                                </span>
                                {histJob.customer_phone && (
                                  <span className="text-slate-400 text-[11px]">
                                    ({histJob.customer_phone})
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-600 text-white">
                                    Current Job
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                                <strong>Issue / Work:</strong> {histJob.work_description}
                              </p>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                <span>
                                  Received: {new Date(histJob.received_date).toLocaleDateString()}
                                </span>
                                {histJob.completed_date && (
                                  <span>
                                    • Completed: {new Date(histJob.completed_date).toLocaleDateString()}
                                  </span>
                                )}
                                {histJob.delivered_date && (
                                  <span>
                                    • Delivered: {new Date(histJob.delivered_date).toLocaleDateString()}
                                  </span>
                                )}
                                {histJob.staff_name && <span>• Tech: {histJob.staff_name}</span>}
                              </div>
                            </div>

                            <div className="shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  getStatusBadge(histJob.status).bg
                                }`}
                              >
                                {getStatusBadge(histJob.status).label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {job && (
          <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Job</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-300 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
