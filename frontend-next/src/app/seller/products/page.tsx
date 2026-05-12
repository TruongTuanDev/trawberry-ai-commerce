import { Suspense } from "react";
import { SellerProductsPageClient } from "@/components/products/seller-products-page-client";

export default function SellerProductsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--muted)]">Loading products...</div>}>
      <SellerProductsPageClient />
    </Suspense>
  );
}
