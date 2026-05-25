"use client";

import { clsx } from "clsx";
import { Star } from "lucide-react";

type ReviewStarsProps = {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  testId?: string;
  summaryLabel?: string;
  interactiveLabel?: (rating: number) => string;
};

export function ReviewStars({
  rating,
  interactive = false,
  onChange,
  size = "md",
  testId,
  summaryLabel,
  interactiveLabel,
}: ReviewStarsProps) {
  const iconSizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  const renderStar = (star: number) => (
    <Star
      className={clsx(
        iconSizeClass,
        "transition",
        star <= rating
          ? "fill-amber-400 text-amber-400"
          : "fill-transparent text-slate-300",
      )}
      strokeWidth={1.8}
    />
  );

  if (!interactive) {
    return (
      <div
        className="inline-flex items-center gap-1"
        aria-label={summaryLabel ?? `${rating} out of 5 stars`}
        data-testid={testId}
        data-rating={rating}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} aria-hidden="true">
            {renderStar(star)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1" data-testid={testId} data-rating={rating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={clsx(
            "rounded-full p-1 transition hover:scale-105 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          )}
          aria-label={interactiveLabel?.(star) ?? `Set ${star} star rating`}
        >
          {renderStar(star)}
        </button>
      ))}
    </div>
  );
}
