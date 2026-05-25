"use client";

import { clsx } from "clsx";

export function ReviewStars({
  rating,
  interactive = false,
  onChange,
  size = "md",
  testId,
}: {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  testId?: string;
}) {
  const sizeClass =
    size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg";

  if (!interactive) {
    return (
      <div
        className={clsx("inline-flex items-center gap-1", sizeClass)}
        aria-label={`${rating} out of 5 stars`}
        data-testid={testId}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= rating ? "text-amber-500" : "text-slate-300"}>
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx("inline-flex items-center gap-1", sizeClass)} data-testid={testId}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={clsx(
            "transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            star <= rating ? "text-amber-500" : "text-slate-300",
          )}
          aria-label={`Rate ${star} out of 5`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
