"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckoutReceiptView } from "@/components/customer/checkout-receipt-view";
import { CustomerSupportSection } from "@/components/customer/customer-support-section";
import { PublicShell } from "@/components/public/public-shell";
import { getCustomerOrderReceipt, type CustomerCheckoutReceipt } from "@/lib/customer-api";
import { useAuthStore } from "@/stores/auth-store";

export function CustomerOrderDetailPageClient({ checkoutCode }: { checkoutCode: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const [receipt, setReceipt] = useState<CustomerCheckoutReceipt | null>(null);
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
        router.replace(`/customer/login?next=/customer/orders/${checkoutCode}`);
        return;
      }
      try {
        const response = await getCustomerOrderReceipt(checkoutCode);
        if (!mounted) return;
        setReceipt(response);
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
  }, [checkoutCode, hydrated, refreshMe, router, user]);

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Link href="/customer/orders" className="public-button-secondary inline-flex px-4 py-2 text-sm">Back to my orders</Link>
          {error ? <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
          {loading ? <section className="card-panel rounded-[2rem] px-6 py-8 text-sm text-[var(--muted)]">Loading receipt...</section> : null}
          {receipt ? <CheckoutReceiptView receipt={receipt} phone={receipt.customer.phone} /> : null}
          {receipt ? <CustomerSupportSection receipt={receipt} /> : null}
        </div>
      </main>
    </PublicShell>
  );
}
