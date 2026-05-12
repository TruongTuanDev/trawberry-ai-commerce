import { CheckoutPageClient } from "@/components/public/checkout-page-client";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    productId?: string;
    quantity?: string;
  }>;
}) {
  const params = await searchParams;
  const initialProductId = params.productId ?? null;
  const initialQuantity = Math.max(1, Number(params.quantity ?? "1") || 1);

  return (
    <CheckoutPageClient
      key={`${initialProductId ?? "none"}:${initialQuantity}`}
      initialProductId={initialProductId}
      initialQuantity={initialQuantity}
    />
  );
}
