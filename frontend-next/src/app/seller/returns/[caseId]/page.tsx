import { SellerReturnsPageClient } from "@/components/seller/seller-returns-page-client";

export default async function SellerReturnDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <SellerReturnsPageClient caseId={caseId} />;
}
