"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Trash2, Edit, AlertCircle, Info, ShieldCheck, Building2, Layers, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { usersApi, branchesApi, departmentsApi, getErrorMessage } from "@/lib/api";
import { Branch, Department, User } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";
import { CreateUserModal } from "@/components/CreateUserModal";
import { EditUserModal } from "@/components/EditUserModal";

export default function UsersPage() {
  const { user } = useAuth();
  const { confirm, alert } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const isPrivilegedRole = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [data, branchList, deptList] = await Promise.all([
        usersApi.list(),
        branchesApi.list(true).catch(() => []),
        departmentsApi.list(true).catch(() => []),
      ]);
      setUsers(data);
      setBranches(branchList);
      setDepartments(deptList);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUsers();
    }
  }, [user]);

  useRealtimeEvent(["USER_LOGIN", "RESYNC"], (event) => {
    if (event.type === "USER_LOGIN" && event.data?.user_id) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === event.data.user_id
            ? {
                ...u,
                today_first_login_at: event.data.today_first_login_at || u.today_first_login_at,
                last_login_at: event.data.last_login_at || u.last_login_at,
              }
            : u
        )
      );
    }
    loadUsers(true);
  });

  // Extract unique branches and departments (from both registered records and assigned users) for filters
  const uniqueBranches = Array.from(
    new Set([
      ...branches.map((b) => b.name),
      ...(users.map((u) => u.branch).filter(Boolean) as string[]),
    ])
  ).sort();
  const uniqueDepartments = Array.from(
    new Set([
      ...departments.map((d) => d.name),
      ...(users.map((u) => u.department).filter(Boolean) as string[]),
    ])
  ).sort();

  const filteredUsers = users.filter((u) => {
    if (selectedRole !== "ALL" && u.role !== selectedRole) return false;
    if (selectedBranch !== "ALL" && (u.branch || "") !== selectedBranch) return false;
    if (selectedDepartment !== "ALL" && (u.department || "") !== selectedDepartment) return false;
    return true;
  });

  // Determine if current user can create users
  const canCreateUsers = () => {
    if (!user) return false;
    return ["SUPER_ADMIN", "ADMIN", "IN_CHARGE", "TEAM_LEADER"].includes(user.role);
  };

  // Determine if current user can delete target user
  const canDeleteUser = (target: User) => {
    if (!user) return false;
    if (user.id === target.id) return false; // cannot delete self
    if (user.role === "SUPER_ADMIN") return true;

    if (user.role === "ADMIN") {
      // Restriction: Can't edit or delete in-charge
      if (target.role === "IN_CHARGE") return false;
      return target.role === "TEAM_LEADER" || target.role === "STAFF";
    }

    if (user.role === "IN_CHARGE") {
      // Restriction: Can't edit or delete team leaders
      if (target.role === "TEAM_LEADER") return false;
      return target.role === "STAFF";
    }

    if (user.role === "TEAM_LEADER") {
      // Restriction: Can't update or delete staff
      if (target.role === "STAFF") return false;
      return false;
    }

    return false;
  };

  // Determine if current user can edit target user
  const canEditUser = (target: User) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    if (user.id === target.id) return true; // users can edit themselves

    if (user.role === "ADMIN") {
      // Restriction: Can't edit or delete in-charge
      if (target.role === "IN_CHARGE" || target.role === "ADMIN" || target.role === "SUPER_ADMIN") return false;
      return target.role === "TEAM_LEADER" || target.role === "STAFF";
    }

    if (user.role === "IN_CHARGE") {
      // Restriction: Can't edit or delete team leaders
      if (target.role === "TEAM_LEADER" || target.role === "IN_CHARGE" || target.role === "ADMIN" || target.role === "SUPER_ADMIN") return false;
      return target.role === "STAFF";
    }

    if (user.role === "TEAM_LEADER") {
      // Restriction: Can't update or delete staff
      return false;
    }

    return false;
  };

  const handleDelete = async (targetId: string, targetName: string) => {
    const targetUser = users.find((u) => u.id === targetId);
    const isTargetSuperAdmin = targetUser?.role === "SUPER_ADMIN";

    const ok = await confirm({
      title: isTargetSuperAdmin ? "Delete Super Admin Account" : "Delete User",
      message: isTargetSuperAdmin
        ? `Are you sure you want to delete Super Admin "${targetName}"? This account has top-level system privileges. This action cannot be undone.`
        : `Are you sure you want to delete user "${targetName}"? This action cannot be undone.`,
      confirmText: isTargetSuperAdmin ? "Delete Super Admin" : "Delete User",
      type: "danger",
    });
    if (!ok) return;

    try {
      await usersApi.delete(targetId);
      await loadUsers();
    } catch (err) {
      await alert({
        title: "Delete Failed",
        message: getErrorMessage(err),
        type: "error",
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Team & User Provisioning
            </h1>
            <p className="text-xs text-slate-500">
              Manage accounts adhering to strict organizational hierarchy rules
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && (
              <>
                <Link
                  href="/branches"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Manage Branches</span>
                </Link>

                <Link
                  href="/departments"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Manage Departments</span>
                </Link>
              </>
            )}

            {canCreateUsers() && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 self-start sm:self-auto transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create User</span>
              </button>
            )}
          </div>
        </div>

        {/* Role Provisions & Restrictions Notice Banner */}
        <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-300">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Hierarchy Provisioning Rules for Your Role ({user?.role})</p>
            {user?.role === "SUPER_ADMIN" && (
              <p>• Provisions: Can create Super Admins & Admins (and any lower level). Can delete and manage all tiers.</p>
            )}
            {user?.role === "ADMIN" && (
              <p>• Provisions: Can create In-Charge accounts. <strong className="text-rose-600 dark:text-rose-400">Restriction: Cannot edit or delete In-Charge.</strong></p>
            )}
            {user?.role === "IN_CHARGE" && (
              <p>• Provisions: Can create Team Leaders & Staff. <strong className="text-rose-600 dark:text-rose-400">Restriction: Cannot edit or delete Team Leaders.</strong></p>
            )}
            {user?.role === "TEAM_LEADER" && (
              <p>• Provisions: Can create Staff. <strong className="text-rose-600 dark:text-rose-400">Restriction: Cannot update or delete Staff.</strong></p>
            )}
            {user?.role === "STAFF" && (
              <p className="text-rose-600 dark:text-rose-400">• Restrictions: All user creation and management options are restricted.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {filteredUsers.length} of {users.length} Accessible Accounts
            </span>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Role Filter */}
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="IN_CHARGE">In-Charge</option>
                <option value="TEAM_LEADER">Team Leader</option>
                <option value="STAFF">Staff</option>
              </select>

              {/* Branch Filter */}
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Branches</option>
                {uniqueBranches.map((b) => (
                  <option key={b} value={b}>
                    Branch: {b}
                  </option>
                ))}
              </select>

              {/* Department Filter */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((d) => (
                  <option key={d} value={d}>
                    Dept: {d}
                  </option>
                ))}
              </select>

              {(selectedRole !== "ALL" || selectedBranch !== "ALL" || selectedDepartment !== "ALL") && (
                <button
                  onClick={() => {
                    setSelectedRole("ALL");
                    setSelectedBranch("ALL");
                    setSelectedDepartment("ALL");
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Branch / Department</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Today&apos;s First Login</span>
                    </div>
                  </th>
                  <th className="px-5 py-3.5">Created On</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                      No accounts found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const deleteAllowed = canDeleteUser(u);

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {u.full_name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{u.email}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <RoleBadge role={u.role} />
                            {u.is_purchase_manager && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                Purchase Manager
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            {u.role === "SUPER_ADMIN" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                Global / All Branches
                              </span>
                            )}
                            {u.branch && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Branch: {u.branch}
                              </span>
                            )}
                            {u.department && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Dept: {u.department}
                              </span>
                            )}
                            {!u.branch && !u.department && u.role !== "SUPER_ADMIN" && (
                              <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                              u.is_active
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.today_first_login_at ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span
                                title={`First login today: ${new Date(u.today_first_login_at).toLocaleString()}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  {new Date(u.today_first_login_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </span>
                              {u.last_login_at &&
                                new Date(u.last_login_at).getTime() - new Date(u.today_first_login_at).getTime() > 60000 && (
                                  <span
                                    title={`Latest login today: ${new Date(u.last_login_at).toLocaleString()}`}
                                    className="text-[10px] text-slate-400 dark:text-slate-500 pl-1"
                                  >
                                    Latest:{" "}
                                    {new Date(u.last_login_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                            </div>
                          ) : isPrivilegedRole || u.id === user?.id ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span
                                title="No login recorded for this user today"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              >
                                <span>Not logged in today</span>
                              </span>
                              {u.last_login_at && (
                                <span
                                  title={`Last login: ${new Date(u.last_login_at).toLocaleString()}`}
                                  className="text-[10px] text-slate-400 dark:text-slate-500 pl-1"
                                >
                                  Last seen:{" "}
                                  {new Date(u.last_login_at).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {canEditUser(u) && (
                            <button
                              onClick={() => {
                                setEditUser(u);
                                setIsEditOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors inline-flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                          {deleteAllowed ? (
                            <button
                              onClick={() => handleDelete(u.id, u.full_name)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            !canEditUser(u) && (
                              <span className="text-[11px] text-slate-400 italic">
                                Action restricted
                              </span>
                            )
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
      </div>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onUserCreated={() => {
          loadUsers();
        }}
      />

      <EditUserModal
        user={editUser}
        currentUser={user}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditUser(null);
        }}
        onUserUpdated={() => loadUsers()}
      />
    </ProtectedRoute>
  );
}

