import React from "react";
import { PurchaseRequestStatus } from "@/lib/types";

interface PurchaseStatusBadgeProps {
  status: PurchaseRequestStatus;
  className?: string;
}

export const PurchaseStatusBadge: React.FC<PurchaseStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case "OPEN":
        return {
          label: "Open (Pending)",
          classes:
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        };
      case "ORDERED":
        return {
          label: "Ordered",
          classes:
            "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
        };
      case "NOT_IN_STOCK":
        return {
          label: "Not in Stock",
          classes:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
        };
      case "RECEIVED":
        return {
          label: "Received (Complete)",
          classes:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        };
      default:
        return {
          label: status,
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

