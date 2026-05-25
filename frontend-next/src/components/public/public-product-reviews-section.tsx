"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
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

function pluralizeReviewCount(count: number, locale: string) {
  if (locale !== "ru") {
    return `${count} reviews`;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;
  let noun = "отзывов";
  if (mod10 === 1 && mod100 !== 11) {
    noun = "отзыв";
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    noun = "отзыва";
  }
  return `${count} ${noun}`;
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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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

  const average = summary.averageRating ?? product.averageRating ?? null;
  const ratingCount = summary.ratingCount ?? product.feedbackCount ?? 0;
  const fitTrueToSizeCount = items.filter((item) => item.fitFeedback === "TRUE_TO_SIZE").length;
  const fitSummary =
    items.length > 0 && fitTrueToSizeCount > 0
      ? `${Math.round((fitTrueToSizeCount / items.length) * 100)}% ${t("public.reviews.fit.TRUE_TO_SIZE").toLowerCase()}`
      : null;

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: t("public.reviews.filters.all") },
      { key: "5" as const, label: "5★" },
      { key: "4" as const, label: "4★" },
      { key: "3" as const, label: "3★" },
      { key: "2" as const, label: "2★" },
      { key: "1" as const, label: "1★" },
    ],
    [t],
  );

  return (
    <section
      className="card-panel rounded-[2rem] bg-white px-6 py-6 sm:px-8"
      data-testid="public-product-reviews"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,#fff8fe_0%,#ffffff_100%)] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {t("public.reviews.sectionKicker")}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
            {t("public.reviews.title")}
          </h2>

          {ratingCount > 0 ? (
            <div className="mt-5">
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black tracking-tight text-[var(--foreground)]">
                  {average ?? "0.0"}
                </span>
                <span className="pb-1 text-amber-400">
                  <Star className="h-8 w-8 fill-amber-400 text-amber-400" strokeWidth={1.8} />
                </span>
              </div>
              <div className="mt-3">
                <ReviewStars rating={Math.round(Number(average ?? 0))} size="md" />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
                {pluralizeReviewCount(ratingCount, locale)}
              </p>
              {fitSummary ? (
                <p className="mt-2 text-sm text-[var(--muted)]">{fitSummary}</p>
              ) : null}
            </div>
          ) : (
            <div
              className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm text-[var(--muted)]"
              data-testid="public-product-reviews-empty"
            >
              {t("public.reviews.emptyLong")}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2" data-testid="public-review-filters">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  filter === option.key
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
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
              {t("public.reviews.emptyLong")}
            </div>
          ) : (
            <div className="mt-6 space-y-4" data-testid="public-product-reviews-list">
              {items.map((review) => (
                <article
                  key={review.id}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 shadow-[0_14px_32px_rgba(31,31,41,0.06)]"
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
                        <ReviewStars rating={review.rating} size="sm" summaryLabel={`${review.rating}/5`} />
                        <span>{formatReviewDate(review.createdAt, locale)}</span>
                      </div>
                    </div>
                    {review.orderCode ? (
                      <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
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

                  {review.images.length ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {review.images.map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]"
                          onClick={() => setPreviewImageUrl(image.url)}
                          data-testid="public-review-image-thumbnail"
                        >
                          <img
                            src={image.url}
                            alt=""
                            className="h-20 w-20 object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {review.sellerReply ? (
                    <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
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
        </div>
      </div>

      {previewImageUrl ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 py-6">
          <button
            type="button"
            className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Close review image preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewImageUrl}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-[1.5rem] bg-white object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </section>
  );
}
