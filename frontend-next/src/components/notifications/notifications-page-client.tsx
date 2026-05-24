"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import { Bell, Check, Inbox, ChevronLeft, ChevronRight, Filter, ShieldAlert, FolderArchive } from "lucide-react";
import { type NotificationItemData, getNotifications, markAllNotificationsRead } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationItem } from "./notification-item";

interface NotificationsPageClientProps {
  role: AuthRoleKey;
}

interface CategoryOption {
  label: string;
  value: string;
  typeQuery?: string;
  severityQuery?: string;
}

const CATEGORIES_BY_ROLE: Record<AuthRoleKey, CategoryOption[]> = {
  admin: [
    { label: "Tất cả", value: "ALL" },
    { label: "Cần xử lý", value: "PENDING_ACTION", severityQuery: "URGENT" },
    { label: "Đơn hàng", value: "ORDER", typeQuery: "ORDER_FULFILLMENT_OVERDUE" },
    { label: "Giao hàng", value: "DELIVERY", typeQuery: "DELIVERY_STATUS_CHANGED" },
    { label: "Tranh chấp", value: "DISPUTE", typeQuery: "RETURN_ADMIN_REVIEW_REQUIRED" },
    { label: "Seller", value: "SELLER", typeQuery: "SYSTEM" },
    { label: "Tài chính", value: "FINANCE", typeQuery: "SELLER_FEE_INVOICE_ISSUED" },
    { label: "Hệ thống", value: "SYSTEM", typeQuery: "SYSTEM" },
  ],
  seller: [
    { label: "Tất cả", value: "ALL" },
    { label: "Cần xử lý", value: "PENDING_ACTION", severityQuery: "URGENT" },
    { label: "Đơn hàng", value: "ORDER", typeQuery: "ORDER_NEW" },
    { label: "Thanh toán", value: "PAYMENT", typeQuery: "PAYMENT_CONFIRMATION_REQUIRED" },
    { label: "Giao hàng", value: "DELIVERY", typeQuery: "YANDEX_CREATION_REMINDER" },
    { label: "Trả hàng", value: "RETURN", typeQuery: "RETURN_CASE_OPENED" },
    { label: "Tài chính", value: "FINANCE", typeQuery: "SELLER_FEE_INVOICE_ISSUED" },
  ],
  customer: [
    { label: "Tất cả", value: "ALL" },
    { label: "Đơn hàng", value: "ORDER", typeQuery: "DELIVERY_STATUS_CHANGED" },
    { label: "Thanh toán", value: "PAYMENT", typeQuery: "DELIVERY_STATUS_CHANGED" },
    { label: "Giao hàng", value: "DELIVERY", typeQuery: "DELIVERY_STATUS_CHANGED" },
    { label: "Hoàn tiền", value: "RETURN", typeQuery: "DELIVERY_STATUS_CHANGED" },
    { label: "Hệ thống", value: "SYSTEM", typeQuery: "SYSTEM" },
  ],
};

const HEADER_CONFIGS = {
  admin: {
    title: "Trung tâm vận hành",
    description: "Theo dõi các việc cần admin xử lý: đơn quá hạn, tranh chấp, seller chờ duyệt, thanh toán và phí sàn.",
  },
  seller: {
    title: "Việc cần xử lý",
    description: "Theo dõi đơn mới, minh chứng thanh toán, nhắc tạo Yandex, hoàn tiền và phí sàn.",
  },
  customer: {
    title: "Thông báo của tôi",
    description: "Cập nhật về thanh toán, vận chuyển, đơn hàng và hoàn tiền.",
  },
};

const EMPTY_STATE_CONFIGS = {
  admin: {
    title: "Chưa có việc nào cần admin xử lý",
    description: "Thông báo sẽ xuất hiện khi có đơn quá hạn, tranh chấp hoàn tiền, seller chờ duyệt hoặc vấn đề thanh toán.",
  },
  seller: {
    title: "Bạn chưa có việc cần xử lý",
    description: "Khi có đơn mới, bill thanh toán, yêu cầu trả hàng hoặc nhắc tạo Yandex, thông báo sẽ xuất hiện ở đây.",
  },
  customer: {
    title: "Bạn chưa có cập nhật mới",
    description: "Khi đơn hàng hoặc thanh toán thay đổi trạng thái, thông báo sẽ xuất hiện ở đây.",
  },
};

export function NotificationsPageClient({ role }: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // Summary counts
  const [allCount, setAllCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);

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
      // Quietly ignore or log
    }
  }, [role]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const activeOpt = CATEGORIES_BY_ROLE[role].find(c => c.value === activeCategory) || { label: "Tất cả", value: "ALL" };
      const res = await getNotifications(role, {
        page,
        limit: 10,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        type: activeOpt.typeQuery || undefined,
        severity: activeOpt.severityQuery || undefined,
      });

      let items = res.items;

      // Post-filtering for customer categories (type DELIVERY_STATUS_CHANGED maps to multiple categories)
      if (role === "customer" && activeCategory !== "ALL") {
        items = items.filter(item => {
          const text = `${item.title} ${item.message}`.toLowerCase();
          if (activeCategory === "ORDER") {
            return item.type === "DELIVERY_STATUS_CHANGED" || item.actionUrl?.includes("/orders") || text.includes("đơn hàng");
          }
          if (activeCategory === "PAYMENT") {
            return item.actionUrl?.includes("/payments") || text.includes("thanh toán") || text.includes("qr") || text.includes("tiền");
          }
          if (activeCategory === "DELIVERY") {
            return item.type === "DELIVERY_STATUS_CHANGED" || item.actionUrl?.includes("/delivery") || text.includes("giao hàng") || text.includes("vận chuyển") || text.includes("yandex");
          }
          if (activeCategory === "RETURN") {
            return item.returnRefundCaseId || item.actionUrl?.includes("/returns") || text.includes("hoàn tiền") || text.includes("trả hàng");
          }
          if (activeCategory === "SYSTEM") {
            return item.type === "SYSTEM";
          }
          return true;
        });
      }

      setNotifications(items);
      setTotalPages(res.meta.totalPages || 1);
    } catch {
      // Quietly ignore or log
    } finally {
      setLoading(false);
    }
  }, [role, page, statusFilter, activeCategory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSummary();
  }, [fetchSummary]);

  const handleMutation = () => {
    void fetchList();
    void fetchSummary();
    void useNotificationStore.getState().fetchUnreadCount(role);
  };

  const handleMarkAllRead = async () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const res = await markAllNotificationsRead(role);
        if (res.success) {
          handleMutation();
        }
      } catch {
        // Quietly ignore
      }
    });
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  const currentHeader = HEADER_CONFIGS[role] || HEADER_CONFIGS.customer;
  const currentEmptyState = EMPTY_STATE_CONFIGS[role] || EMPTY_STATE_CONFIGS.customer;
  const roleCategories = CATEGORIES_BY_ROLE[role] || CATEGORIES_BY_ROLE.customer;

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8" data-testid="notifications-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-500" />
            {currentHeader.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {currentHeader.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            disabled={isPending || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition cursor-pointer"
            data-testid="mark-all-read-btn"
          >
            <Check className="h-4 w-4" />
            Đánh dấu đọc tất cả
          </button>
        </div>
      </div>

      {/* Summary Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-500">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Tất cả</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{allCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Chưa đọc</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{unreadCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Khẩn cấp</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{urgentCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500">
            <FolderArchive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Lưu trữ</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{archivedCount}</p>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="space-y-4">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          {["ALL", "UNREAD", "READ", "ARCHIVED"].map((status) => {
            const label = status === "ALL" ? "Tất cả" : status === "UNREAD" ? "Chưa đọc" : status === "READ" ? "Đã đọc" : "Đã lưu trữ";
            const active = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                  active
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Sleek Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400 mr-1 flex-shrink-0" />
            {roleCategories.map((opt) => {
              const active = activeCategory === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { setActiveCategory(opt.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap cursor-pointer transition-all border ${
                    active
                      ? "bg-blue-500 border-blue-500 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                  data-testid={`category-tab-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
            <span className="text-sm">Đang tải danh sách thông báo...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <Inbox className="h-12 w-12 stroke-1 mb-4 text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300" data-testid="empty-state-title">
              {currentEmptyState.title}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed" data-testid="empty-state-description">
              {currentEmptyState.description}
            </p>
          </div>
        ) : (
          <div className="space-y-3 group/list">
            {notifications.map((item) => (
              <NotificationItem
                key={item.id}
                notification={item}
                role={role}
                onMutation={handleMutation}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Trang <span className="font-semibold text-slate-700 dark:text-white">{page}</span> trên{" "}
            <span className="font-semibold text-slate-700 dark:text-white">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextPage}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default NotificationsPageClient;
