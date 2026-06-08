"use client";

import { useState } from "react";
import { FallbackImage } from "@/components/ui/fallback-image";

export function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: Array<{
    id: string;
    url: string;
    isMain: boolean;
  }>;
}) {
  const normalizedImages = images.length
    ? images
    : [{ id: "placeholder", url: "", isMain: true }];
  const mainIndex = Math.max(0, normalizedImages.findIndex((image) => image.isMain));
  const [selectedIndex, setSelectedIndex] = useState(mainIndex);
  const selectedImage = normalizedImages[selectedIndex] ?? normalizedImages[0];

  return (
    <div
      className="grid gap-3 lg:grid-cols-[88px_minmax(0,1fr)] lg:gap-5"
      data-testid="product-gallery"
    >
      <div className="order-2 flex gap-2 overflow-x-auto px-0.5 py-1 scrollbar-thin lg:order-1 lg:max-h-[620px] lg:flex-col lg:overflow-y-auto">
        {normalizedImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`h-18 w-18 flex-shrink-0 overflow-hidden rounded-2xl border bg-white p-1.5 transition-all duration-200 sm:h-20 sm:w-20 lg:h-[76px] lg:w-[76px] ${
              index === selectedIndex
                ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] ring-2 ring-[var(--brand-primary)]/15 shadow-[0_8px_24px_rgba(203,17,171,0.16)]"
                : "border-[var(--border)] hover:border-slate-300"
            }`}
            aria-label={`Select product image ${index + 1}`}
            aria-pressed={index === selectedIndex}
            data-testid={index === 0 ? "product-thumbnail" : undefined}
          >
            <FallbackImage
              src={image.url}
              alt={`${name} thumbnail ${index + 1}`}
              className="h-full w-full rounded-lg object-cover"
              testId={index === 0 ? "product-gallery-thumbnail-image" : undefined}
            />
          </button>
        ))}
      </div>

      <div className="order-1 overflow-hidden rounded-[2rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:order-2">
        <div className="mb-3 flex justify-end px-1">
          <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
            {selectedIndex + 1}/{normalizedImages.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
          <FallbackImage
            src={selectedImage.url}
            alt={name}
            className="aspect-[4/5] max-h-[72svh] min-h-[280px] w-full object-cover transition-transform duration-300 hover:scale-[1.02] sm:min-h-[360px] lg:max-h-none"
            testId="product-gallery-main-image"
          />
        </div>
      </div>
    </div>
  );
}
