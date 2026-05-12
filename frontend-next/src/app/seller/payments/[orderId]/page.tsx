import { SellerPaymentDetailPageClient } from "@/components/payments/seller-payment-detail-page-client";

export default async function SellerPaymentDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <SellerPaymentDetailPageClient orderId={orderId} />;
}
