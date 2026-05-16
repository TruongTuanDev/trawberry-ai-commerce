"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ProductListItem, StockStatus } from "@/lib/seller-api";
import { FallbackImage } from "@/components/ui/fallback-image";

function StatusBadge({ visibility, inStock }: { visibility: string | null; inStock: boolean }) {
  const tone = visibility === "ACTIVE" && inStock
    ? "bg-emerald-100 text-emerald-700"
    : visibility === "ACTIVE"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-200 text-slate-700";

  const label = visibility === "ACTIVE" ? (inStock ? "Active" : "Missing stock") : visibility ?? "Unknown";

  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}

function StockBadge({
  stockStatus,
  trackInventory,
}: {
  stockStatus: StockStatus;
  trackInventory: boolean;
}) {
  const tone =
    stockStatus === "OUT_OF_STOCK"
      ? "bg-rose-100 text-rose-700"
      : stockStatus === "LOW_STOCK"
        ? "bg-amber-100 text-amber-700"
        : stockStatus === "NOT_TRACKED" || !trackInventory
          ? "bg-slate-200 text-slate-700"
          : "bg-emerald-100 text-emerald-700";

  const label =
    stockStatus === "OUT_OF_STOCK"
      ? "Out of stock"
      : stockStatus === "LOW_STOCK"
        ? "Low stock"
        : stockStatus === "NOT_TRACKED" || !trackInventory
          ? "Not tracked"
          : "In stock";

  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}

export function ProductTable({
  products,
  onEdit,
  onQuickUpdate,
}: {
  products: ProductListItem[];
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number) => Promise<void>;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
        No products matched the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_140px_150px_180px_240px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <div>Product</div>
        <div>Status</div>
        <div>Category</div>
        <div>Inventory</div>
        <div className="text-right">Actions</div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {products.map((product) => (
          <article key={product.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,2.2fr)_140px_150px_180px_240px] lg:px-5" data-testid="seller-product-row">
            <div className="flex min-w-0 gap-4">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]">
                {product.mainImage ? (
                  <FallbackImage src={product.mainImage} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--muted)]">No image</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--foreground)]">{product.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">WB ID: {product.wbNmId}</p>
                <p className="truncate text-sm text-[var(--muted)]">Vendor: {product.wbVendorCode ?? "N/A"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <StatusBadge visibility={product.visibility} inStock={product.inStock} />
              <div>
                <StockBadge stockStatus={product.stockStatus} trackInventory={product.trackInventory} />
              </div>
            </div>
            <div className="text-sm text-[var(--muted)] lg:flex lg:items-center">
              <div>
                <p>{product.categoryName ?? "Uncategorized"}</p>
                {product.sourceCategoryName && product.sourceCategoryName !== product.categoryName ? (
                  <p className="mt-1 text-xs">WB: {product.sourceCategoryName}</p>
                ) : null}
              </div>
            </div>
            <div className="text-sm lg:flex lg:items-center">
              <div className="space-y-1">
                <p className={product.stockStatus === "OUT_OF_STOCK" ? "font-semibold text-rose-700" : product.stockStatus === "LOW_STOCK" ? "font-semibold text-amber-700" : "text-emerald-700"}>
                  {product.trackInventory ? `${product.stockQuantity} available` : "Inventory not tracked"}
                </p>
                {product.trackInventory ? (
                  <p className="text-xs text-[var(--muted)]">
                    Threshold {product.lowStockThreshold} · {product.variantCount} variant{product.variantCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
              <QuickStockEditor product={product} onSave={onQuickUpdate} />
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/seller/products/${product.id}`}
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
                >
                  View details
                </Link>
                <button
                  type="button"
                  onClick={() => onEdit(product.id)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Edit
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function QuickStockEditor({
  product,
  onSave,
}: {
  product: ProductListItem;
  onSave: (product: ProductListItem, stockQuantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(product.stockQuantity));
  const [saving, setSaving] = useState(false);
  const quickUpdateDisabled = !product.trackInventory || product.variantCount !== 1;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3 lg:min-w-[220px]">
      <label htmlFor={`quick-stock-${product.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Quick stock
      </label>
      <div className="flex gap-2">
        <input
          id={`quick-stock-${product.id}`}
          type="number"
          min={0}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={quickUpdateDisabled || saving}
          className="w-20 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--panel)]"
        />
        <button
          type="button"
          disabled={quickUpdateDisabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(product, Math.max(0, Number(value) || 0));
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Update"}
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {quickUpdateDisabled ? "Use product detail for multi-variant or untracked inventory." : "Applies to the single sellable variant in this MVP."}
      </p>
    </div>
  );
}
