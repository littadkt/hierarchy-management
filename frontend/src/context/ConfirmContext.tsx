"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";

export type ConfirmType = "danger" | "warning" | "info" | "success";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  type?: "error" | "warning" | "info" | "success";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    isConfirm: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: ConfirmType | "error";
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === "string" ? { message: options } : options;

      setModalState({
        isOpen: true,
        isConfirm: true,
        title: opts.title || "Please Confirm",
        message: opts.message,
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        type: opts.type || "danger",
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const opts: AlertOptions =
        typeof options === "string" ? { message: options } : options;

      setModalState({
        isOpen: true,
        isConfirm: false,
        title: opts.title || (opts.type === "success" ? "Success" : "Notice"),
        message: opts.message,
        confirmText: opts.confirmText || "OK",
        cancelText: "",
        type: opts.type || "error",
        resolve: () => resolve(),
      });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (modalState) {
      modalState.resolve(result);
      setModalState(null);
    }
  };

  // Keyboard navigation
  React.useEffect(() => {
    if (!modalState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose(false);
      } else if (e.key === "Enter") {
        handleClose(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState]);

  const getIcon = () => {
    if (!modalState) return null;
    switch (modalState.type) {
      case "danger":
      case "error":
        return <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />;
      case "warning":
        return <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      case "info":
      default:
        return <Info className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const getIconBg = () => {
    if (!modalState) return "";
    switch (modalState.type) {
      case "danger":
      case "error":
        return "bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-900/60";
      case "warning":
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-200 dark:border-amber-900/60";
      case "success":
        return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border-emerald-200 dark:border-emerald-900/60";
      case "info":
      default:
        return "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border-indigo-200 dark:border-indigo-900/60";
    }
  };

  const getConfirmBtnClass = () => {
    if (!modalState) return "";
    switch (modalState.type) {
      case "danger":
      case "error":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20";
      case "info":
      default:
        return "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20";
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Render Alert / Confirm Modal Dialog */}
      {modalState?.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => handleClose(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 scale-in-95 duration-150"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm ${getIconBg()}`}
              >
                {getIcon()}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {modalState.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed break-words whitespace-pre-wrap">
                  {modalState.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleClose(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              {modalState.isConfirm && (
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {modalState.cancelText}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${getConfirmBtnClass()}`}
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};

