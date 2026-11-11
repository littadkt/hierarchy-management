"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Plus,
  Loader2,
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
  AlertCircle,
  History,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { warrantyApi, getErrorMessage } from "@/lib/api";
import {
  WarrantyBrand,
  WarrantyJob,
  WarrantyModel,
  WarrantySerialHistory,
  WarrantyServiceType,
  WarrantyStaff,
  WarrantyStatus,
} from "@/lib/types";
import {
  LookupType,
  ManageWarrantyLookupModal,
} from "./ManageWarrantyLookupModal";

interface RegisterWarrantyJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobSaved: (job: WarrantyJob) => void;
  jobToEdit?: WarrantyJob | null;
}

export const RegisterWarrantyJobModal: React.FC<RegisterWarrantyJobModalProps> = ({
  isOpen,
  onClose,
  onJobSaved,
  jobToEdit,
}) => {
  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [serviceTypeId, setServiceTypeId] = useState("");
  const [staffId, setStaffId] = useState("");

  const [productName, setProductName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");

  const [workDescription, setWorkDescription] = useState("");
  const [status, setStatus] = useState<WarrantyStatus>("RECEIVED");
  const [notes, setNotes] = useState("");

  // Lookups data
  const [serviceTypes, setServiceTypes] = useState<WarrantyServiceType[]>([]);
  const [staffList, setStaffList] = useState<WarrantyStaff[]>([]);
  const [brands, setBrands] = useState<WarrantyBrand[]>([]);
  const [models, setModels] = useState<WarrantyModel[]>([]);

  // Serial history state
  const [serialHistory, setSerialHistory] = useState<WarrantySerialHistory | null>(null);
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  // Manage lookup modal state
  const [lookupModalType, setLookupModalType] = useState<LookupType | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load lookups
  const loadLookups = async () => {
    try {
      const [stData, staffData, brData, mdData] = await Promise.all([
        warrantyApi.getServiceTypes(),
        warrantyApi.getStaff(),
        warrantyApi.getBrands(),
        warrantyApi.getModels(),
      ]);
      setServiceTypes(stData);
      setStaffList(staffData);
      setBrands(brData);
      setModels(mdData);
    } catch (err) {
      console.error("Failed to load warranty lookups:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLookups();
      if (jobToEdit) {
        setCustomerName(jobToEdit.customer_name);
        setCustomerPhone(jobToEdit.customer_phone || "");
        setCustomerEmail(jobToEdit.customer_email || "");
        setCustomerAddress(jobToEdit.customer_address || "");
        setServiceTypeId(jobToEdit.service_type_id || "");
        setStaffId(jobToEdit.staff_id || "");
        setProductName(jobToEdit.product_name);
        setSerialNumber(jobToEdit.serial_number);
        setBrandId(jobToEdit.brand_id || "");
        setModelId(jobToEdit.model_id || "");
        setWorkDescription(jobToEdit.work_description);
        setStatus(jobToEdit.status);
        setNotes(jobToEdit.notes || "");

        // Check serial history excluding current job
        checkSerialHistory(jobToEdit.serial_number, jobToEdit.id);
      } else {
        // Reset form
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setCustomerAddress("");
        setServiceTypeId("");
        setStaffId("");
        setProductName("");
        setSerialNumber("");
        setBrandId("");
        setModelId("");
        setWorkDescription("");
        setStatus("RECEIVED");
        setNotes("");
        setSerialHistory(null);
      }
      setError(null);
    }
  }, [isOpen, jobToEdit]);

  // Serial history check
  const checkSerialHistory = async (serial: string, excludeId?: string) => {
    const cleanSerial = serial.trim();
    if (!cleanSerial || cleanSerial.length < 3) {
      setSerialHistory(null);
      return;
    }

    setCheckingSerial(true);
    try {
      const history = await warrantyApi.getSerialHistory(cleanSerial, excludeId);
      setSerialHistory(history);
      setIsHistoryExpanded(true);
    } catch (err) {
      console.error("Failed to check serial history:", err);
    } finally {
      setCheckingSerial(false);
    }
  };

  const handleSerialBlur = () => {
    if (serialNumber.trim()) {
      checkSerialHistory(serialNumber, jobToEdit?.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !productName.trim() || !serialNumber.trim() || !workDescription.trim()) {
      setError("Please fill in Customer Name, Product Name, Serial Number, and Work Description.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      customer_email: customerEmail.trim() || null,
      customer_address: customerAddress.trim() || null,
      service_type_id: serviceTypeId || null,
      staff_id: staffId || null,
      product_name: productName.trim(),
      serial_number: serialNumber.trim(),
      brand_id: brandId || null,
      model_id: modelId || null,
      work_description: workDescription.trim(),
      status,
      notes: notes.trim() || null,
    };

    try {
      let savedJob: WarrantyJob;
      if (jobToEdit) {
        savedJob = await warrantyApi.updateJob(jobToEdit.id, payload);
      } else {
        savedJob = await warrantyApi.createJob(payload);
      }
      onJobSaved(savedJob);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter models based on selected brand
  const filteredModels = brandId
    ? models.filter((m) => !m.brand_id || m.brand_id === brandId)
    : models;

  const getLookupItems = () => {
    switch (lookupModalType) {
      case "service_type":
        return serviceTypes;
      case "staff":
        return staffList;
      case "brand":
        return brands;
      case "model":
        return filteredModels;
      default:
        return [];
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {jobToEdit ? `Edit Warranty Job #${jobToEdit.job_number}` : "Register New Warranty Job"}
                </h2>
                <p className="text-xs text-slate-500">
                  Customer intake, product details, serial check, and service assignment
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
            {error && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Customer Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <UserIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  1. Customer Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full name of customer"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Contact Phone</span>
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>Customer Address</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Street, City, Postal Code"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Service & Staff Assignment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  2. Service Type & Staff Assignment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Service Type Dropdown with Create/Edit/Delete */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      Service Type
                    </label>
                    <button
                      type="button"
                      onClick={() => setLookupModalType("service_type")}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Manage / + New</span>
                    </button>
                  </div>
                  <select
                    value={serviceTypeId}
                    onChange={(e) => setServiceTypeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Service Type (Optional)</option>
                    {serviceTypes.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Staff Dropdown with Create/Edit/Delete */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      Assigned Staff
                    </label>
                    <button
                      type="button"
                      onClick={() => setLookupModalType("staff")}
                      className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Manage / + New</span>
                    </button>
                  </div>
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Staff (Optional)</option>
                    {staffList.map((stf) => (
                      <option key={stf.id} value={stf.id}>
                        {stf.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Product Details & Serial History */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3. Product Details & Serial Number History
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. iPhone 15 Pro, Dell Latitude 5420"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      Serial Number <span className="text-rose-500">*</span>
                    </label>
                    {checkingSerial && (
                      <span className="text-[10px] text-indigo-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking history...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. SN-8899001122"
                      value={serialNumber}
                      onChange={(e) => {
                        setSerialNumber(e.target.value);
                      }}
                      onBlur={handleSerialBlur}
                      className="w-full pl-3 pr-20 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => checkSerialHistory(serialNumber, jobToEdit?.id)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition cursor-pointer"
                    >
                      Check History
                    </button>
                  </div>
                </div>

                {/* Brand Dropdown with Create/Edit/Delete */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      Brand Name
                    </label>
                    <button
                      type="button"
                      onClick={() => setLookupModalType("brand")}
                      className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Manage / + New</span>
                    </button>
                  </div>
                  <select
                    value={brandId}
                    onChange={(e) => {
                      setBrandId(e.target.value);
                      setModelId("");
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Brand (Optional)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Dropdown with Create/Edit/Delete */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                      Model
                    </label>
                    <button
                      type="button"
                      onClick={() => setLookupModalType("model")}
                      className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Manage / + New</span>
                    </button>
                  </div>
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Model (Optional)</option>
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* REALTIME SERIAL HISTORY DISPLAY */}
              {serialHistory && (
                <div
                  className={`rounded-2xl border p-3.5 sm:p-4 text-xs transition-all ${
                    serialHistory.total_services > 0
                      ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                      : "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History
                        className={`w-4 h-4 shrink-0 ${
                          serialHistory.total_services > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      />
                      <span className="font-bold text-slate-900 dark:text-white">
                        {serialHistory.total_services > 0
                          ? `Product Service History: ${serialHistory.total_services} prior service ${
                              serialHistory.total_services === 1 ? "record" : "records"
                            } found for serial "${serialHistory.serial_number}"`
                          : `No prior service records found for serial "${serialHistory.serial_number}" (First-time intake)`}
                      </span>
                    </div>

                    {serialHistory.total_services > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                        className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isHistoryExpanded ? "Collapse" : "View History"}</span>
                        {isHistoryExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Prior Service Records List */}
                  {serialHistory.total_services > 0 && isHistoryExpanded && (
                    <div className="mt-3 space-y-2 border-t border-amber-200 dark:border-amber-800/80 pt-3">
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        This product was previously submitted for service by the following customer(s):
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {serialHistory.jobs.map((pastJob) => (
                          <div
                            key={pastJob.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {pastJob.customer_name}
                                </span>
                                {pastJob.customer_phone && (
                                  <span className="text-slate-400 text-[11px]">
                                    ({pastJob.customer_phone})
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  #{pastJob.job_number}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 text-[11px] truncate mt-0.5">
                                <strong className="text-slate-700 dark:text-slate-300">Work:</strong>{" "}
                                {pastJob.work_description}
                              </p>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                <span>
                                  Received: {new Date(pastJob.received_date).toLocaleDateString()}
                                </span>
                                {pastJob.staff_name && <span>• Staff: {pastJob.staff_name}</span>}
                              </div>
                            </div>

                            <div className="shrink-0 self-start sm:self-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  pastJob.status === "DELIVERED"
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                    : pastJob.status === "WARRANTY_COMPLETED"
                                    ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300"
                                    : pastJob.status === "REJECTED"
                                    ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300"
                                    : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                                }`}
                              >
                                {pastJob.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Work Description, Status & Notes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  4. Work Description & Job Status
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Work Description / Issue Reported <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the defect, diagnostics required, customer complaints..."
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Job Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as WarrantyStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="RECEIVED">Received</option>
                      <option value="SEND_TO_COMPANY">Send to Company</option>
                      <option value="WARRANTY_COMPLETED">Warranty Completed</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Internal Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Accessory details, condition notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{jobToEdit ? "Update Warranty Job" : "Register Warranty Job"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Lookup Management Modal (for inline create, edit, delete of Service Type, Staff, Brand, Model) */}
      {lookupModalType && (
        <ManageWarrantyLookupModal
          isOpen={true}
          onClose={() => setLookupModalType(null)}
          type={lookupModalType}
          selectedBrandId={brandId}
          items={getLookupItems()}
          refreshItems={loadLookups}
          onItemCreated={(newItem) => {
            if (lookupModalType === "service_type") setServiceTypeId(newItem.id);
            else if (lookupModalType === "staff") setStaffId(newItem.id);
            else if (lookupModalType === "brand") setBrandId(newItem.id);
            else if (lookupModalType === "model") setModelId(newItem.id);
          }}
        />
      )}
    </>
  );
};
