"use client";

import React, { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  ShoppingCart,
  Users,
  Package,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Filter,
  Layers,
  MapPin,
  Phone,
  Tag,
  Building2,
  Boxes,
  Edit,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { wholesaleApi, getErrorMessage } from "@/lib/api";
import {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderStatus,
  WholesaleProduct,
} from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { PlaceOrderModal } from "@/components/PlaceOrderModal";
import { CreateWholesaleCustomerModal } from "@/components/CreateWholesaleCustomerModal";
import { EditWholesaleCustomerModal } from "@/components/EditWholesaleCustomerModal";
import { CreateWholesaleProductModal } from "@/components/CreateWholesaleProductModal";
import { EditWholesaleProductModal } from "@/components/EditWholesaleProductModal";
import { EditWholesaleOrderModal } from "@/components/EditWholesaleOrderModal";
import { SuperAdminPermissionsModal } from "@/components/SuperAdminPermissionsModal";
import { ExcelUploadModal } from "@/components/ExcelUploadModal";

export default function WholesalePage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "products">("orders");

  // Orders State
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState<number>(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState<WholesaleOrderStatus | "ALL">("ALL");
  const [orderSearch, setOrderSearch] = useState("");

  // Customers State
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");

  // Products State
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isPlaceOrderOpen, setIsPlaceOrderOpen] = useState(false);
  const [preselectedProdId, setPreselectedProdId] = useState<string | undefined>(undefined);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [isExcelProductsOpen, setIsExcelProductsOpen] = useState(false);
  const [isExcelCustomersOpen, setIsExcelCustomersOpen] = useState(false);

  // Edit Modals State
  const [editCustomer, setEditCustomer] = useState<WholesaleCustomer | null>(null);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);

  const [editProduct, setEditProduct] = useState<WholesaleProduct | null>(null);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);

  const [editOrder, setEditOrder] = useState<WholesaleOrder | null>(null);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);

  // Permissions
  const canPlaceOrders = user?.role === "SUPER_ADMIN" || !!user?.can_place_wholesale_orders;
  const canViewAllOrders = ["SUPER_ADMIN", "ADMIN", "IN_CHARGE"].includes(user?.role || "");
  const canUpdateStatus = ["SUPER_ADMIN", "ADMIN", "IN_CHARGE"].includes(user?.role || "");
  const canManageProducts = ["SUPER_ADMIN", "ADMIN"].includes(user?.role || "");
  const canManageCustomers = ["SUPER_ADMIN", "ADMIN", "IN_CHARGE"].includes(user?.role || "");

  const canEditOrder = (o: WholesaleOrder) => {
    if (canUpdateStatus) return true;
    return o.placed_by_id === user?.id && o.status === "PENDING";
  };

  const handleDeleteCustomer = async (c: WholesaleCustomer) => {
    const ok = await confirm({
      title: "Delete Wholesale Customer",
      message: `Are you sure you want to delete customer "${c.name}"? This action cannot be undone.`,
      confirmText: "Delete Customer",
      type: "danger",
    });
    if (!ok) return;

    try {
      await wholesaleApi.deleteCustomer(c.id);
      loadData();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const handleDeleteProduct = async (p: WholesaleProduct) => {
    const ok = await confirm({
      title: "Delete Wholesale Product",
      message: `Are you sure you want to delete product "${p.name}" (${p.code})?`,
      confirmText: "Delete Product",
      type: "danger",
    });
    if (!ok) return;

    try {
      await wholesaleApi.deleteProduct(p.id);
      setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
      loadData();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const allProductsSelected =
    products.length > 0 && products.every((p) => selectedProductIds.includes(p.id));
  const someProductsSelected =
    products.length > 0 &&
    products.some((p) => selectedProductIds.includes(p.id)) &&
    !allProductsSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someProductsSelected;
    }
  }, [someProductsSelected]);

  const handleToggleSelectAllProducts = () => {
    if (allProductsSelected) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((p) => p.id));
    }
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleBulkDeleteProducts = async () => {
    if (!canManageProducts || selectedProductIds.length === 0) return;
    const count = selectedProductIds.length;
    const ok = await confirm({
      title: "Delete Selected Wholesale Products",
      message: `Are you sure you want to permanently delete the ${count} selected wholesale product(s)? This action cannot be undone.`,
      confirmText: `Delete ${count} Product(s)`,
      type: "danger",
    });
    if (!ok) return;

    try {
      const res = await wholesaleApi.bulkDeleteProducts(selectedProductIds);
      setSelectedProductIds([]);
      loadData();

      if (res.failed_count > 0 && res.errors.length > 0) {
        await alert({
          title: "Partial Delete Complete",
          message: `Successfully deleted ${res.deleted_count} product(s).\n\n${res.failed_count} product(s) could not be deleted:\n${res.errors.join("\n")}`,
          type: "warning",
        });
      } else {
        await alert({
          title: "Products Deleted",
          message: `Successfully deleted ${res.deleted_count} wholesale product(s).`,
          type: "success",
        });
      }
    } catch (err) {
      await alert({
        title: "Bulk Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const handleDeleteOrder = async (o: WholesaleOrder) => {
    const ok = await confirm({
      title: "Delete Wholesale Order",
      message: `Are you sure you want to delete order "${o.order_number}"? This will cancel the order and restore product stock.`,
      confirmText: "Delete & Restore Stock",
      type: "danger",
    });
    if (!ok) return;

    try {
      await wholesaleApi.deleteOrder(o.id);
      loadData();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (activeTab === "orders") {
        const filters = {
          status: orderStatusFilter === "ALL" ? undefined : orderStatusFilter,
          search: orderSearch.trim() || undefined,
        };
        const res = await wholesaleApi.listOrders(filters);
        setOrders(res.items);
        setOrdersTotal(res.total);
      } else if (activeTab === "customers") {
        const res = await wholesaleApi.getCustomers(customerSearch.trim() || undefined);
        setCustomers(res.items);
      } else if (activeTab === "products") {
        const res = await wholesaleApi.getProducts({ search: productSearch.trim() || undefined });
        setProducts(res.items);
      }
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
  }, [user, activeTab, orderStatusFilter]);

  useRealtimeEvent(
    [
      "WHOLESALE_ORDER_STATUS_UPDATED",
      "WHOLESALE_ORDER_CREATED",
      "WHOLESALE_ORDER_UPDATED",
      "WHOLESALE_ORDER_DELETED",
      "RESYNC",
    ],
    () => {
      loadData(true);
    }
  );

  useEffect(() => {
    setSelectedProductIds([]);
  }, [activeTab]);

  const handleStatusChange = async (orderId: string, newStatus: WholesaleOrderStatus) => {
    try {
      await wholesaleApi.updateOrderStatus(orderId, newStatus);
      loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleQuickOrderProduct = (productId: string) => {
    setPreselectedProdId(productId);
    setIsPlaceOrderOpen(true);
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Truck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              <span>Wholesale Management & Orders</span>
            </h1>
            <p className="text-xs text-slate-500">
              Manage wholesale client relationships, bulk product catalog, and authorized order placement
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {/* Super Admin Permissions Button */}
            {user?.role === "SUPER_ADMIN" && (
              <button
                onClick={() => setIsPermissionsOpen(true)}
                className="px-3.5 py-2.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold text-xs flex items-center gap-2 hover:bg-purple-100 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Order Permissions</span>
              </button>
            )}

            {/* Place Order Button (for permitted users & Super Admin) */}
            {canPlaceOrders ? (
              <button
                onClick={() => {
                  setPreselectedProdId(undefined);
                  setIsPlaceOrderOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Place Wholesale Order</span>
              </button>
            ) : (
              <div className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                <span>Order placement restricted</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "orders"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Wholesale Orders</span>
          </button>

          <button
            onClick={() => setActiveTab("customers")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "customers"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Wholesale Customers</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "products"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Wholesale Products List</span>
          </button>
        </div>

        {/* TAB 1: PLACED WHOLESALE ORDERS */}
        {activeTab === "orders" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden space-y-0">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {(["ALL", "PENDING", "CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                        orderStatusFilter === st
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {st === "ALL" ? "All Orders" : st}
                    </button>
                  )
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadData();
                }}
                className="flex items-center gap-2 w-full md:w-auto"
              >
                <div className="relative flex-1 md:flex-initial">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search order #, customer, place..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-full sm:w-64"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Visibility Notice Banner */}
            <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>
                {canViewAllOrders
                  ? "✓ In-Charges, Admins, and Super Admins have full visibility of all placed wholesale orders."
                  : "Showing orders placed by you."}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Total: {ordersTotal} Orders
              </span>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Order Number</th>
                    <th className="px-5 py-3.5">Customer Details</th>
                    <th className="px-5 py-3.5">Place & Contact</th>
                    <th className="px-5 py-3.5">Item & Code</th>
                    <th className="px-5 py-3.5">Qty × Rate</th>
                    <th className="px-5 py-3.5">Total Amount</th>
                    <th className="px-5 py-3.5">Placed By</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                        Loading wholesale orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                        No wholesale orders found matching filter.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr
                        key={o.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {o.order_number}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {o.customer_name}
                        </td>
                        <td className="px-5 py-3.5">
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {o.place}
                            </span>
                            <span className="text-[11px] text-slate-400">{o.contact_number}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {o.product_name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {o.product_code}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {o.quantity} × ₹{o.unit_rate.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 font-extrabold text-slate-900 dark:text-white">
                          ₹{o.total_amount.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {o.placed_by?.full_name || "Unknown"}
                            </span>
                            {o.placed_by?.role && <RoleBadge role={o.placed_by.role} />}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <OrderStatusBadge status={o.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {canUpdateStatus && (
                            <select
                              value={o.status}
                              onChange={(e) =>
                                handleStatusChange(o.id, e.target.value as WholesaleOrderStatus)
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                            >
                              <option value="PENDING">Pending</option>
                              <option value="CONFIRMED">Confirmed</option>
                              <option value="DISPATCHED">Dispatched</option>
                              <option value="DELIVERED">Delivered</option>
                              <option value="CANCELLED">Cancelled</option>
                            </select>
                          )}
                          {canEditOrder(o) && (
                            <>
                              <button
                                onClick={() => {
                                  setEditOrder(o);
                                  setIsEditOrderOpen(true);
                                }}
                                title="Edit order"
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(o)}
                                title="Delete order"
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WHOLESALE CUSTOMERS TABLE */}
        {activeTab === "customers" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadData();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer name, place..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-64"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2">
                {canManageCustomers && (
                  <button
                    onClick={() => setIsExcelCustomersOpen(true)}
                    className="px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Import Customers</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Customer</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Customer Name</th>
                    <th className="px-5 py-3.5">Place / City</th>
                    <th className="px-5 py-3.5">Contact Number</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Address</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        Loading wholesale customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                        No wholesale customers registered yet.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {c.name}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {c.place}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                          {c.contact_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{c.email || "—"}</td>
                        <td className="px-5 py-3.5 text-slate-500 truncate max-w-xs">
                          {c.address || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {canManageCustomers && (
                            <>
                              <button
                                onClick={() => {
                                  setEditCustomer(c);
                                  setIsEditCustomerOpen(true);
                                }}
                                title="Edit customer"
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(c)}
                                title="Delete customer"
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WHOLESALE PRODUCTS LIST */}
        {activeTab === "products" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadData();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product, barcode, brand..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden w-64"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2">
                {canManageProducts && selectedProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteProducts}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Selected ({selectedProductIds.length})</span>
                  </button>
                )}
                {canManageProducts && (
                  <button
                    onClick={() => setIsExcelProductsOpen(true)}
                    className="px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Import Products</span>
                  </button>
                )}
                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Wholesale Product</span>
                </button>
              </div>
            </div>

            {/* Selection Banner for Bulk Delete */}
            {canManageProducts && selectedProductIds.length > 0 && (
              <div className="mx-4 my-3 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-800 dark:text-rose-200">
                    {selectedProductIds.length} of {products.length} product{products.length > 1 ? "s" : ""} selected
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductIds([])}
                    className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 underline font-medium"
                  >
                    Deselect all
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleBulkDeleteProducts}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedProductIds.length})</span>
                </button>
              </div>
            )}

            {/* Products Table (fields same as inventory item) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {canManageProducts && (
                      <th className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          ref={selectAllRef}
                          checked={allProductsSelected}
                          onChange={handleToggleSelectAllProducts}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer align-middle"
                          title={allProductsSelected ? "Deselect all products" : "Select all products"}
                        />
                      </th>
                    )}
                    <th className="px-5 py-3.5">Barcode / Code</th>
                    <th className="px-5 py-3.5">Product Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Brand</th>
                    <th className="px-5 py-3.5">Vendor</th>
                    <th className="px-5 py-3.5">Wholesale Rate</th>
                    <th className="px-5 py-3.5">Stock Qty</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={canManageProducts ? 9 : 8} className="px-5 py-12 text-center text-slate-400">
                        Loading wholesale products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={canManageProducts ? 9 : 8} className="px-5 py-12 text-center text-slate-400">
                        No wholesale products registered yet.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
                          }`}
                        >
                          {canManageProducts && (
                            <td className="w-10 px-4 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(p.id)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer align-middle"
                              />
                            </td>
                          )}
                          <td className="px-5 py-3.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {p.code}
                          </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {p.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                          {p.brand}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{p.vendor}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          ₹{p.rate.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              p.quantity > 10
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                : p.quantity > 0
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                            }`}
                          >
                            {p.quantity} units
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {canPlaceOrders && (
                            <button
                              onClick={() => handleQuickOrderProduct(p.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 transition-colors inline-flex items-center gap-1"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Order</span>
                            </button>
                          )}
                          {canManageProducts && (
                            <>
                              <button
                                onClick={() => {
                                  setEditProduct(p);
                                  setIsEditProductOpen(true);
                                }}
                                title="Edit product"
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                title="Delete product"
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PlaceOrderModal
        isOpen={isPlaceOrderOpen}
        preselectedProductId={preselectedProdId}
        onClose={() => setIsPlaceOrderOpen(false)}
        onOrderPlaced={() => {
          setActiveTab("orders");
          loadData();
        }}
      />

      <CreateWholesaleCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={() => loadData()}
      />

      <EditWholesaleCustomerModal
        customer={editCustomer}
        isOpen={isEditCustomerOpen}
        onClose={() => {
          setIsEditCustomerOpen(false);
          setEditCustomer(null);
        }}
        onCustomerUpdated={() => loadData()}
      />

      <CreateWholesaleProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onProductCreated={() => loadData()}
      />

      <EditWholesaleProductModal
        product={editProduct}
        isOpen={isEditProductOpen}
        onClose={() => {
          setIsEditProductOpen(false);
          setEditProduct(null);
        }}
        onProductUpdated={() => loadData()}
      />

      <EditWholesaleOrderModal
        order={editOrder}
        isOpen={isEditOrderOpen}
        canUpdateStatus={canUpdateStatus}
        onClose={() => {
          setIsEditOrderOpen(false);
          setEditOrder(null);
        }}
        onOrderUpdated={() => loadData()}
      />

      <SuperAdminPermissionsModal
        isOpen={isPermissionsOpen}
        onClose={() => setIsPermissionsOpen(false)}
        onPermissionsUpdated={() => loadData()}
      />

      {/* Excel Upload Modals */}
      <ExcelUploadModal
        isOpen={isExcelProductsOpen}
        onClose={() => setIsExcelProductsOpen(false)}
        title="Import Wholesale Products"
        description="Upload an Excel (.xlsx/.xls) or CSV (.csv) file to bulk add or update wholesale catalog products."
        expectedColumns={[
          "Barcode",
          "Product Name",
          "Rate",
          "Category",
          "Brand",
          "Vendor",
          "Quantity",
        ]}
        onDownloadTemplate={wholesaleApi.downloadProductsTemplate}
        templateFilename="wholesale_products_template.xlsx"
        onUpload={wholesaleApi.uploadProductsExcel}
        onSuccess={() => loadData()}
      />

      <ExcelUploadModal
        isOpen={isExcelCustomersOpen}
        onClose={() => setIsExcelCustomersOpen(false)}
        title="Import Wholesale Customers"
        description="Upload an Excel (.xlsx/.xls) or CSV (.csv) file to bulk add or update wholesale customer directories."
        expectedColumns={[
          "Customer Name",
          "Place",
          "Contact Number",
          "Email",
          "Address",
        ]}
        onDownloadTemplate={wholesaleApi.downloadCustomersTemplate}
        templateFilename="wholesale_customers_template.xlsx"
        onUpload={wholesaleApi.uploadCustomersExcel}
        onSuccess={() => loadData()}
      />
    </ProtectedRoute>
  );
}
