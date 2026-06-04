"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/use-i18n";
import { useAuthStore } from "@/stores/auth-store";

export function MessageShopButton({
  shopSlug,
  productId,
  className,
  testId,
}: {
  shopSlug: string;
  productId?: string;
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const customerUser = useAuthStore((state) => state.customerUser);
  const { t } = useI18n("customer");

  const targetHref = `/customer/messages/new?shopSlug=${encodeURIComponent(shopSlug)}${
    productId ? `&productId=${encodeURIComponent(productId)}` : ""
  }`;

  return (
    <button
      type="button"
      className={className}
      data-testid={testId}
      onClick={() => {
        if (customerUser?.role === "CUSTOMER") {
          router.push(targetHref);
          return;
        }

        router.push(
          `/customer/login?next=${encodeURIComponent(targetHref)}&intent=message`,
        );
      }}
    >
      {t("customer.messages.messageShop")}
    </button>
  );
}
