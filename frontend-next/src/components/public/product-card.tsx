"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FallbackImage } from "@/components/ui/fallback-image";
import { QuantityStepper } from "@/components/public/quantity-stepper";
import {
  formatMoney,
  getCartQuantity,
  getComparableOldPrice,
  getProductPrimaryVariant,
  getStockState,
  getVariantLabel,
  hasSelectableVariants,
} from "@/components/public/public-product-utils";
import { StockBadge } from "@/components/public/stock-badge";
import type { PublicProduct } from "@/lib/public-api";
import { useCartStore } from "@/stores/cart-store";

export function ProductCard({ product }: { product: PublicProduct }) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const primaryVariant = getProductPrimaryVariant(product);
  const inCartQuantity = getCartQuantity(items, product.id, primaryVariant?.id);
  const stockState = getStockState(product);
  const formattedPrice = formatMoney(product.price);
  const oldPrice = getComparableOldPrice(product.price, product.oldPrice);
  const formattedOldPrice = formatMoney(oldPrice);
  const requiresSelection = hasSelectableVariants(product);

  const handleQuickAdd = () => {
    if (!primaryVariant?.inStock) {
      return;
    }

    if (requiresSelection) {
      router.push(`/products/${product.id}`);
      return;
    }

    addItem(product, primaryVariant, 1);
  };

  return (
    <article
      className="card-panel group flex h-full flex-col overflow-hidden rounded-[1.9rem] bg-white"
      data-testid="product-card"
    >
      <Link href={`/products/${product.id}`} className="relative block overflow-hidden">
        <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
          <StockBadge label={stockState.label} tone={stockState.tone} />
          {inCartQuantity > 0 ? (
            <span className="inline-flex items-center rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
              In cart {inCartQuantity}
            </span>
          ) : null}
        </div>
        <div className="aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,#f4ecdf,#eadbc5)]">
          <FallbackImage
            src={product.images[0]?.url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            testId={`product-card-image-${product.id}`}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {product.shop.name ?? "Marketplace shop"}
              </p>
              <Link
                href={`/products/${product.id}`}
                className="mt-2 line-clamp-2 block text-base font-semibold text-[var(--foreground)]"
                data-testid={`product-view-${product.id}`}
              >
                {product.name}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            {product.brand ? <span>{product.brand}</span> : null}
            {product.categoryName ? <span>{product.categoryName}</span> : null}
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-[var(--foreground)]">
                {formattedPrice ?? "Contact shop"}
              </p>
              {formattedOldPrice ? (
                <p className="mt-1 text-sm text-[var(--muted)] line-through">
                  {formattedOldPrice}
                </p>
              ) : null}
            </div>
            {primaryVariant ? (
              <p className="text-right text-xs text-[var(--muted)]">
                {getVariantLabel(primaryVariant)}
              </p>
            ) : null}
          </div>

          {inCartQuantity > 0 && primaryVariant ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--accent-strong)]">
                In cart
              </span>
              <QuantityStepper
                size="sm"
                value={inCartQuantity}
                max={primaryVariant.trackInventory ? primaryVariant.availableQuantity : undefined}
                onChange={(nextValue) =>
                  updateQuantity(product.id, primaryVariant.id, nextValue)
                }
                testId={`product-card-stepper-${product.id}`}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!primaryVariant?.inStock}
              className="public-button-primary w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`product-primary-action-${product.id}`}
            >
              {requiresSelection
                ? "Выбрать размер"
                : primaryVariant?.inStock
                  ? "В корзину"
                  : "Нет в наличии"}
            </button>
          )}

          <Link
            href={`/products/${product.id}`}
            className="public-button-secondary inline-flex w-full justify-center px-4 py-3 text-sm"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
