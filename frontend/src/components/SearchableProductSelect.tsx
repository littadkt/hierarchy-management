"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X, Check, Package, Tag, Loader2 } from "lucide-react";
import { WholesaleProduct } from "@/lib/types";

interface SearchableProductSelectProps {
  products: WholesaleProduct[];
  selectedProductId: string;
  selectedProduct?: WholesaleProduct | null;
  onSelectProduct: (product: WholesaleProduct) => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  selectedProductId,
  selectedProduct: explicitSelectedProduct,
  onSelectProduct,
  onSearch,
  isLoading = false,
  placeholder = "Search product by name, barcode, brand...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected product
  const selectedProduct =
    explicitSelectedProduct || products.find((p) => p.id === selectedProductId);

  // Sync search query display with selected product when closed
  useEffect(() => {
    if (!isOpen) {
      if (selectedProduct) {
        setSearchQuery(`${selectedProduct.name} [${selectedProduct.code}]`);
      } else {
        setSearchQuery("");
      }
    }
  }, [selectedProductId, selectedProduct, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Reset query display to selected product
        if (selectedProduct) {
          setSearchQuery(`${selectedProduct.name} [${selectedProduct.code}]`);
        } else {
          setSearchQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  // Filter products by name, code, brand, or category if purely client-side
  const filteredProducts = React.useMemo(() => {
    if (onSearch) {
      // Backend does filtering
      return products;
    }
    if (!searchQuery.trim()) return products;
    if (
      selectedProduct &&
      searchQuery === `${selectedProduct.name} [${selectedProduct.code}]`
    ) {
      return products;
    }

    const term = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchName = p.name?.toLowerCase().includes(term);
      const matchCode = p.code?.toLowerCase().includes(term);
      const matchBrand = p.brand?.toLowerCase().includes(term);
      const matchCat = p.category?.toLowerCase().includes(term);
      return matchName || matchCode || matchBrand || matchCat;
    });
  }, [products, searchQuery, selectedProduct, onSearch]);

  const displayProducts = filteredProducts;

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [displayProducts.length]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (product: WholesaleProduct) => {
    onSelectProduct(product);
    setSearchQuery(`${product.name} [${product.code}]`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery("");
    if (onSearch) {
      onSearch("");
    }
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsOpen(true);
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < displayProducts.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : displayProducts.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (displayProducts[highlightedIndex]) {
          handleSelect(displayProducts[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        if (selectedProduct) {
          setSearchQuery(`${selectedProduct.name} [${selectedProduct.code}]`);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 text-xs transition-all cursor-text shadow-xs ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
        ) : (
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            if (
              selectedProduct &&
              searchQuery === `${selectedProduct.name} [${selectedProduct.code}]`
            ) {
              if (onSearch) onSearch("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none text-xs font-medium truncate"
        />

        {/* Clear Search / Reset Button */}
        {searchQuery ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        ) : null}

        {/* Dropdown Toggle Indicator */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Dropdown Results Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header count / hint */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              {isLoading
                ? "Searching catalog..."
                : `${displayProducts.length} product${displayProducts.length === 1 ? "" : "s"} found`}
            </span>
            <span className="hidden sm:inline">Use ↑↓ keys & Enter to select</span>
          </div>

          <ul ref={listRef} className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading && displayProducts.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Searching product database...</span>
              </li>
            ) : displayProducts.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-400 space-y-1">
                <Package className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">
                  No wholesale products found
                </p>
                <p className="text-[11px]">
                  Try searching with a different name, barcode, brand, or category.
                </p>
              </li>
            ) : (
              displayProducts.map((p, index) => {
                const isSelected = p.id === selectedProductId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={p.id}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(p)}
                    className={`px-3 py-2.5 cursor-pointer text-xs flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200"
                        : isSelected
                        ? "bg-slate-50 dark:bg-slate-800/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md">
                            <Check className="w-2.5 h-2.5" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300">
                          {p.code}
                        </span>
                        {p.brand && <span>• Brand: {p.brand}</span>}
                        {p.category && <span>• {p.category}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-slate-900 dark:text-white block">
                        ₹{p.rate.toLocaleString()}
                      </span>
                      <span
                        className={`text-[10px] font-medium block ${
                          p.quantity <= 0
                            ? "text-amber-500 font-semibold"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        Stock: {p.quantity}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

