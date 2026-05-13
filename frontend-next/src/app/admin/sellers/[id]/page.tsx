import { AdminSellerDetailClient } from "@/components/admin/admin-seller-detail-client";

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminSellerDetailClient userId={id} />;
}
