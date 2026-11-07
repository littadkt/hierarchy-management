"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  X,
  ShoppingCart,
  Users,
  Package,
  MapPin,
  Phone,
  AlertCircle,
  CheckCircle2,
  Scan,
  Camera,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  Boxes,
} from "lucide-react";
import { wholesaleApi, getErrorMessage } from "@/lib/api";
import { WholesaleCustomer, WholesaleProduct } from "@/lib/types";
import { CameraBarcodeScanner } from "./CameraBarcodeScanner";
import { SearchableProductSelect } from "./SearchableProductSelect";
import { SearchableCustomerSelect } from "./SearchableCustomerSelect";

interface PlaceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: () => void;
  preselectedProductId?: string;
}

interface OrderLineItem {
  product: WholesaleProduct;
  quantity: number;
}

export const PlaceOrderModal: React.FC<PlaceOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderPlaced,
  preselectedProductId,
}) => {
  const [customers, setCustomers] = useState<WholesaleCustomer[]>([]);
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<WholesaleCustomer | null>(null);
  const [place, setPlace] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Multi-product items in the cart
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>([]);

  // Picker bar state
  const [pickerProductId, setPickerProductId] = useState<string>("");
  const [selectedPickerProduct, setSelectedPickerProduct] = useState<WholesaleProduct | null>(null);
  const [pickerQuantity, setPickerQuantity] = useState<number>(1);

  // Live backend search loading states & debounce timers
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const customerDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const productDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Camera scanner state
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      loadPrerequisites();
    }
  }, [isOpen]);

  const loadPrerequisites = async () => {
    setLoading(true);
    try {
      // Load small initial sets (15 items each) for instant modal responsiveness
      const [custData, prodData] = await Promise.all([
        wholesaleApi.getCustomers({ limit: 15 }),
        wholesaleApi.getProducts({ limit: 15 }),
      ]);
      setCustomers(custData.items);
      setProducts(prodData.items);

      if (custData.items.length > 0 && !selectedCustomerId) {
        const firstCust = custData.items[0];
        setSelectedCustomerId(firstCust.id);
        setSelectedCustomer(firstCust);
        setPlace(firstCust.place || "");
        setContactNumber(firstCust.contact_number || "");
      }

      // If opened with preselected product
      let initialProd: WholesaleProduct | undefined = undefined;
      if (preselectedProductId) {
        initialProd = prodData.items.find((p) => p.id === preselectedProductId);
        if (!initialProd) {
          try {
            initialProd = await wholesaleApi.getProduct(preselectedProductId);
            setProducts((prev) => [initialProd!, ...prev.filter((p) => p.id !== initialProd!.id)]);
          } catch (_) {}
        }
      }

      if (initialProd) {
        setPickerProductId(initialProd.id);
        setSelectedPickerProduct(initialProd);
        setOrderItems([{ product: initialProd, quantity: 1 }]);
      } else {
        const firstProd = prodData.items[0];
        if (firstProd) {
          setPickerProductId(firstProd.id);
          setSelectedPickerProduct(firstProd);
        }
        setOrderItems([]);
      }
      setPickerQuantity(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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

  // Add product from picker bar to items list
  const handleAddProductToOrder = () => {
    setError(null);
    if (!pickerProductId) {
      setError("Please select a wholesale product to add.");
      return;
    }
    const targetProduct =
      selectedPickerProduct || products.find((p) => p.id === pickerProductId);
    if (!targetProduct) {
      setError("Selected product not found in catalog.");
      return;
    }

    if (pickerQuantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    // Check if already in order items
    const existingIndex = orderItems.findIndex((item) => item.product.id === pickerProductId);

    if (existingIndex >= 0) {
      const currentQty = orderItems[existingIndex].quantity;
      const newQty = currentQty + pickerQuantity;
      const updated = [...orderItems];
      updated[existingIndex].quantity = newQty;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, { product: targetProduct, quantity: pickerQuantity }]);
    }

    // Reset picker quantity
    setPickerQuantity(1);
  };

  // Camera scan: adds or increments scanned product by querying backend
  const handleCameraScan = async (code: string) => {
    setIsCameraOpen(false);
    try {
      const prod = await wholesaleApi.getProductByCode(code.trim());
      if (prod) {
        setPickerProductId(prod.id);
        setSelectedPickerProduct(prod);
        setProducts((prev) => [prod, ...prev.filter((p) => p.id !== prod.id)]);

        // Auto add 1 unit to order items
        const existingIndex = orderItems.findIndex((item) => item.product.id === prod.id);
        if (existingIndex >= 0) {
          const updated = [...orderItems];
          updated[existingIndex].quantity += 1;
          setOrderItems(updated);
        } else {
          setOrderItems([...orderItems, { product: prod, quantity: 1 }]);
        }
      }
    } catch (_) {
      setError(`Wholesale product with scanned barcode '${code}' not found in catalog.`);
    }
  };

  // Modify quantity of a line item
  const handleUpdateItemQuantity = (productId: string, newQty: number) => {
    const updated = orderItems.map((item) => {
      if (item.product.id === productId) {
        const validatedQty = Math.max(1, newQty || 1);
        return { ...item, quantity: validatedQty };
      }
      return item;
    });
    setOrderItems(updated);
  };

  // Remove a line item
  const handleRemoveItem = (productId: string) => {
    setOrderItems(orderItems.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const totalItemsCount = orderItems.length;
  const totalUnitsCount = orderItems.reduce((acc, i) => acc + i.quantity, 0);
  const grandTotalAmount = orderItems.reduce((acc, i) => acc + i.quantity * i.product.rate, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError("Please select a wholesale customer.");
      return;
    }
    if (!place.trim() || !contactNumber.trim()) {
      setError("Delivery place and contact number are required.");
      return;
    }
    if (orderItems.length === 0) {
      setError("Please add at least one product to the order before confirming.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await wholesaleApi.placeOrder({
        customer_id: selectedCustomerId,
        place: place.trim(),
        contact_number: contactNumber.trim(),
        notes: notes.trim() || undefined,
        // Backward-compatible single item properties:
        product_id: orderItems[0]?.product.id,
        quantity: orderItems[0]?.quantity,
        // Multi-product array:
        items: orderItems.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
      });

      setSuccessMsg(
        `Wholesale order for ${totalItemsCount} product${totalItemsCount > 1 ? "s" : ""} placed successfully!`
      );
      setTimeout(() => {
        onOrderPlaced();
        onClose();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-indigo-50/50 dark:from-emerald-950/20 dark:to-indigo-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                Place Wholesale Order
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Add single or multiple wholesale products to this order
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs flex items-start gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Loading catalog & customer lists...
            </div>
          ) : (
            <>
              {/* Field 1: Customer Name (Searchable Select with live backend search) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Wholesale Customer <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Live backend search by name, place, phone
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
                  placeholder="Type to search customer by name, place, phone..."
                />
              </div>

              {/* Field 2 & 3: Place and Contact Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Place / Destination</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    placeholder="e.g. Mumbai, Bangalore"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Contact Number</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +91 98201 12345"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Section: Add Products (Multi-product support) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Add Products to Order</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan Product Barcode</span>
                  </button>
                </div>

                {/* Product Picker Bar */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5 relative z-20">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    {/* Search & Select Product Component */}
                    <div className="sm:col-span-6 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Search & Select Product
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Live backend search
                        </span>
                      </div>
                      <SearchableProductSelect
                        products={products}
                        selectedProductId={pickerProductId}
                        selectedProduct={selectedPickerProduct}
                        onSelectProduct={(product) => {
                          setPickerProductId(product.id);
                          setSelectedPickerProduct(product);
                        }}
                        onSearch={handleSearchProducts}
                        isLoading={searchingProducts}
                        placeholder="Type to search by name, barcode, brand, category..."
                      />
                    </div>

                    {/* Quantity with Plus and Minus Buttons */}
                    <div className="sm:col-span-3 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Quantity
                      </span>
                      <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setPickerQuantity((prev) => Math.max(1, prev - 1))}
                          disabled={pickerQuantity <= 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
                          title="Decrease quantity"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={pickerQuantity}
                          onChange={(e) => setPickerQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-xs font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => setPickerQuantity((prev) => prev + 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                          title="Increase quantity"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Add Button */}
                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddProductToOrder}
                        disabled={!pickerProductId || products.length === 0}
                        className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Product</span>
                      </button>
                    </div>
                  </div>

                  {selectedPickerProduct && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
                      <span>
                        Rate: <strong className="text-slate-700 dark:text-slate-300">₹{selectedPickerProduct.rate.toLocaleString()}</strong>
                      </span>
                      <span>
                        Available Stock: <strong className="text-slate-700 dark:text-slate-300">{selectedPickerProduct.quantity} units</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Added Order Items List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>Selected Products ({orderItems.length})</span>
                    <span>Subtotal</span>
                  </div>

                  {orderItems.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400 space-y-1">
                      <Package className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        No products added to this order yet.
                      </p>
                      <p className="text-[11px]">
                        Choose a product above and click "+ Add Product", or scan a barcode.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {orderItems.map((item) => {
                        const itemSubtotal = item.quantity * item.product.rate;
                        return (
                          <div
                            key={item.product.id}
                            className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {item.product.name}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="font-mono">[{item.product.code}]</span>
                                <span>•</span>
                                <span>₹{item.product.rate.toLocaleString()} / unit</span>
                                <span>•</span>
                                <span
                                  className={
                                    item.product.quantity <= 0
                                      ? "text-amber-500 font-semibold"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }
                                >
                                  Stock: {item.product.quantity}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {/* Quantity stepper with plus & minus buttons */}
                              <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.product.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
                                  title="Decrease quantity"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItemQuantity(
                                      item.product.id,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-10 text-xs font-bold text-center bg-transparent text-slate-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.product.id, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                                  title="Increase quantity"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Subtotal */}
                              <span className="text-xs font-bold text-slate-900 dark:text-white min-w-16 text-right">
                                ₹{itemSubtotal.toLocaleString()}
                              </span>

                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.product.id)}
                                title="Remove item"
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Order Summary Box */}
                {orderItems.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-900 dark:text-emerald-200 block text-sm">
                        Total Order Summary
                      </span>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        {totalItemsCount} distinct product{totalItemsCount > 1 ? "s" : ""} •{" "}
                        {totalUnitsCount} total unit{totalUnitsCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
                        Grand Total
                      </span>
                      <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                        ₹{grandTotalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Order Dispatch Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Delivery required via BlueDart Express to warehouse dock"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-hidden resize-none"
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading || orderItems.length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>
                {submitting
                  ? "Placing Order..."
                  : `Confirm & Place Order (${totalUnitsCount} Units • ₹${grandTotalAmount.toLocaleString()})`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Camera scanner for wholesale barcodes */}
      <CameraBarcodeScanner
        isOpen={isCameraOpen}
        onScan={handleCameraScan}
        onClose={() => setIsCameraOpen(false)}
      />
    </div>
  );
};
