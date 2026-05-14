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
    : [{ id: "placeholder", url: "https://placehold.co/960x960?text=No+Image", isMain: true }];
  const mainIndex = Math.max(
    0,
    normalizedImages.findIndex((image) => image.isMain),
  );
  const [selectedIndex, setSelectedIndex] = useState(mainIndex);
  const selectedImage = normalizedImages[selectedIndex] ?? normalizedImages[0];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] bg-[linear-gradient(180deg,#efe0ce,#e2c7aa)] p-4">
        <FallbackImage src={selectedImage.url} alt={name} className="h-full w-full rounded-[1.35rem] object-cover" />
      </div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {normalizedImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`overflow-hidden rounded-[1.1rem] border p-1 ${index === selectedIndex ? "border-[var(--accent)] bg-[var(--accent-soft)]/50" : "border-[var(--border)] bg-white"}`}
            aria-label={`Select product image ${index + 1}`}
          >
            <FallbackImage src={image.url} alt={`${name} thumbnail ${index + 1}`} className="aspect-square w-full rounded-[0.85rem] object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
