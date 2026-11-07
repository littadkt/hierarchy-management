import React from "react";
import { CheckCircle2, Clock, PlayCircle, AlertCircle, XCircle } from "lucide-react";
import { TaskStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case "PENDING":
        return {
          label: "To Do",
          icon: Clock,
          classes: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
        };
      case "IN_PROGRESS":
        return {
          label: "In Progress",
          icon: PlayCircle,
          classes: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        };
      case "PENDING_APPROVAL":
        return {
          label: "Awaiting Approval",
          icon: AlertCircle,
          classes: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 animate-pulse",
        };
      case "COMPLETED":
        return {
          label: "Completed",
          icon: CheckCircle2,
          classes: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          icon: XCircle,
          classes: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
        };
      default:
        return {
          label: status,
          icon: Clock,
          classes: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const { label, icon: Icon, classes } = getBadgeConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
};

