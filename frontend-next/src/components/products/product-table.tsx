"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { ProductListItem, StockStatus } from "@/lib/seller-api";
import { FallbackImage } from "@/components/ui/fallback-image";

function CatalogStatusBadge({ status }: { status: ProductListItem["catalogStatus"] }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "READY"
        ? "bg-sky-100 text-sky-700"
        : status === "IMPORTED"
          ? "bg-amber-100 text-amber-700"
          : status === "ARCHIVED"
            ? "bg-slate-200 text-slate-700"
            : "bg-rose-100 text-rose-700";

  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{status}</span>;
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

function WarningChip({ warning }: { warning: string }) {
  return <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">{warning.replaceAll("_", " ")}</span>;
}

export function ProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onQuickUpdate,
  onPublish,
  onUnpublish,
  onArchive,
}: {
  products: ProductListItem[];
  selectedIds: string[];
  onToggleSelect: (productId: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number) => Promise<void>;
  onPublish: (productId: string) => Promise<void>;
  onUnpublish: (productId: string) => Promise<void>;
  onArchive: (productId: string) => Promise<void>;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
        No products matched the current filters.
      </div>
    );
  }

  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
      <div className="hidden grid-cols-[32px_minmax(0,2.2fr)_170px_170px_210px_280px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <div>
          <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} aria-label="Select all products" />
        </div>
        <div>Product</div>
        <div>Catalog</div>
        <div>Category</div>
        <div>Pricing and stock</div>
        <div className="text-right">Actions</div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            selected={selectedIds.includes(product.id)}
            onToggleSelect={onToggleSelect}
            onEdit={onEdit}
            onQuickUpdate={onQuickUpdate}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onArchive={onArchive}
          />
        ))}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  selected,
  onToggleSelect,
  onEdit,
  onQuickUpdate,
  onPublish,
  onUnpublish,
  onArchive,
}: {
  product: ProductListItem;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number) => Promise<void>;
  onPublish: (productId: string) => Promise<void>;
  onUnpublish: (productId: string) => Promise<void>;
  onArchive: (productId: string) => Promise<void>;
}) {
  const [actionSaving, setActionSaving] = useState<string | null>(null);

  const runAction = async (action: "publish" | "unpublish" | "archive") => {
    setActionSaving(action);
    try {
      if (action === "publish") {
        await onPublish(product.id);
      } else if (action === "unpublish") {
        await onUnpublish(product.id);
      } else {
        await onArchive(product.id);
      }
    } finally {
      setActionSaving(null);
    }
  };

  return (
    <article key={product.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[32px_minmax(0,2.2fr)_170px_170px_210px_280px] lg:px-5" data-testid="seller-product-row">
      <div className="pt-1">
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(product.id)} aria-label={`Select ${product.title}`} />
      </div>
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
          <p className="mt-1 text-xs text-[var(--muted)]">Source: {product.source}</p>
        </div>
      </div>
      <div className="space-y-2">
        <CatalogStatusBadge status={product.catalogStatus} />
        <div>
          <StockBadge stockStatus={product.stockStatus} trackInventory={product.trackInventory} />
        </div>
        <p className="text-xs text-[var(--muted)]">{product.readyToPublish ? "Ready to publish" : "Needs review"}</p>
        <div className="flex flex-wrap gap-2">
          {product.reviewWarnings.slice(0, 3).map((warning) => (
            <WarningChip key={`${product.id}-${warning}`} warning={warning} />
          ))}
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
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-semibold text-[var(--foreground)]">{renderPriceSummary(product.minPrice, product.maxPrice)}</p>
            <p className="text-xs text-[var(--muted)]">
              {product.minPrice || product.maxPrice ? "Current sell price range" : "Missing price"}
            </p>
          </div>
          <div className="space-y-1">
            <p className={product.stockStatus === "OUT_OF_STOCK" ? "font-semibold text-rose-700" : product.stockStatus === "LOW_STOCK" ? "font-semibold text-amber-700" : "text-emerald-700"}>
              {product.trackInventory ? `${product.stockQuantity} available` : "Inventory not tracked"}
            </p>
            {product.trackInventory ? (
              <p className="text-xs text-[var(--muted)]">
                Threshold {product.lowStockThreshold} | {product.variantCount} variant{product.variantCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <QuickStockEditor product={product} onSave={onQuickUpdate} />
        </div>
      </div>
      <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAction("publish")}
            disabled={actionSaving !== null || product.catalogStatus === "PUBLISHED"}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionSaving === "publish" ? "Publishing..." : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("unpublish")}
            disabled={actionSaving !== null || product.catalogStatus !== "PUBLISHED"}
            className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionSaving === "unpublish" ? "Unpublishing..." : "Unpublish"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("archive")}
            disabled={actionSaving !== null || product.catalogStatus === "ARCHIVED"}
            className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionSaving === "archive" ? "Archiving..." : "Archive"}
          </button>
        </div>
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
  );
}

function renderPriceSummary(minPrice: string | null, maxPrice: string | null) {
  if (!minPrice && !maxPrice) {
    return "No price";
  }

  if (minPrice && maxPrice && minPrice !== maxPrice) {
    return `${formatMoney(minPrice)} - ${formatMoney(maxPrice)}`;
  }

  return formatMoney(minPrice ?? maxPrice ?? "0");
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return value;
  }
  return amount.toLocaleString("en-US");
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
