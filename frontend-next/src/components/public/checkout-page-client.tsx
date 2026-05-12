"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createCheckoutOrder, getPublicProduct, type CheckoutOrderResponse, type PublicProduct } from "@/lib/public-api";

const initialCustomer = {
  fullName: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

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

  if (!initialProductId) {
    return (
      <main className="grain-overlay flex min-h-screen items-center justify-center px-4 py-10">
        <div className="card-panel max-w-xl rounded-[2rem] px-6 py-8 text-center">
          <p className="text-sm text-[var(--muted)]">Checkout needs a selected product.</p>
          <Link href="/products" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
            Open marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return <main className="grain-overlay min-h-screen px-4 py-10 text-sm text-[var(--muted)]">Loading checkout...</main>;
  }

  return (
    <main className="grain-overlay min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href={product ? `/products/${product.id}` : "/products"} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Back
          </Link>
          <Link href="/products" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Marketplace
          </Link>
        </div>

        {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

        {order ? (
          <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Order created</p>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">Confirmation</h1>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Metric label="Order code" value={order.orderCode} />
              <Metric label="Status" value={order.status} />
              <Metric label="Payment status" value={order.paymentStatus} />
              <Metric label="Backend total" value={order.totalAmount} />
            </div>
            <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Track this order later</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Keep the order code <span className="font-semibold text-[var(--foreground)]">{order.orderCode}</span> and the phone{" "}
                  <span className="font-semibold text-[var(--foreground)]">{order.customerPhone}</span>. You can use them at the public tracking page and upload manual transfer proof there.
                </p>
              </div>
              <div className="flex items-center">
                <Link href={`${order.trackingPath}?phone=${encodeURIComponent(order.customerPhone)}`} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]">
                  Open tracking
                </Link>
              </div>
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">Payment instructions</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{order.paymentInstructions ?? "The shop did not provide additional payment instructions."}</p>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <section className="card-panel overflow-hidden rounded-[2rem]">
              <div className="bg-[var(--panel-strong)] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product?.images[0]?.url ?? "https://placehold.co/960x720?text=No+Image"}
                  alt={product?.name ?? "Checkout product"}
                  className="h-full w-full rounded-[1.5rem] object-cover"
                />
              </div>
              <div className="space-y-4 px-6 py-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{product?.shop.name}</p>
                  <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">{product?.name ?? "Product"}</h1>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{product?.description ?? "No description provided."}</p>
                </div>
                <div className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
                  <Metric label="Unit price" value={product?.price ?? "Unavailable"} />
                  <Metric label="Preview total" value={previewTotal ?? "Calculated by backend"} />
                </div>
                <p className="text-xs leading-6 text-[var(--muted)]">Displayed totals are for preview only. The backend recalculates the real order total from product price and quantity.</p>
              </div>
            </section>

            <section className="card-panel rounded-[2rem] px-6 py-6 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer checkout MVP</p>
              <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Delivery details</h2>

              <div className="mt-6 grid gap-4">
                <Field label="Full name">
                  <input value={customer.fullName} onChange={(event) => setCustomer((current) => ({ ...current, fullName: event.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
                </Field>
                <Field label="Phone">
                  <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
                </Field>
                <Field label="Email">
                  <input value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
                </Field>
                <Field label="Address">
                  <textarea value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} rows={4} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
                </Field>
                <Field label="Note">
                  <textarea value={customer.note} onChange={(event) => setCustomer((current) => ({ ...current, note: event.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Quantity">
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                  <Field label="Payment method">
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as "MANUAL_TRANSFER" | "CASH_ON_DELIVERY")}
                      className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    >
                      <option value="MANUAL_TRANSFER">Manual transfer</option>
                      <option value="CASH_ON_DELIVERY">Cash on delivery</option>
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  disabled={submitting || !product}
                  onClick={() => void handleSubmit()}
                  className="mt-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Creating order..." : "Create order"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
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
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
