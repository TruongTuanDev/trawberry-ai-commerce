import { PublicProductDetailPageClient } from "@/components/public/public-product-detail-page-client";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

export default async function PublicProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recommendationFlags = getRecommendationFlags();

  return (
    <PublicProductDetailPageClient
      productId={id}
      recommendationsEnabled={recommendationFlags.publicRecommendationsEnabled}
      recommendationTrackingEnabled={recommendationFlags.recommendationTrackingEnabled}
    />
  );
}
