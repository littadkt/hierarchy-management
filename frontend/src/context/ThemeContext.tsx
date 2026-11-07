"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
export type PrimaryColor = "indigo" | "blue" | "purple" | "emerald" | "amber" | "rose";

export interface ColorOption {
  id: PrimaryColor;
  label: string;
  colorHex: string;
  bgClass: string;
  ringClass: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { id: "indigo", label: "Indigo", colorHex: "#4f46e5", bgClass: "bg-indigo-600", ringClass: "ring-indigo-500" },
  { id: "blue", label: "Blue", colorHex: "#2563eb", bgClass: "bg-blue-600", ringClass: "ring-blue-500" },
  { id: "purple", label: "Purple", colorHex: "#9333ea", bgClass: "bg-purple-600", ringClass: "ring-purple-500" },
  { id: "emerald", label: "Emerald", colorHex: "#059669", bgClass: "bg-emerald-600", ringClass: "ring-emerald-500" },
  { id: "amber", label: "Amber", colorHex: "#d97706", bgClass: "bg-amber-600", ringClass: "ring-amber-500" },
  { id: "rose", label: "Rose", colorHex: "#e11d48", bgClass: "bg-rose-600", ringClass: "ring-rose-500" },
];

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  primaryColor: PrimaryColor;
  setTheme: (theme: Theme) => void;
  setPrimaryColor: (color: PrimaryColor) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("system");
  const [primaryColor, setPrimaryColorState] = useState<PrimaryColor>("indigo");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Synchronize initial values from localStorage on mount
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("theme") as Theme | null;
      if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
        setThemeState(storedTheme);
      }
      const storedColor = localStorage.getItem("color-scheme") as PrimaryColor | null;
      if (storedColor && ["indigo", "blue", "purple", "emerald", "amber", "rose"].includes(storedColor)) {
        setPrimaryColorState(storedColor);
      }
    } catch (_) {}
  }, []);

  const applyToDOM = useCallback((currentTheme: Theme, currentColor: PrimaryColor) => {
    if (typeof window === "undefined") return;

    let active: "light" | "dark" = "light";
    if (currentTheme === "system") {
      active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      active = currentTheme;
    }

    setResolvedTheme(active);

    const root = document.documentElement;
    const body = document.body;

    if (active === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
      if (body) {
        body.classList.add("dark");
        body.setAttribute("data-theme", "dark");
      }
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
      if (body) {
        body.classList.remove("dark");
        body.setAttribute("data-theme", "light");
      }
    }

    root.setAttribute("data-color", currentColor);
    if (body) {
      body.setAttribute("data-color", currentColor);
    }
  }, []);

  useEffect(() => {
    applyToDOM(theme, primaryColor);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyToDOM("system", primaryColor);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme, primaryColor, applyToDOM]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
    } catch (_) {}
  };

  const setPrimaryColor = (newColor: PrimaryColor) => {
    setPrimaryColorState(newColor);
    try {
      localStorage.setItem("color-scheme", newColor);
    } catch (_) {}
  };

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        primaryColor,
        setTheme,
        setPrimaryColor,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
