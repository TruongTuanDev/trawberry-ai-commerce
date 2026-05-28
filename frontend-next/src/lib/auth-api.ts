import { type Locale, type LocaleRole } from "@/i18n/config";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { apiRequest, type AuthRoleKey } from "@/lib/api";

export type RegisterResponse = {
  success: true;
  message: "REGISTERED";
  userId: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  role: string;
  status: string;
  approvalStatus: string | null;
  sellerNextStep: string | null;
  sellerOnboardingComplete: boolean | null;
  isSyntheticEmail: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
};

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
  preferredLocale: "en" | "ru" | "vi" | null;
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
export type AuthMode = "register" | "login" | "session";

export async function loginRequest(input: {
  identifier?: string;
  email?: string;
  password: string;
}) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
    retryOnAuthFailure: false,
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
    retryOnAuthFailure: false,
  });
}

export async function registerRequest(input: {
  email?: string;
  phone?: string;
  password: string;
  fullName?: string;
  role?: "CUSTOMER" | "SELLER" | "USER";
}) {
  return apiRequest<RegisterResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
    retryOnAuthFailure: false,
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
  return apiRequest<RegisterResponse>(`/api/auth/${role.toLowerCase()}/register`, {
    method: "POST",
    body: JSON.stringify(input),
    retryOnAuthFailure: false,
  });
}

export function getAuthErrorMessage(
  error: unknown,
  mode: AuthMode,
  options: {
    role?: LocaleRole;
    locale?: Locale;
  } = {},
): string {
  return getLocalizedErrorMessage({
    role: options.role ?? "customer",
    locale: options.locale,
    error,
    authMode: mode,
    fallbackKey: mode === "session" ? "errors.unauthorized" : "errors.default",
  });
}

export async function refreshSession(role: AuthRoleKey) {
  return apiRequest<AuthResponse>(`/api/auth/${role}/refresh`, {
    method: "POST",
    authRole: role,
    retryOnAuthFailure: false,
  });
}

export async function refreshCustomerSession() {
  return refreshSession("customer");
}

export async function refreshSellerSession() {
  return refreshSession("seller");
}

export async function refreshAdminSession() {
  return refreshSession("admin");
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
    retryOnAuthFailure: false,
  });
}

export async function getAdminMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/admin/me", {
    method: "GET",
    token,
    authRole: "admin",
  });
}

export async function getSellerMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/seller/me", {
    method: "GET",
    token,
    authRole: "seller",
  });
}

export async function getCustomerMeRequest(token?: string) {
  return apiRequest<CurrentUserResponse>("/api/auth/customer/me", {
    method: "GET",
    token,
    authRole: "customer",
  });
}

export async function logoutAdminRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/admin/logout", {
    method: "POST",
    authRole: "admin",
    retryOnAuthFailure: false,
  });
}

export async function logoutSellerRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/seller/logout", {
    method: "POST",
    authRole: "seller",
    retryOnAuthFailure: false,
  });
}

export async function logoutCustomerRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/customer/logout", {
    method: "POST",
    authRole: "customer",
    retryOnAuthFailure: false,
  });
}

export async function logoutAllRequest() {
  return apiRequest<{ success: boolean }>("/api/auth/logout-all", {
    method: "POST",
    retryOnAuthFailure: false,
  });
}

export async function updateMyPreferredLocale(
  locale: "en" | "ru" | "vi",
  authRole: AuthRoleKey,
) {
  return apiRequest<{ preferredLocale: "en" | "ru" | "vi" | null }>("/api/users/locale", {
    method: "PATCH",
    authRole,
    body: JSON.stringify({ preferredLocale: locale }),
  });
}
