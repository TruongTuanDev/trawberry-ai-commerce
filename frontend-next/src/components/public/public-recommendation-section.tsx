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

export function PublicRecommendationSection({
  titleKey,
  items,
  placement,
  sourceProductId,
  trackingEnabled,
}: {
  titleKey: "recommendedForYou" | "similarProducts" | "similarBySearch";
  items: RecommendationProductItem[];
  placement: RecommendationPlacement;
  sourceProductId?: string;
  trackingEnabled: boolean;
}) {
  const { t } = useI18n("customer");
  const impressionKeyRef = useRef<string>("");

  useEffect(() => {
    if (!trackingEnabled || items.length === 0) {
      return;
    }

    const impressionKey = `${placement}:${sourceProductId ?? "none"}:${items.map((item) => item.product.id).join(",")}`;
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
        algorithm: "rule_based_v2",
        rank: item.rank ?? index + 1,
        score: item.score ?? undefined,
        guestSessionId,
      });
    });
  }, [items, placement, sourceProductId, trackingEnabled]);

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
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
        data-testid={`recommendation-grid-${placement}`}
      >
        {items.map((item, index) => (
          <ProductCard
            key={`${placement}-${item.product.id}`}
            product={item.product}
            onProductNavigate={() => {
              if (!trackingEnabled) {
                return;
              }

              void trackRecommendationEvent({
                type: "click",
                placement,
                productId: item.product.id,
                sourceProductId,
                algorithm: "rule_based_v2",
                rank: item.rank ?? index + 1,
                score: item.score ?? undefined,
                guestSessionId: getGuestSessionId(),
              });
            }}
          />
        ))}
      </section>
    </section>
  );
}
