"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentDetailsPanel } from "@/components/payments/payment-details-panel";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import { Button } from "@/components/ui/button";
import {
  addPaymentNote,
  confirmPayment,
  getPaymentDetail,
  rejectPayment,
  type SellerPaymentItem,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerPaymentDetailPageClient({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.sellerUser);
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
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load payment detail.",
          );
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
        action === "markPaid"
          ? "Mark this payment as paid?"
          : "Reject this payment?",
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
        updated = await confirmPayment(
          currentShopId,
          payment.id,
          note.trim() ? { note: note.trim() } : undefined,
          "",
        );
        setSuccessMessage("Payment confirmed.");
      } else if (action === "reject") {
        updated = await rejectPayment(
          currentShopId,
          payment.id,
          note.trim() ? { note: note.trim() } : undefined,
          "",
        );
        setSuccessMessage("Payment rejected.");
      } else {
        updated = await addPaymentNote(
          currentShopId,
          payment.id,
          { note: note.trim() },
          "",
        );
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
      <SectionCard
        eyebrow="Payment detail"
        title="Loading payment"
        description="Fetching payment review detail from the NestJS API."
      >
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !payment) {
    return (
      <SectionCard
        eyebrow="Payment detail"
        title="Unable to load payment"
        description="The selected payment record could not be loaded for the current shop."
      >
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? "Payment not found."}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/seller/payments")}
        >
          Back to payments
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/seller/orders/${payment.id}`)}
        >
          Open order
        </Button>
      </div>

      <div
        className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"
        data-testid="seller-payment-detail-page"
      >
        <SectionCard
          eyebrow="Payment"
          title={payment.orderNumber}
          description="Direct seller QR payment review state for the selected order."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Customer" value={payment.customer.name} />
            <Metric label="Phone" value={payment.customer.phone} />
            <Metric
              label="Payment method"
              value={payment.paymentMethod ?? "Unknown"}
            />
            <Metric label="Proof status" value={payment.paymentProofStatus} />
            <Metric label="Total" value={payment.totalAmount} />
            <Metric
              label="Created"
              value={new Date(payment.createdAt).toLocaleString()}
            />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Payment status
              </p>
              <div className="mt-3">
                <PaymentStatusBadge
                  status={payment.paymentStatus}
                  testId="seller-payment-status"
                />
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Order status
              </p>
              <div className="mt-3">
                <OrderStatusBadge status={payment.status} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <PaymentDetailsPanel
              details={payment.paymentDetails}
              title="Seller direct payment details"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Shipping address
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {payment.shippingAddress}
              </p>
            </div>
            {payment.customerNote ? (
              <p className="text-sm text-[var(--muted)]">
                Customer note: {payment.customerNote}
              </p>
            ) : null}
            {payment.buyerPaymentNote ? (
              <p className="text-sm text-[var(--muted)]">
                Buyer payment note: {payment.buyerPaymentNote}
              </p>
            ) : null}
            {payment.paymentProof ? (
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Payment proof
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {payment.paymentProof.originalName ?? "Uploaded proof"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Uploaded:{" "}
                  {payment.paymentProof.uploadedAt
                    ? new Date(payment.paymentProof.uploadedAt).toLocaleString()
                    : "Unknown"}
                </p>
                <a
                  href={payment.paymentProof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
                  data-testid="seller-payment-proof-link"
                >
                  Open proof
                </a>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Review actions"
          title="Seller review"
          description="Add notes, confirm direct seller payment after checking your bank account, or reject the proof."
        >
          <div className="space-y-4">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              placeholder="Optional review note"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => void performAction("note")}
                disabled={saving || !note.trim()}
                loading={saving}
              >
                Add note
              </Button>
              <Button
                variant="success"
                onClick={() => void performAction("markPaid")}
                disabled={saving}
                loading={saving}
                data-testid="seller-mark-paid-button"
              >
                Confirm payment received
              </Button>
              <Button
                variant="danger"
                onClick={() => void performAction("reject")}
                disabled={saving}
                loading={saving}
              >
                Reject proof
              </Button>
            </div>
            {error ? (
              <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {error}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Items"
        title="Payment order items"
        description="Line totals are based on checkout-time snapshots."
      >
        <div className="grid gap-4">
          {payment.items.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[80px_1fr_160px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  item.productImageSnapshot ??
                  "https://placehold.co/160x160?text=No+Image"
                }
                alt={item.productTitleSnapshot}
                className="h-20 w-20 rounded-2xl object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {item.productTitleSnapshot}
                </p>
                {item.variantNameSnapshot ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Variant: {item.variantNameSnapshot}
                  </p>
                ) : null}
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>Qty: {item.quantity}</p>
                <p className="mt-1">
                  Unit: {item.unitPrice ?? item.priceAtPurchase}
                </p>
                <p className="mt-1">Line: {item.lineTotal}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Audit trail"
        title="Payment review logs"
        description="Every seller action is stored as a basic payment audit record."
      >
        <div className="space-y-4">
          {payment.reviewLogs.length ? (
            payment.reviewLogs.map((log) => (
              <article
                key={log.id}
                className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {log.action}
                    </span>
                    <p className="text-sm text-[var(--muted)]">
                      {log.fromStatus ?? "N/A"}{" "}
                      {log.toStatus ? `-> ${log.toStatus}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-3 text-sm text-[var(--foreground)]">
                  {log.note ?? "No note attached."}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Reviewer: {log.reviewerName ?? log.reviewerUserId}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No payment review logs recorded yet.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
