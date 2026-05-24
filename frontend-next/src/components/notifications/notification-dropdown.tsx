"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Inbox } from "lucide-react";
import { type AuthRoleKey } from "@/lib/api";
import {
  type NotificationItemData,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-api";
import { useI18n } from "@/i18n/use-i18n";

interface NotificationDropdownProps {
  role: AuthRoleKey;
  onClose: () => void;
  onMutation?: () => void;
}

function getRoleKey(role: AuthRoleKey) {
  return role === "admin" ? "admin" : role === "seller" ? "seller" : "customer";
}

export function NotificationDropdown({
  role,
  onClose,
  onMutation,
}: NotificationDropdownProps) {
  const { t, locale } = useI18n(getRoleKey(role));
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchLatest = useCallback(async () => {
    try {
      const unread = await getNotifications(role, {
        page: 1,
        limit: 5,
        status: "UNREAD",
      });
      if (unread.items.length >= 5) {
        setNotifications(unread.items);
        return;
      }
      const all = await getNotifications(role, { page: 1, limit: 5 });
      setNotifications(all.items);
    } catch (error) {
      console.error("Failed to load dropdown notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLatest();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLatest]);

  const handleMarkAllRead = async () => {
    if (isPending) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await markAllNotificationsRead(role);
        if (result.success) {
          await fetchLatest();
          onMutation?.();
        }
      } catch (error) {
        console.error("Failed to mark all read:", error);
      }
    });
  };

  const handleItemClick = async (item: NotificationItemData) => {
    if (item.status === "UNREAD") {
      try {
        await markNotificationRead(role, item.id);
        onMutation?.();
      } catch (error) {
        console.error("Failed to mark read on click:", error);
      }
    }
    onClose();
  };

  const seeAllHref = `/${role}/notifications`;
  const headingKey =
    role === "admin"
      ? "notifications.adminTitle"
      : role === "seller"
        ? "seller.notifications.heading"
        : "notifications.customerTitle";
  const emptyTitleKey =
    role === "admin"
      ? "notifications.adminEmptyTitle"
      : role === "seller"
        ? "seller.notifications.emptyTitle"
        : "notifications.customerEmptyTitle";

  return (
    <div
      className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 dark:border-slate-800 dark:bg-slate-900/95 dark:text-white sm:w-96"
      onClick={(event) => event.stopPropagation()}
      data-testid="notification-dropdown"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">{t(headingKey)}</h3>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={isPending || loading}
          className="flex cursor-pointer items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <Check className="h-3.5 w-3.5" />
          {t("notifications.markAllRead")}
        </button>
      </div>

      <div className="max-h-[350px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-850">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <div className="mb-3 h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
            <span className="text-xs">{t("notifications.loading")}</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Inbox className="mb-2 h-10 w-10 stroke-1 text-slate-300 dark:text-slate-700" />
            <span className="text-xs font-medium">{t(emptyTitleKey)}</span>
          </div>
        ) : (
          notifications.map((item) => {
            const isUnread = item.status === "UNREAD";
            return (
              <div
                key={item.id}
                className={`relative flex cursor-pointer gap-3 p-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-850 ${
                  isUnread ? "bg-blue-50/20 dark:bg-blue-950/10" : ""
                }`}
                onClick={() => void handleItemClick(item)}
              >
                <div
                  className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    isUnread ? "bg-blue-500" : "bg-transparent"
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {item.type}
                    </span>
                    <span className="text-2xs flex-shrink-0 text-slate-400 dark:text-slate-500">
                      {new Date(item.createdAt).toLocaleString(
                        locale === "ru"
                          ? "ru-RU"
                          : locale === "vi"
                            ? "vi-VN"
                            : "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        },
                      )}
                    </span>
                  </div>

                  <h4
                    className={`truncate text-xs font-semibold ${
                      isUnread
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {item.message}
                  </p>

                  {item.actionUrl ? (
                    <Link
                      href={item.actionUrl}
                      className="mt-1.5 inline-flex items-center gap-1 text-3xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t("common.actions.open")}
                      <ExternalLink className="h-2 w-2" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/20">
        <Link
          href={seeAllHref}
          onClick={onClose}
          className="block w-full py-2.5 text-center text-xs font-semibold text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
        >
          {t("common.actions.view")} {t("notifications.all").toLowerCase()}
        </Link>
      </div>
    </div>
  );
}

export default NotificationDropdown;
