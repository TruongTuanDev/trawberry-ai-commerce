"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Inbox } from "lucide-react";
import { type NotificationItemData, getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";

interface NotificationDropdownProps {
  role: AuthRoleKey;
  onClose: () => void;
  onMutation?: () => void;
}

export function NotificationDropdown({ role, onClose, onMutation }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchLatest = useCallback(async () => {
    try {
      const res = await getNotifications(role, { page: 1, limit: 5, status: "UNREAD" });
      // If we don't have enough unread, load read ones too
      if (res.items.length < 5) {
        const allRes = await getNotifications(role, { page: 1, limit: 5 });
        setNotifications(allRes.items);
      } else {
        setNotifications(res.items);
      }
    } catch (err) {
      console.error("Failed to load dropdown notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLatest();
  }, [fetchLatest]);

  const handleMarkAllRead = async () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const res = await markAllNotificationsRead(role);
        if (res.success) {
          fetchLatest();
          if (onMutation) onMutation();
        }
      } catch (err) {
        console.error("Failed to mark all read:", err);
      }
    });
  };

  const handleItemClick = async (item: NotificationItemData) => {
    if (item.status === "UNREAD") {
      try {
        await markNotificationRead(role, item.id);
        if (onMutation) onMutation();
      } catch (err) {
        console.error("Failed to mark read on click:", err);
      }
    }
    onClose();
  };

  const seeAllHref = `/${role}/notifications`;

  return (
    <div
      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl z-50 text-slate-900 dark:text-white overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      onClick={(e) => e.stopPropagation()}
      data-testid="notification-dropdown"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">Thông báo</h3>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={isPending || loading}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 transition cursor-pointer flex items-center gap-1"
        >
          <Check className="h-3.5 w-3.5" />
          Đọc tất cả
        </button>
      </div>

      {/* Body List */}
      <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-3" />
            <span className="text-xs">Đang tải...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Inbox className="h-10 w-10 stroke-1 mb-2 text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-medium">Hộp thư trống</span>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = item.status === "UNREAD";
            return (
              <div
                key={item.id}
                className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-850 transition relative flex gap-3 cursor-pointer ${
                  isUnread ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                }`}
                onClick={() => handleItemClick(item)}
              >
                <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isUnread ? "bg-blue-500" : "bg-transparent"}`} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {item.type}
                    </span>
                    <span className="text-2xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                      {new Date(item.createdAt).toLocaleDateString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h4 className={`text-xs font-semibold truncate ${isUnread ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                    {item.title}
                  </h4>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  {item.actionUrl && (
                    <Link
                      href={item.actionUrl}
                      className="inline-flex items-center gap-1 text-3xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Chi tiết <ExternalLink className="h-2 w-2" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
        <Link
          href={seeAllHref}
          onClick={onClose}
          className="block w-full py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          Xem tất cả thông báo
        </Link>
      </div>
    </div>
  );
}
export default NotificationDropdown;
