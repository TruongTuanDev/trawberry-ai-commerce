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

  return {
    recommendationsEnabled,
    publicRecommendationsEnabled:
      recommendationsEnabled && publicRecommendationsEnabled,
    recommendationTrackingEnabled:
      recommendationsEnabled && recommendationTrackingEnabled,
  };
}

export function readRecommendationFlagsFromDocument() {
  if (typeof document === "undefined") {
    return {
      publicRecommendationsEnabled: false,
      recommendationTrackingEnabled: false,
    };
  }

  return {
    publicRecommendationsEnabled:
      document.body.dataset.publicRecommendationsEnabled === "true",
    recommendationTrackingEnabled:
      document.body.dataset.recommendationTrackingEnabled === "true",
  };
}
