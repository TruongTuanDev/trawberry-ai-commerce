"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { trackOrderById, uploadPaymentProof, type PublicTrackedOrder } from "@/lib/public-api";

export function OrderTrackDetailPageClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? "";
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(Boolean(initialPhone));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!initialPhone.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const tracked = await trackOrderById(orderId, initialPhone.trim());
        if (!mounted) return;
        setOrder(tracked);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load order.");
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
  }, [initialPhone, orderId]);

  const handleLookup = async () => {
    if (!phone.trim()) {
      setError("Phone is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const tracked = await trackOrderById(orderId, phone.trim());
      setOrder(tracked);
      router.replace(`/orders/${orderId}?phone=${encodeURIComponent(phone.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!phone.trim() || !file) {
      setError("Phone and payment proof file are required.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await uploadPaymentProof(orderId, phone.trim(), file);
      setOrder(updated);
      setFile(null);
      setSuccessMessage("Payment proof uploaded. Seller can review it now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload payment proof.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="grain-overlay min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/orders/track" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Back to tracking
          </Link>
          <Link href="/products" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Marketplace
          </Link>
        </div>

        {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
        {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}

        <section className="card-panel rounded-[2rem] px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Order lookup</p>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Field label="Order id">
              <input value={orderId} disabled className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]" />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <div className="flex items-end">
              <button type="button" onClick={() => void handleLookup()} disabled={loading} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Loading..." : "Load order"}
              </button>
            </div>
          </div>
        </section>

        {order ? (
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Order snapshot</p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">{order.orderCode}</h1>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Metric label="Order status" value={order.status} />
                <Metric label="Payment status" value={order.paymentStatus} />
                <Metric label="Payment method" value={order.paymentMethod ?? "Unknown"} />
                <Metric label="Total" value={order.totalAmount} />
              </div>
              <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">Payment instructions</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{order.paymentInstructions ?? "This shop did not provide manual payment instructions."}</p>
              </div>
              <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
                <Metric label="Customer" value={order.customer.name} />
                <Metric label="Phone" value={order.customer.phone} />
                <Metric label="Email" value={order.customer.email ?? "Not provided"} />
                <Metric label="Address" value={order.customer.address} />
              </div>
              {order.customerNote ? (
                <p className="mt-4 text-sm text-[var(--muted)]">Customer note: {order.customerNote}</p>
              ) : null}
            </section>

            <section className="space-y-6">
              <div className="card-panel rounded-[2rem] px-6 py-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Payment proof</p>
                {order.paymentProof ? (
                  <div className="mt-4 space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{order.paymentProof.originalName ?? "Uploaded proof"}</p>
                    <p className="text-sm text-[var(--muted)]">Uploaded at: {order.paymentProof.uploadedAt ? new Date(order.paymentProof.uploadedAt).toLocaleString() : "Unknown"}</p>
                    <a href={order.paymentProof.url} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
                      Open proof
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">No payment proof uploaded yet.</p>
                )}

                <div className="mt-6 grid gap-4">
                  <Field label="Upload proof">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => void handleUpload()}
                    disabled={uploading || !file}
                    className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : "Upload payment proof"}
                  </button>
                </div>
              </div>

              <div className="card-panel rounded-[2rem] px-6 py-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Items</p>
                <div className="mt-4 space-y-4">
                  {order.items.map((item) => (
                    <article key={item.id} className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
                      <div className="flex gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.productImageSnapshot ?? "https://placehold.co/160x160?text=No+Image"} alt={item.productTitleSnapshot} className="h-20 w-20 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{item.productTitleSnapshot}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Quantity: {item.quantity}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">Price: {item.priceAtPurchase}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}
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
