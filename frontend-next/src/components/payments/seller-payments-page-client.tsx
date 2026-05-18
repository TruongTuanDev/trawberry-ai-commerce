"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import { listPayments, type SellerPaymentItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerPaymentsPageClient() {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [payments, setPayments] = useState<SellerPaymentItem[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await listPayments(
          currentShopId,
          {
            page,
            size,
            search: search || undefined,
            status: status || undefined,
          },
          "",
        );
        if (!mounted) return;
        setPayments(response.items);
        setTotalPages(response.meta.totalPages);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load payments.");
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
  }, [currentShopId, page, search, size, status, user]);

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Payment review"
        title="Payments"
        description="Review manual transfers and COD orders before the fulfillment workflow moves forward."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_220px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by order, customer, payment method"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">Pending queue</option>
            <option value="PENDING">Pending</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Queue"
        title="Orders awaiting payment review"
        description="Default view focuses on pending and unpaid checkout orders."
      >
        {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[170px_1.1fr_180px_160px_160px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>Order</div>
            <div>Customer</div>
            <div>Payment</div>
            <div>Total</div>
            <div>Created</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading payments...</div>
            ) : payments.length ? (
              payments.map((payment) => (
                <article key={payment.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[170px_1.1fr_180px_160px_160px] lg:px-5">
                  <div>
                    <Link href={`/seller/payments/${payment.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {payment.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{payment.status}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{payment.customer.name}</p>
                    <p>{payment.customer.phone}</p>
                    <p>{payment.customer.email ?? "No email"}</p>
                  </div>
                  <div className="space-y-2 text-sm text-[var(--muted)]">
                    <PaymentStatusBadge status={payment.paymentStatus} />
                    <p>{payment.paymentMethod ?? "Unknown method"}</p>
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{payment.totalAmount}</div>
                  <div className="text-sm text-[var(--muted)]">{new Date(payment.createdAt).toLocaleDateString()}</div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">No payments match the current filters.</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">Page {page} of {totalPages}</p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
