"use client";

import { useEffect, useMemo, useState } from "react";
import { ReviewStars } from "@/components/reviews/review-stars";
import { useI18n } from "@/i18n/use-i18n";
import {
  getPublicProductReviews,
  type PublicProduct,
  type PublicProductReview,
  type PublicProductReviewsResponse,
} from "@/lib/public-api";

type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

function formatReviewDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export function PublicProductReviewsSection({
  product,
}: {
  product: PublicProduct;
}) {
  const { locale, t } = useI18n("customer");
  const [items, setItems] = useState<PublicProductReview[]>([]);
  const [summary, setSummary] = useState<PublicProductReviewsResponse["summary"]>({
    averageRating: product.averageRating,
    ratingCount: product.feedbackCount,
    countsByRating: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RatingFilter>("all");

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await getPublicProductReviews(product.id, {
          rating: filter === "all" ? undefined : Number(filter),
          page: 1,
          limit: 20,
        });
        if (!active) return;
        setItems(response.items);
        setSummary(response.summary);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : t("public.reviews.loadFailed"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [filter, product.id, t]);

  const counts = summary.countsByRating;
  const average = summary.averageRating ?? product.averageRating ?? null;
  const ratingCount = summary.ratingCount ?? product.feedbackCount ?? 0;

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: t("public.reviews.filters.all") },
      { key: "5" as const, label: t("public.reviews.filters.stars", { count: 5 }) },
      { key: "4" as const, label: t("public.reviews.filters.stars", { count: 4 }) },
      { key: "3" as const, label: t("public.reviews.filters.stars", { count: 3 }) },
      { key: "2" as const, label: t("public.reviews.filters.stars", { count: 2 }) },
      { key: "1" as const, label: t("public.reviews.filters.stars", { count: 1 }) },
    ],
    [t],
  );

  return (
    <section
      className="card-panel rounded-[2rem] bg-white px-6 py-6 sm:px-8"
      data-testid="public-product-reviews"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("public.reviews.sectionKicker")}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
            {t("public.reviews.title")}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ratingCount > 0
              ? t("public.reviews.summaryLine", {
                  rating: average ?? "0.0",
                  count: ratingCount,
                })
              : t("public.reviews.empty")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label={t("public.reviews.average")}
            value={average ?? t("public.reviews.noRatingYet")}
          />
          <SummaryCard
            label={t("public.reviews.total")}
            value={String(ratingCount)}
          />
          <SummaryCard
            label={t("public.reviews.topRating")}
            value={String(counts["5"] ?? 0)}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" data-testid="public-review-filters">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === option.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-[var(--muted)]">{t("public.reviews.loading")}</div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div
          className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-5 text-sm text-[var(--muted)]"
          data-testid="public-product-reviews-empty"
        >
          {t("public.reviews.empty")}
        </div>
      ) : (
        <div className="mt-6 space-y-4" data-testid="public-product-reviews-list">
          {items.map((review) => (
            <article
              key={review.id}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-5"
              data-testid="public-review-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {review.customerName}
                    </p>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      {t("public.reviews.verifiedPurchase")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <ReviewStars rating={review.rating} size="sm" />
                    <span>{formatReviewDate(review.createdAt, locale)}</span>
                  </div>
                </div>
                {review.orderCode ? (
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
                    {review.orderCode}
                  </span>
                ) : null}
              </div>
              {review.comment ? (
                <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">{review.comment}</p>
              ) : null}
              {review.fitFeedback ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {t(`public.reviews.fit.${review.fitFeedback}`)}
                </p>
              ) : null}
              {review.sellerReply ? (
                <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("public.reviews.sellerReply")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
                    {review.sellerReply}
                  </p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
