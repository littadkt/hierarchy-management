"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, X, Check, Users, MapPin, Phone, Loader2 } from "lucide-react";
import { WholesaleCustomer } from "@/lib/types";

interface SearchableCustomerSelectProps {
  customers: WholesaleCustomer[];
  selectedCustomerId: string;
  selectedCustomer?: WholesaleCustomer | null;
  onSelectCustomer: (customer: WholesaleCustomer) => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const SearchableCustomerSelect: React.FC<SearchableCustomerSelectProps> = ({
  customers,
  selectedCustomerId,
  selectedCustomer: explicitSelectedCustomer,
  onSelectCustomer,
  onSearch,
  isLoading = false,
  placeholder = "Search customer by name, place, phone...",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected customer
  const selectedCustomer =
    explicitSelectedCustomer || customers.find((c) => c.id === selectedCustomerId);

  // Sync search query display with selected customer when closed
  useEffect(() => {
    if (!isOpen) {
      if (selectedCustomer) {
        setSearchQuery(
          selectedCustomer.place
            ? `${selectedCustomer.name} (${selectedCustomer.place})`
            : selectedCustomer.name
        );
      } else {
        setSearchQuery("");
      }
    }
  }, [selectedCustomerId, selectedCustomer, isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (selectedCustomer) {
          setSearchQuery(
            selectedCustomer.place
              ? `${selectedCustomer.name} (${selectedCustomer.place})`
              : selectedCustomer.name
          );
        } else {
          setSearchQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCustomer]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [customers.length]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (customer: WholesaleCustomer) => {
    onSelectCustomer(customer);
    setSearchQuery(
      customer.place ? `${customer.name} (${customer.place})` : customer.name
    );
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
          prev < customers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (customers[highlightedIndex]) {
          handleSelect(customers[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Box */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border bg-white dark:bg-slate-800 text-xs transition-all cursor-text ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
        ) : (
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            if (
              selectedCustomer &&
              searchQuery ===
                (selectedCustomer.place
                  ? `${selectedCustomer.name} (${selectedCustomer.place})`
                  : selectedCustomer.name)
            ) {
              // If focused, allow typing a fresh search
              if (onSearch) onSearch("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none font-medium truncate"
        />

        <div className="flex items-center gap-1 shrink-0">
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-emerald-600" : ""
            }`}
          />
        </div>
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 p-1"
          >
            {isLoading && customers.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Searching customer database...</span>
              </li>
            ) : customers.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400">
                <Users className="w-5 h-5 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-600 dark:text-slate-300">
                  No matching customers found
                </p>
                <p className="text-[11px] mt-0.5">
                  Try searching by different name, city, or phone number.
                </p>
              </li>
            ) : (
              customers.map((c, index) => {
                const isSelected = c.id === selectedCustomerId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isHighlighted
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-300"
                    } ${isSelected ? "font-bold" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate">
                          {c.name}
                        </span>
                        {c.place && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 shrink-0">
                            <MapPin className="w-2.5 h-2.5" />
                            {c.place}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-slate-400 font-normal">
                        {c.contact_number && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            {c.contact_number}
                          </span>
                        )}
                        {c.email && (
                          <span className="truncate hidden sm:inline text-slate-400">
                            • {c.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          <div className="p-2 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-400 flex items-center justify-between">
            <span>
              Type to search live across all registered wholesale customers
            </span>
            <span>
              {customers.length} result{customers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

