"use client";

import { useCallback, useEffect, useRef } from "react";

export type Crop = { x: number; y: number; width: number; height: number };

export const FULL_CROP: Crop = { x: 0, y: 0, width: 100, height: 100 };

const MIN_SIZE = 8; // percent

export function isFullCrop(crop: Crop) {
  return (
    crop.x <= 0.5 &&
    crop.y <= 0.5 &&
    crop.width >= 99.5 &&
    crop.height >= 99.5
  );
}

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_POSITION: Record<Handle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type DragState =
  | { mode: "move"; startX: number; startY: number; origin: Crop }
  | { mode: "draw"; anchorX: number; anchorY: number }
  | { mode: "resize"; handle: Handle; origin: Crop };

export function ImageCropSelector({
  src,
  alt,
  crop,
  onChange,
}: {
  src: string;
  alt: string;
  crop: Crop;
  onChange: (next: Crop) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const pointToPercent = useCallback((clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return { px: 0, py: 0 };
    }
    return {
      px: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      py: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { px, py } = pointToPercent(clientX, clientY);

      if (drag.mode === "move") {
        const dx = px - drag.startX;
        const dy = py - drag.startY;
        onChange({
          ...drag.origin,
          x: clamp(drag.origin.x + dx, 0, 100 - drag.origin.width),
          y: clamp(drag.origin.y + dy, 0, 100 - drag.origin.height),
        });
        return;
      }

      if (drag.mode === "draw") {
        const x = Math.min(drag.anchorX, px);
        const y = Math.min(drag.anchorY, py);
        const width = Math.abs(px - drag.anchorX);
        const height = Math.abs(py - drag.anchorY);
        onChange({ x, y, width: Math.max(MIN_SIZE, width), height: Math.max(MIN_SIZE, height) });
        return;
      }

      // resize
      const origin = drag.origin;
      let left = origin.x;
      let top = origin.y;
      let right = origin.x + origin.width;
      let bottom = origin.y + origin.height;
      const h = drag.handle;
      if (h.includes("w")) left = clamp(px, 0, right - MIN_SIZE);
      if (h.includes("e")) right = clamp(px, left + MIN_SIZE, 100);
      if (h.includes("n")) top = clamp(py, 0, bottom - MIN_SIZE);
      if (h.includes("s")) bottom = clamp(py, top + MIN_SIZE, 100);
      onChange({ x: left, y: top, width: right - left, height: bottom - top });
    },
    [onChange, pointToPercent],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      event.preventDefault();
      handleMove(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [handleMove]);

  const startSurface = (event: React.PointerEvent) => {
    // Begin a fresh selection when the user drags on the image background
    // (or anywhere while the whole image is selected).
    const { px, py } = pointToPercent(event.clientX, event.clientY);
    dragRef.current = { mode: "draw", anchorX: px, anchorY: py };
    onChange({ x: px, y: py, width: MIN_SIZE, height: MIN_SIZE });
  };

  const startMove = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (isFullCrop(crop)) {
      // Whole image selected: treat as drawing a new region.
      startSurface(event);
      return;
    }
    const { px, py } = pointToPercent(event.clientX, event.clientY);
    dragRef.current = { mode: "move", startX: px, startY: py, origin: crop };
  };

  const startResize = (event: React.PointerEvent, handle: Handle) => {
    event.stopPropagation();
    dragRef.current = { mode: "resize", handle, origin: crop };
  };

  const boxStyle = {
    left: `${crop.x}%`,
    top: `${crop.y}%`,
    width: `${crop.width}%`,
    height: `${crop.height}%`,
  };

  return (
    <div className="flex justify-center">
      <div
        ref={surfaceRef}
        onPointerDown={startSurface}
        className="relative inline-block touch-none select-none overflow-hidden rounded-[1.5rem]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block max-h-[440px] w-auto max-w-full select-none"
          data-testid="visual-search-preview-image"
        />
        <div
          onPointerDown={startMove}
          style={boxStyle}
          className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
          data-testid="visual-search-crop-box"
        >
          {HANDLES.map((handle) => (
            <span
              key={handle}
              onPointerDown={(event) => startResize(event, handle)}
              className={`absolute h-3.5 w-3.5 rounded-full border-2 border-[var(--accent)] bg-white shadow ${HANDLE_POSITION[handle]}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
