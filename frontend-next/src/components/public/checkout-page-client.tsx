"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import {
  createCheckoutOrder,
  getPublicProduct,
  type CheckoutOrderResponse,
} from "@/lib/public-api";
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

function groupItemsByShop(items: CartItem[]): ShopCheckoutGroup[] {
  const groups = new Map<string, ShopCheckoutGroup>();
  for (const item of items) {
    const existing = groups.get(item.shopId) ?? {
      shopId: item.shopId,
      shopName: item.shopName,
      items: [],
      subtotal: 0,
    };
    existing.items.push(item);
    existing.subtotal += Number(item.unitPrice || 0) * item.quantity;
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
  const items = useCartStore((state) => state.items);
  const hydrateCart = useCartStore((state) => state.hydrate);
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const [paymentMethod, setPaymentMethod] = useState<
    "MANUAL_TRANSFER" | "CASH_ON_DELIVERY"
  >("MANUAL_TRANSFER");
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(Boolean(initialProductId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CheckoutOrderResponse | null>(null);
  const shopGroups = useMemo(() => groupItemsByShop(items), [items]);
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.unitPrice || 0) * item.quantity,
        0,
      ),
    [items],
  );

  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);

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
        if (mounted)
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load checkout product.",
          );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [addItem, initialProductId, initialQuantity, initialVariantId]);

  const handleSubmit = async () => {
    if (!items.length) {
      setError("Cart is empty.");
      return;
    }
    if (
      !customer.fullName.trim() ||
      !customer.phone.trim() ||
      !customer.address.trim()
    ) {
      setError("Full name, phone, and address are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createCheckoutOrder({
        shopId: items[0].shopId,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        customer: {
          fullName: customer.fullName.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim() || undefined,
          address: customer.address.trim(),
          note: customer.note.trim() || undefined,
        },
        paymentMethod,
      });
      clearCart();
      setOrder(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          {loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-sm text-[var(--muted)]">
              Loading checkout...
            </section>
          ) : order ? (
            <section
              className="card-panel rounded-[2.25rem] px-6 py-8 sm:px-8"
              data-testid="checkout-confirmation"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Orders created
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">
                Confirmation
              </h1>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Orders" value={String(order.orders.length)} />
                <Metric label="Grand total" value={order.grandTotal} />
                <Metric label="First order" value={order.orderCode} />
                <Metric label="Status" value={order.status} />
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
                        Order code{" "}
                        <span className="font-semibold text-[var(--foreground)]">
                          {splitOrder.orderCode}
                        </span>{" "}
                        · ID {splitOrder.orderId} · {splitOrder.itemsCount} item(s) ·{" "}
                        {splitOrder.totalAmount}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                        {splitOrder.paymentInstructions ??
                          "This shop did not provide additional payment instructions."}
                      </p>
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
                        Open tracking
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : !items.length ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">
                Checkout needs cart items.
              </p>
              <Link
                href="/products"
                className="public-button-primary mt-5 inline-flex px-5 py-3 text-sm"
              >
                Open marketplace
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
                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Customer info
                  </p>
                  <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                    Delivery details
                  </h1>
                  <div className="mt-6 grid gap-4">
                    <Field label="Full name">
                      <input
                        value={customer.fullName}
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
                      <Field label="Phone">
                        <input
                          value={customer.phone}
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
                      <Field label="Email">
                        <input
                          value={customer.email}
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
                    <Field label="Address">
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
                    <Field label="Note">
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
                    Order summary
                  </p>
                  <div
                    className="mt-5 space-y-4"
                    data-testid="checkout-order-items"
                  >
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
                        {group.items.map((item) => (
                          <article
                            key={`${item.productId}:${item.variantId}`}
                            className="grid grid-cols-[64px_1fr] gap-3 rounded-[1rem] border border-[var(--border)] bg-white p-3"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                item.imageUrl ??
                                "https://placehold.co/120x120?text=No+Image"
                              }
                              alt={item.productName}
                              className="h-16 w-16 rounded-xl object-cover"
                            />
                            <div className="min-w-0 text-sm">
                              <p className="font-semibold text-[var(--foreground)]">
                                {item.productName}
                              </p>
                              <p className="mt-1 text-[var(--muted)]">
                                {item.variantName}
                              </p>
                              <p className="mt-1 text-[var(--muted)]">
                                Qty {item.quantity} x{" "}
                                {Number(item.unitPrice || 0).toFixed(2)}
                              </p>
                            </div>
                          </article>
                        ))}
                      </section>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)]">Subtotal</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {subtotal.toFixed(2)}
                    </span>
                  </div>
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Payment method
                  </p>
                  <div className="mt-4 grid gap-3">
                    <PaymentOption
                      label="Manual transfer"
                      checked={paymentMethod === "MANUAL_TRANSFER"}
                      onChange={() => setPaymentMethod("MANUAL_TRANSFER")}
                      testId="payment-method-manual-transfer"
                    />
                    <PaymentOption
                      label="Cash on delivery"
                      checked={paymentMethod === "CASH_ON_DELIVERY"}
                      onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
                      testId="payment-method-cod"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                    className="public-button-primary mt-5 w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="checkout-submit"
                  >
                    {submitting ? "Creating order..." : "Create order"}
                  </button>
                  <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                    The backend recalculates trusted totals from current variant
                    prices and stock before creating the order.
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
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  testId: string;
}) {
  return (
    <label
      className={`rounded-[1.35rem] border px-4 py-4 ${checked ? "border-[var(--accent)] bg-white" : "border-[var(--border)] bg-white/70"}`}
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
