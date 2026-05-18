import type { CurrentUserResponse } from "@/lib/auth-api";

export function getRoleHome(user: Pick<CurrentUserResponse, "role" | "sellerApprovalStatus">) {
  if (user.role === "ADMIN") {
    return "/admin/dashboard";
  }

  if (user.role === "SELLER") {
    return user.sellerApprovalStatus === "APPROVED"
      ? "/seller/dashboard"
      : "/seller/onboarding";
  }

  if (user.role === "CUSTOMER") {
    return "/customer/orders";
  }

  return "/products";
}
