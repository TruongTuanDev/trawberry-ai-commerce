"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { ProductListItem } from "@/lib/seller-api";
import { FallbackImage } from "@/components/ui/fallback-image";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";

function getProductStatusInfo(product: ProductListItem) {
  if (product.visibility === "DELETED") {
    return { label: "Đã xóa", tone: "bg-slate-200 text-slate-700" };
  }
  if (product.publicVisible) {
    return { label: "Đang bán", tone: "bg-emerald-100 text-emerald-700" };
  }
  if (product.stockQuantity <= 0) {
    return { label: "Hết hàng", tone: "bg-rose-100 text-rose-700" };
  }
  if (product.reviewWarnings.includes("MISSING_PRICE")) {
    return { label: "Thiếu giá", tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("MISSING_CATEGORY")) {
    return { label: "Thiếu danh mục", tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("MISSING_IMAGE")) {
    return { label: "Thiếu ảnh", tone: "bg-amber-100 text-amber-700" };
  }
  if (product.reviewWarnings.includes("NO_ACTIVE_VARIANT")) {
    return { label: "Thiếu biến thể", tone: "bg-amber-100 text-amber-700" };
  }
  return { label: "Cần bổ sung", tone: "bg-amber-100 text-amber-700" };
}

function ProductStatusBadge({ product }: { product: ProductListItem }) {
  const { label, tone } = getProductStatusInfo(product);
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
  if (products.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white px-4 py-8 text-sm text-[var(--muted)]">
        Không tìm thấy sản phẩm nào khớp với bộ lọc.
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
            aria-label="Select all products"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div>Sản phẩm</div>
        <div>Trạng thái</div>
        <div>Danh mục</div>
        <div>Giá và Kho hàng</div>
        <div className="text-right">Thao tác</div>
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
}: {
  product: ProductListItem;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  onEdit: (productId: string) => void;
  onQuickUpdate: (product: ProductListItem, stockQuantity: number, price?: number) => Promise<void>;
  onDelete: (productId: string) => void;
}) {
  const router = useRouter();

  return (
    <article
      key={product.id}
      onClick={() => router.push(`/seller/products/${product.id}`)}
      className="grid gap-4 px-4 py-4 lg:grid-cols-[32px_minmax(0,2.2fr)_170px_170px_210px_80px] lg:px-5 hover:bg-[var(--panel-strong)] cursor-pointer transition items-center"
      data-testid="seller-product-row"
    >
      <div className="pt-1" onClick={(e) => e.stopPropagation()}>
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
        <ProductStatusBadge product={product} />
        <div className="flex flex-wrap gap-2">
          {product.reviewWarnings.slice(0, 3).map((warning) => (
            <WarningChip key={`${product.id}-${warning}`} warning={warning} />
          ))}
        </div>
      </div>
      <div className="text-sm text-[var(--muted)]">
        <p>{product.categoryName ?? "Uncategorized"}</p>
        {product.sourceCategoryName && product.sourceCategoryName !== product.categoryName ? (
          <p className="mt-1 text-xs">WB: {product.sourceCategoryName}</p>
        ) : null}
      </div>
      <div className="text-sm">
        <CompactProductEditor product={product} onSave={onQuickUpdate} />
      </div>
      <div className="text-right">
        <ActionsDropdown productId={product.id} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </article>
  );
}

function ActionsDropdown({
  productId,
  onEdit,
  onDelete,
}: {
  productId: string;
  onEdit: (productId: string) => void;
  onDelete: (productId: string) => void;
}) {
  const items = [
    {
      label: "Chỉnh sửa sản phẩm",
      onClick: () => onEdit(productId),
      "data-testid": `seller-product-edit-${productId}`,
    },
    {
      label: "Tạo ảnh AI",
      href: `/seller/ai-images?productId=${productId}`,
    },
    {
      label: "Xem trang công khai",
      href: `/products/${productId}`,
      target: "_blank",
    },
    {
      label: "Xóa sản phẩm",
      variant: "danger" as const,
      confirm: "Bạn có chắc chắn muốn xóa sản phẩm này?",
      onClick: () => onDelete(productId),
      "data-testid": `seller-product-delete-${productId}`,
    },
  ];

  return <ActionMenu items={items} />;
}

function CompactProductEditor({
  product,
  onSave,
}: {
  product: ProductListItem;
  onSave: (product: ProductListItem, stockQuantity: number, price?: number) => Promise<void>;
}) {
  const [price, setPrice] = useState(String(Number(product.minPrice) || 0));
  const [stock, setStock] = useState(String(product.stockQuantity));
  const [saving, setSaving] = useState(false);

  const originalPrice = String(Number(product.minPrice) || 0);
  const originalStock = String(product.stockQuantity);

  const isDirty = price !== originalPrice || stock !== originalStock;
  const disabled = !product.trackInventory || product.variantCount !== 1;

  const handleSave = async () => {
    if (!isDirty || disabled || saving) return;
    setSaving(true);
    try {
      await onSave(product, Math.max(0, Number(stock) || 0), Math.max(0, Number(price) || 0));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-[var(--muted)] uppercase">Giá</label>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
          disabled={saving}
          className="w-[80px] rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
          aria-label="Price"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-[var(--muted)] uppercase">Kho</label>
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
          }}
          disabled={disabled || saving}
          className="w-[72px] rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none focus:border-[var(--accent)] disabled:bg-[var(--panel)] disabled:cursor-not-allowed"
          aria-label="Stock"
        />
      </div>
      {isDirty && (
        <Button
          variant="success"
          size="xs"
          className="mt-4"
          onClick={handleSave}
          disabled={saving}
          loading={saving}
        >
          Lưu
        </Button>
      )}
    </div>
  );
}
