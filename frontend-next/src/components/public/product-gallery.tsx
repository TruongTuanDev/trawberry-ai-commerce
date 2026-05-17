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
    : [{ id: "placeholder", url: "https://placehold.co/960x1200?text=No+Image", isMain: true }];
  const mainIndex = Math.max(0, normalizedImages.findIndex((image) => image.isMain));
  const [selectedIndex, setSelectedIndex] = useState(mainIndex);
  const selectedImage = normalizedImages[selectedIndex] ?? normalizedImages[0];

  return (
    <div
      className="grid gap-4 lg:grid-cols-[84px_minmax(0,1fr)]"
      data-testid="product-gallery"
    >
      <div className="order-2 grid grid-cols-5 gap-3 lg:order-1 lg:grid-cols-1">
        {normalizedImages.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className={`overflow-hidden rounded-[1.2rem] border bg-white p-1.5 ${index === selectedIndex ? "border-[var(--accent)] shadow-[0_10px_24px_rgba(182,49,75,0.14)]" : "border-[var(--border)]"}`}
            aria-label={`Select product image ${index + 1}`}
            data-testid={index === 0 ? "product-thumbnail" : undefined}
          >
            <FallbackImage
              src={image.url}
              alt={`${name} thumbnail ${index + 1}`}
              className="aspect-square w-full rounded-[0.95rem] object-cover"
            />
          </button>
        ))}
      </div>
      <div className="order-1 overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#f7f0e7,#ece0d0)] p-3 lg:order-2">
        <div className="overflow-hidden rounded-[1.6rem] bg-white/35">
          <FallbackImage
            src={selectedImage.url}
            alt={name}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
