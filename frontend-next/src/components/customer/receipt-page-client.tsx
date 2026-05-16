"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckoutReceiptView } from "@/components/customer/checkout-receipt-view";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicCheckoutReceipt, type CustomerCheckoutReceipt } from "@/lib/customer-api";

export function ReceiptPageClient({ checkoutCode }: { checkoutCode: string }) {
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? "";
  const [phone, setPhone] = useState(initialPhone);
  const [receipt, setReceipt] = useState<CustomerCheckoutReceipt | null>(null);
  const [loading, setLoading] = useState(Boolean(initialPhone));
  const [error, setError] = useState<string | null>(null);

  const load = async (nextPhone: string) => {
    if (!nextPhone.trim()) {
      setError("Phone is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReceipt(await getPublicCheckoutReceipt(checkoutCode, nextPhone.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load receipt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!initialPhone.trim()) {
        setLoading(false);
        return;
      }
      try {
        const loaded = await getPublicCheckoutReceipt(checkoutCode, initialPhone.trim());
        if (!mounted) return;
        setReceipt(loaded);
        setError(null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load receipt.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [checkoutCode, initialPhone]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="public-button-secondary px-4 py-2 text-sm">Marketplace</Link>
            <Link href="/customer/orders" className="public-button-secondary px-4 py-2 text-sm">My orders</Link>
          </div>
          {!receipt ? (
            <section className="card-panel rounded-[2rem] px-6 py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Receipt lookup</p>
              <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">{checkoutCode}</h1>
              <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone used at checkout" className="public-input" data-testid="receipt-phone" />
                <button type="button" onClick={() => void load(phone)} disabled={loading} className="public-button-primary px-5 py-3 text-sm" data-testid="receipt-load">
                  {loading ? "Loading..." : "Load receipt"}
                </button>
              </div>
              {error ? <div className="mt-4 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            </section>
          ) : (
            <CheckoutReceiptView receipt={receipt} phone={phone} />
          )}
        </div>
      </main>
    </PublicShell>
  );
}
