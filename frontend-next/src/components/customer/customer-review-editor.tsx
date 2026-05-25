"use client";

import { useState } from "react";
import { ReviewStars } from "@/components/reviews/review-stars";
import { toast } from "@/components/ui/use-toast";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  createCustomerReview,
  updateCustomerReview,
  type CustomerProductReview,
  type CustomerReviewRecord,
} from "@/lib/customer-api";

type SavedReview = CustomerProductReview & { id: string };

const fitFeedbackOptions = [
  "RUNS_SMALL",
  "TRUE_TO_SIZE",
  "RUNS_LARGE",
] as const;

export function CustomerReviewEditor({
  orderId,
  orderItemId,
  productId,
  existingReview,
  onSaved,
  compact = false,
}: {
  orderId: string;
  orderItemId: string;
  productId: string | null;
  existingReview: CustomerProductReview | null;
  onSaved: (review: SavedReview) => void;
  compact?: boolean;
}) {
  const { t } = useI18n("customer");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [fitFeedback, setFitFeedback] = useState(existingReview?.fitFeedback ?? "");
  const [saving, setSaving] = useState(false);

  const actionLabel = existingReview
    ? t("customer.reviews.editReview")
    : t("customer.reviews.writeReview");

  const handleSubmit = async () => {
    if (!rating) {
      toast.error(t("customer.reviews.ratingRequired"));
      return;
    }

    setSaving(true);
    try {
      const saved: CustomerReviewRecord = existingReview
        ? await updateCustomerReview(existingReview.id, {
            rating,
            comment,
            fitFeedback: fitFeedback || undefined,
          })
        : await createCustomerReview({
            orderId,
            orderItemId,
            ...(productId ? { productId } : {}),
            rating,
            comment,
            fitFeedback: fitFeedback || undefined,
          });

      onSaved({
        id: saved.id,
        rating: saved.rating,
        comment: saved.comment,
        fitFeedback: saved.fitFeedback,
        status: saved.status,
        sellerReply: saved.sellerReply,
        sellerRepliedAt: saved.sellerRepliedAt,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });
      setOpen(false);
      toast.success(
        existingReview
          ? t("customer.reviews.updated")
          : t("customer.reviews.thankYou"),
      );
    } catch (error) {
      toast.error(
        getLocalizedErrorMessage({
          role: "customer",
          error,
          fallbackKey: "customer.reviews.submitFailed",
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"} data-testid="customer-review-editor">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="public-button-secondary px-4 py-2 text-sm"
        data-testid={existingReview ? "customer-edit-review-button" : "customer-write-review-button"}
      >
        {actionLabel}
      </button>

      {existingReview && !open ? (
        <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <ReviewStars rating={existingReview.rating} size="sm" />
            <span
              className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"
              data-testid="customer-review-status"
            >
              {t("customer.reviews.verifiedPurchase")}
            </span>
          </div>
          {existingReview.comment ? (
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
              {existingReview.comment}
            </p>
          ) : null}
          {existingReview.fitFeedback ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t(`customer.reviews.fit.${existingReview.fitFeedback}`)}
            </p>
          ) : null}
          {existingReview.sellerReply ? (
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("customer.reviews.sellerReply")}
              </p>
              <p className="mt-2 text-[var(--foreground)]">{existingReview.sellerReply}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {actionLabel}
          </p>
          <div className="mt-3">
            <ReviewStars
              rating={rating}
              interactive
              onChange={setRating}
              size="lg"
              testId="customer-review-rating"
            />
          </div>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t("customer.reviews.fitLabel")}
          </label>
          <select
            value={fitFeedback}
            onChange={(event) => setFitFeedback(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="customer-review-fit-feedback"
          >
            <option value="">{t("customer.reviews.fitNone")}</option>
            {fitFeedbackOptions.map((option) => (
              <option key={option} value={option}>
                {t(`customer.reviews.fit.${option}`)}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t("customer.reviews.comment")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2 min-h-[120px] w-full rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3 text-sm"
            placeholder={t("customer.reviews.commentPlaceholder")}
            data-testid="customer-review-comment"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="public-button-secondary px-4 py-2 text-sm"
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="public-button-primary px-4 py-2 text-sm disabled:opacity-60"
              data-testid="customer-review-submit"
            >
              {saving ? t("customer.reviews.submitting") : t("customer.reviews.submit")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
