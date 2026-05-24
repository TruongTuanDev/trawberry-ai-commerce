"use client";

import React, { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Bell, Check, Inbox, ChevronLeft, ChevronRight, Filter, ShieldAlert, FolderArchive } from "lucide-react";
import { type NotificationItemData, getNotifications, markAllNotificationsRead } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationItem } from "./notification-item";
import { useI18n } from "@/i18n/use-i18n";

interface NotificationsPageClientProps {
  role: AuthRoleKey;
}

interface CategoryOption {
  label: string;
  value: string;
  typeQuery?: string;
  severityQuery?: string;
}

function getRoleKey(role: AuthRoleKey) {
  return role === "admin" ? "admin" : role === "seller" ? "seller" : "customer";
}

export function NotificationsPageClient({ role }: NotificationsPageClientProps) {
  const { t } = useI18n(getRoleKey(role));
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [allCount, setAllCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);

  const categoriesByRole = useMemo<Record<AuthRoleKey, CategoryOption[]>>(
    () => ({
      admin: [
        { label: t("notifications.all"), value: "ALL" },
        { label: t("notifications.needAction"), value: "PENDING_ACTION", severityQuery: "URGENT" },
        { label: t("notifications.order"), value: "ORDER", typeQuery: "ORDER_FULFILLMENT_OVERDUE" },
        { label: t("notifications.delivery"), value: "DELIVERY", typeQuery: "DELIVERY_STATUS_CHANGED" },
        { label: t("notifications.dispute"), value: "DISPUTE", typeQuery: "RETURN_ADMIN_REVIEW_REQUIRED" },
        { label: "Seller", value: "SELLER", typeQuery: "SYSTEM" },
        { label: t("notifications.finance"), value: "FINANCE", typeQuery: "SELLER_FEE_INVOICE_ISSUED" },
        { label: t("notifications.system"), value: "SYSTEM", typeQuery: "SYSTEM" },
      ],
      seller: [
        { label: t("notifications.all"), value: "ALL" },
        { label: t("notifications.needAction"), value: "PENDING_ACTION", severityQuery: "URGENT" },
        { label: t("notifications.order"), value: "ORDER", typeQuery: "ORDER_NEW" },
        { label: t("notifications.payment"), value: "PAYMENT", typeQuery: "PAYMENT_CONFIRMATION_REQUIRED" },
        { label: t("notifications.delivery"), value: "DELIVERY", typeQuery: "YANDEX_CREATION_REMINDER" },
        { label: t("notifications.return"), value: "RETURN", typeQuery: "RETURN_CASE_OPENED" },
        { label: t("notifications.finance"), value: "FINANCE", typeQuery: "SELLER_FEE_INVOICE_ISSUED" },
      ],
      customer: [
        { label: t("notifications.all"), value: "ALL" },
        { label: t("notifications.order"), value: "ORDER", typeQuery: "DELIVERY_STATUS_CHANGED" },
        { label: t("notifications.payment"), value: "PAYMENT", typeQuery: "DELIVERY_STATUS_CHANGED" },
        { label: t("notifications.delivery"), value: "DELIVERY", typeQuery: "DELIVERY_STATUS_CHANGED" },
        { label: t("notifications.return"), value: "RETURN", typeQuery: "DELIVERY_STATUS_CHANGED" },
        { label: t("notifications.system"), value: "SYSTEM", typeQuery: "SYSTEM" },
      ],
    }),
    [t],
  );

  const headerConfigs = useMemo(
    () => ({
      admin: { title: t("notifications.adminTitle"), description: t("notifications.adminDescription") },
      seller: { title: t("seller.notifications.heading"), description: t("notifications.sellerDescription") },
      customer: { title: t("notifications.customerTitle"), description: t("notifications.customerDescription") },
    }),
    [t],
  );

  const emptyConfigs = useMemo(
    () => ({
      admin: { title: t("notifications.adminEmptyTitle"), description: t("notifications.adminEmptyDescription") },
      seller: { title: t("seller.notifications.emptyTitle"), description: t("seller.notifications.emptyDescription") },
      customer: { title: t("notifications.customerEmptyTitle"), description: t("notifications.customerEmptyDescription") },
    }),
    [t],
  );

  const fetchSummary = useCallback(async () => {
    try {
      const [allRes, unreadRes, urgentRes, archivedRes] = await Promise.all([
        getNotifications(role, { page: 1, limit: 1 }),
        getNotifications(role, { page: 1, limit: 1, status: "UNREAD" }),
        getNotifications(role, { page: 1, limit: 1, severity: "URGENT" }),
        getNotifications(role, { page: 1, limit: 1, status: "ARCHIVED" }),
      ]);
      setAllCount(allRes.meta.total || 0);
      setUnreadCount(unreadRes.meta.total || 0);
      setUrgentCount(urgentRes.meta.total || 0);
      setArchivedCount(archivedRes.meta.total || 0);
    } catch {
      // ignore
    }
  }, [role]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const activeOpt = categoriesByRole[role].find((option) => option.value === activeCategory) ?? categoriesByRole[role][0];
      const res = await getNotifications(role, {
        page,
        limit: 10,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: activeOpt.typeQuery || undefined,
        severity: activeOpt.severityQuery || undefined,
      });
      setNotifications(res.items);
      setTotalPages(res.meta.totalPages || 1);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeCategory, categoriesByRole, page, role, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchList();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSummary();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSummary]);

  const handleMutation = () => {
    void fetchList();
    void fetchSummary();
    void useNotificationStore.getState().fetchUnreadCount(role);
  };

  const handleMarkAllRead = async () => {
    if (isPending) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await markAllNotificationsRead(role);
        if (res.success) {
          handleMutation();
        }
      } catch {
        // ignore
      }
    });
  };

  const header = headerConfigs[role] ?? headerConfigs.customer;
  const emptyState = emptyConfigs[role] ?? emptyConfigs.customer;
  const roleCategories = categoriesByRole[role] ?? categoriesByRole.customer;
  const statusTabs = [
    { value: "ALL", label: t("notifications.all") },
    { value: "UNREAD", label: t("notifications.unread") },
    { value: "READ", label: t("notifications.read") },
    { value: "ARCHIVED", label: t("notifications.archived") },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8" data-testid="notifications-page">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            <Bell className="h-6 w-6 text-blue-500" />
            {header.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{header.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleMarkAllRead} disabled={isPending || loading} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-900/30" data-testid="mark-all-read-btn">
            <Check className="h-4 w-4" />
            {t("notifications.markAllRead")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard icon={<Bell className="h-5 w-5" />} tone="blue" label={t("notifications.all")} value={allCount} />
        <SummaryCard icon={<Inbox className="h-5 w-5" />} tone="amber" label={t("notifications.unread")} value={unreadCount} />
        <SummaryCard icon={<ShieldAlert className="h-5 w-5" />} tone="red" label={t("notifications.urgent")} value={urgentCount} />
        <SummaryCard icon={<FolderArchive className="h-5 w-5" />} tone="slate" label={t("notifications.archived")} value={archivedCount} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
          {statusTabs.map((status) => {
            const active = statusFilter === status.value;
            return (
              <button
                key={status.value}
                onClick={() => {
                  setStatusFilter(status.value);
                  setPage(1);
                }}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {status.label}
              </button>
            );
          })}
        </div>

        <div className="mx-0 flex items-center gap-2 overflow-x-auto pb-1 px-0">
          <div className="flex items-center gap-1.5">
            <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
            {roleCategories.map((option) => {
              const active = activeCategory === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setActiveCategory(option.value);
                    setPage(1);
                  }}
                  className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "border-blue-500 bg-blue-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                  data-testid={`category-tab-${option.value}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-20 text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            <span className="text-sm">{t("notifications.loading")}</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-6 py-20 text-center text-slate-400 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Inbox className="mb-4 h-12 w-12 stroke-1 text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300" data-testid="empty-state-title">
              {emptyState.title}
            </h3>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400" data-testid="empty-state-description">
              {emptyState.description}
            </p>
          </div>
        ) : (
          <div className="group/list space-y-3">
            {notifications.map((item) => (
              <NotificationItem key={item.id} notification={item} role={role} onMutation={handleMutation} />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-100 pt-5 dark:border-slate-850">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("common.pageOf", { page, total: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || loading} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages || loading} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "blue" | "amber" | "red" | "slate";
  label: string;
  value: number;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-500 dark:bg-blue-950/30"
      : tone === "amber"
        ? "bg-amber-50 text-amber-500 dark:bg-amber-950/30"
        : tone === "red"
          ? "bg-red-50 text-red-500 dark:bg-red-950/30"
          : "bg-slate-50 text-slate-500 dark:bg-slate-800";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`rounded-xl p-2 ${toneClass}`}>{icon}</div>
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-slate-800 dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export default NotificationsPageClient;
