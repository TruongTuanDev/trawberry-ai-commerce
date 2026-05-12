"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import { addPaymentNote, getPaymentDetail, markPaymentPaid, rejectPayment, type SellerPaymentItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerPaymentDetailPageClient({ orderId }: { orderId: string }) {
  const user = useAuthStore((state) => state.user);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [payment, setPayment] = useState<SellerPaymentItem | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const result = await getPaymentDetail(currentShopId, orderId, "");
        if (!mounted) return;
        setPayment(result);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load payment detail.");
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
  }, [currentShopId, orderId, user]);

  const performAction = async (action: "markPaid" | "reject" | "note") => {
    if (!currentShopId || !payment) {
      return;
    }

    if (action !== "note") {
      const confirmed = window.confirm(
        action === "markPaid" ? "Mark this payment as paid?" : "Reject this payment?",
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let updated: SellerPaymentItem;
      if (action === "markPaid") {
        updated = await markPaymentPaid(currentShopId, payment.id, note.trim() ? { note: note.trim() } : undefined, "");
        setSuccessMessage("Payment marked as paid.");
      } else if (action === "reject") {
        updated = await rejectPayment(currentShopId, payment.id, note.trim() ? { note: note.trim() } : undefined, "");
        setSuccessMessage("Payment rejected.");
      } else {
        updated = await addPaymentNote(currentShopId, payment.id, { note: note.trim() }, "");
        setSuccessMessage("Payment note added.");
      }

      setPayment(updated);
      if (action === "note") {
        setNote("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment action failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionCard eyebrow="Payment detail" title="Loading payment" description="Fetching payment review detail from the NestJS API.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !payment) {
    return (
      <SectionCard eyebrow="Payment detail" title="Unable to load payment" description="The selected payment record could not be loaded for the current shop.">
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error ?? "Payment not found."}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/seller/payments" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Back to payments
        </Link>
        <Link href={`/seller/orders/${payment.id}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Open order
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard eyebrow="Payment" title={payment.orderNumber} description="Manual payment review state for the selected order.">
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Customer" value={payment.customer.name} />
            <Metric label="Phone" value={payment.customer.phone} />
            <Metric label="Payment method" value={payment.paymentMethod ?? "Unknown"} />
            <Metric label="Total" value={payment.totalAmount} />
            <Metric label="Created" value={new Date(payment.createdAt).toLocaleString()} />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Payment status</p>
              <div className="mt-3"><PaymentStatusBadge status={payment.paymentStatus} /></div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Order status</p>
              <div className="mt-3"><OrderStatusBadge status={payment.status} /></div>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Payment instructions</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{payment.paymentInstructions ?? "This shop did not set manual payment instructions."}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Shipping address</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{payment.shippingAddress}</p>
            </div>
            {payment.customerNote ? (
              <p className="text-sm text-[var(--muted)]">Customer note: {payment.customerNote}</p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Review actions" title="Seller review" description="Add notes, mark the payment as paid, or reject it when the transition is still valid.">
          <div className="space-y-4">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              placeholder="Optional review note"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => void performAction("note")}
                disabled={saving || !note.trim()}
                className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add note
              </button>
              <button
                type="button"
                onClick={() => void performAction("markPaid")}
                disabled={saving}
                className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Mark as paid"}
              </button>
              <button
                type="button"
                onClick={() => void performAction("reject")}
                disabled={saving}
                className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Reject payment"}
              </button>
            </div>
            {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Audit trail" title="Payment review logs" description="Every seller action is stored as a basic payment audit record.">
        <div className="space-y-4">
          {payment.reviewLogs.length ? (
            payment.reviewLogs.map((log) => (
              <article key={log.id} className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {log.action}
                    </span>
                    <p className="text-sm text-[var(--muted)]">
                      {log.fromStatus ?? "N/A"} {log.toStatus ? `→ ${log.toStatus}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-3 text-sm text-[var(--foreground)]">{log.note ?? "No note attached."}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">Reviewer: {log.reviewerName ?? log.reviewerUserId}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">No payment review logs recorded yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
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
