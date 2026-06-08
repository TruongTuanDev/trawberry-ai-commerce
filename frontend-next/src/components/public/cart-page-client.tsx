"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { FallbackImage } from "@/components/ui/fallback-image";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  buildCartValidationPayload,
  buildValidationMap,
  canAdjustValidatedQuantity,
  cartItemKey,
  formatMoneyNumber,
  getValidationAutomationMessage,
  getValidationMessage,
  getValidationTone,
  isBlockingCartStatus,
} from "@/lib/cart-validation";
import {
  validatePublicCart,
  type PublicCartValidationResponse,
} from "@/lib/public-api";
import { type CartItem, useCartStore } from "@/stores/cart-store";

type ShopCartGroup = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  subtotal: number;
};

function groupItemsByShop(
  items: CartItem[],
  lineTotals: Map<string, number>,
  shopNames: Map<string, string>,
): ShopCartGroup[] {
  const groups = new Map<string, ShopCartGroup>();
  for (const item of items) {
    const existing = groups.get(item.shopId) ?? {
      shopId: item.shopId,
      shopName: shopNames.get(item.shopId) ?? item.shopName,
      items: [],
      subtotal: 0,
    };
    existing.items.push(item);
    existing.subtotal +=
      lineTotals.get(cartItemKey(item.productId, item.variantId)) ??
      Number(item.unitPrice || 0) * item.quantity;
    groups.set(item.shopId, existing);
  }
  return [...groups.values()];
}

export function CartPageClient() {
  const { t } = useI18n("customer");
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const hydrate = useCartStore((state) => state.hydrate);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const patchItem = useCartStore((state) => state.patchItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [validation, setValidation] = useState<PublicCartValidationResponse | null>(
    null,
  );
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationRequestKey, setValidationRequestKey] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !items.length) {
      return;
    }

    let mounted = true;

    const run = async () => {
      setValidationLoading(true);
      try {
        const result = await validatePublicCart(buildCartValidationPayload(items));
        if (!mounted) {
          return;
        }
        setValidation(result);
        setValidationError(null);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setValidation(null);
        setValidationError(
          getLocalizedErrorMessage({
            role: "customer",
            error,
            fallbackKey: "errors.validation",
          }),
        );
      } finally {
        if (mounted) {
          setValidationLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [hydrated, items, validationRequestKey]);

  const activeValidation = items.length ? validation : null;
  const activeValidationError = items.length ? validationError : null;
  const activeValidationLoading = items.length ? validationLoading : false;

  const validationMap = useMemo(
    () => buildValidationMap(activeValidation),
    [activeValidation],
  );
  const lineTotals = useMemo(() => {
    return new Map(
      items.map((item) => {
        const validated = validationMap.get(cartItemKey(item.productId, item.variantId));
        return [
          cartItemKey(item.productId, item.variantId),
          validated?.lineTotal ?? Number(item.unitPrice || 0) * item.quantity,
        ] as const;
      }),
    );
  }, [items, validationMap]);
  const shopNames = useMemo(() => {
    return new Map(
      items.map((item) => {
        const validated = validationMap.get(cartItemKey(item.productId, item.variantId));
        return [item.shopId, validated?.shopName ?? item.shopName] as const;
      }),
    );
  }, [items, validationMap]);
  const subtotal =
    activeValidation?.summary.subtotal ??
    items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
  const shopGroups = useMemo(
    () => groupItemsByShop(items, lineTotals, shopNames),
    [items, lineTotals, shopNames],
  );
  const hasBlockingIssues =
    activeValidation?.items.some((item) => isBlockingCartStatus(item.status)) ?? false;
  const hasPriceChanges = (activeValidation?.summary.changedCount ?? 0) > 0;
  const checkoutDisabled =
    activeValidationLoading || Boolean(activeValidationError) || hasBlockingIssues;

  const acceptNewPrice = (
    item: CartItem,
    validated: NonNullable<PublicCartValidationResponse["items"][number]>,
  ) => {
    if (validated.unitPrice === null) {
      return;
    }
    patchItem(item.productId, item.variantId, {
      unitPrice: String(validated.unitPrice),
      availableQuantity: validated.maxQuantity,
      trackInventory: validated.trackInventory,
      productName: validated.productName ?? item.productName,
      imageUrl: validated.imageUrl ?? item.imageUrl,
      variantName: validated.variantName ?? item.variantName,
      shopName: validated.shopName ?? item.shopName,
    });
  };

  return (
    <PublicShell>
      <main className="px-4 py-6 pb-32 sm:px-6 sm:py-10 xl:pb-10">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header Actions Row */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-primary-dark)] hover:opacity-80 transition-colors"
            >
              <span>←</span>
              <span>{t("cart.backToProducts")}</span>
            </Link>
            {items.length ? (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(t("cart.clearCartConfirm"))) {
                    return;
                  }
                  clearCart();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/60 bg-rose-50/40 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
              >
                <span>🗑</span>
                <span>{t("cart.clearCart")}</span>
              </button>
            ) : null}
          </div>

          {/* Cart Page Title */}
          <div className="flex items-end gap-3.5">
            <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
              {t("cart.title")}
            </h1>
            {items.length ? (
              <span className="mb-1 rounded-full bg-[var(--brand-primary-soft)] px-3 py-1 text-sm font-bold text-[var(--brand-primary-dark)]">
                {items.reduce((acc, curr) => acc + curr.quantity, 0)} {t("cart.quantity").toLowerCase()}
              </span>
            ) : null}
          </div>

          {!items.length ? (
            /* Redesigned Empty Cart State */
            <section
              className="cart-panel rounded-[2rem] px-6 py-12 text-center sm:px-12 flex flex-col items-center justify-center space-y-6"
              data-testid="cart-empty-state"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--brand-primary-soft)] text-4xl shadow-sm">
                🛒
              </div>
              <div className="space-y-2">
                <h2 className="text-gradient-primary font-[family-name:var(--font-mono-app)] text-2xl sm:text-3xl font-bold">
                  {t("cart.emptyTitle")}
                </h2>
                <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--muted)]">
                  {t("cart.emptyDescription")}
                </p>
              </div>
              <Link
                href="/products"
                className="public-button-primary inline-flex px-8 py-3.5 text-sm font-bold shadow-lg hover:shadow-xl transition"
                data-testid="cart-empty-continue-shopping"
              >
                {t("cart.continueShopping")}
              </Link>
            </section>
          ) : (
            /* Main Cart Layout */
            <div className="grid gap-6 xl:grid-cols-[1fr_380px] xl:gap-8">
              <section className="space-y-6" data-testid="cart-items">
                {activeValidationLoading ? (
                  <section className="rounded-[1.75rem] border border-[var(--border)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
                    {t("cart.checkingLatest")}
                  </section>
                ) : null}

                {activeValidationError ? (
                  <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
                    <p>{activeValidationError}</p>
                    <button
                      type="button"
                      onClick={() => setValidationRequestKey((current) => current + 1)}
                      className="public-button-secondary mt-3 px-4 py-2 text-sm"
                      data-testid="cart-validation-retry"
                    >
                      {t("cart.retryValidation")}
                    </button>
                  </section>
                ) : null}

                {hasBlockingIssues ? (
                  <section
                    className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm"
                    data-testid="cart-validation-banner"
                  >
                    {t("cart.blockingBanner")}
                  </section>
                ) : null}

                {hasPriceChanges ? (
                  <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 shadow-sm">
                    {t("cart.priceChangedBanner")}
                  </section>
                ) : null}

                {shopGroups.map((group) => (
                  <section
                    key={group.shopId}
                    className="cart-panel space-y-5"
                    data-testid="cart-shop-group"
                  >
                    {/* Shop Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)] text-sm text-[var(--brand-primary-dark)]">
                          🏪
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                            {t("cart.shop")}
                          </p>
                          <h2 className="text-base font-bold text-[var(--foreground)]">
                            {group.shopName}
                          </h2>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                          {t("cart.shop")} {t("cart.grandTotal").toLowerCase()}
                        </p>
                        <p className="text-sm font-black text-[var(--brand-primary)]">
                          {group.subtotal.toFixed(2)} RUB
                        </p>
                      </div>
                    </div>

                    {/* Shop Group Items */}
                    <div className="space-y-4">
                      {group.items.map((item) => {
                        const key = cartItemKey(item.productId, item.variantId);
                        const validated = validationMap.get(key);
                        const status = validated?.status ?? "OK";
                        const canAdjust = canAdjustValidatedQuantity(status);
                        const resolvedMax =
                          validated?.trackInventory && validated.maxQuantity > 0
                            ? validated.maxQuantity
                            : item.trackInventory
                              ? item.availableQuantity
                              : undefined;
                        const blocking = validated
                          ? isBlockingCartStatus(validated.status)
                          : false;
                        const displayUnitPrice =
                          validated?.unitPrice ?? Number(item.unitPrice || 0);
                        const localUnitPrice = Number(item.unitPrice || 0);
                        const displayLineTotal =
                          validated?.lineTotal ?? localUnitPrice * item.quantity;

                        return (
                          <article
                            key={key}
                            className="cart-line-item grid grid-cols-1 gap-4 p-4 sm:grid-cols-[100px_minmax(0,1fr)] lg:grid-cols-[100px_minmax(0,1fr)_180px_110px]"
                          >
                            {/* Product Image */}
                            <div className="relative aspect-square overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#fdf2fc_0%,#fbf5fa_100%)] border border-[var(--brand-primary)]/8">
                              <FallbackImage
                                src={validated?.imageUrl ?? item.imageUrl}
                                alt={validated?.productName ?? item.productName}
                                className="h-full w-full object-cover"
                                testId={`cart-item-image-${item.productId}-${item.variantId}`}
                              />
                            </div>

                            {/* Title & Shop Details */}
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-bold text-[var(--foreground)] leading-snug hover:text-[var(--brand-primary)] transition">
                                {validated?.productName ?? item.productName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[var(--muted)]">
                                {validated?.variantName || item.variantName ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                    {validated?.variantName ?? item.variantName}
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-[var(--brand-primary-soft)] px-2 py-0.5 font-semibold text-[var(--brand-primary-dark)]">
                                  {validated?.shopName ?? item.shopName}
                                </span>
                              </div>

                              {validated ? (
                                <div
                                  className={`mt-3 rounded-2xl border px-3 py-2 text-xs ${getValidationTone(validated.status)}`}
                                  data-testid={`cart-item-validation-${item.productId}-${item.variantId}`}
                                >
                                  <p>
                                    {getValidationMessage({
                                      status: validated.status,
                                      productName: validated.productName,
                                      variantName: validated.variantName,
                                      currentStock: validated.currentStock,
                                      maxQuantity: validated.maxQuantity,
                                      requestedQuantity: validated.requestedQuantity,
                                      unitPrice: validated.unitPrice,
                                      localUnitPrice,
                                    }, t)}
                                  </p>
                                  <span className="block max-h-px overflow-hidden text-[1px] leading-none opacity-0 select-none">
                                    {getValidationAutomationMessage({
                                      status: validated.status,
                                      productName: validated.productName,
                                      variantName: validated.variantName,
                                      maxQuantity: validated.maxQuantity,
                                      requestedQuantity: validated.requestedQuantity,
                                      unitPrice: validated.unitPrice,
                                      localUnitPrice,
                                    })}
                                  </span>
                                  <div className="mt-2.5 flex flex-wrap gap-2">
                                    {validated.status === "QUANTITY_EXCEEDS_STOCK" &&
                                    validated.maxQuantity > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          patchItem(item.productId, item.variantId, {
                                            availableQuantity: validated.maxQuantity,
                                            trackInventory: validated.trackInventory,
                                          });
                                          updateQuantity(
                                            item.productId,
                                            item.variantId,
                                            validated.maxQuantity,
                                          );
                                        }}
                                        className="public-button-secondary px-3 py-1.5 text-[11px] cursor-pointer"
                                        data-testid={`cart-validation-set-max-${item.productId}-${item.variantId}`}
                                      >
                                        {t("cart.setToMax")}
                                      </button>
                                    ) : null}
                                    {validated.status === "PRICE_CHANGED" ? (
                                      <button
                                        type="button"
                                        onClick={() => acceptNewPrice(item, validated)}
                                        className="public-button-secondary px-3 py-1.5 text-[11px] cursor-pointer"
                                        data-testid={`cart-validation-accept-price-${item.productId}-${item.variantId}`}
                                      >
                                        {t("cart.acceptNewPrice")}
                                      </button>
                                    ) : null}
                                    {validated.status !== "OK" ? (
                                      <button
                                        type="button"
                                        onClick={() => removeItem(item.productId, item.variantId)}
                                        className="public-button-secondary px-3 py-1.5 text-[11px] cursor-pointer"
                                        data-testid={`cart-validation-remove-${item.productId}-${item.variantId}`}
                                      >
                                        {t("cart.remove")}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Quantity Controls & Stepper */}
                            <div className="flex flex-col gap-3 lg:min-h-[80px] lg:justify-between">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                                  {t("cart.quantity")}
                                </p>
                                <div className="cart-quantity-control mt-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(
                                        item.productId,
                                        item.variantId,
                                        item.quantity - 1,
                                      )
                                    }
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={t("cart.quantity")}
                                    disabled={!canAdjust || item.quantity <= 1}
                                  >
                                    -
                                  </button>
                                  <input
                                    value={item.quantity}
                                    min={1}
                                    max={resolvedMax}
                                    type="number"
                                    onChange={(event) =>
                                      updateQuantity(
                                        item.productId,
                                        item.variantId,
                                        Number(event.target.value),
                                      )
                                    }
                                    className="w-10 bg-transparent text-center text-xs font-bold text-gray-800 outline-none focus:outline-none focus:ring-0"
                                    data-testid="cart-quantity-input"
                                    disabled={!canAdjust}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(
                                        item.productId,
                                        item.variantId,
                                        item.quantity + 1,
                                      )
                                    }
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={t("cart.quantity")}
                                    disabled={!canAdjust || (resolvedMax !== undefined && item.quantity >= resolvedMax)}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.productId, item.variantId)}
                                className="mt-3 text-left text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>🗑</span>
                                <span>{t("cart.remove")}</span>
                              </button>
                              {blocking ? (
                                <p className="mt-2 text-xs text-rose-700 font-semibold">
                                  {t("cart.checkoutBlocked")}
                                </p>
                              ) : null}
                            </div>

                            {/* Price Presentation */}
                            <div className="flex flex-col items-start justify-between gap-2 lg:min-h-[80px] lg:items-end">
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                                {t("cart.grandTotal").split(" ")[1] ?? t("cart.grandTotal")}
                              </p>
                              <div className="mt-1 md:text-right">
                                <p className="text-xs font-medium text-[var(--muted)]">
                                  {t("cart.unit", {
                                    amount: formatMoneyNumber(displayUnitPrice) ?? displayUnitPrice,
                                  })}
                                </p>
                                {validated?.status === "PRICE_CHANGED" ? (
                                  <p className="mt-0.5 text-[10px] text-rose-600 line-through">
                                    {t("cart.was", {
                                      amount: formatMoneyNumber(localUnitPrice) ?? localUnitPrice,
                                    })}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-base font-black text-[var(--brand-primary-dark)]">
                                  {displayLineTotal.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </section>

              {/* Redesigned Premium Sticky Summary Card */}
              <aside className="cart-summary-card hidden h-fit space-y-5 xl:sticky xl:top-24 xl:block">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("cart.summary")}
                </p>
                <div className="space-y-3 border-y border-gray-100 py-4 text-sm font-medium">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>{t("cart.quantity")}</span>
                    <span className="font-semibold text-gray-900">
                      {items.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>{t("cart.shop")}s</span>
                    <span className="font-semibold text-gray-900">{shopGroups.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>{t("checkout.deliveries") || "Delivery"}</span>
                    <span className="text-emerald-600 font-semibold">{t("checkout.free") || "Free (Manual)"}</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-gray-800">{t("cart.grandTotal")}</span>
                  <div className="text-right">
                    <span className="text-gradient-primary text-2xl font-black tracking-tight">
                      {subtotal.toFixed(2)}
                    </span>
                    <span className="block text-[10px] font-bold text-[var(--muted)] mt-0.5">RUB</span>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-gray-400 font-medium">
                  {t("cart.snapshotDescription")}
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/checkout")}
                  disabled={checkoutDisabled}
                  className="public-button-primary inline-flex w-full justify-center px-5 py-3.5 text-sm font-bold shadow-[0_12px_28px_rgba(203,17,171,0.22)] active:scale-98 transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  data-testid="cart-checkout"
                >
                  {checkoutDisabled ? t("cart.resolveIssues") : t("cart.checkout")}
                </button>

                {/* Secure checkout trust signals */}
                <div className="rounded-2xl bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <span className="text-base">🛡️</span>
                    <span>{t("productDetail.safeCheckout") || "Secure Checkout"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                    <span className="text-base">🚀</span>
                    <span>{t("productDetail.fastShipping") || "Reliable Delivery"}</span>
                  </div>
                </div>
              </aside>

              <div className="fixed inset-x-3 bottom-3 z-40 xl:hidden">
                <div className="rounded-[1.75rem] border border-[var(--border)] bg-white/95 p-4 shadow-[0_16px_40px_rgba(203,17,171,0.16)] backdrop-blur supports-[padding:max(0px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t("cart.summary")}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {items.reduce((sum, item) => sum + item.quantity, 0)} {t("cart.quantity").toLowerCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[var(--brand-primary)]">
                        {subtotal.toFixed(2)}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        RUB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/checkout")}
                    disabled={checkoutDisabled}
                    className="public-button-primary mt-3 inline-flex w-full justify-center px-5 py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {checkoutDisabled ? t("cart.resolveIssues") : t("cart.checkout")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
