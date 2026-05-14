import { apiRequest } from "@/lib/api";
import type { SellerDocument, SellerOnboardingProfile } from "@/lib/seller-onboarding-api";

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
};

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
