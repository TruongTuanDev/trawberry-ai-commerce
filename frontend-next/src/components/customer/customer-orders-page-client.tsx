"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import {
  getCustomerOrderHistory,
  type CustomerCheckoutReceipt,
} from "@/lib/customer-api";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerOrdersPageClient() {
  const router = useRouter();
  const user = useAuthStore((state) => state.customerUser);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshRole = useAuthStore((state) => state.refreshRole);
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
      const ok = user ? true : await refreshRole("customer");
      const currentUser = useAuthStore.getState().customerUser;
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
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load orders.");
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
  }, [hydrated, refreshRole, router, user]);

  return (
    <CustomerAccountShell
      title="Đơn hàng của tôi"
      description="Lịch sử parent checkout receipt của customer, giữ nguyên multi-shop history hiện có và dẫn vào từng receipt chi tiết."
    >
      {error ? (
        <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4" data-testid="customer-orders-list">
        {loading ? (
          <div className="card-panel rounded-[2rem] px-6 py-8 text-sm text-[var(--muted)]">
            Loading orders...
          </div>
        ) : orders.length ? (
          orders.map((receipt) => (
            <article
              key={receipt.checkoutId}
              className="card-panel rounded-[1.5rem] px-5 py-5"
              data-testid="customer-order-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/customer/orders/${receipt.checkoutCode}`}
                    className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
                  >
                    {receipt.checkoutCode}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {receipt.orders.length} shop order(s) ·{" "}
                    {new Date(receipt.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {receipt.grandTotal}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {receipt.status}
                  </p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="card-panel rounded-[2rem] px-6 py-8 text-sm text-[var(--muted)]">
            No orders yet.
          </div>
        )}
      </div>
    </CustomerAccountShell>
  );
}
