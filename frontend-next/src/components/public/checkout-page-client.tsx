"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductGallery } from "@/components/public/product-gallery";
import { PublicShell } from "@/components/public/public-shell";
import { createCheckoutOrder, getPublicProduct, type CheckoutOrderResponse, type PublicProduct } from "@/lib/public-api";

const initialCustomer = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

const steps = [
  "Customer info",
  "Order summary",
  "Payment method",
  "Confirmation",
];

export function CheckoutPageClient({
  initialProductId,
  initialQuantity,
}: {
  initialProductId: string | null;
  initialQuantity: number;
}) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [paymentMethod, setPaymentMethod] = useState<"MANUAL_TRANSFER" | "CASH_ON_DELIVERY">("MANUAL_TRANSFER");
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(Boolean(initialProductId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CheckoutOrderResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!initialProductId) {
        setLoading(false);
        setProduct(null);
        return;
      }

      setLoading(true);
      try {
        const result = await getPublicProduct(initialProductId);
        if (!mounted) return;
        setProduct(result);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load product for checkout.");
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
  }, [initialProductId]);

  const previewTotal = useMemo(() => {
    if (!product?.price) return null;
    return (Number(product.price) * quantity).toFixed(2);
  }, [product?.price, quantity]);

  const handleSubmit = async () => {
    if (!product) {
      setError("Pick a product before creating an order.");
      return;
    }

    if (!customer.fullName.trim() || !customer.phone.trim() || !customer.address.trim()) {
      setError("Full name, phone, and address are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createCheckoutOrder({
        shopId: product.shop.id,
        items: [{ productId: product.id, quantity }],
        customer: {
          fullName: customer.fullName.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim() || undefined,
          address: customer.address.trim(),
          note: customer.note.trim() || undefined,
        },
        paymentMethod,
      });
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
          {!initialProductId ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-center">
              <p className="text-sm text-[var(--muted)]">Checkout needs a selected product.</p>
              <Link href="/products" className="public-button-primary mt-5 inline-flex px-5 py-3 text-sm">
                Open marketplace
              </Link>
            </section>
          ) : loading ? (
            <section className="card-panel rounded-[2rem] px-6 py-10 text-sm text-[var(--muted)]">Loading checkout...</section>
          ) : order ? (
            <section className="space-y-6">
              <div className="card-panel rounded-[2.25rem] px-6 py-8 sm:px-8">
                <div data-testid="checkout-confirmation">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Order created</p>
                <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">
                  Confirmation
                </h1>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Order code" value={order.orderCode} />
                  <Metric label="Order id" value={order.orderId} />
                  <Metric label="Status" value={order.status} />
                  <Metric label="Payment status" value={order.paymentStatus} />
                </div>
                <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">Payment instructions</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {order.paymentInstructions ?? "The shop did not provide additional payment instructions."}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                      Keep the order code <span className="font-semibold text-[var(--foreground)]">{order.orderCode}</span> and
                      phone <span className="font-semibold text-[var(--foreground)]">{order.customerPhone}</span> for future tracking.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Link href={`${order.trackingPath}?phone=${encodeURIComponent(order.customerPhone)}`} className="public-button-primary inline-flex px-5 py-3 text-sm" data-testid="confirmation-track-link">
                      Open tracking
                    </Link>
                  </div>
                </div>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="card-panel rounded-[2.25rem] px-6 py-6 sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Checkout flow</p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {steps.map((step, index) => (
                    <div key={step} className={`rounded-[1.35rem] border px-4 py-4 ${index < 3 ? "border-[var(--border)] bg-white" : "border-dashed border-[var(--border)] bg-[var(--panel)]"}`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Step {index + 1}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                <section className="space-y-6">
                  {error ? (
                    <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
                      {error}
                    </div>
                  ) : null}

                  <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer info</p>
                    <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
                      Delivery details
                    </h2>
                    <div className="mt-6 grid gap-4">
                      <Field label="Full name">
                        <input value={customer.fullName} onChange={(event) => setCustomer((current) => ({ ...current, fullName: event.target.value }))} className="public-input" data-testid="checkout-full-name" />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Phone">
                          <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="public-input" data-testid="checkout-phone" />
                        </Field>
                        <Field label="Email">
                          <input value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} className="public-input" data-testid="checkout-email" />
                        </Field>
                      </div>
                      <Field label="Address">
                        <textarea value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} rows={4} className="public-input min-h-32" data-testid="checkout-address" />
                      </Field>
                      <Field label="Note">
                        <textarea value={customer.note} onChange={(event) => setCustomer((current) => ({ ...current, note: event.target.value }))} rows={3} className="public-input min-h-24" data-testid="checkout-note" />
                      </Field>
                    </div>
                  </section>
                </section>

                <section className="space-y-6">
                  <section className="card-panel overflow-hidden rounded-[2rem]">
                    <div className="p-4">
                      <ProductGallery name={product?.name ?? "Checkout product"} images={product?.images ?? []} />
                    </div>
                    <div className="space-y-5 px-6 py-6 sm:px-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{product?.shop.name ?? "Marketplace shop"}</p>
                        <h2 className="mt-3 text-2xl font-bold text-[var(--foreground)]">{product?.name ?? "Product"}</h2>
                        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{product?.description ?? "No description provided."}</p>
                      </div>

                      <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                        <Metric label="Unit price" value={product?.price ?? "Unavailable"} />
                        <Metric label="Estimated total" value={previewTotal ?? "Calculated by backend"} />
                        <Field label="Quantity">
                          <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                            className="public-input"
                          />
                        </Field>
                      </div>

                      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Payment method</p>
                        <div className="mt-4 grid gap-3">
                          <label className={`rounded-[1.35rem] border px-4 py-4 ${paymentMethod === "MANUAL_TRANSFER" ? "border-[var(--accent)] bg-white" : "border-[var(--border)] bg-white/70"}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="MANUAL_TRANSFER"
                              checked={paymentMethod === "MANUAL_TRANSFER"}
                              onChange={() => setPaymentMethod("MANUAL_TRANSFER")}
                              className="sr-only"
                              data-testid="payment-method-manual-transfer"
                            />
                            <p className="text-sm font-semibold text-[var(--foreground)]">Manual transfer</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Upload proof later from order tracking if needed.</p>
                          </label>
                          <label className={`rounded-[1.35rem] border px-4 py-4 ${paymentMethod === "CASH_ON_DELIVERY" ? "border-[var(--accent)] bg-white" : "border-[var(--border)] bg-white/70"}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="CASH_ON_DELIVERY"
                              checked={paymentMethod === "CASH_ON_DELIVERY"}
                              onChange={() => setPaymentMethod("CASH_ON_DELIVERY")}
                              className="sr-only"
                              data-testid="payment-method-cod"
                            />
                            <p className="text-sm font-semibold text-[var(--foreground)]">Cash on delivery</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Payment stays `UNPAID` until delivery collection in this MVP.</p>
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={submitting || !product}
                        onClick={() => void handleSubmit()}
                        className="public-button-primary w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        data-testid="checkout-submit"
                      >
                        {submitting ? "Creating order..." : "Create order"}
                      </button>
                      <p className="text-xs leading-6 text-[var(--muted)]">
                        Estimated totals are for customer guidance only. The backend always recalculates the trusted order total from product price and quantity.
                      </p>
                    </div>
                  </section>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold break-words text-[var(--foreground)]">{value}</p>
    </div>
  );
}
