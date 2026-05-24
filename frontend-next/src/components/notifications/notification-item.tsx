"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Archive, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type NotificationItemData, markNotificationRead, archiveNotification } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";
import { SEVERITY_CONFIGS, TYPE_CONFIGS } from "./notification-status";
import { useI18n } from "@/i18n/use-i18n";

interface NotificationItemProps {
  notification: NotificationItemData;
  role: AuthRoleKey;
  onMutation?: () => void;
  hideActions?: boolean;
}

function getRoleKey(role: AuthRoleKey) {
  return role === "admin" ? "admin" : role === "seller" ? "seller" : "customer";
}

export function NotificationItem({ notification, role, onMutation, hideActions = false }: NotificationItemProps) {
  const router = useRouter();
  const { t, locale } = useI18n(getRoleKey(role));
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
    if (isPending) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await markNotificationRead(role, notification.id);
        if (res.success && onMutation) {
          onMutation();
        }
      } catch {
        // ignore
      }
    });
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await archiveNotification(role, notification.id);
        if (res.success && onMutation) {
          onMutation();
        }
      } catch {
        // ignore
      }
    });
  };

  const navigateToAction = async () => {
    if (isUnread) {
      try {
        await markNotificationRead(role, notification.id);
        onMutation?.();
      } catch {
        // ignore
      }
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(locale === "ru" ? "ru-RU" : locale === "vi" ? "vi-VN" : "en-US", {
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

  const getActionLabel = (url: string | null | undefined) => {
    if (!url) {
      return null;
    }
    const path = url.toLowerCase();
    if (path.includes("/orders")) return t("common.actions.open");
    if (path.includes("/payments")) return t("common.actions.open");
    if (path.includes("/yandex-workbench")) return t("common.actions.open");
    if (path.includes("/returns")) return t("common.actions.open");
    if (path.includes("/finance") || path.includes("/fees")) return t("common.actions.open");
    return t("common.actions.view");
  };

  const severityLabels: Record<string, string> = {
    INFO: t("notifications.system"),
    SUCCESS: t("common.status.confirmed"),
    WARNING: t("common.status.pending"),
    URGENT: t("notifications.urgent"),
  };

  const typeLabels: Record<string, string> = {
    ORDER_NEW: t("notifications.order"),
    PAYMENT_CONFIRMATION_REQUIRED: t("notifications.payment"),
    DELIVERY_STATUS_CHANGED: t("notifications.delivery"),
    YANDEX_CREATION_REMINDER: "Yandex",
    RETURN_CASE_OPENED: t("notifications.return"),
    RETURN_SELLER_RESPONSE_REQUIRED: t("notifications.return"),
    RETURN_ADMIN_REVIEW_REQUIRED: t("notifications.dispute"),
    SELLER_FEE_INVOICE_ISSUED: t("notifications.finance"),
    ORDER_FULFILLMENT_OVERDUE: t("notifications.order"),
    SYSTEM: t("notifications.system"),
  };

  const actionLabel = getActionLabel(notification.actionUrl);
  const commonClasses = `block border-l-4 transition-all duration-200 rounded-2xl p-4 cursor-pointer relative shadow-sm hover:shadow-md border ${
    isUnread
      ? "bg-white dark:bg-slate-900 border-l-blue-500 border-slate-200/80 dark:border-slate-800"
      : "bg-slate-50/50 dark:bg-slate-950/20 border-l-slate-300 dark:border-l-slate-700 border-slate-100 dark:border-slate-850 opacity-80 hover:opacity-100"
  } ${sevConfig.borderClass}`;

  return (
    <div onClick={() => void navigateToAction()} className={commonClasses} data-testid="notification-item">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 rounded-xl p-2 ${sevConfig.bgClass} ${sevConfig.colorClass}`}>
          <IconComponent className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 pr-8">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {typeLabels[type] ?? typeConfig.label}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime(notification.createdAt)}</span>
            {isUnread ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-2xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {t("notifications.unread")}
              </span>
            ) : null}
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-medium ${sevConfig.bgClass} ${sevConfig.colorClass}`}>
              {severityLabels[severity]}
            </span>
          </div>

          <h4 className={`mb-1 text-sm font-semibold ${isUnread ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
            {notification.title}
          </h4>
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{notification.message}</p>

          <div className="flex flex-wrap items-center gap-1.5">
            {notification.orderId ? (
              <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-3xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {t("notifications.order")}: #{notification.orderId.slice(0, 8)}
              </span>
            ) : null}
            {notification.shopId ? (
              <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-3xs font-semibold text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                Shop ID: #{notification.shopId.slice(0, 8)}
              </span>
            ) : null}
            {notification.returnRefundCaseId ? (
              <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-3xs font-semibold text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
                {t("notifications.dispute")}: #{notification.returnRefundCaseId.slice(0, 8)}
              </span>
            ) : null}
            {notification.invoiceId ? (
              <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-3xs font-semibold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                Invoice: #{notification.invoiceId.slice(0, 8)}
              </span>
            ) : null}
            {actionLabel ? (
              <Button variant="link" size="xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void navigateToAction(); }} className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold" data-testid="notification-action-btn">
                {actionLabel}
                <ExternalLink className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {!hideActions ? (
        <div className="absolute right-3 top-4 flex items-center gap-1 opacity-0 transition duration-150 group-hover/list:opacity-100 focus-within:opacity-100 md:opacity-100">
          {isUnread ? (
            <Button variant="ghost" size="icon" onClick={handleMarkRead} disabled={isPending} className="h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400" title={t("notifications.markAllRead")} data-testid="mark-read-btn">
              <Check className="h-4 w-4" />
            </Button>
          ) : null}
          {notification.status !== "ARCHIVED" ? (
            <Button variant="ghost" size="icon" onClick={handleArchive} disabled={isPending} className="h-7 w-7 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400" title={t("common.actions.archive")} data-testid="archive-btn">
              <Archive className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default NotificationItem;
