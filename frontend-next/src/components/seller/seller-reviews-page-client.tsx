"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { ReviewStars } from "@/components/reviews/review-stars";
import { toast } from "@/components/ui/use-toast";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  listShopReviews,
  replyToShopReview,
  type SellerReviewRecord,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

function formatReviewDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "vi" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function SellerReviewsPageClient() {
  const { locale, t } = useI18n("seller");
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const [items, setItems] = useState<SellerReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState("");
  const [query, setQuery] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void loadShops();
  }, [hydrated, loadShops]);

  useEffect(() => {
    if (!currentShopId) {
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const response = await listShopReviews(currentShopId, {
          rating: rating ? Number(rating) : undefined,
          q: query.trim() || undefined,
        });
        if (!active) return;
        setItems(response.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(
          getLocalizedErrorMessage({
            role: "seller",
            error: issue,
            fallbackKey: "seller.reviews.loadFailed",
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [currentShopId, query, rating]);

  const currentShopName = useMemo(
    () => shops.find((shop) => shop.id === currentShopId)?.name ?? null,
    [currentShopId, shops],
  );

  const handleReply = async (review: SellerReviewRecord) => {
    if (!currentShopId) return;
    const reply = replyDrafts[review.id]?.trim();
    if (!reply) return;

    setSavingReviewId(review.id);
    try {
      const updated = await replyToShopReview(currentShopId, review.id, { reply });
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReplyDrafts((current) => ({ ...current, [review.id]: "" }));
      toast.success(t("seller.reviews.replySent"));
    } catch (issue) {
      toast.error(
        getLocalizedErrorMessage({
          role: "seller",
          error: issue,
          fallbackKey: "seller.reviews.replyFailed",
        }),
      );
    } finally {
      setSavingReviewId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="seller-reviews-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {t("seller.reviews.eyebrow")}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          {t("seller.reviews.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          {currentShopName
            ? t("seller.reviews.subtitle", { shop: currentShopName })
            : t("seller.reviews.noShop")}
        </p>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("seller.reviews.searchPlaceholder")}
            className="min-w-[260px] rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="seller-reviews-search"
          />
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="seller-reviews-rating-filter"
          >
            <option value="">{t("seller.reviews.allRatings")}</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {t("seller.reviews.ratingFilter", { count: value })}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {!currentShopId ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.reviews.noShop")}
        </section>
      ) : loading ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.reviews.loading")}
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          {t("seller.reviews.empty")}
        </section>
      ) : (
        <div className="grid gap-4">
          {items.map((review) => (
            <article
              key={review.id}
              className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5"
              data-testid="seller-review-row"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {review.product?.title ?? review.orderItem?.productTitleSnapshot ?? t("seller.reviews.unknownProduct")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <ReviewStars rating={review.rating} size="sm" />
                    <span>{review.customer?.maskedName ?? t("seller.reviews.customerFallback")}</span>
                    <span>{formatReviewDate(review.createdAt, locale)}</span>
                  </div>
                </div>
                <span
                  className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]"
                  data-testid="seller-review-status"
                >
                  {t(`seller.reviews.status.${review.status}`)}
                </span>
              </div>

              {review.comment ? (
                <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">{review.comment}</p>
              ) : null}
              {review.fitFeedback ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {t(`seller.reviews.fit.${review.fitFeedback}`)}
                </p>
              ) : null}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("seller.reviews.customerPhotos")}
                </p>
                {review.images.length ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {review.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                        onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
                        data-testid="seller-review-image-thumbnail"
                      >
                        <img
                          src={image.url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.reviews.noImages")}</p>
                )}
              </div>
              {review.sellerReply ? (
                <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("seller.reviews.replyLabel")}
                  </p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">{review.sellerReply}</p>
                </div>
              ) : null}

              <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("seller.reviews.replyLabel")}
                </label>
                <textarea
                  value={replyDrafts[review.id] ?? ""}
                  onChange={(event) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [review.id]: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-[110px] w-full rounded-[1rem] border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  placeholder={t("seller.reviews.replyPlaceholder")}
                  data-testid="seller-review-reply-input"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleReply(review)}
                    disabled={savingReviewId === review.id}
                    className="public-button-primary px-4 py-2 text-sm disabled:opacity-60"
                    data-testid="seller-review-reply-submit"
                  >
                    {savingReviewId === review.id
                      ? t("seller.reviews.replySending")
                      : t("seller.reviews.sendReply")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
