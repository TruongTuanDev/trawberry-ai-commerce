"use client";

import { useState } from "react";

const FALLBACK_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f7efe4" />
      <stop offset="100%" stop-color="#eadac5" />
    </linearGradient>
  </defs>
  <rect width="960" height="720" rx="48" fill="url(#bg)" />
  <rect x="216" y="148" width="528" height="424" rx="36" fill="#fffaf4" stroke="#d8c3aa" stroke-width="10" />
  <path d="M300 492l118-128 98 92 74-80 70 116H300z" fill="#d4b08f" />
  <circle cx="402" cy="286" r="34" fill="#b6314b" opacity="0.82" />
  <text x="480" y="620" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#6d4f3d">
    No image available
  </text>
</svg>
`)}`;

export function FallbackImage({
  src,
  alt,
  className,
  testId,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  testId?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = failed || !src ? FALLBACK_IMAGE_URL : src;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      data-testid={testId}
      data-fallback-active={failed || !src ? "true" : "false"}
      onError={() => setFailed(true)}
    />
  );
}
