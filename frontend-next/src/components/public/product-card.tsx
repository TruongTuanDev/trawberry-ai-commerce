import Link from "next/link";
import type { PublicProduct } from "@/lib/public-api";
import { FallbackImage } from "@/components/ui/fallback-image";

export function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <article className="card-panel group flex h-full flex-col overflow-hidden rounded-[1.75rem]" data-testid="product-card">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(180deg,#efe0ce,#e2c7aa)]">
        <FallbackImage
          src={product.images[0]?.url}
          alt={product.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(35,24,20,0.78))] px-5 pb-5 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/72">{product.shop.name ?? "Marketplace shop"}</p>
          <p className="mt-2 text-xl font-semibold text-white">{product.name}</p>
        </div>
        {!product.inStock ? (
          <div className="absolute right-4 top-4 rounded-full bg-[rgba(125,37,17,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
            Out of stock
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <p className="line-clamp-3 text-sm leading-6 text-[var(--muted)]">{product.description ?? "No description yet."}</p>
        <div className="mt-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">From</p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">{product.price ?? "Contact shop"}</p>
            <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.14em] ${product.inStock ? "text-emerald-700" : "text-[var(--accent)]"}`}>
              {product.inStock ? `${product.availableQuantity} ready to order` : "Unavailable"}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href={`/products/${product.id}`} className="public-button-secondary px-4 py-2 text-sm" data-testid={`product-view-${product.id}`}>
              View
            </Link>
            {product.inStock ? (
              <Link href={`/checkout?productId=${product.id}&quantity=1`} className="public-button-primary px-4 py-2 text-sm" data-testid={`product-checkout-${product.id}`}>
                Checkout
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                Sold out
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
