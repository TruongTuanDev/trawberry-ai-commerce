import { apiRequest } from "@/lib/api";

export type AuthResponse = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  role: string;
  status: string;
  approvalStatus: string | null;
  sellerNextStep: string | null;
  sellerOnboardingComplete: boolean | null;
  isSyntheticEmail: boolean;
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
  sellerRejectionReason: string | null;
  sellerNextStep: string | null;
  sellerOnboardingComplete: boolean | null;
  isSyntheticEmail: boolean;
};

export type PublicRole = "CUSTOMER" | "SELLER";
export type StaffRole = "ADMIN" | "SELLER" | "CUSTOMER";
export type AuthRoleKey = "admin" | "seller" | "customer";

export async function loginRequest(input: {
  identifier?: string;
  email?: string;
  password: string;
}) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function roleLoginRequest(
  role: StaffRole,
  input: {
    identifier?: string;
    email?: string;
    password: string;
  },
) {
  const path =
    role === "ADMIN"
      ? "/api/auth/admin/login"
      : role === "SELLER"
        ? "/api/auth/seller/login"
        : "/api/auth/customer/login";

  return apiRequest<AuthResponse>(path, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function registerRequest(input: {
  email?: string;
  phone?: string;
  password: string;
  fullName?: string;
  role?: "CUSTOMER" | "SELLER" | "USER";
}) {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function roleRegisterRequest(
  role: PublicRole,
  input: {
    email?: string;
    phone?: string;
    password: string;
    fullName?: string;
  },
) {
  return apiRequest<AuthResponse>(`/api/auth/${role.toLowerCase()}/register`, {
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

export async function logoutRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getAdminMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/admin/me", {
    method: "GET",
    token,
  });
}

export async function getSellerMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/seller/me", {
    method: "GET",
    token,
  });
}

export async function getCustomerMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/customer/me", {
    method: "GET",
    token,
  });
}

export async function logoutAdminRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/admin/logout", {
    method: "POST",
  });
}

export async function logoutSellerRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/seller/logout", {
    method: "POST",
  });
}

export async function logoutCustomerRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/customer/logout", {
    method: "POST",
  });
}

export async function logoutAllRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/logout-all", {
    method: "POST",
  });
}
