import { AdminReturnsPageClient } from "@/components/admin/admin-returns-page-client";

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return <AdminReturnsPageClient caseId={caseId} />;
}
