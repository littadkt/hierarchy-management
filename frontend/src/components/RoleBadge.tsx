import React from "react";
import { Role } from "@/lib/types";

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = "" }) => {
  const getBadgeConfig = () => {
    switch (role) {
      case "SUPER_ADMIN":
        return {
          label: "Super Admin",
          classes: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
        };
      case "ADMIN":
        return {
          label: "Admin",
          classes: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        };
      case "IN_CHARGE":
        return {
          label: "In-Charge",
          classes: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "TEAM_LEADER":
        return {
          label: "Team Leader",
          classes: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        };
      case "STAFF":
        return {
          label: "Staff",
          classes: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        };
      default:
        return {
          label: role,
          classes: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const { label, classes } = getBadgeConfig();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classes} ${className}`}
    >
      {label}
    </span>
  );
};

