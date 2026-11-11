"use client";

import React, { useState } from "react";
import { X, Plus, Edit2, Trash2, Check, Loader2, Tag, Users, Shield, Cpu } from "lucide-react";
import { warrantyApi, getErrorMessage } from "@/lib/api";
import { useConfirm } from "@/context/ConfirmContext";
import { WarrantyBrand, WarrantyModel, WarrantyServiceType, WarrantyStaff } from "@/lib/types";

export type LookupType = "service_type" | "staff" | "brand" | "model";

interface ManageWarrantyLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LookupType;
  selectedBrandId?: string;
  onItemCreated?: (item: any) => void;
  onItemUpdated?: (item: any) => void;
  onItemDeleted?: (id: string) => void;
  items: any[];
  refreshItems: () => Promise<void>;
}

export const ManageWarrantyLookupModal: React.FC<ManageWarrantyLookupModalProps> = ({
  isOpen,
  onClose,
  type,
  selectedBrandId,
  onItemCreated,
  onItemUpdated,
  onItemDeleted,
  items,
  refreshItems,
}) => {
  const { confirm, alert } = useConfirm();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case "service_type":
        return "Manage Service Types";
      case "staff":
        return "Manage Warranty Staff";
      case "brand":
        return "Manage Brands";
      case "model":
        return "Manage Product Models";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "service_type":
        return <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case "staff":
        return <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case "brand":
        return <Tag className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "model":
        return <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      let created: any = null;
      if (type === "service_type") {
        created = await warrantyApi.createServiceType({
          name: newName.trim(),
          description: newDesc.trim() || undefined,
        });
      } else if (type === "staff") {
        created = await warrantyApi.createStaff({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
        });
      } else if (type === "brand") {
        created = await warrantyApi.createBrand({
          name: newName.trim(),
        });
      } else if (type === "model") {
        created = await warrantyApi.createModel({
          name: newName.trim(),
          brand_id: selectedBrandId || undefined,
        });
      }

      setNewName("");
      setNewDesc("");
      setNewPhone("");
      setNewEmail("");
      await refreshItems();
      if (onItemCreated && created) {
        onItemCreated(created);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditDesc(item.description || "");
    setEditPhone(item.phone || "");
    setEditEmail(item.email || "");
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let updated: any = null;
      if (type === "service_type") {
        updated = await warrantyApi.updateServiceType(itemId, {
          name: editName.trim(),
          description: editDesc.trim() || null,
        });
      } else if (type === "staff") {
        updated = await warrantyApi.updateStaff(itemId, {
          name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
        });
      } else if (type === "brand") {
        updated = await warrantyApi.updateBrand(itemId, {
          name: editName.trim(),
        });
      } else if (type === "model") {
        updated = await warrantyApi.updateModel(itemId, {
          name: editName.trim(),
          brand_id: selectedBrandId || undefined,
        });
      }

      setEditingId(null);
      await refreshItems();
      if (onItemUpdated && updated) {
        onItemUpdated(updated);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: any) => {
    const ok = await confirm({
      title: `Delete ${item.name}`,
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
    });
    if (!ok) return;

    setLoading(true);
    try {
      if (type === "service_type") {
        await warrantyApi.deleteServiceType(item.id);
      } else if (type === "staff") {
        await warrantyApi.deleteStaff(item.id);
      } else if (type === "brand") {
        await warrantyApi.deleteBrand(item.id);
      } else if (type === "model") {
        await warrantyApi.deleteModel(item.id);
      }
      await refreshItems();
      if (onItemDeleted) {
        onItemDeleted(item.id);
      }
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {getIcon()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {getTitle()}
              </h3>
              <p className="text-xs text-slate-500">
                Add, edit, or remove entries available in the dropdown
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Add New Item Form */}
        <form onSubmit={handleCreate} className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Add New Entry
          </span>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={
                  type === "service_type"
                    ? "Service type name (e.g. Screen Replacement)"
                    : type === "staff"
                    ? "Staff member name"
                    : type === "brand"
                    ? "Brand name (e.g. Sony, HP)"
                    : "Model name (e.g. XPS 15, S24)"
                }
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !newName.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </div>

            {type === "service_type" && (
              <input
                type="text"
                placeholder="Description / note (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
            )}

            {type === "staff" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Phone number (optional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />
                <input
                  type="email"
                  placeholder="Email address (optional)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />
              </div>
            )}
          </div>
        </form>

        {/* Existing Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 max-h-72">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No entries registered yet. Use the form above to add one.
            </div>
          ) : (
            items.map((item) => {
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={loading || !editName.trim()}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs transition cursor-pointer"
                        title="Save changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {type === "service_type" && (
                      <input
                        type="text"
                        placeholder="Description"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                      />
                    )}

                    {type === "staff" && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Phone"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="px-3 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="px-3 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                      {item.name}
                    </span>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                    {(item.phone || item.email) && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.phone && <span>{item.phone}</span>}
                        {item.phone && item.email && <span> • </span>}
                        {item.email && <span>{item.email}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      title="Edit"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
