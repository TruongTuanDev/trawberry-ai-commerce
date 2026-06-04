"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ReviewStars } from "@/components/reviews/review-stars";
import { toast } from "@/components/ui/use-toast";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  createCustomerReview,
  updateCustomerReview,
  uploadCustomerReviewImage,
  type CustomerProductReview,
  type CustomerReviewRecord,
  type ReviewImageAsset,
} from "@/lib/customer-api";

type SavedReview = CustomerProductReview & { id: string };

const fitFeedbackOptions = [
  "RUNS_SMALL",
  "TRUE_TO_SIZE",
  "RUNS_LARGE",
] as const;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxReviewImages = 5;
const maxImageSizeBytes = 5 * 1024 * 1024;

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

function mapSavedReview(saved: CustomerReviewRecord): SavedReview {
  return {
    id: saved.id,
    rating: saved.rating,
    comment: saved.comment,
    fitFeedback: saved.fitFeedback,
    status: saved.status,
    sellerReply: saved.sellerReply,
    sellerRepliedAt: saved.sellerRepliedAt,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    images: saved.images,
  };
}

function ExistingReviewImages({ images }: { images: ReviewImageAsset[] }) {
  if (!images.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3" data-testid="customer-review-image-gallery">
      {images.map((image) => (
        <button
          key={image.id}
          type="button"
          className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
          onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
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
  );
}

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
  const { locale, t } = useI18n("customer");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [fitFeedback, setFitFeedback] = useState(existingReview?.fitFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      for (const image of pendingImagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  const actionLabel = existingReview
    ? t("customer.reviews.editReview")
    : t("customer.reviews.writeReview");

  const existingImageCount = existingReview?.images.length ?? 0;
  const remainingImageSlots = Math.max(0, maxReviewImages - existingImageCount - pendingImages.length);

  const handleClose = () => {
    setOpen(false);
    setPendingImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    setRating(existingReview?.rating ?? 0);
    setComment(existingReview?.comment ?? "");
    setFitFeedback(existingReview?.fitFeedback ?? "");
  };

  const handleToggleEditor = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setRating(existingReview?.rating ?? 0);
        setComment(existingReview?.comment ?? "");
        setFitFeedback(existingReview?.fitFeedback ?? "");
      }
      return next;
    });
  };

  const validateFiles = (files: File[]) => {
    if (existingImageCount + pendingImages.length + files.length > maxReviewImages) {
      toast.error(t("errors.REVIEW_IMAGE_LIMIT_EXCEEDED"));
      return false;
    }

    for (const file of files) {
      if (!allowedImageTypes.has(file.type)) {
        toast.error(t("errors.REVIEW_IMAGE_TYPE_INVALID"));
        return false;
      }
      if (file.size > maxImageSizeBytes) {
        toast.error(t("errors.REVIEW_IMAGE_TOO_LARGE"));
        return false;
      }
    }

    return true;
  };

  const handleSelectImages = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const selected = Array.from(files);
    if (!validateFiles(selected)) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setPendingImages((current) => [
      ...current,
      ...selected.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingImage = (imageId: string) => {
    setPendingImages((current) => {
      const target = current.find((image) => image.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((image) => image.id !== imageId);
    });
  };

  const handleSubmit = async () => {
    if (!rating) {
      toast.error(t("customer.reviews.ratingRequired"));
      return;
    }

    if (!comment.trim()) {
      toast.error(t("customer.reviews.commentRequired"));
      return;
    }

    setSaving(true);
    try {
      let saved: CustomerReviewRecord = existingReview
        ? await updateCustomerReview(existingReview.id, {
            rating,
            comment: comment.trim(),
            fitFeedback: fitFeedback || undefined,
          })
        : await createCustomerReview({
            orderId,
            orderItemId,
            ...(productId ? { productId } : {}),
            rating,
            comment: comment.trim(),
            fitFeedback: fitFeedback || undefined,
          });

      for (const image of pendingImages) {
        saved = await uploadCustomerReviewImage(saved.id, image.file);
      }

      onSaved(mapSavedReview(saved));
      setPendingImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return [];
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

  const existingSummaryImages = useMemo(
    () => existingReview?.images ?? [],
    [existingReview],
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3"} data-testid="customer-review-editor">
      <button
        type="button"
        onClick={handleToggleEditor}
        className="public-button-secondary px-4 py-2 text-sm"
        data-testid={existingReview ? "customer-edit-review-button" : "customer-write-review-button"}
      >
        {actionLabel}
      </button>

      {existingReview && !open ? (
        <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <ReviewStars
              rating={existingReview.rating}
              size="sm"
              summaryLabel={`${existingReview.rating}/5`}
            />
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
          <ExistingReviewImages images={existingSummaryImages} />
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
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(31,31,41,0.08)]">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {actionLabel}
          </p>

          <div className="mt-4">
            <ReviewStars
              rating={rating}
              interactive
              onChange={setRating}
              size="lg"
              testId="customer-review-rating"
              interactiveLabel={(value) =>
                locale === "ru"
                  ? `${value} из 5`
                  : `Set ${value} star rating`
              }
            />
          </div>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
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

          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {t("customer.reviews.comment")}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="mt-2 min-h-[140px] w-full rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3 text-sm"
            placeholder={t("customer.reviews.commentPlaceholder")}
            data-testid="customer-review-comment"
          />

          <div className="mt-5 rounded-[1.25rem] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("customer.reviews.photos")}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {t("customer.reviews.photosHelper")}
                </p>
              </div>
              <div className="text-xs font-semibold text-[var(--muted)]">
                {t("customer.reviews.photosRemaining", {
                  count: remainingImageSlots,
                })}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => handleSelectImages(event.target.files)}
              data-testid="customer-review-image-input"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="public-button-secondary px-4 py-2 text-sm"
                data-testid="customer-review-add-photos"
              >
                {t("customer.reviews.addPhotos")}
              </button>
            </div>

            {pendingImages.length ? (
              <div className="mt-4 flex flex-wrap gap-3" data-testid="customer-review-pending-images">
                {pendingImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                  >
                    <img
                      src={image.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingImage(image.id)}
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white"
                      aria-label={t("customer.reviews.removePhoto")}
                      data-testid="customer-review-remove-image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleClose}
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
