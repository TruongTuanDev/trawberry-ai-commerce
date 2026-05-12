import { SellerOrderDetailPageClient } from "@/components/orders/seller-order-detail-page-client";

export default async function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SellerOrderDetailPageClient orderId={id} />;
}
