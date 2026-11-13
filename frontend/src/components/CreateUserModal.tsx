"use client";

import React, { useEffect, useState } from "react";
import { X, UserPlus, AlertCircle, ShieldCheck, Plus, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usersApi, branchesApi, departmentsApi, schedulesApi, getErrorMessage } from "@/lib/api";
import { Branch, Department, Role, TimeSchedule } from "@/lib/types";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");

  // Determine allowed roles to create based on operator role
  const getAllowedRoles = (): Role[] => {
    if (!user) return [];
    if (user.role === "SUPER_ADMIN") {
      return ["SUPER_ADMIN", "ADMIN", "IN_CHARGE", "TEAM_LEADER", "STAFF"];
    }
    if (user.role === "ADMIN") {
      return ["IN_CHARGE"];
    }
    if (user.role === "IN_CHARGE") {
      return ["TEAM_LEADER", "STAFF"];
    }
    if (user.role === "TEAM_LEADER") {
      return ["STAFF"];
    }
    return [];
  };

  const allowedRoles = getAllowedRoles();
  const [role, setRole] = useState<Role>("ADMIN");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showQuickAddBranch, setShowQuickAddBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [quickCreating, setQuickCreating] = useState(false);

  const [showQuickAddDept, setShowQuickAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [quickCreatingDept, setQuickCreatingDept] = useState(false);

  // Time Schedule & Custom Check-in/out State
  const [schedules, setSchedules] = useState<TimeSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [showQuickAddSchedule, setShowQuickAddSchedule] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newSchedInTime, setNewSchedInTime] = useState("09:00");
  const [newSchedOutTime, setNewSchedOutTime] = useState("18:00");
  const [quickCreatingSchedule, setQuickCreatingSchedule] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      branchesApi.list(true).then(setBranches).catch(() => {});
      departmentsApi.list(true).then(setDepartments).catch(() => {});
      schedulesApi
        .list()
        .then((data) => {
          setSchedules(data);
          // Auto-select General Shift or the first available schedule
          if (data.length > 0) {
            const defaultSched = data.find((s) => s.name.toLowerCase().includes("general")) || data[0];
            setSelectedScheduleId(defaultSched.id);
            setCheckInTime(defaultSched.check_in_time);
            setCheckOutTime(defaultSched.check_out_time);
          }
        })
        .catch(() => {});
      const allowed = getAllowedRoles();
      if (allowed.length > 0) {
        // Default to SUPER_ADMIN if Super Admin, or first allowed role
        if (!allowed.includes(role)) {
          setRole(allowed[0]);
        }
      }
      // Pre-fill branch/department from current user if applicable
      if (user?.branch) {
        setBranch(user.branch);
      }
      if (user?.department) {
        setDepartment(user.department);
      }
      setError(null);
      setShowQuickAddBranch(false);
      setNewBranchName("");
      setShowQuickAddDept(false);
      setNewDeptName("");
      setShowQuickAddSchedule(false);
      setNewScheduleName("");
    }
  }, [isOpen, user]);

  const handleScheduleSelect = (schedId: string) => {
    setSelectedScheduleId(schedId);
    if (!schedId) {
      setCheckInTime("");
      setCheckOutTime("");
      return;
    }
    const found = schedules.find((s) => s.id === schedId);
    if (found) {
      setCheckInTime(found.check_in_time);
      setCheckOutTime(found.check_out_time);
    }
  };

  const handleQuickCreateSchedule = async () => {
    if (!newScheduleName.trim() || !newSchedInTime || !newSchedOutTime) return;
    setQuickCreatingSchedule(true);
    try {
      const created = await schedulesApi.create({
        name: newScheduleName.trim(),
        check_in_time: newSchedInTime,
        check_out_time: newSchedOutTime,
        buffer_minutes: 10,
        monthly_buffer_limit: 3,
      });
      setSchedules((prev) => [...prev, created]);
      setSelectedScheduleId(created.id);
      setCheckInTime(created.check_in_time);
      setCheckOutTime(created.check_out_time);
      setNewScheduleName("");
      setShowQuickAddSchedule(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setQuickCreatingSchedule(false);
    }
  };

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

  const canManageOrganizational = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const renderBranchSelector = (required: boolean, helperText: string) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
          Branch Location {required && "*"}
        </label>
        {canManageOrganizational && (
          <button
            type="button"
            onClick={() => setShowQuickAddBranch(!showQuickAddBranch)}
            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{showQuickAddBranch ? "Select Existing" : "+ New Branch"}</span>
          </button>
        )}
      </div>

      {showQuickAddBranch ? (
        <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2 mb-1">
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
              className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
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
          className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Select Branch Location --</option>
          {branchOptions.map((bName) => (
            <option key={bName} value={bName}>
              {bName}
            </option>
          ))}
        </select>
      )}
      <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>
    </div>
  );

  const renderDepartmentSelector = (required: boolean, helperText: string) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
          Department Categorization {required && "*"}
        </label>
        {canManageOrganizational && (
          <button
            type="button"
            onClick={() => setShowQuickAddDept(!showQuickAddDept)}
            className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{showQuickAddDept ? "Select Existing" : "+ New Dept"}</span>
          </button>
        )}
      </div>

      {showQuickAddDept ? (
        <div className="p-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 space-y-2 mb-1">
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
              className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 cursor-pointer"
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
          className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">-- Select Department --</option>
          {departmentOptions.map((dName) => (
            <option key={dName} value={dName}>
              {dName}
            </option>
          ))}
        </select>
      )}
      <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>
    </div>
  );

  if (!isOpen || allowedRoles.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!selectedScheduleId) {
      setError("Please select a check-in and check-out schedule.");
      setLoading(false);
      return;
    }

    const selectedSched = schedules.find((s) => s.id === selectedScheduleId);

    try {
      await usersApi.create({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        branch: branch.trim() || undefined,
        department: department.trim() || undefined,
        reports_to_id: role === "SUPER_ADMIN" ? undefined : user?.id,
        schedule_id: selectedScheduleId,
        check_in_time: selectedSched?.check_in_time || checkInTime || undefined,
        check_out_time: selectedSched?.check_out_time || checkOutTime || undefined,
      });
      onUserCreated();
      onClose();
      // Reset
      setFullName("");
      setEmail("");
      setPassword("");
      setBranch("");
      setDepartment("");
      setSelectedScheduleId("");
      setCheckInTime("");
      setCheckOutTime("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<Role, string> = {
    SUPER_ADMIN: "Super Admin (Level 1 - Full Control)",
    ADMIN: "Admin (Level 2)",
    IN_CHARGE: "In-Charge (Level 3)",
    TEAM_LEADER: "Team Leader (Level 4)",
    STAFF: "Staff (Level 5)",
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Create New User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rachel Green"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters (letters & numbers)"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allowedRoles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r] || r.replace("_", " ")}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Allowed options restricted by your role: {user?.role}
            </p>

            {role === "SUPER_ADMIN" && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                <span>
                  <strong>Super Admin Provision:</strong> This user will receive highest-level privileges, including managing all tiers, creating additional super admins, system backups, and global approvals.
                </span>
              </div>
            )}
          </div>

          {/* Branch & Department Categorization */}
          {role === "ADMIN" && (
            renderBranchSelector(true, "Assigns this Admin to head and oversee this branch location")
          )}

          {(role === "IN_CHARGE" || role === "TEAM_LEADER") && (
            <>
              {renderDepartmentSelector(
                true,
                `Department this ${role === "IN_CHARGE" ? "In-Charge" : "Team Leader"} is responsible for`
              )}
              {renderBranchSelector(false, "Optional branch location this role operates from")}
            </>
          )}

          {role === "STAFF" && (
            <>
              {renderDepartmentSelector(
                true,
                "Department this staff member belongs to (determines approval routing)"
              )}
              {renderBranchSelector(false, "Branch location this staff member reports under (determines branch Admin approver routing)")}
            </>
          )}

          {/* Check-in & Check-out Schedule Select */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Check-in & Check-out Schedule *</span>
              </label>
              {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
                <button
                  type="button"
                  onClick={() => setShowQuickAddSchedule(!showQuickAddSchedule)}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showQuickAddSchedule ? "Select Existing" : "+ New Schedule"}</span>
                </button>
              )}
            </div>

            {showQuickAddSchedule ? (
              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2.5">
                <input
                  type="text"
                  placeholder="Schedule name (e.g. Night Shift)"
                  value={newScheduleName}
                  onChange={(e) => setNewScheduleName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Check-in Time</label>
                    <input
                      type="time"
                      value={newSchedInTime}
                      onChange={(e) => setNewSchedInTime(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Check-out Time</label>
                    <input
                      type="time"
                      value={newSchedOutTime}
                      onChange={(e) => setNewSchedOutTime(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleQuickCreateSchedule}
                    disabled={quickCreatingSchedule || !newScheduleName.trim()}
                    className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                  >
                    {quickCreatingSchedule ? "Saving..." : "Save Schedule"}
                  </button>
                </div>
              </div>
            ) : (
              <select
                required
                value={selectedScheduleId}
                onChange={(e) => handleScheduleSelect(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select Check-in & Check-out Schedule * --</option>
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.check_in_time} - {s.check_out_time})
                  </option>
                ))}
              </select>
            )}

            {/* Active Schedule Info Banner */}
            {selectedScheduleId && !showQuickAddSchedule && (
              (() => {
                const s = schedules.find((item) => item.id === selectedScheduleId);
                if (!s) return null;
                return (
                  <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{s.name}</span>
                    </div>
                    <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      {s.check_in_time} – {s.check_out_time}
                    </div>
                  </div>
                );
              })()
            )}

            <p className="text-[10px] text-slate-400">
              10-minute grace buffer applies (max 3 days/month). Late check-in beyond buffer is marked as Half Day Leave.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

