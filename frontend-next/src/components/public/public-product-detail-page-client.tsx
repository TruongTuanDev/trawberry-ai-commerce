"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AiTryOnModal } from "@/components/ai-try-on/ai-try-on-modal";
import { ProductGallery } from "@/components/public/product-gallery";
import { MessageShopButton } from "@/components/public/message-shop-button";
import { PublicRecommendationSection } from "@/components/public/public-recommendation-section";
import { PublicProductReviewsSection } from "@/components/public/public-product-reviews-section";
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
import { useI18n } from "@/i18n/use-i18n";
import {
  getGuestSessionId,
  getPublicAiTryOnConfig,
  getPublicProduct,
  getSimilarProductRecommendations,
  trackProductView,
  type PublicAiTryOnConfig,
  type PublicProduct,
  type RecommendationProductItem,
} from "@/lib/public-api";
import { readRecommendationFlagsFromDocument } from "@/lib/recommendation-flags";
import { useCartStore } from "@/stores/cart-store";

export function PublicProductDetailPageClient({
  productId,
  initialProduct,
  recommendationsEnabled,
  recommendationTrackingEnabled,
}: {
  productId: string;
  initialProduct: PublicProduct | null;
  recommendationsEnabled: boolean;
  recommendationTrackingEnabled: boolean;
}) {
  const { locale, t } = useI18n("customer");
  const recommendationFlags = readRecommendationFlagsFromDocument();
  const router = useRouter();
  const [product, setProduct] = useState<PublicProduct | null>(initialProduct);
  const [similarProducts, setSimilarProducts] = useState<RecommendationProductItem[]>([]);
  const [similarProductsAlgorithm, setSimilarProductsAlgorithm] =
    useState<string | null>(null);
  const [aiTryOnConfig, setAiTryOnConfig] = useState<PublicAiTryOnConfig | null>(null);
  const [aiTryOnOpen, setAiTryOnOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    initialProduct?.variants.find((variant) => variant.inStock)?.id ??
      initialProduct?.variants[0]?.id ??
      "",
  );
  const [, setHasChosenSize] = useState(false);
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
  const cartItem =
    product && selectedVariant
      ? getCartItem(items, product.id, selectedVariant.id)
      : null;
  const [loading, setLoading] = useState(!initialProduct);
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
  const selectedVariantLabel = selectedVariant
    ? getVariantLabel(selectedVariant)
    : t("productDetail.noVariant");
  const isUnavailableState =
    normalizedError.includes("not found") ||
    normalizedError.includes("no longer") ||
    normalizedError.includes("hidden");

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  useEffect(() => {
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;

    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    return () => {
      document.documentElement.style.overflowX = previousHtmlOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  useEffect(() => {
    if (!detailsDrawerOpen) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailsDrawerOpen(false);
      }
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [detailsDrawerOpen]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    if (requestKey === 0 && initialProduct) {
      return () => {
        mounted = false;
        window.clearTimeout(timeout);
        controller.abort();
      };
    }

    const run = async () => {
      setLoading(true);
      try {
        const result = await getPublicProduct(productId, {
          signal: controller.signal,
        });
        if (!mounted) return;
        setProduct(result);
        setSimilarProducts([]);
        setHasChosenSize(false);
        setSelectedVariantId(
          result.variants.find((variant) => variant.inStock)?.id ??
            result.variants[0]?.id ??
            "",
        );
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error && err.name === "AbortError"
              ? t("productDetail.tryAgain")
              : err instanceof Error
                ? err.message
                : "Unable to load product.",
          );
        }
      } finally {
        if (mounted) {
          window.clearTimeout(timeout);
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [initialProduct, productId, requestKey, t]);

  useEffect(() => {
    if (!product || !recommendationsEnabled) {
      return;
    }

    let mounted = true;

    const run = async () => {
      try {
        const response = await getSimilarProductRecommendations(product.id, 8, {
          debug: recommendationFlags.recommendationExplainabilityEnabled,
        });
        if (mounted) {
          setSimilarProductsAlgorithm(response.algorithm);
          setSimilarProducts(
            response.items.filter((item) => item.product.id !== product.id),
          );
        }
      } catch {
        if (mounted) {
          setSimilarProductsAlgorithm(null);
          setSimilarProducts([]);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [
    product,
    recommendationFlags.recommendationExplainabilityEnabled,
    recommendationsEnabled,
  ]);

  useEffect(() => {
    if (!product || !recommendationTrackingEnabled) {
      return;
    }

    void trackProductView({
      productId: product.id,
      source: "product_page",
      referrer:
        typeof document === "undefined" ? undefined : document.referrer || undefined,
      guestSessionId: getGuestSessionId(),
    });
  }, [product, recommendationTrackingEnabled]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const config = await getPublicAiTryOnConfig();
        if (mounted) {
          setAiTryOnConfig(config);
        }
      } catch {
        if (mounted) {
          setAiTryOnConfig(null);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  const currentPrice = selectedVariant?.price ?? product?.price ?? null;
  const oldPrice = getComparableOldPrice(
    currentPrice,
    selectedVariant?.originalPrice ?? product?.oldPrice ?? null,
  );
  const discountPercent = useMemo(() => {
    if (!currentPrice || !oldPrice) return null;
    const currentNum = Number(currentPrice);
    const oldNum = Number(oldPrice);
    if (oldNum <= currentNum) return null;
    return Math.round(((oldNum - currentNum) / oldNum) * 100);
  }, [currentPrice, oldPrice]);

  const reviewLabel =
    product?.averageRating && Number(product.feedbackCount) > 0
      ? t("productDetail.reviews", {
          rating: Number(product.averageRating).toFixed(1),
          count: product.feedbackCount,
        })
      : null;

  const stockLabel = !selectedVariant
    ? t("productDetail.selectSize")
    : !selectedVariant.inStock
      ? t("productDetail.outOfStock")
      : selectedVariant.trackInventory
        ? t("productDetail.availableCount", {
            count: formatCount(selectedVariant.availableQuantity),
          })
        : t("productDetail.availableToOrder");

  const stockTone = !selectedVariant?.inStock
    ? "text-rose-700 bg-rose-50 border-rose-200"
    : selectedVariant &&
        selectedVariant.trackInventory &&
        selectedVariant.availableQuantity <= selectedVariant.lowStockThreshold
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";

  const isLowStockState = Boolean(
    selectedVariant &&
      selectedVariant.inStock &&
      selectedVariant.trackInventory &&
      selectedVariant.availableQuantity <= selectedVariant.lowStockThreshold,
  );

  const availabilitySummary = !selectedVariant
    ? t("productDetail.selectSize")
    : !selectedVariant.inStock
      ? t("productDetail.productOutOfStock")
      : isLowStockState
        ? t("productDetail.productLowStock")
        : t("productDetail.productInStock");

  const specRows = [
    {
      label: t("productDetail.sku"),
      value: selectedVariant?.sellerSku ?? product?.sellerSku ?? null,
    },
    { label: t("productDetail.brand"), value: product?.brand ?? null },
    {
      label: t("productDetail.category"),
      value: product?.categoryName ?? product?.sourceCategoryName ?? null,
    },
    { label: t("productDetail.color"), value: product?.color ?? null },
    { label: t("productDetail.gender"), value: product?.gender ?? null },
    { label: t("productDetail.composition"), value: product?.composition ?? null },
    {
      label: t("productDetail.source"),
      value:
        product?.sourceCategoryName &&
        product.sourceCategoryName !== product.categoryName
          ? product.sourceCategoryName
          : null,
      },
  ].filter((row) => row.value);

  const basicInfoRows = [
    {
      label: t("productDetail.sku"),
      value: selectedVariant?.sellerSku ?? product?.sellerSku ?? null,
    },
    { label: t("productDetail.soldBy"), value: product?.shop.name ?? null },
    {
      label: t("productDetail.category"),
      value: product?.categoryName ?? product?.sourceCategoryName ?? null,
    },
    { label: t("productDetail.brand"), value: product?.brand ?? null },
    { label: t("productDetail.color"), value: product?.color ?? null },
    { label: t("productDetail.composition"), value: product?.composition ?? null },
  ].filter((row) => row.value);

  const additionalInfoRows = [
    {
      label: t("productDetail.selectedVariant"),
      value: selectedVariant ? selectedVariantLabel : null,
    },
    { label: t("productDetail.gender"), value: product?.gender ?? null },
    {
      label: t("productDetail.source"),
      value:
        product?.sourceCategoryName &&
        product.sourceCategoryName !== product.categoryName
          ? product.sourceCategoryName
          : null,
    },
  ].filter((row) => row.value);

  const trustItems = [
    t("productDetail.productTrustSecureCheckout"),
    t("productDetail.productTrustOrderTracking"),
    t("productDetail.productTrustVerifiedSeller"),
    t("productDetail.productTrustReturnsPolicy"),
  ];

  const infoCards = [
    {
      title: t("productDetail.productDeliveryInfoTitle"),
      body: selectedVariant?.inStock
        ? t("productDetail.productDeliveryInfoBody")
        : t("productDetail.pickupDeliveryByAgreement"),
    },
    {
      title: t("productDetail.productPaymentInfoTitle"),
      body: product?.shop.paymentInstructions ?? t("productDetail.productPaymentInfoBody"),
    },
  ];

  const descriptionText = product?.description?.trim() ?? "";

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

  const handleOpenAiTryOn = () => {
    if (!aiTryOnConfig?.enabled) {
      toast.warning(t("aiTryOn.underDevelopment"));
      return;
    }

    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    setAiTryOnOpen(true);
  };

  const openDetailsDrawer = () => {
    setDetailsDrawerOpen(true);
  };

  return (
    <PublicShell>
      <main className="px-4 py-6 pb-36 sm:px-6 sm:py-10 lg:pb-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("productDetail.productBackToCatalog")}
            </Link>
            <Link
              href="/cart"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("productDetail.openCart")}
            </Link>
          </div>

          {loading ? (
            <section
              className="card-panel rounded-[2rem] bg-white px-5 py-6 sm:px-6"
              aria-label={t("productDetail.loadingProduct")}
            >
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.9fr)_320px]">
                <div className="min-h-[420px] animate-pulse rounded-[2rem] bg-slate-100" />
                <div className="space-y-4">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-10 w-full animate-pulse rounded-3xl bg-slate-100" />
                  <div className="h-24 w-full animate-pulse rounded-[1.75rem] bg-slate-100" />
                  <div className="h-40 w-full animate-pulse rounded-[1.75rem] bg-slate-100" />
                </div>
                <div className="min-h-[360px] animate-pulse rounded-[2rem] bg-slate-100" />
              </div>
            </section>
          ) : error || !product ? (
            <section
              className={`rounded-[2rem] px-6 py-8 sm:px-8 ${isUnavailableState ? "border border-[var(--border)] bg-white text-[var(--foreground)]" : "border border-[var(--accent-soft)] bg-[var(--accent-soft)]/40 text-[var(--accent-strong)]"}`}
              data-testid={isUnavailableState ? "product-unavailable-state" : "product-detail-error"}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {isUnavailableState
                  ? t("productDetail.unavailable")
                  : t("productDetail.loadError")}
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">
                {isUnavailableState
                  ? t("productDetail.unavailableTitle")
                  : t("productDetail.loadErrorTitle")}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {isUnavailableState
                  ? t("productDetail.unavailableDescription")
                  : (error ?? t("productDetail.tryAgain"))}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="public-button-primary inline-flex px-5 py-3 text-sm"
                >
                  {t("productDetail.backToProducts")}
                </Link>
                {!isUnavailableState ? (
                  <button
                    type="button"
                    onClick={() => setRequestKey((current) => current + 1)}
                    className="public-button-secondary px-5 py-3 text-sm"
                  >
                    {t("productDetail.productRetryLoad")}
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <>
              <section className="card-panel rounded-[2rem] bg-white p-4 sm:rounded-[2.25rem] sm:p-6">
                <div className="grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.9fr)_320px]">
                  <div className="min-w-0">
                    <ProductGallery
                      key={`${product.id}:${product.images.length}`}
                      name={product.name}
                      images={product.images}
                    />
                  </div>

                  <div className="min-w-0 space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex rounded-full border border-[var(--brand-primary)]/15 bg-[var(--brand-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary-dark)]">
                          {availabilitySummary}
                        </span>
                        {product.shop.slug ? (
                          <Link
                            href={`/shops/${product.shop.slug}`}
                            className="inline-flex min-w-0 break-all rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)] transition hover:border-[var(--brand-primary)]/25 hover:text-[var(--brand-primary-dark)]"
                            data-testid="public-product-shop-link"
                          >
                            {product.shop.name}
                          </Link>
                        ) : (
                          <p className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                            {product.shop.name}
                          </p>
                        )}
                        {product.shop.slug ? (
                          <MessageShopButton
                            shopSlug={product.shop.slug}
                            productId={product.id}
                            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]"
                            testId="public-product-message-shop-button"
                          />
                        ) : null}
                      </div>

                      <h1
                        className="break-words text-3xl font-black leading-tight text-[var(--foreground)] sm:text-4xl xl:text-[2.7rem]"
                        data-testid="product-detail-title"
                      >
                        {product.name}
                      </h1>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                        {reviewLabel ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                            <span className="text-amber-500">*</span>
                            <span>{reviewLabel}</span>
                          </span>
                        ) : null}
                        {product.feedbackCount > 0 ? (
                          <span className="rounded-full border border-slate-200/50 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">
                            {t("productDetail.questionsCount", {
                              count: product.feedbackCount,
                            })}
                          </span>
                        ) : null}
                        {!reviewLabel && product.feedbackCount === 0 ? (
                          <span className="rounded-full border border-emerald-200/50 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                            {t("productDetail.readyForCheckout")}
                          </span>
                        ) : null}
                      </div>

                      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(135deg,#ffffff_0%,#fff5fc_100%)] px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("productDetail.productWhyBuyTitle")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                          {t("productDetail.trustedValidationNotice")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {t("productDetail.sizes")}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {t("productDetail.chooseVariant")}
                        </p>
                      </div>
                      <div
                        className="flex flex-wrap gap-2.5 sm:gap-3"
                        data-testid="product-size-selector"
                      >
                        {product.variants.map((variant) => {
                          const label = getVariantLabel(variant);
                          const active = selectedVariantId === variant.id;

                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => {
                                setSelectedVariantId(variant.id);
                                setHasChosenSize(true);
                                setQuantity(1);
                              }}
                              className={`min-w-20 flex-1 rounded-2xl border px-4 py-3 text-left transition-all duration-200 min-[430px]:flex-none ${active ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] shadow-[0_4px_14px_rgba(203,17,171,0.15)]" : "border-[var(--border)] bg-white hover:border-[var(--brand-primary)]/40"} ${variant.inStock ? "text-[var(--foreground)]" : "cursor-not-allowed text-[var(--muted)] opacity-55"}`}
                              disabled={!variant.inStock}
                              data-testid={
                                active
                                  ? "product-selected-size"
                                  : `product-size-${variant.id}`
                              }
                            >
                              <div className="text-sm font-semibold">{label}</div>
                              <div className="mt-1 text-xs">
                                {variant.inStock
                                  ? variant.trackInventory
                                    ? t("productDetail.pcsCount", {
                                        count: formatCount(variant.availableQuantity),
                                      })
                                    : t("productDetail.available")
                                  : t("productDetail.outOfStock")}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] px-5 py-5">
                      {!hasSelectableInStockVariant ? (
                        <p
                          className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
                          data-testid="product-out-of-stock-state"
                        >
                          {t("productDetail.allVariantsOutOfStock")}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={openDetailsDrawer}
                        className="flex w-full items-center justify-between rounded-[1.4rem] border border-[var(--border)] bg-white px-4 py-3 text-left transition hover:border-[var(--brand-primary)]/25 hover:bg-[var(--brand-primary-soft)]/45"
                        data-testid="product-open-details"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {t("productDetail.productCharacteristicsAndDescription")}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                            {t("productDetail.productOpenDetails")}
                          </p>
                        </div>
                        <span className="text-xl text-[var(--brand-primary)]" aria-hidden="true">
                          +
                        </span>
                      </button>
                    </div>
                  </div>

                  <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
                    <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_12px_40px_rgba(203,17,171,0.08)]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-4xl font-black tracking-tight text-[var(--brand-primary)]">
                            {formatMoney(currentPrice) ?? t("productDetail.contactShop")}
                          </p>
                          {oldPrice ? (
                            <p className="pb-1 text-base text-[var(--muted)] line-through">
                              {formatMoney(oldPrice)}
                            </p>
                          ) : null}
                          {discountPercent ? (
                            <span className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                              -{discountPercent}%
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StockBadge label={stockLabel} tone={stockTone} />
                          <span className="text-sm text-[var(--muted)]">
                            {availabilitySummary}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div
                          className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
                          data-testid="product-selected-variant-summary"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("productDetail.selectedVariant")}
                          </p>
                          <p className="mt-2 break-words text-sm font-semibold text-[var(--foreground)]">
                            {selectedVariant
                              ? t("productDetail.selectedSizeLabel", {
                                  size: selectedVariantLabel,
                                })
                              : t("productDetail.selectSize")}
                          </p>
                        </div>

                        <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("productDetail.quantity")}
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
                          <div className="rounded-[1.5rem] border border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] px-4 py-3 text-center text-sm font-semibold text-[var(--brand-primary-dark)] shadow-sm">
                            {t("productDetail.inCartCount", { count: cartItem.quantity })}
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={!hasReadyVariant}
                          className="public-button-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="add-to-cart"
                        >
                          {cartItem ? t("productDetail.inCart") : t("productDetail.addToCart")}
                        </button>
                        <button
                          type="button"
                          onClick={handleBuyNow}
                          disabled={!hasReadyVariant}
                          className="w-full rounded-full border border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] px-5 py-3.5 text-sm font-semibold text-[var(--brand-primary-dark)] transition-all duration-200 hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary-soft)]/85 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="continue-to-checkout"
                        >
                          {t("productDetail.buyNow")}
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenAiTryOn}
                          className="w-full rounded-full border border-[var(--border)] bg-white px-5 py-3.5 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]"
                          data-testid="product-ai-try-on-button"
                        >
                          {locale === "ru" ? "Примерка с ИИ" : "AI Try-On"}
                        </button>
                      </div>

                      <div
                        className="mt-6 space-y-4 border-t border-slate-100 pt-5"
                        data-testid="product-trust-section"
                      >
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {trustItems.map((item) => (
                            <div
                              key={item}
                              className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-3 py-3 text-xs font-semibold leading-5 text-[var(--foreground)]"
                            >
                              {item}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={openDetailsDrawer}
                          className="w-full rounded-[1.25rem] border border-[var(--border)] bg-slate-50/80 px-4 py-3 text-left transition hover:border-[var(--brand-primary)]/25 hover:bg-[var(--brand-primary-soft)]/40"
                          data-testid="product-delivery-payment-info"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("productDetail.productDeliveryAndPayment")}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                            {selectedVariant?.inStock
                              ? t("productDetail.productDeliveryInfoBody")
                              : t("productDetail.pickupDeliveryByAgreement")}
                          </p>
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              </section>

              <PublicProductReviewsSection product={product} />
              <PublicRecommendationSection
                titleKey="similarProducts"
                items={similarProducts}
                placement="product_detail"
                algorithm={similarProductsAlgorithm}
                showExplainability={
                  recommendationFlags.recommendationExplainabilityEnabled
                }
                sourceProductId={product.id}
                trackingEnabled={recommendationTrackingEnabled}
              />

              {detailsDrawerOpen ? (
                <div
                  className="fixed inset-0 z-[70]"
                  data-testid="product-details-drawer"
                >
                  <button
                    type="button"
                    aria-label={t("productDetail.productCloseDetails")}
                    className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
                    onClick={() => setDetailsDrawerOpen(false)}
                  />
                  <aside className="absolute inset-x-0 bottom-0 top-auto max-h-[85vh] overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(15,23,42,0.2)] md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[min(36rem,92vw)] md:rounded-none md:rounded-l-[2rem]">
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("productDetail.productCharacteristicsAndDescription")}
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-[var(--foreground)]">
                          {product.name}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDetailsDrawerOpen(false)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-xl text-[var(--foreground)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]"
                        aria-label={t("productDetail.productCloseDetails")}
                        data-testid="product-close-details"
                      >
                        x
                      </button>
                    </div>

                    <div className="h-full overflow-y-auto px-5 pb-8 pt-5 sm:px-6">
                      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("productDetail.productBasicInformation")}
                        </h3>
                        <div className="mt-4 space-y-2">
                          {basicInfoRows.map((row) => (
                            <div
                              key={row.label}
                              className="grid gap-2 border-b border-dashed border-[var(--border)]/80 py-2 last:border-none md:grid-cols-[180px_minmax(0,1fr)]"
                            >
                              <p className="text-sm text-[var(--muted)]">{row.label}</p>
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {row.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>

                      {additionalInfoRows.length > 0 ? (
                        <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("productDetail.productAdditionalInformation")}
                          </h3>
                          <div className="mt-4 space-y-2">
                            {additionalInfoRows.map((row) => (
                              <div
                                key={row.label}
                                className="grid gap-2 border-b border-dashed border-[var(--border)]/80 py-2 last:border-none md:grid-cols-[180px_minmax(0,1fr)]"
                              >
                                <p className="text-sm text-[var(--muted)]">{row.label}</p>
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                  {row.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {specRows.length > 0 ? (
                        <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("productDetail.productSpecsTitle")}
                          </h3>
                          <div className="mt-4 space-y-2">
                            {specRows.map((row) => (
                              <div
                                key={row.label}
                                className="grid gap-2 border-b border-dashed border-[var(--border)]/80 py-2 last:border-none md:grid-cols-[180px_minmax(0,1fr)]"
                              >
                                <p className="text-sm text-[var(--muted)]">{row.label}</p>
                                <p className="text-sm font-semibold text-[var(--foreground)]">
                                  {row.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <section className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("productDetail.productDescriptionTitle")}
                        </h3>
                        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--foreground)]">
                          {descriptionText || t("productDetail.noDescription")}
                        </p>
                      </section>

                      <section
                        className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-white px-4 py-4"
                        data-testid="product-delivery-payment-drawer"
                      >
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("productDetail.productDeliveryAndPayment")}
                        </h3>
                        <div className="mt-4 space-y-3">
                          {infoCards.map((card) => (
                            <div
                              key={card.title}
                              className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                {card.title}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                                {card.body}
                              </p>
                            </div>
                          ))}
                          <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                              {t("productDetail.productSupportInfoTitle")}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                              {t("productDetail.productSupportInfoBody")}
                            </p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </aside>
                </div>
              ) : null}

              {!detailsDrawerOpen ? (
                <div
                  className="fixed inset-x-3 bottom-3 z-40 lg:hidden"
                  data-testid="mobile-product-cta"
                >
                  <div className="rounded-[1.8rem] border border-[var(--border)] bg-white/95 p-4 shadow-[0_12px_40px_rgba(203,17,171,0.16)] backdrop-blur supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between min-[430px]:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xl font-black tracking-tight text-[var(--brand-primary)]">
                          {formatMoney(currentPrice) ?? t("productDetail.contactShop")}
                        </p>
                        {oldPrice ? (
                          <p className="text-xs text-[var(--muted)] line-through">
                            {formatMoney(oldPrice)}
                          </p>
                        ) : null}
                        {discountPercent ? (
                          <span className="rounded border border-rose-100 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            -{discountPercent}%
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-[var(--muted)]">
                          {selectedVariant
                            ? t("productDetail.selectedSizeLabel", {
                                size: selectedVariantLabel,
                              })
                            : t("productDetail.selectSize")}
                        </p>
                        <StockBadge label={stockLabel} tone={stockTone} />
                      </div>
                    </div>
                    <div className="min-w-0 min-[430px]:text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t("productDetail.mobileQty")}
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
                      {cartItem ? t("productDetail.inCart") : t("productDetail.addToCart")}
                    </button>
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={!hasReadyVariant}
                      className="min-w-0 flex-1 rounded-full border border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--brand-primary-dark)] transition-all duration-200 hover:border-[var(--brand-primary)]/20 hover:bg-[var(--brand-primary-soft)]/85 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="mobile-buy-now"
                    >
                      {t("productDetail.buyNow")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAiTryOn}
                    className="mt-2 w-full rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition-all duration-200 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]"
                    data-testid="mobile-product-ai-try-on"
                  >
                    {locale === "ru" ? "Примерка с ИИ" : "AI Try-On"}
                  </button>
                  <button
                    type="button"
                    onClick={openDetailsDrawer}
                    className="mt-2 w-full rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary-dark)]"
                    data-testid="mobile-product-open-details"
                  >
                    {t("productDetail.productCharacteristicsAndDescription")}
                  </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
      {product && selectedVariant && aiTryOnConfig && aiTryOnOpen ? (
        <AiTryOnModal
          open={aiTryOnOpen}
          locale={locale === "ru" ? "ru" : "en"}
          requireConsent={aiTryOnConfig.requireConsent}
          product={{
            id: product.id,
            name: product.name,
            imageUrl: product.images[0]?.url ?? null,
            selectedSize: selectedVariantLabel,
            selectedRussianSize: selectedVariant.russianSize,
          }}
          t={t}
          onClose={() => {
            document.documentElement.style.overflowX = "";
            document.body.style.overflowX = "";
            setAiTryOnOpen(false);
          }}
        />
      ) : null}
    </PublicShell>
  );
}
