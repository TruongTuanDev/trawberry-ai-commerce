"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/public/product-card";
import { toast } from "@/components/ui/use-toast";
import { ApiError } from "@/lib/api";
import {
  createVisualSearch,
  getGuestSessionId,
  trackVisualSearchEvent,
  type PublicProduct,
  type VisualSearchResponse,
} from "@/lib/public-api";

type CropState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CATEGORY_HINTS = [
  { value: "Шорты", key: "visualSearch.shorts" },
  { value: "Топ", key: "visualSearch.top" },
  { value: "Аксессуары", key: "visualSearch.accessories" },
  { value: "Другой предмет", key: "visualSearch.otherItem" },
];

const DEFAULT_CROP: CropState = {
  x: 10,
  y: 10,
  width: 80,
  height: 80,
};

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

async function cropImageFile(file: File, crop: CropState) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      element.src = imageUrl;
    });

    const sx = Math.round((crop.x / 100) * image.width);
    const sy = Math.round((crop.y / 100) * image.height);
    const sWidth = Math.max(1, Math.round((crop.width / 100) * image.width));
    const sHeight = Math.max(1, Math.round((crop.height / 100) * image.height));

    const canvas = document.createElement("canvas");
    canvas.width = sWidth;
    canvas.height = sHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

    const mimeType = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ? file.type
      : "image/png";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, 0.92),
    );
    if (!blob) {
      return file;
    }

    return new File([blob], file.name, {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function resolveFriendlyErrorMessage(locale: string, fallback: string) {
  if (locale === "ru") {
    return "Не удалось найти товары по фото. Попробуйте другое изображение.";
  }
  if (locale === "vi") {
    return "Không thể tìm sản phẩm bằng ảnh này. Vui lòng thử ảnh khác.";
  }
  return fallback;
}

export function VisualSearchModal({
  open,
  locale,
  t,
  trackingEnabled,
  onClose,
}: {
  open: boolean;
  locale: string;
  t: (key: string) => string;
  trackingEnabled: boolean;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [categoryHint, setCategoryHint] = useState<string>(CATEGORY_HINTS[0]!.value);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<VisualSearchResponse | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const similarProducts = useMemo(() => results?.products ?? [], [results]);
  const matchByProductId = useMemo(
    () => new Map((results?.matches ?? []).map((match) => [match.product.id, match])),
    [results],
  );

  if (!open) {
    return null;
  }

  const resetState = () => {
    setFile(null);
    setResults(null);
    setErrorMessage(null);
    setCrop(DEFAULT_CROP);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (selectedFile: File | null) => {
    setResults(null);
    setErrorMessage(null);
    setCrop(DEFAULT_CROP);
    setFile(selectedFile);
  };

  const handleSearch = async () => {
    if (!file) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResults(null);

    try {
      const croppedFile = await cropImageFile(file, crop);
      const response = await createVisualSearch({
        image: croppedFile,
        categoryHint,
        cropX: crop.x,
        cropY: crop.y,
        cropWidth: crop.width,
        cropHeight: crop.height,
        guestSessionId: getGuestSessionId(),
      });
      setResults(response);

      if (trackingEnabled && response.visualSearchLogId && response.products.length > 0) {
        await Promise.all(
          response.products.map((product, index) =>
            trackVisualSearchEvent({
              type: "impression",
              visualSearchLogId: response.visualSearchLogId ?? undefined,
              productId: product.id,
              rank: index + 1,
              score: response.matches.find((match) => match.product.id === product.id)?.score,
              guestSessionId: getGuestSessionId(),
            }),
          ),
        );
      }
    } catch (error) {
      const fallbackMessage = t("visualSearch.couldNotFindProductsByPhoto");
      const message =
        error instanceof ApiError
          ? resolveFriendlyErrorMessage(locale, fallbackMessage)
          : fallbackMessage;
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const cropStyle = {
    left: `${crop.x}%`,
    top: `${crop.y}%`,
    width: `${crop.width}%`,
    height: `${crop.height}%`,
  };

  const handleProductNavigate = async (product: PublicProduct, index: number) => {
    if (!trackingEnabled || !results?.visualSearchLogId) {
      return;
    }

    await trackVisualSearchEvent({
      type: "click",
      visualSearchLogId: results.visualSearchLogId,
      productId: product.id,
      rank: index + 1,
      score: matchByProductId.get(product.id)?.score,
      guestSessionId: getGuestSessionId(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" data-testid="visual-search-modal">
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-[#fffdf9] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-[2rem]">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-20 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-slate-50"
          >
            {t("common.close")}
          </button>

          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="space-y-5">
                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    {t("visualSearch.findProductsByPhoto")}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-[var(--foreground)]">
                    {t("visualSearch.findProduct")}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {t("visualSearch.supportedFormats")}
                  </p>
                </div>

                <label className="flex cursor-pointer flex-col gap-3 rounded-[1.75rem] border border-dashed border-[var(--border)] bg-white p-5 text-sm text-[var(--foreground)] shadow-sm">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--panel)] text-[var(--accent-strong)]">
                    <CameraIcon />
                  </span>
                  <span className="font-semibold">{t("visualSearch.dragOrChoosePhoto")}</span>
                  <span className="text-xs text-[var(--muted)]">{t("visualSearch.supportedFormats")}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    data-testid="visual-search-file-input"
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {t("visualSearch.selectProductArea")}
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      ["x", "X", crop.x],
                      ["y", "Y", crop.y],
                      ["width", "W", crop.width],
                      ["height", "H", crop.height],
                    ].map(([key, label, value]) => (
                      <label key={key} className="block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        {label}
                        <input
                          type="range"
                          min={key === "width" || key === "height" ? 20 : 0}
                          max={key === "x" || key === "y" ? 80 : 100}
                          value={value}
                          onChange={(event) =>
                            setCrop((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full accent-[var(--accent)]"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {t("visualSearch.categoryHint")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {CATEGORY_HINTS.map((hint) => (
                      <button
                        key={hint.value}
                        type="button"
                        onClick={() => setCategoryHint(hint.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          categoryHint === hint.value
                            ? "bg-gradient-primary text-white shadow-[0_10px_20px_rgba(203,17,171,0.2)]"
                            : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--panel-strong)]"
                        }`}
                        data-testid={`visual-search-category-${hint.value}`}
                      >
                        {t(hint.key)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={!file || loading}
                  className="public-button-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="visual-search-submit"
                >
                  {loading ? t("visualSearch.finding") : t("visualSearch.findProduct")}
                </button>
              </aside>

              <section className="space-y-5">
                <div className="rounded-[1.85rem] border border-[var(--border)] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t("visualSearch.findProductsByPhoto")}
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-[var(--foreground)]">
                        {t("visualSearch.selectProductArea")}
                      </h3>
                    </div>
                    {results?.analysis.category ? (
                      <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        {results.analysis.category}
                      </span>
                    ) : null}
                  </div>

                  {previewUrl ? (
                    <div className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,#fbf3ff_0%,#f7f6fb_100%)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={t("visualSearch.findProductsByPhoto")}
                        className="max-h-[440px] w-full object-contain"
                        data-testid="visual-search-preview-image"
                      />
                      <div
                        className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
                        style={cropStyle}
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--muted)]">
                      {t("visualSearch.dragOrChoosePhoto")}
                    </div>
                  )}
                </div>

                {errorMessage ? (
                  <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700" data-testid="visual-search-error">
                    {errorMessage}
                  </div>
                ) : null}

                {results && similarProducts.length > 0 ? (
                  <div className="space-y-4" data-testid="visual-search-results">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold text-[var(--foreground)]">
                        {t("visualSearch.similarProductsFound")}
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        {results.analysis.color ?? categoryHint}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2" data-testid="visual-search-analysis">
                      {[
                        results.analysis.category,
                        results.analysis.color,
                        results.analysis.material,
                        results.analysis.pattern,
                        results.analysis.style,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .map((value) => (
                          <span key={value} className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                            {value}
                          </span>
                        ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="visual-search-product-grid">
                      {similarProducts.map((product, index) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onProductNavigate={() => void handleProductNavigate(product, index)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {results && similarProducts.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4 text-sm text-[var(--muted)]" data-testid="visual-search-empty-state">
                    {t("visualSearch.couldNotFindProductsByPhoto")}
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
