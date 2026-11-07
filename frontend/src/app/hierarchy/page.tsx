"use client";

import React, { useEffect, useState } from "react";
import {
  Network,
  Users,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";
import { hierarchyApi, getErrorMessage } from "@/lib/api";
import { Role, User } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBadge } from "@/components/RoleBadge";

export default function HierarchyPage() {
  const { user } = useAuth();
  const [overviewUsers, setOverviewUsers] = useState<User[]>([]);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "tree">("overview");
  const [filterBranch, setFilterBranch] = useState<string>("ALL");
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [overview, tree] = await Promise.all([
        hierarchyApi.getOverview(),
        hierarchyApi.getTree(),
      ]);
      setOverviewUsers(overview);
      setTreeData(tree);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useRealtimeEvent(["USER_LOGIN", "RESYNC"], (event) => {
    if (event.type === "USER_LOGIN" && event.data?.user_id) {
      setOverviewUsers((prev) =>
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
    loadData(true);
  });

  // Extract unique branches and departments
  const allBranches = Array.from(
    new Set(overviewUsers.map((u) => u.branch).filter(Boolean) as string[])
  ).sort();
  const allDepartments = Array.from(
    new Set(overviewUsers.map((u) => u.department).filter(Boolean) as string[])
  ).sort();

  // Filter users based on selected branch and department
  const filteredOverviewUsers = overviewUsers.filter((u) => {
    if (filterBranch !== "ALL" && (u.branch || "") !== filterBranch) return false;
    if (filterDepartment !== "ALL" && (u.department || "") !== filterDepartment) return false;
    return true;
  });

  // Group users by role for Super Admin overview
  const roleGroups: Record<Role, User[]> = {
    SUPER_ADMIN: [],
    ADMIN: [],
    IN_CHARGE: [],
    TEAM_LEADER: [],
    STAFF: [],
  };

  filteredOverviewUsers.forEach((u) => {
    if (roleGroups[u.role]) {
      roleGroups[u.role].push(u);
    }
  });

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Network className="w-6 h-6 text-indigo-600" />
              <span>Organizational Hierarchy & Task Metrics</span>
            </h1>
            <p className="text-xs text-slate-500">
              {user?.role === "SUPER_ADMIN"
                ? "Super Admin View: Monitoring all Super Admins, Admins, In-Charge, Team Leaders, and Staff with their live task details"
                : `Hierarchy reporting scoped to your role (${user?.role})`}
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
            {/* Filter by Branch */}
            {allBranches.length > 0 && (
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Branches</option>
                {allBranches.map((b) => (
                  <option key={b} value={b}>
                    Branch: {b}
                  </option>
                ))}
              </select>
            )}

            {/* Filter by Department */}
            {allDepartments.length > 0 && (
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">All Departments</option>
                {allDepartments.map((d) => (
                  <option key={d} value={d}>
                    Dept: {d}
                  </option>
                ))}
              </select>
            )}

            {(filterBranch !== "ALL" || filterDepartment !== "ALL") && (
              <button
                onClick={() => {
                  setFilterBranch("ALL");
                  setFilterDepartment("ALL");
                }}
                className="text-xs font-semibold text-indigo-600 hover:underline px-1"
              >
                Reset
              </button>
            )}

            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
              <button
                onClick={() => setViewMode("overview")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === "overview"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Role Overview
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === "tree"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Org Tree
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl">
            {error}
          </div>
        )}

        {/* View 1: Role Overview Cards */}
        {viewMode === "overview" && (
          <div className="space-y-6">
            {(
              [
                { role: "SUPER_ADMIN", title: "Super Admins", color: "purple" },
                { role: "ADMIN", title: "Admins", color: "blue" },
                { role: "IN_CHARGE", title: "In-Charge Leaders", color: "emerald" },
                { role: "TEAM_LEADER", title: "Team Leaders", color: "amber" },
                { role: "STAFF", title: "Operational Staff", color: "slate" },
              ] as const
            ).map((group) => {
              const members = roleGroups[group.role] || [];
              if (members.length === 0) return null;

              return (
                <div
                  key={group.role}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <RoleBadge role={group.role} />
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        {group.title} ({members.length})
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                              {member.full_name}
                            </h4>
                            <p className="text-xs text-slate-500">{member.email}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              {member.branch && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  Branch: {member.branch}
                                </span>
                              )}
                              {member.department && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Dept: {member.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {member.manager_name && (
                          <p className="text-[11px] text-slate-500">
                            Reports to:{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {member.manager_name}
                            </span>
                          </p>
                        )}

                        {(user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || member.id === user?.id) && (
                          <div className="pt-0.5">
                            {member.today_first_login_at ? (
                              <div
                                title={`First login today: ${new Date(member.today_first_login_at).toLocaleString()}`}
                                className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-md px-2 py-0.5"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>
                                  Login:{" "}
                                  {new Date(member.today_first_login_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span
                                title="Not logged in yet today"
                                className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-0.5"
                              >
                                Not logged in today
                              </span>
                            )}
                          </div>
                        )}

                        {/* Task Statistics Breakdown */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Task Performance ({member.task_stats?.total_assigned || 0} Total)
                          </span>
                          <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                            <div className="p-1 rounded bg-gray-100 dark:bg-gray-800">
                              <span className="text-slate-500 block">To Do</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {member.task_stats?.pending || 0}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-blue-100 dark:bg-blue-950/60">
                              <span className="text-blue-700 dark:text-blue-300 block">Active</span>
                              <span className="font-bold text-blue-900 dark:text-blue-200">
                                {member.task_stats?.in_progress || 0}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-amber-100 dark:bg-amber-950/60">
                              <span className="text-amber-700 dark:text-amber-300 block">Review</span>
                              <span className="font-bold text-amber-900 dark:text-amber-200">
                                {member.task_stats?.pending_approval || 0}
                              </span>
                            </div>
                            <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950/60">
                              <span className="text-emerald-700 dark:text-emerald-300 block">Done</span>
                              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                {member.task_stats?.completed || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View 2: Interactive Nested Org Tree */}
        {viewMode === "tree" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Reporting Tree Lineage
            </h3>
            <p className="text-xs text-slate-500">
              Explore reporting lines and drill down into sub-teams and their task workload
            </p>

            <div className="space-y-2 pt-2">
              {treeData.map((node) => (
                <TreeNode key={node.id} node={node} level={0} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// Tree Node Recursive Component
const TreeNode: React.FC<{ node: any; level: number }> = ({ node, level }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.subordinates && node.subordinates.length > 0;

  return (
    <div className="text-xs">
      <div
        className={`flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
          level > 0 ? "ml-6" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-4 h-4" />
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {node.full_name}
              </span>
              <RoleBadge role={node.role} />
              {node.branch && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {node.branch}
                </span>
              )}
              {node.department && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {node.department}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">{node.email}</p>
          </div>
        </div>

        {/* Workload badges */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {node.task_stats?.in_progress || 0} In Progress
          </span>
          <span className="px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {node.task_stats?.completed || 0} Closed
          </span>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="border-l-2 border-indigo-100 dark:border-slate-800 ml-4 pl-2 space-y-2 mt-2">
          {node.subordinates.map((subNode: any) => (
            <TreeNode key={subNode.id} node={subNode} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

