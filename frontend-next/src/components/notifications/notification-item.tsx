"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Archive } from "lucide-react";
import { type NotificationItemData, markNotificationRead, archiveNotification } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";
import { SEVERITY_CONFIGS, TYPE_CONFIGS } from "./notification-status";

interface NotificationItemProps {
  notification: NotificationItemData;
  role: AuthRoleKey;
  onMutation?: () => void;
  hideActions?: boolean;
}

export function NotificationItem({ notification, role, onMutation, hideActions = false }: NotificationItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const severity = notification.severity || "INFO";
  const type = notification.type || "SYSTEM";

  const sevConfig = SEVERITY_CONFIGS[severity] || SEVERITY_CONFIGS.INFO;
  const typeConfig = TYPE_CONFIGS[type] || TYPE_CONFIGS.SYSTEM;

  const IconComponent = typeConfig.icon;

  const isUnread = notification.status === "UNREAD";

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await markNotificationRead(role, notification.id);
        if (res.success && onMutation) {
          onMutation();
        }
      } catch (err) {
        console.error("Failed to mark read:", err);
      }
    });
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;

    startTransition(async () => {
      try {
        const res = await archiveNotification(role, notification.id);
        if (res.success && onMutation) {
          onMutation();
        }
      } catch (err) {
        console.error("Failed to archive:", err);
      }
    });
  };

  const handleCardClick = async () => {
    if (isPending) return;

    if (isUnread) {
      try {
        await markNotificationRead(role, notification.id);
        if (onMutation) {
          onMutation();
        }
      } catch (err) {
        console.error("Failed to auto mark read on click:", err);
      }
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const commonClasses = `block border-l-4 transition-all duration-200 rounded-lg p-4 cursor-pointer relative ${
    isUnread
      ? "bg-white dark:bg-slate-900 border-l-blue-500 shadow-sm hover:shadow-md"
      : "bg-slate-50/50 dark:bg-slate-950/20 border-l-slate-300 dark:border-l-slate-700 opacity-80 hover:opacity-100"
  } ${sevConfig.borderClass}`;

  return (
    <div onClick={handleCardClick} className={commonClasses}>
      <div className="flex items-start gap-3">
        {/* Severity Icon Indicator */}
        <div className={`p-2 rounded-lg ${sevConfig.bgClass} ${sevConfig.colorClass}`}>
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {typeConfig.label}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatTime(notification.createdAt)}
            </span>
            {isUnread && (
              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-2xs font-medium text-blue-800 dark:text-blue-400">
                Mới
              </span>
            )}
          </div>
          <h4 className={`text-sm font-semibold mb-1 ${isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
            {notification.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
        </div>
      </div>

      {/* Actions (Floating on Hover / visible right side) */}
      {!hideActions && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 md:relative md:opacity-100 md:translate-y-0 md:top-auto md:float-right md:-mt-6 md:gap-1">
          {isUnread && (
            <button
              onClick={handleMarkRead}
              disabled={isPending}
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Đánh dấu đã đọc"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {notification.status !== "ARCHIVED" && (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Lưu trữ"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default NotificationItem;
