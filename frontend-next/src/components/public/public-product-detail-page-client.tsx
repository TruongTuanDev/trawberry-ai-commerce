"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductGallery } from "@/components/public/product-gallery";
import {
  formatCount,
  formatMoney,
  getCartItem,
  getComparableOldPrice,
  getVariantLabel,
} from "@/components/public/public-product-utils";
import { PublicShell } from "@/components/public/public-shell";
import { QuantityStepper } from "@/components/public/quantity-stepper";
import { StockBadge } from "@/components/public/stock-badge";
import { toast } from "@/components/ui/use-toast";
import { FallbackImage } from "@/components/ui/fallback-image";
import { useI18n } from "@/i18n/use-i18n";
import { getPublicProduct, type PublicProduct } from "@/lib/public-api";
import { useCartStore } from "@/stores/cart-store";

export function PublicProductDetailPageClient({
  productId,
}: {
  productId: string;
}) {
  const { t } = useI18n("customer");
  const router = useRouter();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [requestKey, setRequestKey] = useState(0);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const hydrateCart = useCartStore((state) => state.hydrate);
  const selectedVariant =
    product?.variants.find((variant) => variant.id === selectedVariantId) ??
    product?.variants.find((variant) => variant.inStock) ??
    product?.variants[0] ??
    null;
  const cartItem = product && selectedVariant ? getCartItem(items, product.id, selectedVariant.id) : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalizedError = error?.toLowerCase() ?? "";
  const maxQuantity =
    selectedVariant?.trackInventory && selectedVariant.availableQuantity > 0
      ? selectedVariant.availableQuantity
      : undefined;
  const safeQuantity = useMemo(() => {
    const normalized = Math.max(1, quantity);
    if (maxQuantity === undefined) {
      return normalized;
    }
    return Math.min(normalized, maxQuantity);
  }, [maxQuantity, quantity]);
  const displayQuantity = cartItem?.quantity ?? safeQuantity;
  const selectedVariantLabel = selectedVariant ? getVariantLabel(selectedVariant) : t("productDetail.noVariant");
  const isUnavailableState =
    normalizedError.includes("not found") ||
    normalizedError.includes("no longer") ||
    normalizedError.includes("hidden");

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const result = await getPublicProduct(productId);
        if (!mounted) return;
        setProduct(result);
        setSelectedVariantId(
          result.variants.find((variant) => variant.inStock)?.id ??
            result.variants[0]?.id ??
            "",
        );
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load product.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [productId, requestKey]);

  const currentPrice = selectedVariant?.price ?? product?.price ?? null;
  const oldPrice = getComparableOldPrice(
    currentPrice,
    selectedVariant?.originalPrice ?? product?.oldPrice ?? null,
  );
  const specRows = [
    { label: "Артикул / SKU", value: selectedVariant?.sellerSku ?? product?.sellerSku ?? null },
    { label: "Бренд", value: product?.brand ?? null },
    { label: "Категория", value: product?.categoryName ?? product?.sourceCategoryName ?? null },
    { label: "Цвет", value: product?.color ?? null },
    { label: "Пол", value: product?.gender ?? null },
    { label: "Состав", value: product?.composition ?? null },
    { label: "Источник", value: product?.sourceCategoryName ?? null },
  ].filter((row) => row.value);

  const reviewLabel =
    product?.averageRating && Number(product.feedbackCount) > 0
      ? `${Number(product.averageRating).toFixed(1)} · ${product.feedbackCount} review(s)`
      : null;

  const stockLabel = !selectedVariant
    ? t("productDetail.selectSize")
    : !selectedVariant.inStock
      ? "Нет в наличии"
      : selectedVariant.trackInventory
        ? `${formatCount(selectedVariant.availableQuantity)} available`
        : t("productDetail.availableToOrder");

  const stockTone = !selectedVariant?.inStock
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : selectedVariant &&
        selectedVariant.trackInventory &&
        selectedVariant.availableQuantity <= selectedVariant.lowStockThreshold
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";

  const hasReadyVariant = Boolean(selectedVariant?.inStock && currentPrice);
  const hasSelectableInStockVariant = Boolean(
    product?.variants.some((variant) => variant.inStock),
  );

  const handleQuantityChange = (nextValue: number) => {
    if (!product || !selectedVariant) {
      setQuantity(nextValue);
      return;
    }

    if (cartItem) {
      updateQuantity(product.id, selectedVariant.id, nextValue);
      return;
    }

    setQuantity(nextValue);
  };

  const handleQuantityMaxExceeded = () => {
    toast.warning(t("productDetail.quantityExceeded"));
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !hasReadyVariant) return;

    if (cartItem) {
      updateQuantity(product.id, selectedVariant.id, displayQuantity);
      return;
    }

    addItem(product, selectedVariant, displayQuantity);
  };

  const handleBuyNow = () => {
    if (!product || !selectedVariant || !hasReadyVariant) return;

    if (cartItem) {
      updateQuantity(product.id, selectedVariant.id, displayQuantity);
    } else {
      addItem(product, selectedVariant, displayQuantity);
    }

    router.push("/checkout");
  };

  return (
    <PublicShell>
      <main className="px-4 py-8 pb-32 sm:px-6 sm:py-10 lg:pb-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("productDetail.backToProducts")}
            </Link>
            <Link
              href="/cart"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("productDetail.openCart")}
            </Link>
          </div>

          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-12 text-sm text-[var(--muted)]">
              {t("productDetail.loadingProduct")}
            </section>
          ) : error || !product ? (
            <section
              className={`rounded-[2rem] px-6 py-8 sm:px-8 ${isUnavailableState ? "border border-[var(--border)] bg-white text-[var(--foreground)]" : "border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 text-[var(--accent-strong)]"}`}
              data-testid={isUnavailableState ? "product-unavailable-state" : "product-detail-error"}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {isUnavailableState ? "Unavailable" : "Load error"}
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">
                {isUnavailableState
                  ? "Sản phẩm không còn bán hoặc đã bị ẩn"
                  : "Unable to load this product right now"}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {isUnavailableState
                  ? "Product is no longer public, has been unpublished, or does not exist in the marketplace."
                  : error ?? "Please try again in a moment."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="public-button-primary inline-flex px-5 py-3 text-sm"
                >
                  Back to products
                </Link>
                {!isUnavailableState ? (
                  <button
                    type="button"
                    onClick={() => setRequestKey((current) => current + 1)}
                    className="public-button-secondary px-5 py-3 text-sm"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <>
              <section className="card-panel rounded-[2.25rem] bg-white p-4 sm:p-6">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.9fr)_320px]">
                  <div>
                    <ProductGallery name={product.name} images={product.images} />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        {product.shop.name}
                      </p>
                      <h1
                        className="text-3xl font-bold leading-tight text-[var(--foreground)] sm:text-4xl"
                        data-testid="product-detail-title"
                      >
                        {product.name}
                      </h1>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                        {reviewLabel ? <span>{reviewLabel}</span> : null}
                        {product.feedbackCount > 0 ? <span>{product.feedbackCount} questions</span> : null}
                        {!reviewLabel && product.feedbackCount === 0 ? (
                          <span>Marketplace selection ready for checkout</span>
                        ) : null}
                      </div>
                    </div>

                    {product.images.length > 1 ? (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Preview
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {product.images.slice(0, 5).map((image, index) => (
                            <div
                              key={image.id}
                              className="h-16 w-16 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]"
                            >
                              <FallbackImage
                                src={image.url}
                                alt={`${product.name} preview ${index + 1}`}
                                className="h-full w-full object-cover"
                                testId={index === 0 ? "product-preview-image" : undefined}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Sizes
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          Choose an in-stock variant
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3" data-testid="product-size-selector">
                        {product.variants.map((variant) => {
                          const label = [variant.sizeName, variant.russianSize].filter(Boolean).join(" / ") || getVariantLabel(variant);
                          const active = selectedVariantId === variant.id;
                          return (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVariantId(variant.id);
                                  setQuantity(1);
                                }}
                              className={`min-w-20 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${active ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_4px_14px_rgba(203,17,171,0.15)]" : "border-[var(--border)] bg-white hover:border-[var(--muted)]"} ${variant.inStock ? "text-[var(--foreground)]" : "cursor-not-allowed text-[var(--muted)] opacity-55"}`}
                                disabled={!variant.inStock}
                                data-testid={active ? "product-selected-size" : `product-size-${variant.id}`}
                              >
                              <div className="text-sm font-semibold">{label}</div>
                              <div className="mt-1 text-xs">
                                {variant.inStock
                                  ? variant.trackInventory
                                    ? `${formatCount(variant.availableQuantity)} pcs`
                                    : "Available"
                                  : "Out of stock"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Selected variant
                        </p>
                        <StockBadge label={stockLabel} tone={stockTone} />
                      </div>
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        {selectedVariantLabel}
                      </p>
                      {!hasSelectableInStockVariant ? (
                        <p
                          className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                          data-testid="product-out-of-stock-state"
                        >
                          This product is currently out of stock for all visible variants.
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Characteristics
                      </p>
                      <div className="space-y-2 rounded-[1.75rem] border border-[var(--border)] bg-white px-5 py-4">
                        {specRows.map((row) => (
                          <div
                            key={row.label}
                            className="grid gap-1 border-b border-dashed border-[var(--border)]/80 py-2 last:border-none sm:grid-cols-[150px_minmax(0,1fr)]"
                          >
                            <p className="text-sm text-[var(--muted)]">{row.label}</p>
                            <p className="text-sm font-medium text-[var(--foreground)]">{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-[var(--border)] bg-white px-5 py-5">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Description
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                        {product.description ?? "No description provided yet."}
                      </p>
                    </div>
                  </div>

                  <aside className="xl:sticky xl:top-24 xl:self-start">
                    <div className="rounded-[2rem] border border-[var(--border)] bg-white p-5 shadow-[0_12px_40px_rgba(203,17,171,0.08)]">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-3">
                          <p className="text-gradient-primary text-4xl font-bold">
                            {formatMoney(currentPrice) ?? "Contact shop"}
                          </p>
                          {oldPrice ? (
                            <p className="pb-1 text-base text-[var(--muted)] line-through">
                              {formatMoney(oldPrice)}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                          {selectedVariant ? `Size ${selectedVariantLabel}` : "Select a size"}
                        </p>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div className="rounded-[1.5rem] bg-[var(--panel)] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            Quantity
                          </p>
                          <div className="mt-3">
                            <QuantityStepper
                              value={displayQuantity}
                              max={maxQuantity}
                              disabled={!selectedVariant?.inStock}
                              onChange={handleQuantityChange}
                              onMaxExceeded={handleQuantityMaxExceeded}
                              testId="product-quantity-stepper"
                            />
                          </div>
                        </div>

                        {cartItem ? (
                          <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)]">
                            В корзине: {cartItem.quantity}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={!hasReadyVariant}
                          className="public-button-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="add-to-cart"
                        >
                          {cartItem ? "В корзине" : "Добавить в корзину"}
                        </button>
                        <button
                          type="button"
                          onClick={handleBuyNow}
                          disabled={!hasReadyVariant}
                          className="w-full rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-5 py-3.5 text-sm font-semibold text-[var(--accent-strong)] transition-all duration-200 hover:bg-[var(--accent-soft)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="continue-to-checkout"
                        >
                          Купить сейчас
                        </button>
                      </div>

                      <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
                        <p>{selectedVariant?.inStock ? "Доставка рассчитывается при оформлении" : "Самовывоз/доставка по договоренности"}</p>
                        <p>Shop: <span className="font-semibold text-[var(--foreground)]">{product.shop.name}</span></p>
                        <p>Stock: <span className="font-semibold text-[var(--foreground)]">{stockLabel}</span></p>
                        {product.shop.paymentInstructions ? (
                          <p>{product.shop.paymentInstructions}</p>
                        ) : null}
                        <p className="text-xs leading-6">
                          Trusted price and stock are validated again server-side during checkout.
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </section>

              <div
                className="fixed inset-x-3 bottom-3 z-40 lg:hidden"
                data-testid="mobile-product-cta"
              >
                <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/95 p-4 shadow-[0_12px_40px_rgba(203,17,171,0.16)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-gradient-primary text-xl font-bold">
                        {formatMoney(currentPrice) ?? "Contact shop"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {selectedVariant ? selectedVariantLabel : "Select a size"}
                      </p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Qty
                      </p>
                      <div className="mt-2">
                        <QuantityStepper
                          size="sm"
                          value={displayQuantity}
                          max={maxQuantity}
                          disabled={!selectedVariant?.inStock}
                          onChange={handleQuantityChange}
                          onMaxExceeded={handleQuantityMaxExceeded}
                          testId="mobile-product-quantity-stepper"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={!hasReadyVariant}
                      className="public-button-primary min-w-0 flex-1 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="mobile-add-to-cart"
                    >
                      {cartItem ? "В корзине" : "Добавить в корзину"}
                    </button>
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={!hasReadyVariant}
                      className="min-w-0 flex-1 rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] transition-all duration-200 hover:bg-[var(--accent-soft)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="mobile-buy-now"
                    >
                      Купить сейчас
                    </button>
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
