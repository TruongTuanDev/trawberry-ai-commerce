"use client";

import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/public/product-card";
import { useI18n } from "@/i18n/use-i18n";
import {
  getGuestSessionId,
  trackRecommendationEvent,
  type RecommendationPlacement,
  type RecommendationProductItem,
} from "@/lib/public-api";

function createRecommendationEventKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function isPersonalizedRecommendation(item: RecommendationProductItem) {
  return item.reasonCodes.some((reasonCode) =>
    [
      "based_on_recent_views",
      "based_on_category_affinity",
      "based_on_search_intent",
      "based_on_recommendation_clicks",
    ].includes(reasonCode),
  );
}

export function PublicRecommendationSection({
  titleKey,
  items,
  placement,
  algorithm,
  showExplainability,
  sourceProductId,
  trackingEnabled,
}: {
  titleKey: "recommendedForYou" | "similarProducts" | "similarBySearch";
  items: RecommendationProductItem[];
  placement: RecommendationPlacement;
  algorithm?: string | null;
  showExplainability?: boolean;
  sourceProductId?: string;
  trackingEnabled: boolean;
}) {
  const { t } = useI18n("customer");
  const impressionKeyRef = useRef<string>("");

  useEffect(() => {
    if (!trackingEnabled || items.length === 0 || !algorithm) {
      return;
    }

    const impressionKey = `${placement}:${algorithm}:${sourceProductId ?? "none"}:${items.map((item) => item.product.id).join(",")}`;
    if (impressionKeyRef.current === impressionKey) {
      return;
    }
    impressionKeyRef.current = impressionKey;

    const guestSessionId = getGuestSessionId();
    items.forEach((item, index) => {
      void trackRecommendationEvent({
        type: "impression",
        placement,
        productId: item.product.id,
        sourceProductId,
        algorithm,
        rank: item.rank ?? index + 1,
        score: item.score ?? undefined,
        guestSessionId,
        idempotencyKey: `imp:${impressionKey}:${item.product.id}`,
        sponsored: item.sponsored ?? false,
        personalized: isPersonalizedRecommendation(item),
        trackingToken: item.trackingToken ?? null,
      });
    });
  }, [algorithm, items, placement, sourceProductId, trackingEnabled]);

  if (!items.length) {
    return null;
  }

  return (
    <section
      className="space-y-5"
      data-testid={`recommendation-section-${placement}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {t("recommendations.kicker")}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
          {t(`recommendations.${titleKey}`)}
        </h2>
      </div>

      <section
        className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:gap-5 xl:grid-cols-4"
        data-testid={`recommendation-grid-${placement}`}
      >
        {items.map((item, index) => (
          <div key={`${placement}-${item.product.id}`} className="space-y-2">
            <ProductCard
              product={item.product}
              onProductNavigate={() => {
                if (!trackingEnabled || !algorithm) {
                  return;
                }

                void trackRecommendationEvent({
                  type: "click",
                  placement,
                  productId: item.product.id,
                  sourceProductId,
                  algorithm,
                  rank: item.rank ?? index + 1,
                  score: item.score ?? undefined,
                  guestSessionId: getGuestSessionId(),
                  idempotencyKey: createRecommendationEventKey(
                    `click:${placement}:${item.product.id}`,
                  ),
                  sponsored: item.sponsored ?? false,
                  personalized: isPersonalizedRecommendation(item),
                  trackingToken: item.trackingToken ?? null,
                });
              }}
            />
            {item.sponsored ? (
              <div className="px-1">
                <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("recommendations.sponsored")}
                </span>
              </div>
            ) : null}
            {showExplainability && item.scoreExplanation ? (
              <div
                className="rounded-[1.25rem] border border-dashed border-[var(--border)] bg-white/80 px-3 py-3 text-xs text-[var(--muted)]"
                data-testid={`recommendation-debug-${placement}-${item.product.id}`}
              >
                <p className="font-semibold text-[var(--foreground)]">
                  {item.scoreExplanation.algorithm} · {item.scoreExplanation.finalScore ?? "n/a"}
                </p>
                {item.scoreExplanation.reasons.length ? (
                  <p className="mt-1 leading-5">
                    {item.scoreExplanation.reasons.join(" | ")}
                  </p>
                ) : null}
                {item.scoreExplanation.scoreBreakdown ? (
                  <p className="mt-2 font-mono leading-5">
                    cat {item.scoreExplanation.scoreBreakdown.categoryScore} · text {item.scoreExplanation.scoreBreakdown.textScore} · pop {item.scoreExplanation.scoreBreakdown.popularityScore} · fresh {item.scoreExplanation.scoreBreakdown.freshnessScore} · rating {item.scoreExplanation.scoreBreakdown.ratingScore} · stock {item.scoreExplanation.scoreBreakdown.stockScore} · shop {item.scoreExplanation.scoreBreakdown.shopScore} · pers {item.scoreExplanation.scoreBreakdown.personalizationScore} · recent {item.scoreExplanation.scoreBreakdown.recentViewScore} · affinity {item.scoreExplanation.scoreBreakdown.categoryAffinityScore} · intent {item.scoreExplanation.scoreBreakdown.searchIntentScore} · clicks {item.scoreExplanation.scoreBreakdown.clickAffinityScore} · penalty {item.scoreExplanation.scoreBreakdown.penaltyScore}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </section>
  );
}
