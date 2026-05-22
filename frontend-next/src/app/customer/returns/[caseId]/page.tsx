import { CustomerAccountReturnsPageClient } from "@/components/customer/account/customer-account-returns-page-client";

export default async function CustomerReturnDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <CustomerAccountReturnsPageClient caseId={caseId} />;
}
