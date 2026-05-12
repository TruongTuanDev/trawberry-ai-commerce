import { PublicProductDetailPageClient } from "@/components/public/public-product-detail-page-client";

export default async function PublicProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PublicProductDetailPageClient productId={id} />;
}
