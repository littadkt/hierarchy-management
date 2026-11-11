"use client";

import React, { useEffect, useRef, useState } from "react";
import { Moon, Sun, Monitor, Palette, Check, ChevronDown } from "lucide-react";
import { useTheme, COLOR_OPTIONS, Theme, PrimaryColor } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  showLabel = false,
}) => {
  const { theme, resolvedTheme, primaryColor, setTheme, setPrimaryColor, toggleTheme } =
    useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`}
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const activeColor = COLOR_OPTIONS.find((c) => c.id === primaryColor) || COLOR_OPTIONS[0];

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={menuRef}>
      {/* Main 1-Click Toggle Button with Dropdown Trigger */}
      <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 shadow-xs p-0.5 transition-colors">
        {/* Toggle Theme (Sun/Moon) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`relative inline-flex items-center justify-center p-2 rounded-lg transition-all duration-200 cursor-pointer ${
            isDark
              ? "text-amber-400 hover:bg-slate-700/80 hover:text-amber-300"
              : "text-slate-600 hover:bg-slate-100 hover:text-primary"
          }`}
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            {isDark ? (
              <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
            ) : (
              <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100" />
            )}
          </div>
          {showLabel && (
            <span className="ml-2 text-xs font-semibold">
              {isDark ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </button>

        {/* Color Palette Menu Opener */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Customize Theme & Colors"
          title="Customize Theme & Colors"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span
            className="w-3 h-3 rounded-full shrink-0 shadow-xs border border-white/40"
            style={{ backgroundColor: activeColor.colorHex }}
          />
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Theme & Color Picker Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Mode Selector */}
          <div className="mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1.5 block">
              Display Mode
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Sun className="w-3.5 h-3.5 mb-0.5 text-amber-500" />
                <span className="text-[11px]">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Moon className="w-3.5 h-3.5 mb-0.5 text-primary" />
                <span className="text-[11px]">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5 mb-0.5 text-slate-500" />
                <span className="text-[11px]">Auto</span>
              </button>
            </div>
          </div>

          {/* Color Palette Picker */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1.5 block">
              Theme Accent Color
            </span>
            <div className="grid grid-cols-6 gap-1.5 px-1 py-1">
              {COLOR_OPTIONS.map((color) => {
                const isSelected = primaryColor === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setPrimaryColor(color.id)}
                    title={color.label}
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                      isSelected
                        ? "ring-2 ring-offset-2 ring-primary dark:ring-offset-slate-900 shadow-md scale-105"
                        : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: color.colorHex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
