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
      className="grid gap-3 lg:grid-cols-[76px_minmax(0,1fr)] lg:gap-4"
      data-testid="product-gallery"
    >
      {/* Thumbnail list: horizontal scroll on mobile, vertical column on desktop */}
      <div className="order-2 flex gap-2 overflow-x-auto px-0.5 py-1 scrollbar-thin lg:order-1 lg:max-h-[550px] lg:flex-col lg:overflow-y-auto">
        {normalizedImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`h-18 w-18 flex-shrink-0 overflow-hidden rounded-xl border bg-white p-1 transition-all duration-200 sm:h-20 sm:w-20 lg:h-16 lg:w-16 ${
              index === selectedIndex
                ? "border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20 shadow-[0_4px_12px_rgba(203,17,171,0.15)]"
                : "border-[var(--border)] hover:border-slate-300"
            }`}
            aria-label={`Select product image ${index + 1}`}
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

      {/* Main Image View */}
      <div className="order-1 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-2 lg:order-2">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <FallbackImage
            src={selectedImage.url}
            alt={name}
            className="aspect-[4/5] max-h-[72svh] min-h-[280px] w-full object-cover transition-transform duration-300 hover:scale-102 sm:min-h-[360px] lg:max-h-none"
            testId="product-gallery-main-image"
          />
        </div>
      </div>
    </div>
  );
}
