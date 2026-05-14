"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
      setError("Select a seller shop and .xlsx file first.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx Wildberries exports are supported.");
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
      setError(err instanceof Error ? err.message : "Unable to preview import.");
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
      setError(err instanceof Error ? err.message : "Unable to confirm import.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wb-import-page">
      <SectionCard
        eyebrow="Wildberries Excel"
        title="Import products from Wildberries"
        description="Upload the WB export with sheet Товары. The backend groups rows by seller SKU into products with size variants."
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground)]">Excel file</span>
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

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">Default stock</span>
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
                <span className="text-sm font-semibold text-[var(--foreground)]">Publish mode</span>
                <select
                  value={publishMode}
                  data-testid="wb-import-publish-mode"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setPublishMode(event.target.value as "DRAFT" | "ACTIVE")}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active if valid</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">Fallback price</span>
                <input
                  type="number"
                  min={0}
                  value={priceFallback}
                  data-testid="wb-import-price-fallback"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setPriceFallback(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Target shop</p>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{currentShop?.name ?? "No shop selected"}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Images use remote WB URLs in the MVP.</p>
            <button
              type="button"
              onClick={() => void previewImport()}
              disabled={loading || !file || !currentShopId}
              data-testid="wb-import-preview"
              className="mt-5 inline-flex w-full justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Parsing..." : "Preview import"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
            {error}
          </div>
        ) : null}
      </SectionCard>

      {preview ? (
        <SectionCard
          eyebrow="Preview"
          title="Import summary"
          description="Review warnings and product grouping before confirming."
        >
          <div className="grid gap-3 sm:grid-cols-5" data-testid="wb-import-summary">
            <Metric label="Products" value={preview.totalProducts} />
            <Metric label="Variants" value={preview.totalVariants} />
            <Metric label="Images" value={preview.totalImages} />
            <Metric label="Warnings" value={preview.warnings.length} />
            <Metric label="Errors" value={preview.errors.length} />
          </div>

          <IssueList title="Errors" issues={preview.errors} />
          <IssueList title="Warnings" issues={preview.warnings.slice(0, 12)} />

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
            <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr_90px_90px_100px] gap-3 border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <div>SKU</div>
              <div>Name</div>
              <div>Brand</div>
              <div>Category</div>
              <div>Sizes</div>
              <div>Images</div>
              <div>Price</div>
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
                <div className="truncate">{product.categoryName ?? "N/A"}</div>
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
              {confirming ? "Importing..." : "Confirm import"}
            </button>
            {preview.errors.length ? (
              <span className="text-sm text-[var(--muted)]">Fix blocking errors before confirming.</span>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard eyebrow="Completed" title="Import result" description="Products are now available in the seller catalog.">
          <div className="grid gap-3 sm:grid-cols-3" data-testid="wb-import-result">
            <Metric label="Created products" value={result.createdProducts} />
            <Metric label="Updated products" value={result.updatedProducts} />
            <Metric label="Variants created" value={result.createdVariants} />
            <Metric label="Variants updated" value={result.updatedVariants} />
            <Metric label="Images added" value={result.addedImages} />
            <Metric label="Images skipped" value={result.skippedImages} />
          </div>
          <Link href="/seller/products" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
            Open products
          </Link>
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
