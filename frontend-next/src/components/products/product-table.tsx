"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { ProductListItem } from "@/lib/seller-api";

function StatusBadge({ visibility, inStock }: { visibility: string | null; inStock: boolean }) {
  const tone = visibility === "ACTIVE" && inStock
    ? "bg-emerald-100 text-emerald-700"
    : visibility === "ACTIVE"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-200 text-slate-700";

  const label = visibility === "ACTIVE" ? (inStock ? "Active" : "Missing stock") : visibility ?? "Unknown";

  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>;
}

export function ProductTable({
  products,
  onEdit,
}: {
  products: ProductListItem[];
  onEdit: (productId: string) => void;
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
      <div className="hidden grid-cols-[minmax(0,2.6fr)_160px_180px_160px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
        <div>Product</div>
        <div>Status</div>
        <div>Category</div>
        <div>Stock</div>
        <div className="text-right">Actions</div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {products.map((product) => (
            <article key={product.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,2.6fr)_160px_180px_160px_220px] lg:px-5">
              <div className="flex min-w-0 gap-4">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]">
                {product.mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.mainImage} alt={product.title} className="h-full w-full object-cover" />
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
            <div className="flex items-center lg:block">
              <StatusBadge visibility={product.visibility} inStock={product.inStock} />
            </div>
            <div className="text-sm text-[var(--muted)] lg:flex lg:items-center">{product.categoryName ?? "Uncategorized"}</div>
            <div className="text-sm lg:flex lg:items-center">
              <span className={product.inStock ? "text-emerald-700" : "text-[var(--accent)]"}>
                {product.inStock ? "In stock" : "Out of stock"}
              </span>
            </div>
            <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
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
          </article>
        ))}
      </div>
    </div>
  );
}
