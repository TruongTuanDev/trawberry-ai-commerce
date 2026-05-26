"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { ReviewStars } from "@/components/reviews/review-stars";
import { toast } from "@/components/ui/use-toast";
import {
  hideAdminReview,
  listAdminReviews,
  restoreAdminReview,
  type AdminReviewRecord,
} from "@/lib/admin-api";

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatReviewStatus(value: string) {
  switch (value) {
    case "PUBLISHED":
      return "Published";
    case "HIDDEN":
      return "Hidden";
    case "REPORTED":
      return "Reported";
    default:
      return value;
  }
}

export function AdminReviewsPageClient() {
  const [items, setItems] = useState<AdminReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await listAdminReviews({
          status: status || undefined,
          q: query.trim() || undefined,
        });
        if (!active) return;
        setItems(response.items);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load reviews.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [query, status]);

  const handleHide = async (reviewId: string) => {
    setSavingId(reviewId);
    try {
      const updated = await hideAdminReview(reviewId, "Hidden by admin moderation.");
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Review hidden.");
    } catch (issue) {
      toast.error(issue instanceof Error ? issue.message : "Unable to hide review.");
    } finally {
      setSavingId(null);
    }
  };

  const handleRestore = async (reviewId: string) => {
    setSavingId(reviewId);
    try {
      const updated = await restoreAdminReview(reviewId);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Review restored.");
    } catch (issue) {
      toast.error(issue instanceof Error ? issue.message : "Unable to restore review.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-reviews-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Marketplace reviews
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
          Product reviews
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Moderate verified-purchase reviews, review seller replies, and hide or restore public visibility.
        </p>
        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by product, shop, or customer"
            className="min-w-[280px] rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-reviews-search"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-reviews-status-filter"
          >
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
            <option value="REPORTED">Reported</option>
          </select>
        </div>
      </section>

      {error ? (
        <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          Loading reviews...
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">
          No reviews found for the current filters.
        </section>
      ) : (
        <div className="grid gap-4">
          {items.map((review) => (
            <article
              key={review.id}
              className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5"
              data-testid="admin-review-row"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {review.product?.title ?? review.orderItem?.productTitleSnapshot ?? "Unknown product"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <ReviewStars rating={review.rating} size="sm" />
                    <span>{review.customer?.maskedName ?? "Customer"}</span>
                    <span>{review.shop?.name ?? "Shop"}</span>
                    <span>{formatReviewDate(review.createdAt)}</span>
                  </div>
                </div>
                <span
                  className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]"
                  data-testid="admin-review-status"
                >
                  {formatReviewStatus(review.status)}
                </span>
              </div>

              {review.comment ? (
                <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">{review.comment}</p>
              ) : null}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Customer photos
                </p>
                {review.images.length ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {review.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                        onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
                        data-testid="admin-review-image-thumbnail"
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
                  <p className="mt-2 text-sm text-[var(--muted)]">No images</p>
                )}
              </div>
              {review.sellerReply ? (
                <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Seller reply
                  </p>
                  <p className="mt-2 text-[var(--foreground)]">{review.sellerReply}</p>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                {review.status === "HIDDEN" ? (
                  <button
                    type="button"
                    onClick={() => void handleRestore(review.id)}
                    disabled={savingId === review.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
                    data-testid="admin-review-restore"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleHide(review.id)}
                    disabled={savingId === review.id}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    data-testid="admin-review-hide"
                  >
                    Hide
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
