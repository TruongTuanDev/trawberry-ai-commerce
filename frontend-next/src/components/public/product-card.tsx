"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/use-i18n";
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
  const { t } = useI18n("customer");
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
      className="card-panel hover-card-effect group flex h-full flex-col overflow-hidden rounded-[1.85rem] border-white/70 bg-white"
      data-testid="product-card"
    >
      <Link href={`/products/${product.id}`} className="relative block overflow-hidden">
        <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StockBadge label={stockState.label} tone={stockState.tone} />
            {product.averageRating && product.feedbackCount > 0 ? (
              <span
                className="inline-flex items-center rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] shadow-[0_8px_20px_rgba(31,31,41,0.08)]"
                data-testid={`product-rating-summary-${product.id}`}
              >
                ★ {Number(product.averageRating).toFixed(1)} ({product.feedbackCount})
              </span>
            ) : null}
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/88 text-base text-[#cb11ab] shadow-[0_10px_22px_rgba(31,31,41,0.08)]">
            ♡
          </span>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
          {inCartQuantity > 0 ? (
            <span className="inline-flex items-center rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(203,17,171,0.24)]">
              {t("productDetail.inCartCount", { count: inCartQuantity })}
            </span>
          ) : null}
        </div>

        <div className="aspect-[4/5] overflow-hidden rounded-b-[1.6rem] bg-[linear-gradient(180deg,#f6f1ff_0%,#f1f1f6_100%)]">
          <FallbackImage
            src={product.images[0]?.url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            testId={`product-card-image-${product.id}`}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              {product.shop.slug ? (
                <Link
                  href={`/shops/${product.shop.slug}`}
                  className="inline-flex text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] transition hover:text-[var(--accent-strong)]"
                  data-testid={`product-shop-link-${product.id}`}
                >
                  {product.shop.name ?? t("productDetail.marketplaceShop")}
                </Link>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {product.shop.name ?? t("productDetail.marketplaceShop")}
                </p>
              )}
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
            {product.brand ? (
              <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1">
                {product.brand}
              </span>
            ) : null}
            {product.categoryName ? (
              <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1">
                {product.categoryName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex items-end justify-between gap-3 rounded-[1.35rem] bg-[linear-gradient(180deg,#fff8fe_0%,#ffffff_100%)] p-3">
            <div>
              <p className="text-3xl font-black tracking-tight text-[#cb11ab]">
                {formattedPrice ?? t("productDetail.contactShop")}
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
                {t("productDetail.inCart")}
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
              className="public-button-primary w-full px-4 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`product-primary-action-${product.id}`}
            >
              {requiresSelection
                ? t("productDetail.selectSize")
                : primaryVariant?.inStock
                  ? t("productDetail.addToCart")
                  : t("productDetail.outOfStock")}
            </button>
          )}

          <Link
            href={`/products/${product.id}`}
            className="public-button-secondary inline-flex w-full justify-center px-4 py-3 text-sm"
          >
            {t("productDetail.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}
