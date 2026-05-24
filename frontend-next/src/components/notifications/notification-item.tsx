"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Archive, ExternalLink } from "lucide-react";
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
      } catch {
        // Quietly ignore to avoid crash
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
      } catch {
        // Quietly ignore to avoid crash
      }
    });
  };

  const handleCardClick = async () => {
    if (isUnread) {
      try {
        await markNotificationRead(role, notification.id);
        if (onMutation) {
          onMutation();
        }
      } catch {
        // Quietly ignore and proceed to navigate
      }
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleActionClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isUnread) {
      try {
        await markNotificationRead(role, notification.id);
        if (onMutation) {
          onMutation();
        }
      } catch {
        // Quietly ignore and proceed to navigate
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

  const getActionLabel = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const path = url.toLowerCase();
    if (path.includes("/orders/") || path.includes("/orders")) return "Mở đơn hàng";
    if (path.includes("/payments") || path.includes("/payment")) return "Mở payment review";
    if (path.includes("/yandex-workbench")) return "Mở Yandex workbench";
    if (path.includes("/returns/") || path.includes("/returns")) return "Mở returns";
    if (path.includes("/finance") || path.includes("/fees")) return "Mở finance";
    if (path.includes("/deliveries")) return "Mở admin deliveries";
    return "Mở chi tiết";
  };

  const severityLabels = {
    INFO: "Thông tin",
    SUCCESS: "Thành công",
    WARNING: "Cảnh báo",
    URGENT: "Khẩn cấp",
  };

  const actionLabel = getActionLabel(notification.actionUrl);

  const commonClasses = `block border-l-4 transition-all duration-200 rounded-2xl p-4 cursor-pointer relative shadow-sm hover:shadow-md border ${
    isUnread
      ? "bg-white dark:bg-slate-900 border-l-blue-500 border-slate-200/80 dark:border-slate-800"
      : "bg-slate-50/50 dark:bg-slate-950/20 border-l-slate-300 dark:border-l-slate-700 border-slate-100 dark:border-slate-850 opacity-80 hover:opacity-100"
  } ${sevConfig.borderClass}`;

  return (
    <div onClick={handleCardClick} className={commonClasses} data-testid="notification-item">
      <div className="flex items-start gap-3">
        {/* Severity Icon Indicator */}
        <div className={`p-2 rounded-xl flex-shrink-0 ${sevConfig.bgClass} ${sevConfig.colorClass}`}>
          <IconComponent className="h-5 w-5" />
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-medium ${sevConfig.bgClass} ${sevConfig.colorClass}`}>
              {severityLabels[severity]}
            </span>
          </div>

          <h4 className={`text-sm font-semibold mb-1 ${isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
            {notification.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
            {notification.message}
          </p>

          {/* Related Entities Metadata Badges */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {notification.orderId && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-3xs font-semibold">
                Đơn hàng: #{notification.orderId.slice(0, 8)}
              </span>
            )}
            {notification.shopId && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 text-3xs font-semibold">
                Shop ID: #{notification.shopId.slice(0, 8)}
              </span>
            )}
            {notification.returnRefundCaseId && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-3xs font-semibold">
                Khiếu nại: #{notification.returnRefundCaseId.slice(0, 8)}
              </span>
            )}
            {notification.invoiceId && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-3xs font-semibold">
                Hóa đơn: #{notification.invoiceId.slice(0, 8)}
              </span>
            )}

            {/* Direct Action Button */}
            {actionLabel && (
              <button
                onClick={handleActionClick}
                className="inline-flex items-center gap-1 ml-auto text-2xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                data-testid="notification-action-btn"
              >
                {actionLabel}
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Actions (Floating on Hover / visible right side) */}
      {!hideActions && (
        <div className="absolute right-3 top-4 flex items-center gap-1 opacity-0 group-hover/list:opacity-100 focus-within:opacity-100 md:opacity-100 transition duration-150">
          {isUnread && (
            <button
              onClick={handleMarkRead}
              disabled={isPending}
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Đánh dấu đã đọc"
              data-testid="mark-read-btn"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          {notification.status !== "ARCHIVED" && (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="p-1 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Lưu trữ"
              data-testid="archive-btn"
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
