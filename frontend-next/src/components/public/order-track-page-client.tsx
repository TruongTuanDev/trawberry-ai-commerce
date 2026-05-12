"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
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
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="card-panel rounded-[2.25rem] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Track a public order</p>
            <h1 className="mt-4 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)] sm:text-5xl">
              Return with your order code and phone.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              This lookup flow is designed for customers who checked out without an account. Use the same phone number you entered during checkout.
            </p>

            {error ? (
              <div className="mt-6 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
                {error}
              </div>
            ) : null}

            <div className="mt-8 grid gap-4">
              <Field label="Order code">
                <input
                  value={orderCode}
                  onChange={(event) => setOrderCode(event.target.value)}
                  placeholder="ORD-..."
                  className="public-input"
                  data-testid="track-order-code"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone used at checkout"
                  className="public-input"
                  data-testid="track-order-phone"
                />
              </Field>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                className="public-button-primary mt-2 px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="track-order-submit"
              >
                {loading ? "Tracking..." : "Track order"}
              </button>
            </div>
          </section>

          <section className="card-panel rounded-[2.25rem] bg-[linear-gradient(180deg,rgba(182,49,75,0.04),rgba(47,107,73,0.08))] px-6 py-8 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">What you can do</p>
            <div className="mt-6 grid gap-4">
              {[
                "Check current order status and payment status.",
                "Review line items, totals, and payment instructions.",
                "Upload payment proof later for manual transfer review.",
              ].map((item) => (
                <div key={item} className="rounded-[1.35rem] border border-[var(--border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                  {item}
                </div>
              ))}
            </div>
          </section>
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
