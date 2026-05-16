"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { getCustomerOrderHistory, type CustomerCheckoutReceipt } from "@/lib/customer-api";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerOrdersPageClient() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const [orders, setOrders] = useState<CustomerCheckoutReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!hydrated) return;
      const ok = user ? true : await refreshMe();
      const currentUser = useAuthStore.getState().user;
      if (!ok || currentUser?.role !== "CUSTOMER") {
        router.replace("/customer/login?next=/customer/orders");
        return;
      }
      try {
        const response = await getCustomerOrderHistory();
        if (!mounted) return;
        setOrders(response.items);
        setError(null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load orders.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [hydrated, refreshMe, router, user]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6">
        <section className="mx-auto max-w-7xl space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Customer account</p>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">My orders</h1>
          </div>
          {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
          <div className="grid gap-4" data-testid="customer-orders-list">
            {loading ? (
              <div className="card-panel rounded-[2rem] px-6 py-8 text-sm text-[var(--muted)]">Loading orders...</div>
            ) : orders.length ? (
              orders.map((receipt) => (
                <article key={receipt.checkoutId} className="card-panel rounded-[1.5rem] px-5 py-5" data-testid="customer-order-card">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <Link href={`/customer/orders/${receipt.checkoutCode}`} className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                        {receipt.checkoutCode}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--muted)]">{receipt.orders.length} shop order(s) · {new Date(receipt.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{receipt.grandTotal}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{receipt.status}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="card-panel rounded-[2rem] px-6 py-8 text-sm text-[var(--muted)]">No orders yet.</div>
            )}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
