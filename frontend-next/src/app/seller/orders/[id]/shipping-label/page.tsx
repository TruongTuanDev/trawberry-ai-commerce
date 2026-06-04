import { SellerShippingLabelPageClient } from "@/components/orders/seller-shipping-label-page-client";
import { normalizeShippingLabelSize } from "@/lib/seller-api";

export default async function SellerShippingLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; size?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <SellerShippingLabelPageClient
      orderId={id}
      autoPrint={query.print === "1"}
      initialSize={normalizeShippingLabelSize(query.size)}
    />
  );
}
