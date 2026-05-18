import type { CurrentUserResponse } from "@/lib/auth-api";

export function getRoleHome(
  user: Pick<
    CurrentUserResponse,
    "role" | "sellerApprovalStatus" | "sellerNextStep"
  >,
) {
  if (user.role === "ADMIN") {
    return "/admin/dashboard";
  }

  if (user.role === "SELLER") {
    if (user.sellerApprovalStatus === "APPROVED") {
      return "/seller/dashboard";
    }

    if (user.sellerNextStep === "WAIT_FOR_APPROVAL" || user.sellerNextStep === "CONTACT_SUPPORT") {
      return "/seller/pending";
    }

    return "/seller/onboarding";
  }

  if (user.role === "CUSTOMER") {
    return "/customer/orders";
  }

  return "/products";
}
