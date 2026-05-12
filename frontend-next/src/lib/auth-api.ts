import { apiRequest } from "@/lib/api";

export type AuthResponse = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  approvalStatus: string | null;
};

export type CurrentUserResponse = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  sellerProfileId: string | null;
  currentShopId: string | null;
  sellerApprovalStatus: string | null;
};

export async function loginRequest(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function currentUserRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/me", {
    method: "GET",
    token,
  });
}
