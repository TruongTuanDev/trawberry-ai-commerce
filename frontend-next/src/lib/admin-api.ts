import { apiRequest } from "@/lib/api";

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
