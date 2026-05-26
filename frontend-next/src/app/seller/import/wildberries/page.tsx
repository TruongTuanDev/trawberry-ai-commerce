"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { SectionCard } from "@/components/seller/section-card";
import {
  confirmWildberriesImport,
  previewWildberriesImport,
  type WbImportConfirmResult,
  type WbImportIssue,
  type WbImportPreview,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export default function WildberriesImportPage() {
  const { t } = useI18n("seller");
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const [file, setFile] = useState<File | null>(null);
  const [defaultStockQuantity, setDefaultStockQuantity] = useState(0);
  const [publishMode, setPublishMode] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [priceFallback, setPriceFallback] = useState("");
  const [preview, setPreview] = useState<WbImportPreview | null>(null);
  const [result, setResult] = useState<WbImportConfirmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  const canConfirm = preview !== null && preview.errors.length === 0 && !result;

  const previewImport = async () => {
    if (!currentShopId || !file) {
      setError(t("seller.wbExcel.selectShopAndFile"));
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError(t("seller.wbExcel.onlyXlsx"));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await previewWildberriesImport(currentShopId, {
        file,
        defaultStockQuantity,
        publishMode,
        imageMode: "REMOTE_URL",
        priceFallback: priceFallback.trim() ? Number(priceFallback) : undefined,
      });
      setPreview(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.wbExcel.previewFailed"));
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!currentShopId || !preview) return;

    setConfirming(true);
    setError(null);

    try {
      setResult(await confirmWildberriesImport(currentShopId, preview.importId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.wbExcel.confirmFailed"));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wb-import-page">
      <SectionCard
        eyebrow={t("seller.wbExcel.eyebrow")}
        title={t("seller.wbExcel.title")}
        description={t("seller.wbExcel.description")}
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbExcel.excelFile")}</span>
              <input
                type="file"
                accept=".xlsx"
                data-testid="wb-import-file"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                onChange={(event) => {
                  setPreview(null);
                  setResult(null);
                  setFile(event.target.files?.[0] ?? null);
                }}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbExcel.defaultStock")}</span>
                <input
                  type="number"
                  min={0}
                  value={defaultStockQuantity}
                  data-testid="wb-import-default-stock"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setDefaultStockQuantity(Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbExcel.publishMode")}</span>
                <select
                  value={publishMode}
                  data-testid="wb-import-publish-mode"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setPublishMode(event.target.value as "DRAFT" | "ACTIVE")}
                >
                  <option value="DRAFT">{t("seller.wbExcel.draft")}</option>
                  <option value="ACTIVE">{t("seller.wbExcel.activeIfValid")}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbExcel.fallbackPrice")}</span>
                <input
                  type="number"
                  min={0}
                  value={priceFallback}
                  data-testid="wb-import-price-fallback"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setPriceFallback(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbExcel.imageMode")}</span>
                <select
                  value="REMOTE_URL"
                  disabled
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]"
                >
                  <option value="REMOTE_URL">{t("seller.wbExcel.useRemoteUrls")}</option>
                  <option value="DOWNLOAD_TO_STORAGE">{t("seller.wbExcel.downloadToStorage")}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.wbExcel.targetShop")}</p>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{currentShop?.name ?? t("seller.wbSync.noShopSelected")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.wbExcel.supportInfo")}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.wbExcel.imageInfo")}</p>
            <button
              type="button"
              onClick={() => void previewImport()}
              disabled={loading || !file || !currentShopId}
              data-testid="wb-import-preview"
              className="mt-5 inline-flex w-full justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? t("seller.wbExcel.parsing") : t("seller.wbExcel.previewButton")}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[var(--border-danger)] bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </SectionCard>

      {preview ? (
        <SectionCard
          eyebrow={t("seller.wbExcel.previewEyebrow")}
          title={t("seller.wbExcel.previewTitle")}
          description={t("seller.wbExcel.previewDescription")}
        >
          <div className="grid gap-3 sm:grid-cols-5" data-testid="wb-import-summary">
            <Metric label={t("seller.wbExcel.metricProducts")} value={preview.totalProducts} />
            <Metric label={t("seller.wbExcel.metricVariants")} value={preview.totalVariants} />
            <Metric label={t("seller.wbExcel.metricImages")} value={preview.totalImages} />
            <Metric label={t("seller.wbExcel.metricWarnings")} value={preview.warnings.length} />
            <Metric label={t("seller.wbExcel.metricErrors")} value={preview.errors.length} />
          </div>

          <IssueList title={t("seller.wbExcel.metricErrors")} issues={preview.errors} />
          <IssueList title={t("seller.wbExcel.metricWarnings")} issues={preview.warnings.slice(0, 12)} />

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
            <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr_90px_90px_100px] gap-3 border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <div>{t("seller.wbExcel.sku")}</div>
              <div>{t("seller.wbExcel.name")}</div>
              <div>{t("seller.wbExcel.brand")}</div>
              <div>{t("seller.wbExcel.category")}</div>
              <div>{t("seller.wbExcel.sizes")}</div>
              <div>{t("seller.wbExcel.metricImages")}</div>
              <div>{t("seller.wbExcel.price")}</div>
            </div>
            {preview.products.slice(0, 30).map((product) => (
              <div
                key={`${product.sellerSku}-${product.externalProductId}-${product.name}`}
                className="grid grid-cols-[1fr_1.4fr_1fr_1fr_90px_90px_100px] gap-3 border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0"
                data-testid="wb-import-product-row"
              >
                <div className="truncate font-semibold">{product.sellerSku ?? product.externalProductId ?? "N/A"}</div>
                <div className="truncate">{product.name}</div>
                <div className="truncate">{product.brand ?? "N/A"}</div>
                <div className="truncate" title={product.sourceCategoryName ?? undefined}>
                  {product.mappedCategoryName ?? product.categoryName ?? "N/A"}
                  {product.sourceCategoryName && product.sourceCategoryName !== (product.mappedCategoryName ?? product.categoryName) ? (
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      {t("seller.wbExcel.from") !== "seller.wbExcel.from" ? t("seller.wbExcel.from") : "from"}{" "}
                      {product.sourceCategoryName}
                    </span>
                  ) : null}
                </div>
                <div>{product.variantsCount}</div>
                <div>{product.imagesCount}</div>
                <div>{product.priceStatus}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={!canConfirm || confirming}
              data-testid="wb-import-confirm"
              className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {confirming ? t("seller.wbExcel.importing") : t("seller.wbExcel.confirmButton")}
            </button>
            {preview.errors.length ? (
              <span className="text-sm text-[var(--muted)]">{t("seller.wbExcel.fixErrors")}</span>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard
          eyebrow={t("seller.wbExcel.resultEyebrow")}
          title={t("seller.wbExcel.resultTitle")}
          description={t("seller.wbExcel.resultDescription")}
        >
          <div className="grid gap-3 sm:grid-cols-3" data-testid="wb-import-result">
            <Metric label={t("seller.wbExcel.createdProducts")} value={result.createdProducts} />
            <Metric label={t("seller.wbExcel.updatedProducts")} value={result.updatedProducts} />
            <Metric label={t("seller.wbExcel.variantsCreated")} value={result.createdVariants} />
            <Metric label={t("seller.wbExcel.variantsUpdated")} value={result.updatedVariants} />
            <Metric label={t("seller.wbExcel.imagesAdded")} value={result.addedImages} />
            <Metric label={t("seller.wbExcel.imagesSkipped")} value={result.skippedImages} />
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            {t("seller.wbExcel.resultHelper")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/seller/products?tab=IMPORTED" className="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              {t("seller.wbExcel.viewImported")}
            </Link>
            <Link href="/seller/products?tab=NEEDS_REVIEW" className="inline-flex rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)]">
              {t("seller.wbExcel.viewNeedsReview")}
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function IssueList({ title, issues }: { title: string; issues: WbImportIssue[] }) {
  if (!issues.length) return null;

  return (
    <div className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
      <div className="mt-3 space-y-2">
        {issues.map((issue, index) => (
          <p key={`${issue.code}-${issue.row ?? index}`} className="text-sm text-[var(--muted)]">
            {issue.row ? `Row ${issue.row}: ` : ""}
            {issue.message}
          </p>
        ))}
      </div>
    </div>
  );
}
