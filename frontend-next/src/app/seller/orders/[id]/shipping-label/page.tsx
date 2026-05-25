import { SellerShippingLabelPageClient } from "@/components/orders/seller-shipping-label-page-client";

export default async function SellerShippingLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <SellerShippingLabelPageClient
      orderId={id}
      autoPrint={query.print === "1"}
    />
  );
}
