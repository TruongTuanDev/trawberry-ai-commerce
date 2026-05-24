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
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="public-button-secondary inline-flex px-4 py-2 text-sm">
              {t("cart.backToProducts")}
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
                className="public-button-secondary px-4 py-2 text-sm"
              >
                {t("cart.clearCart")}
              </button>
            ) : null}
          </div>

          <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("publicHeader.cart")}
            </p>
            <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold">
              {t("cart.title")}
            </h1>
          </section>

          {!items.length ? (
            <section
              className="card-panel rounded-[2rem] px-6 py-10 text-center sm:px-10"
              data-testid="cart-empty-state"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("publicHeader.cart")}
              </p>
              <h2 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">
                {t("cart.emptyTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
                {t("cart.emptyDescription")}
              </p>
              <Link
                href="/products"
                className="public-button-primary mt-6 inline-flex px-5 py-3 text-sm"
                data-testid="cart-empty-continue-shopping"
              >
                {t("cart.continueShopping")}
              </Link>
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="space-y-4" data-testid="cart-items">
                {activeValidationLoading ? (
                  <section className="rounded-[1.75rem] border border-[var(--border)] bg-white px-5 py-4 text-sm text-[var(--muted)]">
                    {t("cart.checkingLatest")}
                  </section>
                ) : null}

                {activeValidationError ? (
                  <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
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
                    className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
                    data-testid="cart-validation-banner"
                  >
                    {t("cart.blockingBanner")}
                  </section>
                ) : null}

                {hasPriceChanges ? (
                  <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                    {t("cart.priceChangedBanner")}
                  </section>
                ) : null}

                {shopGroups.map((group) => (
                  <section
                    key={group.shopId}
                    className="space-y-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-4"
                    data-testid="cart-shop-group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          {t("cart.shop")}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                          {group.shopName}
                        </h2>
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {group.subtotal.toFixed(2)}
                      </p>
                    </div>
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
                          className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[96px_1fr_220px_120px]"
                        >
                          <div className="overflow-hidden rounded-2xl bg-[var(--panel-strong)]">
                            <FallbackImage
                              src={validated?.imageUrl ?? item.imageUrl}
                              alt={validated?.productName ?? item.productName}
                              className="h-24 w-full object-cover"
                              testId={`cart-item-image-${item.productId}-${item.variantId}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {validated?.productName ?? item.productName}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {validated?.variantName ?? item.variantName}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {validated?.shopName ?? item.shopName}
                            </p>
                            {validated ? (
                              <div
                                className={`mt-3 rounded-2xl border px-3 py-2 text-sm ${getValidationTone(validated.status)}`}
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
                                <div className="mt-3 flex flex-wrap gap-2">
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
                                      className="public-button-secondary px-3 py-2 text-xs"
                                      data-testid={`cart-validation-set-max-${item.productId}-${item.variantId}`}
                                    >
                                      {t("cart.setToMax")}
                                    </button>
                                  ) : null}
                                  {validated.status === "PRICE_CHANGED" ? (
                                    <button
                                      type="button"
                                      onClick={() => acceptNewPrice(item, validated)}
                                      className="public-button-secondary px-3 py-2 text-xs"
                                      data-testid={`cart-validation-accept-price-${item.productId}-${item.variantId}`}
                                    >
                                      {t("cart.acceptNewPrice")}
                                    </button>
                                  ) : null}
                                  {validated.status !== "OK" ? (
                                    <button
                                      type="button"
                                      onClick={() => removeItem(item.productId, item.variantId)}
                                      className="public-button-secondary px-3 py-2 text-xs"
                                      data-testid={`cart-validation-remove-${item.productId}-${item.variantId}`}
                                    >
                                      {t("cart.remove")}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                              {t("cart.quantity")}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    item.variantId,
                                    item.quantity - 1,
                                  )
                                }
                                className="public-button-secondary h-10 w-10"
                                aria-label={t("cart.quantity")}
                                disabled={!canAdjust}
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
                                className="public-input w-20 text-center"
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
                                className="public-button-secondary h-10 w-10"
                                aria-label={t("cart.quantity")}
                                disabled={!canAdjust}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="mt-3 text-sm font-semibold text-[var(--accent-strong)] transition-colors hover:text-[var(--accent)]"
                            >
                              {t("cart.remove")}
                            </button>
                            {blocking ? (
                              <p className="mt-2 text-xs text-rose-700">
                                {t("cart.checkoutBlocked")}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-sm md:text-right">
                            <p className="text-[var(--muted)]">
                              {t("cart.unit", {
                                amount: formatMoneyNumber(displayUnitPrice) ?? displayUnitPrice,
                              })}
                            </p>
                            {validated?.status === "PRICE_CHANGED" ? (
                              <p className="mt-1 text-xs text-[var(--muted)] line-through">
                                {t("cart.was", {
                                  amount: formatMoneyNumber(localUnitPrice) ?? localUnitPrice,
                                })}
                              </p>
                            ) : null}
                            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                              {displayLineTotal.toFixed(2)}
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ))}
              </section>

              <aside className="card-panel h-fit rounded-[2rem] px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("cart.summary")}
                </p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{t("cart.grandTotal")}</span>
                  <span className="text-gradient-primary text-xl font-bold">
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                  {t("cart.snapshotDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/checkout")}
                  disabled={checkoutDisabled}
                  className="public-button-primary mt-5 inline-flex w-full justify-center px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="cart-checkout"
                >
                  {checkoutDisabled ? t("cart.resolveIssues") : t("cart.checkout")}
                </button>
              </aside>
            </div>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
