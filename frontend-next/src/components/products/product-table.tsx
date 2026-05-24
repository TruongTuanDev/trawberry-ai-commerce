"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ProductListItem } from "@/lib/seller-api";
import { FallbackImage } from "@/components/ui/fallback-image";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";

type Translate = (key: string, values?: Record<string, string | number>) => string;

function getProductStatusInfo(product: ProductListItem, t: Translate) {
  if (product.visibility === "DELETED") {
    return { label: t("seller.products.statusBadges.deleted"), tone: "bg-slate-200 text-slate-700" };
  }
  if (product.publicVisible) {
    return { label: t("seller.products.statusBadges.live"), tone: "bg-emerald-100 text-emerald-700" };
  }
  if (product.stockQuantity <= 0) {
    return { label: t("seller.products.statusBadges.outOfStock"), tone: "bg-rose-100 text-rose-700" };
  }
  if (product.reviewWarnings.includes("MISSING_PRICE")) {
    return { label: t("seller.products.statusBadges.missingPrice"), tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("MISSING_STOCK")) {
    return { label: t("seller.products.statusBadges.missingStock"), tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("MISSING_CATEGORY")) {
    return { label: t("seller.products.statusBadges.missingCategory"), tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("MISSING_IMAGE")) {
    return { label: t("seller.products.statusBadges.missingImage"), tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("NO_ACTIVE_VARIANT")) {
    return { label: t("seller.products.statusBadges.missingVariant"), tone: "bg-amber-100 text-amber-700" };
  }
  return { label: t("seller.products.statusBadges.needsInfo"), tone: "bg-amber-100 text-amber-700" };
}

function ProductStatusBadge({
  product,
  t,
}: {
  product: ProductListItem;
  t: Translate;
}) {
  const { label, tone } = getProductStatusInfo(product, t);
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
  onDelete,
}: {
  products: ProductListItem[];
  selectedIds: string[];
  onToggleSelect: (productId: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number, price?: number) => Promise<void>;
  onDelete: (productId: string) => void;
}) {
  const { t } = useI18n("seller");

  if (products.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
        {t("seller.products.table.empty")}
      </div>
    );
  }

  const allSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
      <div className="hidden grid-cols-[32px_minmax(0,2.2fr)_170px_170px_210px_80px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <div>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            aria-label={t("seller.products.table.selectAll")}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div>{t("seller.products.table.product")}</div>
        <div>{t("seller.products.table.status")}</div>
        <div>{t("seller.products.category")}</div>
        <div>{t("seller.products.table.priceStock")}</div>
        <div className="text-right">{t("seller.products.table.actions")}</div>
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
            onDelete={onDelete}
            t={t}
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
  onDelete,
  t,
}: {
  product: ProductListItem;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number, price?: number) => Promise<void>;
  onDelete: (productId: string) => void;
  t: Translate;
}) {
  const router = useRouter();

  return (
    <article
      onClick={() => router.push(`/seller/products/${product.id}`)}
      className="grid cursor-pointer items-center gap-4 px-4 py-4 transition hover:bg-[var(--panel-strong)] lg:grid-cols-[32px_minmax(0,2.2fr)_170px_170px_210px_80px] lg:px-5"
      data-testid="seller-product-row"
    >
      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onToggleSelect(product.id)} aria-label={`${t("seller.products.table.product")}: ${product.title}`} />
      </div>
      <div className="flex min-w-0 gap-4">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]">
          {product.mainImage ? (
            <FallbackImage src={product.mainImage} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--muted)]">{t("seller.products.table.noImage")}</div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--foreground)]">{product.title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">WB ID: {product.wbNmId}</p>
          <p className="truncate text-sm text-[var(--muted)]">{t("seller.products.table.vendor")}: {product.wbVendorCode ?? t("common.notProvided")}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t("seller.products.table.source")}: {product.source}</p>
        </div>
      </div>
      <div className="space-y-2">
        <ProductStatusBadge product={product} t={t} />
        <div className="flex flex-wrap gap-2">
          {product.reviewWarnings.slice(0, 3).map((warning) => (
            <WarningChip key={`${product.id}-${warning}`} warning={warning} />
          ))}
        </div>
      </div>
      <div className="text-sm text-[var(--muted)]">
        <p>{product.categoryName ?? t("seller.products.table.uncategorized")}</p>
        {product.sourceCategoryName && product.sourceCategoryName !== product.categoryName ? (
          <p className="mt-1 text-xs">{t("seller.products.table.wbCategory", { name: product.sourceCategoryName })}</p>
        ) : null}
      </div>
      <div className="text-sm">
        <CompactProductEditor product={product} onSave={onQuickUpdate} t={t} />
      </div>
      <div className="text-right">
        <ActionsDropdown productId={product.id} onEdit={onEdit} onDelete={onDelete} t={t} />
      </div>
    </article>
  );
}

function ActionsDropdown({
  productId,
  onEdit,
  onDelete,
  t,
}: {
  productId: string;
  onEdit: (productId: string) => void;
  onDelete: (productId: string) => void;
  t: Translate;
}) {
  const items = [
    {
      label: t("seller.products.actions.editProduct"),
      onClick: () => onEdit(productId),
      "data-testid": `seller-product-edit-${productId}`,
    },
    {
      label: t("seller.products.actions.generateAiImages"),
      href: `/seller/ai-images?productId=${productId}`,
    },
    {
      label: t("seller.products.actions.viewPublicPage"),
      href: `/products/${productId}`,
      target: "_blank",
    },
    {
      label: t("seller.products.actions.deleteProduct"),
      variant: "danger" as const,
      confirm: t("common.confirm.deleteProduct"),
      onClick: () => onDelete(productId),
      "data-testid": `seller-product-delete-${productId}`,
    },
  ];

  return <ActionMenu items={items} />;
}

function CompactProductEditor({
  product,
  onSave,
  t,
}: {
  product: ProductListItem;
  onSave: (product: ProductListItem, stockQuantity: number, price?: number) => Promise<void>;
  t: Translate;
}) {
  const [price, setPrice] = useState(String(Number(product.minPrice) || 0));
  const [stock, setStock] = useState(String(product.stockQuantity));
  const [saving, setSaving] = useState(false);

  const originalPrice = String(Number(product.minPrice) || 0);
  const originalStock = String(product.stockQuantity);

  const isDirty = price !== originalPrice || stock !== originalStock;
  const disabled = !product.trackInventory || product.variantCount !== 1;

  const handleSave = async () => {
    if (!isDirty || disabled || saving) {
      return;
    }
    setSaving(true);
    try {
      await onSave(product, Math.max(0, Number(stock) || 0), Math.max(0, Number(price) || 0));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">{t("seller.products.editor.price")}</label>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSave();
            }
          }}
          disabled={saving}
          className="w-[80px] rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
          aria-label={t("seller.products.editor.price")}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase text-[var(--muted)]">{t("seller.products.editor.stock")}</label>
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void handleSave();
            }
          }}
          disabled={disabled || saving}
          className="w-[72px] rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--panel)]"
          aria-label={t("seller.products.editor.stock")}
        />
      </div>
      {isDirty ? (
        <Button variant="success" size="xs" className="mt-4" onClick={handleSave} disabled={saving} loading={saving}>
          {t("common.actions.save")}
        </Button>
      ) : null}
    </div>
  );
}
