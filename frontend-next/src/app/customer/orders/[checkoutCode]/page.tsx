import { CustomerOrderDetailPageClient } from "@/components/customer/customer-order-detail-page-client";

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ checkoutCode: string }>;
}) {
  const { checkoutCode } = await params;
  return <CustomerOrderDetailPageClient checkoutCode={checkoutCode} />;
}
