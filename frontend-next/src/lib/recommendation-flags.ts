function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return !["0", "false", "off", "no"].includes(value.toLowerCase());
}

export function getRecommendationFlags() {
  const recommendationsEnabled = readBoolean(
    process.env.RECOMMENDATIONS_ENABLED,
    true,
  );
  const publicRecommendationsEnabled = readBoolean(
    process.env.PUBLIC_RECOMMENDATIONS_ENABLED ??
      process.env.NEXT_PUBLIC_PUBLIC_RECOMMENDATIONS_ENABLED,
    true,
  );
  const recommendationTrackingEnabled = readBoolean(
    process.env.RECOMMENDATION_TRACKING_ENABLED ??
      process.env.NEXT_PUBLIC_RECOMMENDATION_TRACKING_ENABLED,
    true,
  );
  const recommendationExplainabilityEnabled = readBoolean(
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED ??
      process.env.NEXT_PUBLIC_RECOMMENDATION_EXPLAINABILITY_ENABLED,
    false,
  );
  const recommendationQaToolsEnabled = readBoolean(
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED ??
      process.env.NEXT_PUBLIC_RECOMMENDATION_QA_TOOLS_ENABLED,
    false,
  );
  const recommendationAnalyticsTuningEnabled = readBoolean(
    process.env.RECOMMENDATION_ANALYTICS_TUNING_ENABLED ??
      process.env.NEXT_PUBLIC_RECOMMENDATION_ANALYTICS_TUNING_ENABLED,
    false,
  );

  return {
    recommendationsEnabled,
    publicRecommendationsEnabled:
      recommendationsEnabled && publicRecommendationsEnabled,
    recommendationTrackingEnabled:
      recommendationsEnabled && recommendationTrackingEnabled,
    recommendationExplainabilityEnabled:
      recommendationsEnabled && recommendationExplainabilityEnabled,
    recommendationQaToolsEnabled,
    recommendationAnalyticsTuningEnabled:
      recommendationsEnabled && recommendationAnalyticsTuningEnabled,
  };
}

export function readRecommendationFlagsFromDocument() {
  if (typeof document === "undefined") {
    return {
      publicRecommendationsEnabled: false,
      recommendationTrackingEnabled: false,
      recommendationExplainabilityEnabled: false,
      recommendationQaToolsEnabled: false,
      recommendationAnalyticsTuningEnabled: false,
    };
  }

  return {
    publicRecommendationsEnabled:
      document.body.dataset.publicRecommendationsEnabled === "true",
    recommendationTrackingEnabled:
      document.body.dataset.recommendationTrackingEnabled === "true",
    recommendationExplainabilityEnabled:
      document.body.dataset.recommendationExplainabilityEnabled === "true",
    recommendationQaToolsEnabled:
      document.body.dataset.recommendationQaToolsEnabled === "true",
    recommendationAnalyticsTuningEnabled:
      document.body.dataset.recommendationAnalyticsTuningEnabled === "true",
  };
}
