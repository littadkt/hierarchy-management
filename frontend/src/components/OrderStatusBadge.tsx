import React from "react";
import { WholesaleOrderStatus } from "@/lib/types";

interface OrderStatusBadgeProps {
  status: WholesaleOrderStatus;
  className?: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case "PENDING":
        return {
          label: "Pending",
          classes:
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
        };
      case "CONFIRMED":
        return {
          label: "Confirmed",
          classes:
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        };
      case "DISPATCHED":
        return {
          label: "Dispatched",
          classes:
            "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
        };
      case "DELIVERED":
        return {
          label: "Delivered",
          classes:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "CANCELLED":
        return {
          label: "Cancelled",
          classes:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
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
