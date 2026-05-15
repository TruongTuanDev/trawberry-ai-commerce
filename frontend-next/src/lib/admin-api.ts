import { apiRequest } from "@/lib/api";
import type { SellerDocument, SellerOnboardingProfile } from "@/lib/seller-onboarding-api";
import type { DeliveryCommentVisibility, DeliveryExceptionReasonCode } from "@/lib/seller-api";

export type SellerApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminSeller = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  sellerApprovalStatus: SellerApprovalStatus;
  sellerApprovedAt: string | null;
  sellerRejectedAt: string | null;
  sellerRejectionReason: string | null;
};

export type AdminSellerOnboarding = {
  seller: AdminSeller;
  profile: SellerOnboardingProfile;
};

export type AdminAuditLog = {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValueJson: unknown;
  newValueJson: unknown;
  reason: string | null;
  createdAt: string;
};

export type AdminDeliveryRow = {
  kind: "SHIPMENT" | "PAID_WITHOUT_DELIVERY";
  id: string;
  deliveryShipmentId: string | null;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  sellerId: string;
  sellerEmail: string;
  sellerName: string | null;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: string;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    address: string;
  };
  provider: string | null;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: string | null;
  deliveryNote: string | null;
  failureReasonCode: string | null;
  failureReasonText: string | null;
  failedAt: string | null;
  customerVisibleMessage: string | null;
  lastAdminNote: string | null;
  lastSellerNote: string | null;
  createdAt: string;
  updatedAt: string;
  events: Array<{
    id: string;
    eventType: string;
    actorUserId: string | null;
    actorRole: string | null;
    action: string | null;
    oldStatus: string | null;
    newStatus: string | null;
    providerStatus: string | null;
    message: string | null;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    actorUserId: string | null;
    actorRole: string;
    visibility: string;
    message: string;
    createdAt: string;
  }>;
};

export type AdminDashboardSummary = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    shopId: string | null;
    sellerId: string | null;
    defaultRange: string;
  };
  orders: {
    total: number;
    pending: number;
    paid: number;
    paidWithoutDelivery: number;
    inTransit: number;
    delivered: number;
    cancelled: number;
  };
  payments: {
    pending: number;
    paid: number;
    rejected: number;
  };
  deliveries: {
    notCreated: number;
    created: number;
    inTransit: number;
    delivered: number;
    deliveredToday: number;
    deliveredThisWeek: number;
    failed: number;
    cancelled: number;
    exceptions: number;
  };
  inventory: {
    outOfStock: number;
    lowStock: number;
  };
  sellers: {
    pending: number;
    approved: number;
    rejected: number;
    withPaidOrdersWithoutDelivery: number;
  };
  recent: {
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      totalAmount: string;
      customerName: string;
      shopId: string;
      shopName: string;
      createdAt: string;
    }>;
    paymentReviews: Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      note: string | null;
      orderId: string;
      orderNumber: string;
      shopId: string;
      shopName: string;
      createdAt: string;
    }>;
    deliveryExceptions: Array<{
      id: string;
      orderId: string;
      orderNumber: string;
      customerName: string;
      shopId: string;
      shopName: string;
      status: string;
      reasonCode: string | null;
      customerVisibleMessage: string | null;
      updatedAt: string;
    }>;
    auditLogs: Array<{
      id: string;
      actorUserId: string;
      targetUserId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      reason: string | null;
      createdAt: string;
    }>;
  };
};

export async function getAdminDashboardSummary(query?: {
  dateFrom?: string;
  dateTo?: string;
  shopId?: string;
  sellerId?: string;
}) {
  const params = new URLSearchParams();
  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.sellerId) params.set("sellerId", query.sellerId);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<AdminDashboardSummary>(`/api/admin/dashboard/summary${suffix}`, {
    method: "GET",
  });
}

export async function listAdminSellers(status: SellerApprovalStatus) {
  return apiRequest<AdminSeller[]>(`/api/admin/sellers?status=${status}`, {
    method: "GET",
  });
}

export async function getAdminSeller(userId: string) {
  return apiRequest<AdminSeller>(`/api/admin/sellers/${userId}`, {
    method: "GET",
  });
}

export async function approveAdminSeller(userId: string) {
  return apiRequest<AdminSeller>(`/api/admin/sellers/${userId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectAdminSeller(userId: string, reason?: string) {
  return apiRequest<AdminSeller>(`/api/admin/sellers/${userId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getAdminSellerOnboarding(userId: string) {
  return apiRequest<AdminSellerOnboarding>(`/api/admin/sellers/${userId}/onboarding`, {
    method: "GET",
  });
}

export async function listAdminSellerDocuments(userId: string) {
  return apiRequest<SellerDocument[]>(`/api/admin/sellers/${userId}/documents`, {
    method: "GET",
  });
}

export async function approveAdminSellerDocument(userId: string, documentId: string) {
  return apiRequest<SellerDocument>(`/api/admin/sellers/${userId}/documents/${documentId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectAdminSellerDocument(userId: string, documentId: string, reason?: string) {
  return apiRequest<SellerDocument>(`/api/admin/sellers/${userId}/documents/${documentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function listAdminAuditLogs(targetUserId?: string) {
  const query = targetUserId ? `?targetUserId=${encodeURIComponent(targetUserId)}` : "";
  return apiRequest<AdminAuditLog[]>(`/api/admin/audit-logs${query}`, {
    method: "GET",
  });
}

export async function listAdminDeliveries(query?: {
  status?: string;
  provider?: string;
  shopId?: string;
  sellerId?: string;
  paidWithoutDelivery?: boolean;
  exceptionOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.provider) params.set("provider", query.provider);
  if (query?.shopId) params.set("shopId", query.shopId);
  if (query?.sellerId) params.set("sellerId", query.sellerId);
  if (query?.paidWithoutDelivery) params.set("paidWithoutDelivery", "true");
  if (query?.exceptionOnly) params.set("exceptionOnly", "true");
  if (query?.dateFrom) params.set("dateFrom", query.dateFrom);
  if (query?.dateTo) params.set("dateTo", query.dateTo);
  if (query?.search) params.set("search", query.search);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<{ items: AdminDeliveryRow[] }>(`/api/admin/deliveries${suffix}`, {
    method: "GET",
  });
}

export async function adminMarkDeliveryInTransit(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-in-transit`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminMarkDeliveryDelivered(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminCancelDelivery(deliveryShipmentId: string, note?: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function adminMarkDeliveryFailed(
  deliveryShipmentId: string,
  payload: {
    reasonCode: DeliveryExceptionReasonCode;
    reasonText?: string | null;
    customerVisibleMessage?: string | null;
  },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/mark-failed`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminAddDeliveryComment(
  deliveryShipmentId: string,
  payload: { visibility: DeliveryCommentVisibility; message: string },
) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateDeliveryCustomerMessage(deliveryShipmentId: string, customerVisibleMessage: string) {
  return apiRequest<AdminDeliveryRow>(`/api/admin/deliveries/${deliveryShipmentId}/customer-message`, {
    method: "PATCH",
    body: JSON.stringify({ customerVisibleMessage }),
  });
}
