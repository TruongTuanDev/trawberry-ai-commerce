"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCustomerAddress } from "@/components/customer/account/customer-account-utils";
import {
  formatCustomerAddressComment,
  getCustomerAddressReadinessBadge,
  isCustomerAddressGeoReady,
} from "@/components/customer/account/customer-account-utils";
import { PaymentDetailsPanel } from "@/components/payments/payment-details-panel";
import { PublicShell } from "@/components/public/public-shell";
import { FallbackImage } from "@/components/ui/fallback-image";
import { getLocalizedErrorMessage } from "@/i18n/error-messages";
import { useI18n } from "@/i18n/use-i18n";
import {
  buildCartValidationPayload,
  buildValidationMap,
  cartItemKey,
  formatMoneyNumber,
  getValidationMessage,
  getValidationTone,
  isBlockingCartStatus,
} from "@/lib/cart-validation";
import {
  getCustomerAddresses,
  type CustomerAddress,
} from "@/lib/customer-api";
import {
  createCheckoutOrder,
  getPublicProduct,
  validatePublicCart,
  type CheckoutPaymentMethod,
  type CheckoutOrderResponse,
  type PublicCartValidationResponse,
} from "@/lib/public-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useAuthStore } from "@/stores/auth-store";
import { type CartItem, useCartStore } from "@/stores/cart-store";

const initialCustomer = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

type ShopCheckoutGroup = {
  shopId: string;
  shopName: string;
  items: CartItem[];
  subtotal: number;
};

const paymentMethodTranslationKeys: Partial<
  Record<CheckoutPaymentMethod, string>
> = {
  PREPAID_SELLER_QR: "checkout.prepaidSellerQrLabel",
  PAY_ON_DELIVERY_SELLER_QR: "checkout.podSellerQrLabel",
  DEPOSIT_THEN_DELIVERY_PAYMENT: "checkout.depositLabel",
};

function groupItemsByShop(
  items: CartItem[],
  lineTotals: Map<string, number>,
  shopNames: Map<string, string>,
): ShopCheckoutGroup[] {
  const groups = new Map<string, ShopCheckoutGroup>();
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

export function CheckoutPageClient({
  initialProductId,
  initialVariantId,
  initialQuantity,
}: {
  initialProductId: string | null;
  initialVariantId: string | null;
  initialQuantity: number;
}) {
  const { t } = useI18n("customer");
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const hydrateCart = useCartStore((state) => state.hydrate);
  const addItem = useCartStore((state) => state.addItem);
  const patchItem = useCartStore((state) => state.patchItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const authUser = useAuthStore((state) => state.customerUser);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const refreshRole = useAuthStore((state) => state.refreshRole);
  const [paymentMethod, setPaymentMethod] =
    useState<CheckoutPaymentMethod>("PREPAID_SELLER_QR");
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(Boolean(initialProductId));
  const { run: runCheckout, isRunning: submitting } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CheckoutOrderResponse | null>(null);
  const [validation, setValidation] = useState<PublicCartValidationResponse | null>(
    null,
  );
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationRequestKey, setValidationRequestKey] = useState(0);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const formatPaymentMethodLabel = (
    method: string | null | undefined,
    fallbackLabel: string | null | undefined,
  ) => {
    if (method && method in paymentMethodTranslationKeys) {
      return t(
        paymentMethodTranslationKeys[method as CheckoutPaymentMethod] as string,
      );
    }

    return fallbackLabel ?? method ?? t("common.unknown");
  };

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

  useEffect(() => {
    hydrateAuth();
    void refreshRole("customer");
  }, [hydrateAuth, refreshRole]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (authUser?.role !== "CUSTOMER") {
        if (mounted) {
          setSavedAddresses([]);
          setSelectedAddressId("");
        }
        return;
      }

      try {
        const response = await getCustomerAddresses();
        if (!mounted) {
          return;
        }

        setSavedAddresses(response.items);
        const preferredAddress =
          response.items.find((item) => item.isDefault && item.yandexManualReady) ??
          response.items.find((item) => item.yandexManualReady) ??
          response.items.find((item) => item.isDefault) ??
          response.items[0];
        setSelectedAddressId(preferredAddress?.id ?? "");
      } catch {
        if (mounted) {
          setSavedAddresses([]);
          setSelectedAddressId("");
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [authUser?.role]);

  const customerForm = {
    fullName:
      customer.fullName ||
      (authUser?.role === "CUSTOMER" ? authUser.fullName ?? "" : ""),
    phone:
      customer.phone ||
      (authUser?.role === "CUSTOMER" ? authUser.phone ?? "" : ""),
    email:
      customer.email || (authUser?.role === "CUSTOMER" ? authUser.email : ""),
    address: customer.address,
    note: customer.note,
  };
  const customerRequiresSavedAddress = authUser?.role === "CUSTOMER";
  const selectedSavedAddress =
    savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const selectedAddressBadge = selectedSavedAddress
    ? getCustomerAddressReadinessBadge(selectedSavedAddress)
    : null;
  const hasReadySavedAddress = savedAddresses.some(
    (address) => address.yandexManualReady,
  );
  const requiresDeliveryReadyAddress =
    customerRequiresSavedAddress &&
    (!selectedSavedAddress || !selectedSavedAddress.yandexManualReady);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!initialProductId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const product = await getPublicProduct(initialProductId);
        if (!mounted) return;
        const variant =
          product.variants.find((entry) => entry.id === initialVariantId) ??
          product.variants.find((entry) => entry.inStock) ??
          product.variants[0];
        if (variant?.inStock && variant.price) {
          addItem(product, variant, initialQuantity);
        }
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load checkout product.",
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
  }, [addItem, initialProductId, initialQuantity, initialVariantId]);

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
      } catch (validationIssue) {
        if (!mounted) {
          return;
        }
        setValidation(null);
        setValidationError(
          validationIssue instanceof Error
            ? validationIssue.message
            : "Unable to validate checkout items right now.",
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
        const validated = validationMap.get(
          cartItemKey(item.productId, item.variantId),
        );
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
        const validated = validationMap.get(
          cartItemKey(item.productId, item.variantId),
        );
        return [item.shopId, validated?.shopName ?? item.shopName] as const;
      }),
    );
  }, [items, validationMap]);
  const shopGroups = useMemo(
    () => groupItemsByShop(items, lineTotals, shopNames),
    [items, lineTotals, shopNames],
  );
  const subtotal =
    activeValidation?.summary.subtotal ??
    items.reduce(
      (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
      0,
    );
  const hasBlockingIssues =
    activeValidation?.items.some((item) => isBlockingCartStatus(item.status)) ??
    false;
  const hasPriceChanges = (activeValidation?.summary.changedCount ?? 0) > 0;
  const submitDisabled =
    submitting ||
    activeValidationLoading ||
    Boolean(activeValidationError) ||
    hasBlockingIssues ||
    requiresDeliveryReadyAddress;

  const handleSubmit = async () => {
    if (!items.length) {
      setError(
        getLocalizedErrorMessage({
          role: "customer",
          error: { message: "VALIDATION_ERROR" },
        }),
      );
      return;
    }
    if (customerRequiresSavedAddress && !selectedSavedAddress) {
      setError(t("errors.CUSTOMER_ADDRESS_REQUIRED"));
      return;
    }
    if (
      customerRequiresSavedAddress &&
      selectedSavedAddress &&
      !selectedSavedAddress.yandexManualReady
    ) {
      setError(t("errors.CUSTOMER_ADDRESS_NOT_YANDEX_READY"));
      return;
    }
    if (
      !customerRequiresSavedAddress &&
      (!customerForm.fullName.trim() ||
        !customerForm.phone.trim() ||
        !customerForm.address.trim())
    ) {
      setError(t("checkout.fullNamePhoneAddressRequired"));
      return;
    }

    setError(null);

    await runCheckout({
      action: async () => {
        const latestValidation = await validatePublicCart(
          buildCartValidationPayload(items),
        );
        setValidation(latestValidation);
        setValidationError(null);

        if (latestValidation.summary.invalidCount > 0) {
          throw new Error(
            "Some cart items changed on the server. Review the validation panel or go back to cart before submitting checkout.",
          );
        }

        const changedItems = latestValidation.items.filter(
          (item) => item.status === "PRICE_CHANGED" && item.unitPrice !== null,
        );
        if (changedItems.length > 0) {
          for (const item of changedItems) {
            if (!item.variantId || item.unitPrice === null) {
              continue;
            }
            patchItem(item.productId, item.variantId, {
              unitPrice: String(item.unitPrice),
              availableQuantity: item.maxQuantity,
              trackInventory: item.trackInventory,
              productName:
                item.productName ??
                items.find(
                  (entry) =>
                    entry.productId === item.productId &&
                    entry.variantId === item.variantId,
                )?.productName,
              imageUrl:
                item.imageUrl ??
                items.find(
                  (entry) =>
                    entry.productId === item.productId &&
                    entry.variantId === item.variantId,
                )?.imageUrl,
              variantName:
                item.variantName ??
                items.find(
                  (entry) =>
                    entry.productId === item.productId &&
                    entry.variantId === item.variantId,
                )?.variantName,
              shopName:
                item.shopName ??
                items.find(
                  (entry) =>
                    entry.productId === item.productId &&
                    entry.variantId === item.variantId,
                )?.shopName,
            });
          }
          throw new Error(
            "Server prices changed. The checkout summary was refreshed with the latest price. Review the total and submit again.",
          );
        }

        const created = await createCheckoutOrder({
          shopId: items[0].shopId,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          customer: {
            fullName:
              customerRequiresSavedAddress ? "" : customerForm.fullName.trim(),
            phone:
              customerRequiresSavedAddress ? "" : customerForm.phone.trim(),
            email: customerForm.email.trim() || undefined,
            address:
              customerRequiresSavedAddress ? "" : customerForm.address.trim(),
            note: customerForm.note.trim() || undefined,
            latitude: selectedSavedAddress?.latitude
              ? Number(selectedSavedAddress.latitude)
              : undefined,
            longitude: selectedSavedAddress?.longitude
              ? Number(selectedSavedAddress.longitude)
              : undefined,
          },
          addressId: selectedSavedAddress?.id,
          paymentMethod,
        });
        clearCart();
        setOrder(created);
        return created;
      },
      successMessage: t("checkout.orderCreatedSuccess"),
      errorMessage: t("checkout.orderCreateFailed"),
    }).catch((submitIssue) => {
      setError(submitIssue.message);
    });
  };

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-sm text-[var(--muted)]">
              {t("checkout.loading")}
            </section>
          ) : order ? (
            <section
              className="card-panel rounded-[2.25rem] px-6 py-8 sm:px-8"
              data-testid="checkout-confirmation"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                {t("checkout.created")}
              </p>
              <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold">
                {t("checkout.confirmation")}
              </h1>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label={t("checkout.orders")} value={String(order.orders.length)} />
                <Metric label={t("checkout.receipt")} value={order.checkoutCode} />
                <Metric label={t("checkout.grandTotal")} value={order.grandTotal} />
                <Metric label={t("checkout.firstOrder")} value={order.orderCode} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/orders/receipt/${order.checkoutCode}?phone=${encodeURIComponent(order.customerPhone)}`}
                  className="public-button-primary px-5 py-3 text-sm"
                  data-testid="checkout-receipt-link"
                >
                  {t("checkout.openReceipt")}
                </Link>
                {authUser?.role === "CUSTOMER" ? (
                  <Link
                    href={`/customer/orders/${order.checkoutCode}`}
                    className="public-button-secondary px-5 py-3 text-sm"
                    data-testid="checkout-customer-order-link"
                  >
                    {t("checkout.saveInOrders")}
                  </Link>
                ) : null}
              </div>
              <div className="mt-6 grid gap-4" data-testid="checkout-orders">
                {order.orders.map((splitOrder, index) => (
                  <article
                    key={splitOrder.orderId}
                    className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-[1fr_auto]"
                    data-testid="checkout-order-card"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {splitOrder.shopName}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {t("orderTrack.orderCode")}{" "}
                        <span className="font-semibold text-[var(--foreground)]">
                          {splitOrder.orderCode}
                        </span>{" "}
                        - {t("orderTrack.orderId")} {splitOrder.orderId} - {t("checkout.itemsCountText", { count: splitOrder.itemsCount })} -{" "}
                        {splitOrder.totalAmount}
                      </p>
                      {splitOrder.paymentMethodLabel || splitOrder.paymentMethod ? (
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          {formatPaymentMethodLabel(
                            splitOrder.paymentMethod,
                            splitOrder.paymentMethodLabel,
                          )}
                        </p>
                      ) : null}
                      <PaymentDetailsPanel
                        details={splitOrder.paymentDetails}
                        title={
                          splitOrder.paymentMethod ===
                          "PAY_ON_DELIVERY_SELLER_QR"
                            ? t("checkout.payShopAfterDelivery", { shopName: splitOrder.shopName })
                            : t("checkout.payShopDirectly", { shopName: splitOrder.shopName })
                        }
                        className="mt-4"
                        role="customer"
                      />
                    </div>
                    <div className="flex items-center">
                      <Link
                        href={`${splitOrder.trackingPath}?phone=${encodeURIComponent(order.customerPhone)}`}
                        className="public-button-primary inline-flex px-5 py-3 text-sm"
                        data-testid={
                          index === 0
                            ? "confirmation-track-link"
                            : "confirmation-track-link-extra"
                        }
                      >
                        {t("checkout.openTracking")}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : !items.length ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">
                {t("checkout.empty")}
              </p>
              <Link
                href="/products"
                className="public-button-primary mt-5 inline-flex px-5 py-3 text-sm"
              >
                {t("checkout.openMarketplace")}
              </Link>
            </section>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
              <section className="space-y-6">
                {error ? (
                  <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
                    {error}
                  </div>
                ) : null}

                {activeValidationError || hasBlockingIssues || hasPriceChanges ? (
                  <section
                    className={`rounded-[2rem] border px-5 py-5 ${activeValidationError || hasBlockingIssues ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}
                    data-testid="checkout-validation-panel"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                          Checkout preflight
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                          Review server-side cart changes before submitting
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setValidationRequestKey((current) => current + 1)}
                          className="public-button-secondary px-4 py-2 text-sm"
                        >
                          Retry preflight
                        </button>
                        <Link
                          href="/cart"
                          className="public-button-secondary inline-flex px-4 py-2 text-sm"
                          data-testid="checkout-validation-back-to-cart"
                        >
                          Back to cart
                        </Link>
                      </div>
                    </div>
                    {activeValidationError ? (
                      <p className="mt-4 text-sm text-rose-700">{activeValidationError}</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {activeValidation?.items
                          .filter((item) => item.status !== "OK")
                          .map((item) => (
                            <div
                              key={cartItemKey(item.productId, item.variantId)}
                              className={`rounded-2xl border px-3 py-3 text-sm ${getValidationTone(item.status)}`}
                            >
                              {getValidationMessage({
                                status: item.status,
                                productName: item.productName,
                                variantName: item.variantName,
                                currentStock: item.currentStock,
                                maxQuantity: item.maxQuantity,
                                requestedQuantity: item.requestedQuantity,
                                unitPrice: item.unitPrice,
                                localUnitPrice: Number(
                                  items.find(
                                    (entry) =>
                                      entry.productId === item.productId &&
                                      entry.variantId === item.variantId,
                                  )?.unitPrice ?? 0,
                                ),
                              }, t)}
                            </div>
                          ))}
                      </div>
                    )}
                  </section>
                ) : null}

                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("checkout.customerInfo")}
                  </p>
                  <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold">
                    {t("checkout.deliveryDetails")}
                  </h1>
                  <div className="mt-6 grid gap-4">
                    {customerRequiresSavedAddress && requiresDeliveryReadyAddress ? (
                      <div
                        className={`rounded-[1.5rem] border px-4 py-4 ${hasReadySavedAddress ? "border-sky-200 bg-sky-50" : "border-rose-200 bg-rose-50"}`}
                        data-testid="checkout-address-required-banner"
                      >
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {t("checkout.addressRequiredTitle")}
                        </p>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {t("checkout.addressRequiredDescription")}
                        </p>
                        <div className="mt-3">
                          <Link
                            href="/customer/account/addresses"
                            className="public-button-secondary inline-flex px-4 py-2 text-sm"
                            data-testid="checkout-configure-addresses"
                          >
                            {t("checkout.configureAddress")}
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    {customerRequiresSavedAddress && savedAddresses.length ? (
                      <Field label={t("checkout.savedAddresses")}>
                        <select
                          value={selectedAddressId}
                          onChange={(event) => setSelectedAddressId(event.target.value)}
                          className="public-input"
                          data-testid="checkout-saved-address-select"
                        >
                          {savedAddresses.map((address) => (
                            <option key={address.id} value={address.id}>
                              {address.fullName} - {address.city}
                              {address.isDefault ? " (default)" : ""}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}

                    {selectedSavedAddress ? (
                      <>
                        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {selectedSavedAddress.fullName}
                            </p>
                            {selectedSavedAddress.isDefault ? (
                              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                                {t("checkout.default")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {selectedSavedAddress.phone}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                            {formatCustomerAddress(selectedSavedAddress)}
                          </p>
                          {formatCustomerAddressComment(selectedSavedAddress) ? (
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              {formatCustomerAddressComment(selectedSavedAddress)}
                            </p>
                          ) : null}
                          <p
                            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${selectedAddressBadge?.tone ?? "bg-amber-100 text-amber-700"}`}
                            data-testid="checkout-address-geo-status"
                          >
                            {selectedAddressBadge?.label ?? "Coordinates missing"}
                          </p>
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            {selectedSavedAddress.yandexApiReady
                              ? t("checkout.yandexReady")
                              : selectedSavedAddress.yandexManualReady
                                ? t("checkout.manualDeliveryAllowed")
                                : t("checkout.structuredAddressMissing")}
                          </p>
                          {!selectedSavedAddress.yandexManualReady &&
                          selectedSavedAddress.missingYandexFields.length ? (
                            <p className="mt-2 text-xs text-rose-700" data-testid="checkout-address-missing-details">
                              {t("checkout.missingDetails", { fields: selectedSavedAddress.missingYandexFields.join(", ") })}
                            </p>
                          ) : null}
                          {!isCustomerAddressGeoReady(selectedSavedAddress) ? (
                            <p className="mt-2 text-xs text-amber-700">
                              {t("checkout.coordinatesMissing")}
                            </p>
                          ) : null}
                        </div>
                        <Field label={t("checkout.email")}>
                          <input
                            value={customerForm.email}
                            onChange={(event) =>
                              setCustomer((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            className="public-input"
                            data-testid="checkout-email"
                          />
                        </Field>
                      </>
                    ) : customerRequiresSavedAddress ? null : (
                      <>
                        <Field label={t("checkout.fullName")}>
                          <input
                            value={customerForm.fullName}
                            onChange={(event) =>
                              setCustomer((current) => ({
                                ...current,
                                fullName: event.target.value,
                              }))
                            }
                            className="public-input"
                            data-testid="checkout-full-name"
                          />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label={t("checkout.phone")}>
                            <input
                              value={customerForm.phone}
                              onChange={(event) =>
                                setCustomer((current) => ({
                                  ...current,
                                  phone: event.target.value,
                                }))
                              }
                              className="public-input"
                              data-testid="checkout-phone"
                            />
                          </Field>
                          <Field label={t("checkout.email")}>
                            <input
                              value={customerForm.email}
                              onChange={(event) =>
                                setCustomer((current) => ({
                                  ...current,
                                  email: event.target.value,
                                }))
                              }
                              className="public-input"
                              data-testid="checkout-email"
                            />
                          </Field>
                        </div>
                        <Field label={t("checkout.address")}>
                          <textarea
                            value={customer.address}
                            onChange={(event) =>
                              setCustomer((current) => ({
                                ...current,
                                address: event.target.value,
                              }))
                            }
                            rows={4}
                            className="public-input min-h-32"
                            data-testid="checkout-address"
                          />
                        </Field>
                      </>
                    )}

                    <Field label={t("checkout.note")}>
                      <textarea
                        value={customer.note}
                        onChange={(event) =>
                          setCustomer((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        rows={3}
                        className="public-input min-h-24"
                        data-testid="checkout-note"
                      />
                    </Field>
                  </div>
                </section>
              </section>

              <section className="space-y-6">
                <section className="card-panel rounded-[2rem] px-6 py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("checkout.orderSummary")}
                  </p>
                  {activeValidationLoading ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {t("checkout.checkingLatest")}
                    </p>
                  ) : null}
                  <div className="mt-5 space-y-4" data-testid="checkout-order-items">
                    {shopGroups.map((group) => (
                      <section
                        key={group.shopId}
                        className="space-y-3 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-3"
                        data-testid="checkout-shop-group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {group.shopName}
                          </p>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {group.subtotal.toFixed(2)}
                          </p>
                        </div>
                        {group.items.map((item) => {
                          const validated = validationMap.get(
                            cartItemKey(item.productId, item.variantId),
                          );
                          const displayUnitPrice =
                            validated?.unitPrice ?? Number(item.unitPrice || 0);
                          const localUnitPrice = Number(item.unitPrice || 0);
                          return (
                            <article
                              key={`${item.productId}:${item.variantId}`}
                              className="grid grid-cols-[64px_1fr] gap-3 rounded-[1rem] border border-[var(--border)] bg-white p-3"
                            >
                              <FallbackImage
                                src={validated?.imageUrl ?? item.imageUrl}
                                alt={validated?.productName ?? item.productName}
                                className="h-16 w-16 rounded-xl object-cover"
                              />
                              <div className="min-w-0 text-sm">
                                <p className="font-semibold text-[var(--foreground)]">
                                  {validated?.productName ?? item.productName}
                                </p>
                                <p className="mt-1 text-[var(--muted)]">
                                  {validated?.variantName ?? item.variantName}
                                </p>
                                <p className="mt-1 text-[var(--muted)]">
                                  Qty {item.quantity} x {formatMoneyNumber(displayUnitPrice)}
                                </p>
                                {validated?.status === "PRICE_CHANGED" ? (
                                  <p className="mt-1 text-xs text-amber-700">
                                    Old snapshot {formatMoneyNumber(localUnitPrice)}
                                  </p>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </section>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)]">{t("checkout.subtotal")}</span>
                    <span className="text-gradient-primary text-xl font-bold">
                      {subtotal.toFixed(2)}
                    </span>
                  </div>
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("checkout.paymentMethod")}
                  </p>
                  <div className="mt-4 grid gap-3">
                    <PaymentOption
                      label={t("checkout.prepaidSellerQrLabel")}
                      description={t("checkout.prepaidSellerQrDescription")}
                      checked={paymentMethod === "PREPAID_SELLER_QR"}
                      onChange={() => setPaymentMethod("PREPAID_SELLER_QR")}
                      testId="payment-method-prepaid-seller-qr"
                    />
                    <PaymentOption
                      label={t("checkout.podSellerQrLabel")}
                      description={t("checkout.podSellerQrDescription")}
                      checked={paymentMethod === "PAY_ON_DELIVERY_SELLER_QR"}
                      onChange={() =>
                        setPaymentMethod("PAY_ON_DELIVERY_SELLER_QR")
                      }
                      testId="payment-method-pay-on-delivery-seller-qr"
                    />
                    <PaymentOption
                      label={t("checkout.depositLabel")}
                      description={t("checkout.depositDescription")}
                      checked={paymentMethod === "DEPOSIT_THEN_DELIVERY_PAYMENT"}
                      onChange={() =>
                        setPaymentMethod("DEPOSIT_THEN_DELIVERY_PAYMENT")
                      }
                      testId="payment-method-deposit-then-delivery"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={submitDisabled}
                    onClick={() => void handleSubmit()}
                    className="public-button-primary mt-5 w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="checkout-submit"
                  >
                    {submitting
                      ? t("checkout.creatingOrder")
                      : requiresDeliveryReadyAddress
                        ? t("checkout.configureAddressFirst")
                      : hasBlockingIssues
                        ? t("cart.resolveIssues")
                        : t("checkout.createOrder")}
                  </button>
                  <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                    {t("checkout.preflightDescription")}
                  </p>
                </section>
              </section>
            </div>
          )}
        </div>
      </main>
    </PublicShell>
  );
}

function PaymentOption({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  testId: string;
}) {
  return (
    <label
      className={`cursor-pointer rounded-[1.35rem] border px-4 py-4 transition-all duration-200 ${checked ? "border-[var(--accent)] bg-[var(--accent-soft)]/30 shadow-[0_4px_14px_rgba(203,17,171,0.1)]" : "border-[var(--border)] bg-white/70 hover:border-[var(--muted)]"}`}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onChange}
        className="sr-only"
        data-testid={testId}
      />
      <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
