"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackOrderByCode } from "@/lib/public-api";

export function OrderTrackPageClient() {
  const router = useRouter();
  const [orderCode, setOrderCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!orderCode.trim() || !phone.trim()) {
      setError("Order code and phone are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tracked = await trackOrderByCode(orderCode.trim(), phone.trim());
      router.push(`/orders/${tracked.orderId}?phone=${encodeURIComponent(phone.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to track order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grain-overlay min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Home
          </Link>
          <Link href="/products" className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]">
            Marketplace
          </Link>
        </div>

        <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer order tracking</p>
          <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">Track your order</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Enter the order code from checkout confirmation and the same phone number used during checkout. Manual transfer orders can upload payment proof after lookup.
          </p>

          {error ? <div className="mt-6 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

          <div className="mt-8 grid gap-4">
            <Field label="Order code">
              <input
                value={orderCode}
                onChange={(event) => setOrderCode(event.target.value)}
                placeholder="ORD-..."
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone used at checkout"
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </Field>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="mt-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Tracking..." : "Track order"}
            </button>
          </div>
        </section>
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
