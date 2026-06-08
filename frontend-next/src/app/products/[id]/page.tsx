import { PublicProductDetailPageClient } from "@/components/public/public-product-detail-page-client";
import { getPublicProduct } from "@/lib/public-api";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

export default async function PublicProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recommendationFlags = getRecommendationFlags();
  let initialProduct = null;

  try {
    initialProduct = await getPublicProduct(id);
  } catch {
    initialProduct = null;
  }

  return (
    <PublicProductDetailPageClient
      productId={id}
      initialProduct={initialProduct}
      recommendationsEnabled={recommendationFlags.publicRecommendationsEnabled}
      recommendationTrackingEnabled={recommendationFlags.recommendationTrackingEnabled}
    />
  );
}
