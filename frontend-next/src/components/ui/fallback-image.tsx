"use client";

import { useState } from "react";

const FALLBACK_IMAGE_URL = "https://placehold.co/960x720?text=No+Image";

export function FallbackImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = failed || !src ? FALLBACK_IMAGE_URL : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
