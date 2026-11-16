"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Boxes,
  Calendar,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Check,
} from "lucide-react";
import { sapApi, getErrorMessage } from "@/lib/api";
import { RentalBooking, RentalProduct } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SapRentalsPage() {
  const [activeTab, setActiveTab] = useState<"bookings" | "products">("bookings");
  const [bookings, setBookings] = useState<RentalBooking[]>([]);
  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("ALL");

  // Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerIdProof, setCustomerIdProof] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rateType, setRateType] = useState("DAILY");
  const [quantity, setQuantity] = useState(1);
  const [bookingNotes, setBookingNotes] = useState("");

  // Return Check-in Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returningBooking, setReturningBooking] = useState<RentalBooking | null>(null);
  const [damageCharges, setDamageCharges] = useState(0);
  const [depositRefunded, setDepositRefunded] = useState(0);
  const [returnNotes, setReturnNotes] = useState("");

  // Product Asset Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RentalProduct | null>(null);
  const [prodCode, setProdCode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Generators");
  const [dailyRate, setDailyRate] = useState(0);
  const [weeklyRate, setWeeklyRate] = useState(0);
  const [monthlyRate, setMonthlyRate] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [totalQty, setTotalQty] = useState(1);
  const [condition, setCondition] = useState("EXCELLENT");
  const [prodDesc, setProdDesc] = useState("");

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bookingsData, productsData] = await Promise.all([
        sapApi.listRentalBookings({
          search: search.trim() || undefined,
          status: bookingStatusFilter,
        }),
        sapApi.listRentalProducts(),
      ]);
      setBookings(bookingsData.items);
      setProducts(productsData.items);
    } catch (err) {
      console.error("Failed to load rental data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [bookingStatusFilter]);

  // Open New Booking
  const openNewBooking = () => {
    setSelectedProductId(products[0]?.id || "");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerIdProof("");
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    setEndDate(in3Days);
    setRateType("DAILY");
    setQuantity(1);
    setBookingNotes("");
    setFormError(null);
    setIsBookingModalOpen(true);
  };

  // Submit New Booking
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !startDate || !endDate) {
      setFormError("Please fill in Customer Name, Phone, and Start/End dates.");
      return;
    }
    const chosenProduct = products.find((p) => p.id === selectedProductId);
    if (!chosenProduct) {
      setFormError("Please select an equipment asset to rent.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      // Calculate rate & amount
      let rate = chosenProduct.daily_rate;
      if (rateType === "WEEKLY") rate = chosenProduct.weekly_rate;
      if (rateType === "MONTHLY") rate = chosenProduct.monthly_rate;

      const s = new Date(startDate);
      const eDate = new Date(endDate);
      const diffDays = Math.max(1, Math.ceil((eDate.getTime() - s.getTime()) / (1000 * 3600 * 24)));
      const totalAmount = rateType === "DAILY" ? diffDays * rate * quantity : rate * quantity;
      const securityDeposit = chosenProduct.security_deposit * quantity;

      await sapApi.createRentalBooking({
        rental_product_id: chosenProduct.id,
        product_name: chosenProduct.name,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_id_proof: customerIdProof.trim() || undefined,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        rate_type: rateType,
        rental_rate: rate,
        quantity: quantity,
        total_amount: totalAmount,
        security_deposit: securityDeposit,
        status: "ACTIVE",
        notes: bookingNotes.trim() || undefined,
      });

      setIsBookingModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  // Open Return Check-in Modal
  const openReturnModal = (b: RentalBooking) => {
    setReturningBooking(b);
    setDamageCharges(0);
    setDepositRefunded(b.security_deposit);
    setReturnNotes("");
    setFormError(null);
    setIsReturnModalOpen(true);
  };

  // Submit Return Check-in
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningBooking) return;
    setFormLoading(true);
    try {
      await sapApi.updateRentalBooking(returningBooking.id, {
        status: "RETURNED",
        damage_charges: Number(damageCharges) || 0,
        deposit_refunded: Number(depositRefunded) || 0,
        notes: returnNotes.trim() ? `${returningBooking.notes || ""}\nReturn Note: ${returnNotes.trim()}` : undefined,
      });
      setIsReturnModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  // Open Product Modal
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdCode(`RNT-${Math.floor(100 + Math.random() * 900)}`);
    setProdName("");
    setProdCategory("Generators");
    setDailyRate(1000);
    setWeeklyRate(5500);
    setMonthlyRate(19000);
    setDeposit(8000);
    setTotalQty(2);
    setCondition("EXCELLENT");
    setProdDesc("");
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const openEditProduct = (p: RentalProduct) => {
    setEditingProduct(p);
    setProdCode(p.product_code);
    setProdName(p.name);
    setProdCategory(p.category);
    setDailyRate(p.daily_rate);
    setWeeklyRate(p.weekly_rate);
    setMonthlyRate(p.monthly_rate);
    setDeposit(p.security_deposit);
    setTotalQty(p.total_quantity);
    setCondition(p.condition_status);
    setProdDesc(p.description || "");
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodCode.trim() || !prodName.trim()) {
      setFormError("Product code and name are required.");
      return;
    }
    setFormLoading(true);
    try {
      const payload: any = {
        product_code: prodCode.trim(),
        name: prodName.trim(),
        category: prodCategory.trim(),
        daily_rate: Number(dailyRate) || 0,
        weekly_rate: Number(weeklyRate) || 0,
        monthly_rate: Number(monthlyRate) || 0,
        security_deposit: Number(deposit) || 0,
        total_quantity: Number(totalQty) || 1,
        available_quantity: Number(totalQty) || 1,
        condition_status: condition,
        description: prodDesc.trim() || undefined,
      };

      if (editingProduct) {
        await sapApi.updateRentalProduct(editingProduct.id, payload);
      } else {
        await sapApi.createRentalProduct(payload);
      }
      setIsProductModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Delete rental asset ${name}?`)) return;
    try {
      await sapApi.deleteRentalProduct(id);
      loadData();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "BOOKED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "RETURNED":
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
      case "OVERDUE":
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
              href="/sap"
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>SAP ERP</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs font-medium text-slate-500">Fleet Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            <span>Product & Equipment Rentals</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Fleet inventory management, booking agreements, security deposits and return inspections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openNewBooking}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Book Equipment Rental</span>
          </button>
          <button
            onClick={openCreateProduct}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Boxes className="w-4 h-4" />
            <span>Add Rental Asset</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "bookings"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Active Bookings & Contracts ({bookings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "products"
              ? "border-teal-600 text-teal-600 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Rental Fleet Assets ({products.length})</span>
        </button>
      </div>

      {/* TAB 1: RENTAL BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                placeholder="Search contracts by booking #, client, product name..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <select
              value={bookingStatusFilter}
              onChange={(e) => setBookingStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Deployment</option>
              <option value="BOOKED">Booked (Upcoming)</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>

          {/* Bookings Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Booking #</th>
                    <th className="py-3.5 px-4">Equipment Asset</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Period</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Rental Total</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                        Loading bookings...
                      </td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No rental bookings found.
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                          {b.booking_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{b.product_name}</div>
                          <div className="text-[11px] text-slate-400">
                            Qty: {b.quantity} unit(s) • {b.rate_type} rate
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{b.customer_name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{b.customer_phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 dark:text-slate-200">
                            {new Date(b.start_date).toLocaleDateString()} →{" "}
                            {new Date(b.end_date).toLocaleDateString()}
                          </div>
                          {b.actual_return_date && (
                            <div className="text-[10px] text-slate-400">
                              Returned: {new Date(b.actual_return_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                              b.status
                            )}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{b.total_amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Dep: ₹{b.security_deposit.toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {b.status === "ACTIVE" || b.status === "BOOKED" || b.status === "OVERDUE" ? (
                            <button
                              onClick={() => openReturnModal(b)}
                              className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 text-xs font-semibold border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                            >
                              Check-In Return
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RENTAL FLEET ASSETS */}
      {activeTab === "products" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {p.product_code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.available_quantity > 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {p.available_quantity > 0
                      ? `${p.available_quantity} of ${p.total_quantity} Available`
                      : "All Deployed"}
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight mb-1">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                  {p.description || `Category: ${p.category}`}
                </p>

                {/* Rental Rates Breakdown */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 text-xs grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <div className="text-[10px] text-slate-400">Daily</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">₹{p.daily_rate}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Weekly</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">₹{p.weekly_rate}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Monthly</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">₹{p.monthly_rate}</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Security Deposit:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ₹{p.security_deposit.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  Condition: {p.condition_status}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditProduct(p)}
                    className="p-1.5 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-500 hover:text-teal-600 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id, p.name)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW RENTAL BOOKING MODAL */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                <span>New Equipment Rental Contract</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
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

            <form onSubmit={handleCreateBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Equipment Asset *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id} disabled={prod.available_quantity <= 0}>
                      {prod.name} ({prod.product_code}) - {prod.available_quantity} available - Daily: ₹{prod.daily_rate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name *
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
                    Customer Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 94470 00000"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer ID / GSTIN
                </label>
                <input
                  type="text"
                  value={customerIdProof}
                  onChange={(e) => setCustomerIdProof(e.target.value)}
                  placeholder="GSTIN: 32AABCS... or Aadhaar/PAN"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rate Basis
                  </label>
                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="DAILY">Daily Rate</option>
                    <option value="WEEKLY">Weekly Rate</option>
                    <option value="MONTHLY">Monthly Rate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contract Notes / Jobsite Location
                </label>
                <textarea
                  rows={2}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g. Kakkanad Metro Extension site, include operator..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Deploying..." : "Confirm Rental Contract"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN CHECK-IN MODAL */}
      {isReturnModalOpen && returningBooking && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-teal-600" />
                <span>Return Check-In Inspection</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <div>
                <strong>Contract:</strong> {returningBooking.booking_number}
              </div>
              <div>
                <strong>Asset:</strong> {returningBooking.product_name}
              </div>
              <div>
                <strong>Customer:</strong> {returningBooking.customer_name}
              </div>
              <div>
                <strong>Deposit Held:</strong> ₹{returningBooking.security_deposit.toLocaleString()}
              </div>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Damage Charges / Penalties (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={damageCharges}
                  onChange={(e) => {
                    const dmg = Number(e.target.value) || 0;
                    setDamageCharges(dmg);
                    setDepositRefunded(Math.max(0, returningBooking.security_deposit - dmg));
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Security Deposit to Refund (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositRefunded}
                  onChange={(e) => setDepositRefunded(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Check hours run, physical condition, fuel level..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Closing..." : "Complete Return & Restore Fleet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT RENTAL PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-teal-600" />
                <span>{editingProduct ? `Edit Asset: ${editingProduct.product_code}` : "New Rental Fleet Asset"}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
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

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Asset Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={prodCode}
                    onChange={(e) => setProdCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    placeholder="Generators, Power Tools..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product / Equipment Title *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Caterpillar 30kVA Generator"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Weekly Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={weeklyRate}
                    onChange={(e) => setWeeklyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fleet Total Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalQty}
                    onChange={(e) => setTotalQty(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="MAINTENANCE">Under Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Specifications
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Technical specifications, included accessories..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : editingProduct ? "Save Changes" : "Register Fleet Asset"}
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
