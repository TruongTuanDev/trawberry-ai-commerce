import { CheckoutPageClient } from "@/components/public/checkout-page-client";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    productId?: string;
    variantId?: string;
    quantity?: string;
  }>;
}) {
  const params = await searchParams;
  const initialProductId = params.productId ?? null;
  const initialVariantId = params.variantId ?? null;
  const initialQuantity = Math.max(1, Number(params.quantity ?? "1") || 1);

  return (
    <CheckoutPageClient
      key={`${initialProductId ?? "none"}:${initialVariantId ?? "auto"}:${initialQuantity}`}
      initialProductId={initialProductId}
      initialVariantId={initialVariantId}
      initialQuantity={initialQuantity}
    />
  );
}
