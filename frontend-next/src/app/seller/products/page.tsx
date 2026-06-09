import { Suspense } from "react";
import { SellerProductsPageClient } from "@/components/products/seller-products-page-client";
import { getRoleDefaultLocale } from "@/i18n/config";
import { translate } from "@/i18n/translate";

export default function SellerProductsPage() {
  const fallbackLocale = getRoleDefaultLocale("seller");

  return (
    <Suspense
      fallback={
        <div className="text-sm text-[var(--muted)]">
          {translate(fallbackLocale, "common.loading")}
        </div>
      }
    >
      <SellerProductsPageClient />
    </Suspense>
  );
}
