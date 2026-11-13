"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CheckSquare,
  Clock,
  ShieldAlert,
  CheckCircle2,
  X,
  ExternalLink,
  Sparkles,
  Info,
  MapPin,
  LogIn,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { AppNotification } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeEvent } from "@/context/RealtimeContext";

function formatTimeAgo(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export const NotificationDropdown: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [toastNotification, setToastNotification] = useState<AppNotification | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load notifications from API
  const loadNotifications = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const res = await notificationsApi.list({ limit: 40 });
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      requestDesktopPermission();
    }
  }, [user]);

  // Request browser Notification permission if supported
  const requestDesktopPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn("Desktop notification request failed:", err);
      }
    }
  };

  // Real-time notification synchronization
  useRealtimeEvent(
    ["NOTIFICATION_RECEIVED", "NOTIFICATION_UPDATED", "RESYNC"],
    (event) => {
      if (event.type === "NOTIFICATION_RECEIVED") {
        const notifData: AppNotification | undefined = event.data?.notification;
        const targetUserId: string | undefined = event.data?.user_id;

        // Only show if intended for current user
        if (notifData && (!targetUserId || targetUserId === user?.id)) {
          setNotifications((prev) => [notifData, ...prev.filter((n) => n.id !== notifData.id)]);
          setUnreadCount((c) => c + 1);

          // Show in-app slide-in toast
          setToastNotification(notifData);

          // Trigger browser notification if permitted
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(notifData.title, {
                body: notifData.message,
                icon: "/icons/icon-192x192.png",
              });
            } catch (_) {}
          }
        }
      } else if (event.type === "NOTIFICATION_UPDATED") {
        const targetUserId: string | undefined = event.data?.user_id;
        if (!targetUserId || targetUserId === user?.id) {
          loadNotifications(true);
        }
      } else if (event.type === "RESYNC") {
        loadNotifications(true);
      }
    }
  );

  // Auto-dismiss in-app toast after 6 seconds
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, activeTab]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TASK_ASSIGNED":
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
        );
      case "CHECKOUT_REMINDER":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 animate-bounce">
            <Clock className="w-4 h-4" />
          </div>
        );
      case "APPROVAL_REQUESTED":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        );
      case "APPROVAL_DECIDED":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case "CHECKIN_APPROVAL_REQUEST":
        return (
          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
        );
      case "CHECKIN_APPROVAL_DECIDED":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <LogIn className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Bell Trigger Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            if (!isOpen) {
              loadNotifications(true);
            }
          }}
          title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          aria-label="View notifications"
          className="relative p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
        >
          <Bell className="w-5 h-5" />

          {/* Unread Counter Badge */}
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 flex items-center justify-center min-w-[17px] h-[17px] sm:min-w-[18px] sm:h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-xs ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-75 duration-150">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Mobile Backdrop Overlay */}
        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 sm:hidden"
            aria-label="Close notifications overlay"
          />
        )}

        {/* Dropdown Popover Panel */}
        {isOpen && (
          <div className="fixed inset-x-2 top-16 w-auto max-h-[calc(100dvh-5rem)] sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    title="Mark all as read"
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark all read</span>
                    <span className="sm:hidden">Mark all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-3.5 pt-2.5 pb-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeTab === "unread"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification Items List */}
            <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 flex-1">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Loading notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {activeTab === "unread" ? "No unread notifications!" : "All caught up!"}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                    {activeTab === "unread"
                      ? "You have read all your notifications."
                      : "New tasks, checkout reminders, and approvals will appear here."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer ${
                      !notif.is_read
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                        : "opacity-85"
                    }`}
                  >
                    {getNotificationIcon(notif.type)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs block truncate ${
                            !notif.is_read
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-semibold text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {notif.link && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                          <span>View details</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {!notif.is_read && (
                      <span
                        className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1"
                        title="Unread notification"
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer with Desktop Notification Prompt */}
            {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={requestDesktopPermission}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Bell className="w-3 h-3" />
                  <span>Enable desktop alert notifications</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating In-App Live Toast Banner for New Notifications */}
      {toastNotification && (
        <div
          role="alert"
          onClick={() => {
            handleNotificationClick(toastNotification);
            setToastNotification(null);
          }}
          className="fixed bottom-4 left-3 right-3 sm:left-auto sm:top-20 sm:bottom-auto sm:right-6 sm:w-96 sm:max-w-sm z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer animate-in slide-in-from-top-4 duration-200 hover:scale-[1.01] transition-transform"
        >
          {getNotificationIcon(toastNotification.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {toastNotification.title}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToastNotification(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
              {toastNotification.message}
            </p>
            {toastNotification.link && (
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 inline-flex items-center gap-1">
                Click to open <ExternalLink className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};
