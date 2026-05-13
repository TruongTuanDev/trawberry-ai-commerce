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
