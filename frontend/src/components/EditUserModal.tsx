"use client";

import React, { useEffect, useState } from "react";
import { X, UserCheck, AlertCircle, Plus } from "lucide-react";
import { usersApi, branchesApi, departmentsApi, getErrorMessage } from "@/lib/api";
import { Branch, Department, Role, User } from "@/lib/types";

interface EditUserModalProps {
  user: User | null;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  currentUser,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showQuickAddBranch, setShowQuickAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);

  const [showQuickAddDept, setShowQuickAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [quickCreatingDept, setQuickCreatingDept] = useState(false);

  const [isActive, setIsActive] = useState<boolean>(true);
  const [canPlaceOrders, setCanPlaceOrders] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const canManageOrganizational = isSuperAdmin || currentUser?.role === "ADMIN";

  useEffect(() => {
    if (isOpen) {
      branchesApi.list(true).then(setBranches).catch(() => {});
      departmentsApi.list(true).then(setDepartments).catch(() => {});
      setShowQuickAddBranch(false);
      setNewBranchName("");
      setShowQuickAddDept(false);
      setNewDeptName("");
    }
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setPassword("");
      setRole(user.role);
      setBranch(user.branch || "");
      setDepartment(user.department || "");
      setIsActive(user.is_active);
      setCanPlaceOrders(!!user.can_place_wholesale_orders);
      setError(null);
    }
  }, [user, isOpen]);

  const handleQuickCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setQuickCreating(true);
    try {
      const created = await branchesApi.create({ name: newBranchName.trim() });
      setBranches((prev) => [...prev, created]);
      setBranch(created.name);
      setNewBranchName("");
      setShowQuickAddBranch(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setQuickCreating(false);
    }
  };

  const handleQuickCreateDepartment = async () => {
    if (!newDeptName.trim()) return;
    setQuickCreatingDept(true);
    try {
      const created = await departmentsApi.create({ name: newDeptName.trim() });
      setDepartments((prev) => [...prev, created]);
      setDepartment(created.name);
      setNewDeptName("");
      setShowQuickAddDept(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setQuickCreatingDept(false);
    }
  };

  const branchOptions = Array.from(
    new Set([
      ...branches.map((b) => b.name),
      ...(branch ? [branch] : []),
    ])
  );

  const departmentOptions = Array.from(
    new Set([
      ...departments.map((d) => d.name),
      ...(department ? [department] : []),
    ])
  );

  const renderBranchSelector = (required: boolean, helperText: string) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Branch Location {required && "*"}
        </label>
        {canManageOrganizational && (
          <button
            type="button"
            onClick={() => setShowQuickAddBranch(!showQuickAddBranch)}
            className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{showQuickAddBranch ? "Select Existing" : "+ New Branch"}</span>
          </button>
        )}
      </div>

      {showQuickAddBranch ? (
        <div className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2 mb-1">
          <input
            type="text"
            placeholder="New branch name (e.g. Kottayam Branch)"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleQuickCreateBranch}
              disabled={quickCreating || !newBranchName.trim()}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
            >
              {quickCreating ? "Saving..." : "Save Branch"}
            </button>
          </div>
        </div>
      ) : (
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          required={required}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
        >
          <option value="">-- Select Branch Location --</option>
          {branchOptions.map((bName) => (
            <option key={bName} value={bName}>
              {bName}
            </option>
          ))}
        </select>
      )}
      <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>
    </div>
  );

  const renderDepartmentSelector = (required: boolean, helperText: string) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Department Categorization {required && "*"}
        </label>
        {canManageOrganizational && (
          <button
            type="button"
            onClick={() => setShowQuickAddDept(!showQuickAddDept)}
            className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{showQuickAddDept ? "Select Existing" : "+ New Dept"}</span>
          </button>
        )}
      </div>

      {showQuickAddDept ? (
        <div className="p-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 space-y-2 mb-1">
          <input
            type="text"
            placeholder="New department name (e.g. Quality Assurance)"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleQuickCreateDepartment}
              disabled={quickCreatingDept || !newDeptName.trim()}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
            >
              {quickCreatingDept ? "Saving..." : "Save Dept"}
            </button>
          </div>
        </div>
      ) : (
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required={required}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-hidden"
        >
          <option value="">-- Select Department --</option>
          {departmentOptions.map((dName) => (
            <option key={dName} value={dName}>
              {dName}
            </option>
          ))}
        </select>
      )}
      <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>
    </div>
  );

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        branch: branch.trim() || null,
        department: department.trim() || null,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      if (isSuperAdmin) {
        payload.role = role;
        payload.is_active = isActive;
        payload.can_place_wholesale_orders = canPlaceOrders;
      }

      await usersApi.update(user.id, payload);
      onUserUpdated();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Edit User Profile</h2>
              <p className="text-[11px] sm:text-xs text-slate-500">Update account credentials & permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Must be at least 6 characters if updating.
            </p>
          </div>

          {/* Branch & Department Categorization */}
          {role === "ADMIN" && (
            renderBranchSelector(true, "Designates this Admin as managing this specific branch location")
          )}

          {(role === "IN_CHARGE" || role === "TEAM_LEADER") && (
            <>
              {renderDepartmentSelector(
                true,
                `Department this ${role === "IN_CHARGE" ? "In-Charge" : "Team Leader"} is responsible for`
              )}
              {renderBranchSelector(false, "Branch location this role operates from")}
            </>
          )}

          {role === "STAFF" && (
            <>
              {renderDepartmentSelector(
                false,
                "Department this staff belongs to (determines approval routing)"
              )}
              {renderBranchSelector(false, "Branch this staff belongs to (determines Admin approver routing)")}
            </>
          )}

          {role === "SUPER_ADMIN" && isSuperAdmin && (
            <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
              Super Admins have universal access across all branches and departments.
            </div>
          )}

          {isSuperAdmin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hierarchical Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Level 1)</option>
                  <option value="ADMIN">ADMIN (Level 2)</option>
                  <option value="IN_CHARGE">IN_CHARGE (Level 3)</option>
                  <option value="TEAM_LEADER">TEAM_LEADER (Level 4)</option>
                  <option value="STAFF">STAFF (Level 5)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                    Account Status
                  </span>
                  <span className="text-[11px] text-slate-500">Allow user to log in and operate</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                    Wholesale Order Placement
                  </span>
                  <span className="text-[11px] text-slate-500">Allow placing wholesale customer orders</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canPlaceOrders}
                    onChange={(e) => setCanPlaceOrders(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </>
          )}

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
              disabled={loading}
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

