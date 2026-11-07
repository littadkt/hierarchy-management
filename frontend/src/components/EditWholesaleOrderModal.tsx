"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Truck, AlertCircle, ShoppingCart, Plus, Minus } from "lucide-react";
import { wholesaleApi, getErrorMessage } from "@/lib/api";
import {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderStatus,
  WholesaleProduct,
} from "@/lib/types";
import { SearchableCustomerSelect } from "./SearchableCustomerSelect";
import { SearchableProductSelect } from "./SearchableProductSelect";

interface EditWholesaleOrderModalProps {
  order: WholesaleOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
  canUpdateStatus?: boolean;
}

export const EditWholesaleOrderModal: React.FC<EditWholesaleOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
  canUpdateStatus = false,
}) => {
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [products, setProducts] = useState<WholesaleProduct[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<WholesaleProduct | null>(null);

  const [place, setPlace] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<WholesaleOrderStatus>("PENDING");

  // Search loading & debounce timers
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFetchingData(true);
      Promise.all([
        wholesaleApi.getCustomers({ limit: 15 }),
        wholesaleApi.getProducts({ limit: 15 }),
      ])
        .then(([custRes, prodRes]) => {
          let loadedCusts = custRes.items;
          let loadedProds = prodRes.items;

          if (order?.customer && !loadedCusts.some((c) => c.id === order.customer_id)) {
            loadedCusts = [order.customer, ...loadedCusts];
          }
          if (order?.product && !loadedProds.some((p) => p.id === order.product_id)) {
            loadedProds = [order.product, ...loadedProds];
          }

          setCustomers(loadedCusts);
          setProducts(loadedProds);
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setFetchingData(false));
    }
  }, [isOpen, order]);

  useEffect(() => {
    if (order) {
      setSelectedCustomerId(order.customer_id);
      setSelectedCustomer(order.customer || null);
      setSelectedProductId(order.product_id);
      setSelectedProduct(order.product || null);
      setPlace(order.place);
      setContactNumber(order.contact_number);
      setQuantity(order.quantity);
      setNotes(order.notes || "");
      setStatus(order.status);
      setError(null);
    }
  }, [order, isOpen]);

  // Debounced backend search for customers
  const handleSearchCustomers = (term: string) => {
    if (customerDebounceRef.current) {
      clearTimeout(customerDebounceRef.current);
    }
    setSearchingCustomers(true);
    customerDebounceRef.current = setTimeout(async () => {
      try {
        const trimmed = term.trim();
        const res = await wholesaleApi.getCustomers({
          search: trimmed || undefined,
          limit: 25,
        });
        setCustomers(res.items);
      } catch (err) {
        console.error("Failed searching customers:", err);
      } finally {
        setSearchingCustomers(false);
      }
    }, 250);
  };

  // Debounced backend search for products
  const handleSearchProducts = (term: string) => {
    if (productDebounceRef.current) {
      clearTimeout(productDebounceRef.current);
    }
    setSearchingProducts(true);
    productDebounceRef.current = setTimeout(async () => {
      try {
        const trimmed = term.trim();
        const res = await wholesaleApi.getProducts({
          search: trimmed || undefined,
          limit: 25,
        });
        setProducts(res.items);
      } catch (err) {
        console.error("Failed searching products:", err);
      } finally {
        setSearchingProducts(false);
      }
    }, 250);
  };

  if (!isOpen || !order) return null;

  const currentProduct =
    selectedProduct || products.find((p) => p.id === selectedProductId) || order.product;
  const unitRate = currentProduct?.rate || order.unit_rate;
  const calculatedTotal = unitRate * (Number(quantity) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await wholesaleApi.updateOrder(order.id, {
        customer_id: selectedCustomerId,
        product_id: selectedProductId,
        quantity: Number(quantity),
        place: place.trim(),
        contact_number: contactNumber.trim(),
        notes: notes.trim() || undefined,
        status: canUpdateStatus ? status : undefined,
      });
      onOrderUpdated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Wholesale Order
              </h2>
              <p className="text-xs text-slate-500 font-mono">Order: {order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection (Searchable with live backend search) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer Name *
              </label>
              <span className="text-[10px] text-slate-400">
                Live search
              </span>
            </div>
            <SearchableCustomerSelect
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={(cust) => {
                setSelectedCustomerId(cust.id);
                setSelectedCustomer(cust);
                setPlace(cust.place || "");
                setContactNumber(cust.contact_number || "");
              }}
              onSearch={handleSearchCustomers}
              isLoading={searchingCustomers}
              placeholder="Search customer by name, place, phone..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Place / Delivery City *
              </label>
              <input
                type="text"
                required
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Number *
              </label>
              <input
                type="text"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          {/* Product Selection (Searchable with live backend search) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Wholesale Product *
              </label>
              <span className="text-[10px] text-slate-400">
                Live search
              </span>
            </div>
            <SearchableProductSelect
              products={products}
              selectedProductId={selectedProductId}
              selectedProduct={selectedProduct}
              onSelectProduct={(prod) => {
                setSelectedProductId(prod.id);
                setSelectedProduct(prod);
              }}
              onSearch={handleSearchProducts}
              isLoading={searchingProducts}
              placeholder="Search product by name, barcode, brand..."
            />
          </div>

          {/* Quantity & Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantity *
              </label>
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
                  title="Decrease quantity"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full text-xs font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                  title="Increase quantity"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Value
              </label>
              <div className="px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                ₹{calculatedTotal.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Status (if permitted) */}
          {canUpdateStatus && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Order Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WholesaleOrderStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Order Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || fetchingData}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

