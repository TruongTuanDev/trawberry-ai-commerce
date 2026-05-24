import { apiRequest, type AuthRoleKey, ApiError } from "@/lib/api";

export type NotificationItemData = {
  id: string;
  recipientUserId: string;
  recipientRole: "CUSTOMER" | "SELLER" | "ADMIN";
  shopId: string | null;
  orderId: string | null;
  checkoutId: string | null;
  returnRefundCaseId: string | null;
  invoiceId: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  severity: "INFO" | "SUCCESS" | "WARNING" | "URGENT";
  status: "UNREAD" | "READ" | "ARCHIVED";
  dedupeKey: string | null;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

export type PaginatedNotifications = {
  items: NotificationItemData[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getNotifications(
  role: AuthRoleKey,
  query?: { status?: string; type?: string; severity?: string; page?: number; limit?: number }
): Promise<PaginatedNotifications> {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.type) params.set("type", query.type);
  if (query?.severity) params.set("severity", query.severity);
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));

  const queryString = params.toString() ? `?${params.toString()}` : "";
  try {
    return await apiRequest<PaginatedNotifications>(`/api/${role}/notifications${queryString}`, {
      method: "GET",
      authRole: role,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return {
        items: [],
        meta: { page: 1, limit: query?.limit ?? 10, total: 0, totalPages: 0 },
      };
    }
    throw error;
  }
}

export async function getUnreadCount(role: AuthRoleKey): Promise<{ count: number }> {
  try {
    return await apiRequest<{ count: number }>(`/api/${role}/notifications/unread-count`, {
      method: "GET",
      authRole: role,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { count: 0 };
    }
    throw error;
  }
}

export async function markNotificationRead(role: AuthRoleKey, id: string): Promise<{ success: boolean }> {
  try {
    return await apiRequest<{ success: boolean }>(`/api/${role}/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
      authRole: role,
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { success: false };
    }
    throw error;
  }
}

export async function markAllNotificationsRead(role: AuthRoleKey): Promise<{ success: boolean }> {
  try {
    return await apiRequest<{ success: boolean }>(`/api/${role}/notifications/mark-all-read`, {
      method: "POST",
      authRole: role,
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { success: false };
    }
    throw error;
  }
}

export async function archiveNotification(role: AuthRoleKey, id: string): Promise<{ success: boolean }> {
  try {
    return await apiRequest<{ success: boolean }>(`/api/${role}/notifications/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      authRole: role,
      body: JSON.stringify({}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { success: false };
    }
    throw error;
  }
}
