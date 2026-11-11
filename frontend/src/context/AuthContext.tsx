"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasPermission: (windowId: string, action: "add" | "display" | "edit" | "delete") => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      authApi
        .getMe()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        setToken(null);
        setUser(null);
        router.push("/login");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const data = await authApi.login(email, pass);
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  };

  const hasPermission = (
    windowId: string,
    action: "add" | "display" | "edit" | "delete"
  ): boolean => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;

    // Direct permission override if stored
    if (user.permissions) {
      if (user.permissions[windowId]) {
        return !!user.permissions[windowId][action];
      }
      if (windowId.startsWith("warranty_") && user.permissions["warranty"]) {
        return !!user.permissions["warranty"][action];
      }
    }

    // Role defaults when no custom override is saved
    if (user.role === "ADMIN") {
      if (windowId === "backup") return false;
      return true;
    }

    if (user.role === "IN_CHARGE") {
      if (windowId === "backup") return false;
      if (action === "display") return true;
      if (["tasks", "subtasks", "checklist", "approvals", "warranty", "warranty_jobs", "attendance"].includes(windowId)) return true;
      return false;
    }

    if (user.role === "TEAM_LEADER") {
      if (["backup", "branches", "departments", "wholesale"].includes(windowId)) return false;
      if (action === "display") return true;
      if (["tasks", "subtasks", "checklist", "warranty", "warranty_jobs", "attendance"].includes(windowId) && ["add", "edit"].includes(action)) return true;
      if (windowId === "approvals" && action === "add") return true;
      return false;
    }

    if (user.role === "STAFF") {
      if (["backup", "branches", "departments", "wholesale", "users", "hierarchy", "approvals"].includes(windowId)) return false;
      if (["dashboard", "tasks", "subtasks", "attendance", "warranty", "warranty_jobs", "checklist", "inventory", "purchases"].includes(windowId) && action === "display") return true;
      if (windowId === "checklist") return true;
      if (["tasks", "subtasks"].includes(windowId) && action === "edit") return true;
      if (["attendance", "warranty", "warranty_jobs"].includes(windowId) && action === "add") return true;
      return false;
    }

    return true;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

