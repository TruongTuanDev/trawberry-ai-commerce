import { OrderTrackDetailPageClient } from "@/components/public/order-track-detail-page-client";

export default async function OrderTrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OrderTrackDetailPageClient orderId={id} />;
}
