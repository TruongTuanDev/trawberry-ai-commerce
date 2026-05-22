import { CustomerAccountReturnsPageClient } from "@/components/customer/account/customer-account-returns-page-client";

export default async function CustomerReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  return <CustomerAccountReturnsPageClient initialOrderId={orderId ?? null} />;
}
