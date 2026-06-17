"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/use-i18n";
import { QuantityStepper } from "@/components/public/quantity-stepper";
import { StockBadge } from "@/components/public/stock-badge";
import {
  formatMoney,
  getCartQuantity,
  getComparableOldPrice,
  getProductPrimaryVariant,
  getStockState,
  hasSelectableVariants,
} from "@/components/public/public-product-utils";
import { FallbackImage } from "@/components/ui/fallback-image";
import type { PublicProduct } from "@/lib/public-api";
import { useCartStore } from "@/stores/cart-store";

export function ProductCard({
  product,
  onProductNavigate,
}: {
  product: PublicProduct;
  onProductNavigate?: () => void;
}) {
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

  const priceNumber = Number(product.price);
  const oldPriceNumber = Number(oldPrice);
  const discountPercent =
    oldPrice && oldPriceNumber > priceNumber && priceNumber > 0
      ? Math.round((1 - priceNumber / oldPriceNumber) * 100)
      : null;

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
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white transition hover:shadow-[0_8px_24px_rgba(31,31,41,0.10)]"
      data-testid="product-card"
    >
      <Link
        href={`/products/${product.id}`}
        className="relative block overflow-hidden"
        onClick={onProductNavigate}
      >
        <div className="absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-1">
          <div className="flex flex-col items-start gap-1">
            {discountPercent ? (
              <span className="inline-flex items-center rounded-md bg-[var(--brand-primary)] px-1.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                -{discountPercent}%
              </span>
            ) : null}
            <StockBadge label={stockState.label} tone={stockState.tone} />
          </div>
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-[var(--brand-primary)] shadow-[0_4px_12px_rgba(31,31,41,0.10)]"
            aria-hidden
          >
            {"♡"}
          </span>
        </div>

        {inCartQuantity > 0 ? (
          <span className="absolute bottom-2 left-2 z-10 inline-flex items-center rounded-md bg-gradient-primary px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            {t("productDetail.inCartCount", { count: inCartQuantity })}
          </span>
        ) : null}

        <div className="aspect-[3/4] overflow-hidden bg-[linear-gradient(180deg,#fdf2fc_0%,#fbf5fa_100%)]">
          <FallbackImage
            src={product.images[0]?.url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            testId={`product-card-image-${product.id}`}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1.5 sm:px-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-black tracking-tight text-[var(--brand-primary)] sm:text-lg">
            {formattedPrice ?? t("productDetail.contactShop")}
          </span>
          {formattedOldPrice ? (
            <span className="text-xs text-[var(--muted)] line-through">
              {formattedOldPrice}
            </span>
          ) : null}
        </div>

        <Link
          href={`/products/${product.id}`}
          className="line-clamp-2 text-xs leading-snug text-[var(--foreground)] transition hover:text-[var(--brand-primary)] sm:text-[13px]"
          data-testid={`product-view-${product.id}`}
          onClick={onProductNavigate}
        >
          {product.name}
        </Link>

        <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--muted)]">
          <span className="truncate">
            {product.brand ?? product.shop.name ?? t("productDetail.marketplaceShop")}
          </span>
          {product.averageRating && product.feedbackCount > 0 ? (
            <span
              className="shrink-0 font-semibold text-[var(--foreground)]"
              data-testid={`product-rating-summary-${product.id}`}
            >
              {"★"} {Number(product.averageRating).toFixed(1)} ({product.feedbackCount})
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-1.5">
          {inCartQuantity > 0 && primaryVariant ? (
            <QuantityStepper
              size="sm"
              value={inCartQuantity}
              max={primaryVariant.trackInventory ? primaryVariant.availableQuantity : undefined}
              onChange={(nextValue) =>
                updateQuantity(product.id, primaryVariant.id, nextValue)
              }
              testId={`product-card-stepper-${product.id}`}
            />
          ) : (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!primaryVariant?.inStock}
              className="w-full rounded-lg bg-gradient-primary px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`product-primary-action-${product.id}`}
            >
              {requiresSelection
                ? t("productDetail.selectSize")
                : primaryVariant?.inStock
                  ? t("productDetail.addToCart")
                  : t("productDetail.outOfStock")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
