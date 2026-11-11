"use client";

import React, { useEffect, useState } from "react";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Shield,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Building,
  User as UserIcon,
  Barcode,
  History,
  Eye,
  Edit,
  Trash2,
  Sparkles,
  ArrowRight,
  Loader2,
  Tag,
  AlertCircle,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { warrantyApi, getErrorMessage } from "@/lib/api";
import {
  WarrantyBrand,
  WarrantyJob,
  WarrantyStaff,
  WarrantyStatus,
} from "@/lib/types";
import { RegisterWarrantyJobModal } from "@/components/RegisterWarrantyJobModal";
import { WarrantyJobDetailModal } from "@/components/WarrantyJobDetailModal";

export default function WarrantyPage() {
  const { user, hasPermission } = useAuth();
  const { confirm, alert } = useConfirm();

  const [jobs, setJobs] = useState<WarrantyJob[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarrantyStatus | "">("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [staffFilter, setStaffFilter] = useState<string>("");

  // Lookups for filters
  const [brands, setBrands] = useState<WarrantyBrand[]>([]);
  const [staffList, setStaffList] = useState<WarrantyStaff[]>([]);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobToEdit, setJobToEdit] = useState<WarrantyJob | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (brandFilter) params.brand_id = brandFilter;
      if (staffFilter) params.staff_id = staffFilter;

      const [jobsData, brandsData, staffData] = await Promise.all([
        warrantyApi.listJobs(params),
        warrantyApi.getBrands(),
        warrantyApi.getStaff(),
      ]);

      setJobs(jobsData.items);
      setTotal(jobsData.total);
      setStatusCounts(jobsData.status_counts);
      setBrands(brandsData);
      setStaffList(staffData);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, statusFilter, brandFilter, staffFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  useRealtimeEvent(
    [
      "WARRANTY_JOB_CREATED",
      "WARRANTY_JOB_UPDATED",
      "WARRANTY_JOB_DELETED",
      "RESYNC",
    ],
    () => {
      loadData(true);
    }
  );

  const handleDeleteJob = async (job: WarrantyJob, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Delete Warranty Job",
      message: `Are you sure you want to delete Warranty Job #${job.job_number} for customer "${job.customer_name}"?`,
      confirmText: "Delete Job",
      type: "danger",
    });
    if (!ok) return;

    try {
      await warrantyApi.deleteJob(job.id);
      loadData(true);
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

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
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800/80">
          <div className="relative z-[1] space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-md text-xs font-medium text-white/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Service & RMA Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Wrench className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-300 shrink-0" />
              <span>Warranty Management</span>
            </h1>
            <p className="text-sm text-indigo-100/90 dark:text-slate-300 leading-relaxed">
              Register customer warranty jobs, manage service types & technicians, track product serial number
              repair history, and monitor progress across all 5 warranty stages.
            </p>
            {hasPermission("warranty", "add") && (
              <div className="pt-2 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setJobToEdit(null);
                    setIsRegisterOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register New Warranty Job</span>
                </button>
              </div>
            )}
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Received */}
          <div
            onClick={() => setStatusFilter("RECEIVED")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === "RECEIVED"
                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600/80 ring-2 ring-amber-400/20"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-800/60"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Received</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {statusCounts["RECEIVED"] || 0}
            </div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
              Awaiting dispatch / initial intake
            </span>
          </div>

          {/* Card 2: Send to Company */}
          <div
            onClick={() => setStatusFilter("SEND_TO_COMPANY")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === "SEND_TO_COMPANY"
                ? "bg-purple-50 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600/80 ring-2 ring-purple-400/20"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800/60"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Send to Company</span>
              <Building className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {statusCounts["SEND_TO_COMPANY"] || 0}
            </div>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 block">
              At OEM / manufacturer center
            </span>
          </div>

          {/* Card 3: Warranty Completed */}
          <div
            onClick={() => setStatusFilter("WARRANTY_COMPLETED")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === "WARRANTY_COMPLETED"
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600/80 ring-2 ring-blue-400/20"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800/60"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Completed</span>
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {statusCounts["WARRANTY_COMPLETED"] || 0}
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 block">
              Repaired & ready for delivery
            </span>
          </div>

          {/* Card 4: Delivered */}
          <div
            onClick={() => setStatusFilter("DELIVERED")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === "DELIVERED"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600/80 ring-2 ring-emerald-400/20"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800/60"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Delivered</span>
              <Truck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {statusCounts["DELIVERED"] || 0}
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 block">
              Handed over to customer
            </span>
          </div>

          {/* Card 5: Rejected */}
          <div
            onClick={() => setStatusFilter("REJECTED")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === "REJECTED"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600/80 ring-2 ring-rose-400/20"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800/60"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
              <span>Rejected</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {statusCounts["REJECTED"] || 0}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 block">
              Voided / out-of-warranty
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Job #, customer, phone, serial #, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Brand Filter */}
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Staff Filter */}
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="">All Staff</option>
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>

              {(search || statusFilter || brandFilter || staffFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setBrandFilter("");
                    setStaffFilter("");
                  }}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Status:</span>
            {(
              [
                { id: "", label: `All (${total})` },
                { id: "RECEIVED", label: `Received (${statusCounts["RECEIVED"] || 0})` },
                { id: "SEND_TO_COMPANY", label: `Send to Company (${statusCounts["SEND_TO_COMPANY"] || 0})` },
                { id: "WARRANTY_COMPLETED", label: `Completed (${statusCounts["WARRANTY_COMPLETED"] || 0})` },
                { id: "REJECTED", label: `Rejected (${statusCounts["REJECTED"] || 0})` },
                { id: "DELIVERED", label: `Delivered (${statusCounts["DELIVERED"] || 0})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Showing {jobs.length} of {total} Warranty Jobs
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Job # / Date</th>
                  <th className="px-5 py-3.5">Customer Details</th>
                  <th className="px-5 py-3.5">Product & Serial #</th>
                  <th className="px-5 py-3.5">Service Type</th>
                  <th className="px-5 py-3.5">Assigned Staff</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      Loading warranty jobs...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      No warranty jobs found matching the criteria. Click &quot;Register New Warranty Job&quot; above to create one.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const stBadge = getStatusBadge(job.status);
                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        {/* Job Number & Date */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            #{job.job_number}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(job.received_date).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {job.customer_name}
                          </span>
                          {job.customer_phone && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {job.customer_phone}
                            </span>
                          )}
                        </td>

                        {/* Product & Serial */}
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {job.product_name}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800">
                              SN: {job.serial_number}
                            </span>
                            {job.brand_name && (
                              <span className="text-[10px] text-slate-400">
                                {job.brand_name} {job.model_name ? `• ${job.model_name}` : ""}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Service Type */}
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          {job.service_type_name || "Standard Repair"}
                        </td>

                        {/* Staff */}
                        <td className="px-5 py-3.5 text-purple-600 dark:text-purple-400 font-semibold">
                          {job.staff_name || "—"}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${stBadge.bg}`}
                          >
                            {stBadge.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedJobId(job.id)}
                              title="View details & serial history"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {hasPermission("warranty", "edit") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setJobToEdit(job);
                                  setIsRegisterOpen(true);
                                }}
                                title="Edit warranty job"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {hasPermission("warranty", "delete") && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteJob(job, e)}
                                title="Delete warranty job"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Register / Edit Warranty Job Modal */}
        <RegisterWarrantyJobModal
          isOpen={isRegisterOpen}
          onClose={() => {
            setIsRegisterOpen(false);
            setJobToEdit(null);
          }}
          jobToEdit={jobToEdit}
          onJobSaved={() => {
            loadData(true);
          }}
        />

        {/* Warranty Job Detail Modal */}
        <WarrantyJobDetailModal
          jobId={selectedJobId}
          isOpen={Boolean(selectedJobId)}
          onClose={() => setSelectedJobId(null)}
          onJobUpdated={() => loadData(true)}
          onJobDeleted={() => {
            setSelectedJobId(null);
            loadData(true);
          }}
          onEditJob={(job) => {
            setSelectedJobId(null);
            setJobToEdit(job);
            setIsRegisterOpen(true);
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
