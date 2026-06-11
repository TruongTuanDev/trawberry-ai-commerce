import { notFound } from "next/navigation";
import { AdminRecommendationTuningPageClient } from "@/components/admin/admin-recommendation-tuning-page-client";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

export default function AdminRecommendationTuningPage() {
  const flags = getRecommendationFlags();
  if (!flags.recommendationTuningWorkflowEnabled) {
    notFound();
  }

  return <AdminRecommendationTuningPageClient />;
}
