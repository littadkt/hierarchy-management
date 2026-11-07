"use client";

import React, { useEffect, useState } from "react";
import { X, ShieldCheck, Check, AlertCircle, Sparkles, UserCheck } from "lucide-react";
import { wholesaleApi, getErrorMessage } from "@/lib/api";
import { UserBrief } from "@/lib/types";
import { RoleBadge } from "./RoleBadge";

interface SuperAdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsUpdated?: () => void;
}

export const SuperAdminPermissionsModal: React.FC<SuperAdminPermissionsModalProps> = ({
  isOpen,
  onClose,
  onPermissionsUpdated,
}) => {
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await wholesaleApi.listUsersForPermissions();
      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (user: UserBrief) => {
    const newStatus = !user.can_place_wholesale_orders;
    setUpdatingId(user.id);
    setError(null);
    try {
      await wholesaleApi.setPermission(user.id, newStatus);
      // Optimistic update in list
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, can_place_wholesale_orders: newStatus } : u
        )
      );
      if (onPermissionsUpdated) onPermissionsUpdated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-base">
                  Order Placement Authorization Control
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure which users in the hierarchy are allowed to place wholesale orders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Order Placement Authorization</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelfSuperAdmin = u.role === "SUPER_ADMIN";
                    const isUpdating = updatingId === u.id;
                    const isAllowed = isSelfSuperAdmin || !!u.can_place_wholesale_orders;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {u.full_name}
                            </span>
                            <span className="text-[11px] text-slate-400">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isAllowed
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isAllowed ? "Allowed to Place Orders" : "Restricted"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isSelfSuperAdmin ? (
                            <span className="text-[11px] text-purple-600 font-semibold italic">
                              Permanent (Super Admin)
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggle(u)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                                u.can_place_wholesale_orders
                                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                              }`}
                            >
                              {isUpdating
                                ? "Saving..."
                                : u.can_place_wholesale_orders
                                ? "Revoke Permission"
                                : "Allow Orders"}
                            </button>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
