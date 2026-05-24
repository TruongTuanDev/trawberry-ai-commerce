"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import { Bell, Check, Inbox, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { type NotificationItemData, getNotifications, markAllNotificationsRead } from "@/lib/notifications-api";
import { type AuthRoleKey } from "@/lib/api";
import { useNotificationStore } from "@/stores/notification-store";
import { NotificationItem } from "./notification-item";

interface NotificationsPageClientProps {
  role: AuthRoleKey;
}

export function NotificationsPageClient({ role }: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications(role, {
        page,
        limit: 10,
        status: statusFilter,
        type: typeFilter || undefined,
        severity: severityFilter || undefined,
      });
      setNotifications(res.items);
      setTotalPages(res.meta.totalPages || 1);
    } catch (err) {
      console.error("Failed to load notifications page list:", err);
    } finally {
      setLoading(false);
    }
  }, [role, page, statusFilter, typeFilter, severityFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchList();
  }, [fetchList]);

  const handleMutation = () => {
    void fetchList();
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
      } catch (err) {
        console.error("Failed to mark all read:", err);
      }
    });
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  const statusOptions = [
    { label: "Tất cả", value: "ALL" },
    { label: "Chưa đọc", value: "UNREAD" },
    { label: "Đã đọc", value: "READ" },
    { label: "Đã lưu trữ", value: "ARCHIVED" },
  ];

  const typeOptions = [
    { label: "Tất cả loại", value: "" },
    { label: "Đơn hàng mới", value: "ORDER_NEW" },
    { label: "Xác nhận thanh toán", value: "PAYMENT_CONFIRMATION_REQUIRED" },
    { label: "Trạng thái giao hàng", value: "DELIVERY_STATUS_CHANGED" },
    { label: "Nhắc nhở Yandex", value: "YANDEX_CREATION_REMINDER" },
    { label: "Khiếu nại mới", value: "RETURN_CASE_OPENED" },
    { label: "Khiếu nại phản hồi", value: "RETURN_SELLER_RESPONSE_REQUIRED" },
    { label: "Admin can thiệp", value: "RETURN_ADMIN_REVIEW_REQUIRED" },
    { label: "Hóa đơn phí", value: "SELLER_FEE_INVOICE_ISSUED" },
    { label: "Xử lý quá hạn", value: "ORDER_FULFILLMENT_OVERDUE" },
    { label: "Hệ thống", value: "SYSTEM" },
  ];

  const severityOptions = [
    { label: "Tất cả mức độ", value: "" },
    { label: "Thông tin", value: "INFO" },
    { label: "Thành công", value: "SUCCESS" },
    { label: "Cảnh báo", value: "WARNING" },
    { label: "Khẩn cấp", value: "URGENT" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8" data-testid="notifications-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-500" />
            Trung tâm thông báo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Xem và quản lý tất cả các thông báo liên quan đến tài khoản của bạn.
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

      {/* Filters Dashboard */}
      <div className="bg-slate-50/50 dark:bg-slate-950/10 border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold">
          <Filter className="h-4 w-4" />
          <span>Lọc:</span>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
                statusFilter === opt.value
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type Filter Select */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Filter Select */}
        <div className="flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {severityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
            <span className="text-sm">Đang tải danh sách thông báo...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
            <Inbox className="h-14 w-14 stroke-1 mb-3 text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy thông báo nào</h3>
            <p className="text-xs text-slate-400 mt-1">Vui lòng thử thay đổi bộ lọc hoặc kiểm tra lại sau.</p>
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
