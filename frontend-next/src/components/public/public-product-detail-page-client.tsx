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
import { getPublicProduct, type PublicProduct } from "@/lib/public-api";
import { useCartStore } from "@/stores/cart-store";

export function PublicProductDetailPageClient({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
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
  }, [productId]);

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
    ? "Select a size to continue"
    : !selectedVariant.inStock
      ? "Нет в наличии"
      : selectedVariant.trackInventory
        ? `${formatCount(selectedVariant.availableQuantity)} available`
        : "Available to order";

  const stockTone = !selectedVariant?.inStock
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : selectedVariant &&
        selectedVariant.trackInventory &&
        selectedVariant.availableQuantity <= selectedVariant.lowStockThreshold
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";

  const hasReadyVariant = Boolean(selectedVariant?.inStock && currentPrice);

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
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              Back to products
            </Link>
            <Link
              href="/cart"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              Open cart
            </Link>
          </div>

          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-12 text-sm text-[var(--muted)]">
              Loading product...
            </section>
          ) : error || !product ? (
            <section className="rounded-[2rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 px-6 py-8 text-sm text-[var(--accent-strong)]">
              {error ?? "Product not found."}
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={image.url}
                                alt={`${product.name} preview ${index + 1}`}
                                className="h-full w-full object-cover"
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
                              className={`min-w-20 rounded-2xl border px-4 py-3 text-left ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]/30 shadow-[0_10px_22px_rgba(182,49,75,0.12)]" : "border-[var(--border)] bg-white"} ${variant.inStock ? "text-[var(--foreground)]" : "cursor-not-allowed text-[var(--muted)] opacity-55"}`}
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
                        {selectedVariant ? getVariantLabel(selectedVariant) : "No variant available"}
                      </p>
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
                    <div className="rounded-[2rem] border border-[var(--border)] bg-white p-5 shadow-[0_24px_60px_rgba(69,35,26,0.12)]">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-3">
                          <p className="text-4xl font-bold text-[var(--accent-strong)]">
                            {formatMoney(currentPrice) ?? "Contact shop"}
                          </p>
                          {oldPrice ? (
                            <p className="pb-1 text-base text-[var(--muted)] line-through">
                              {formatMoney(oldPrice)}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm text-[var(--muted)]">
                          {selectedVariant ? `Size ${getVariantLabel(selectedVariant)}` : "Select a size"}
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
                              onChange={(nextValue) => {
                                if (!product || !selectedVariant) {
                                  setQuantity(nextValue);
                                  return;
                                }

                                if (cartItem) {
                                  updateQuantity(product.id, selectedVariant.id, nextValue);
                                  return;
                                }

                                setQuantity(nextValue);
                              }}
                              testId="product-quantity-stepper"
                            />
                          </div>
                        </div>

                        {cartItem ? (
                          <div className="rounded-[1.5rem] border border-[var(--accent-soft)] bg-[var(--accent-soft)]/30 px-4 py-3 text-sm font-semibold text-[var(--accent-strong)]">
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
                          className="w-full rounded-full border border-[var(--accent-soft)] bg-[var(--accent-soft)]/35 px-5 py-3.5 text-sm font-semibold text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
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

            </>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
