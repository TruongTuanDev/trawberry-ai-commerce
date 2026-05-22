"use client";

import { useEffect, useState } from "react";
import { PaymentDetailsPanel } from "@/components/payments/payment-details-panel";
import {
  adminConfirmPayment,
  adminRejectPayment,
  getAdminPayment,
  listAdminPayments,
  type AdminPaymentSupervisionRow,
} from "@/lib/admin-api";
import { labelForReturnStatus, labelForReturnType } from "@/components/returns/return-refund-utils";

export function AdminPaymentsSupervisionPageClient() {
  const [items, setItems] = useState<AdminPaymentSupervisionRow[]>([]);
  const [selected, setSelected] = useState<AdminPaymentSupervisionRow | null>(null);
  const [status, setStatus] = useState("BUYER_MARKED_DELIVERY_PAID");
  const [proofStatus, setProofStatus] = useState("BUYER_MARKED_PAID");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async (filters?: { status?: string; proofStatus?: string }) => {
    setLoading(true);
    try {
      const response = await listAdminPayments({
        status: filters?.status ?? status,
        proofStatus: filters?.proofStatus ?? proofStatus,
        page: 1,
        size: 20,
      });
      setItems(response.items);
      if (response.items.length && !selected) {
        setSelected(response.items[0]);
      } else if (selected) {
        const refreshedSelected = response.items.find((item) => item.id === selected.id);
        if (refreshedSelected) {
          setSelected(await getAdminPayment(refreshedSelected.id));
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const response = await listAdminPayments({
          status,
          proofStatus,
          page: 1,
          size: 20,
        });
        if (cancelled) return;
        setItems(response.items);
        setSelected((current) =>
          current
            ? response.items.find((item) => item.id === current.id) ?? current
            : response.items[0] ?? null,
        );
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load admin payments.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [status, proofStatus]);

  const openItem = async (orderId: string) => {
    setSelected(await getAdminPayment(orderId));
  };

  const handleAction = async (action: "confirm" | "reject") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated =
        action === "confirm"
          ? await adminConfirmPayment(selected.id, {})
          : await adminRejectPayment(selected.id, {});
      setSelected(updated);
      setMessage(action === "confirm" ? "Admin confirmed payment." : "Admin rejected payment.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin payment action failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-payments-supervision-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Marketplace operations</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Payments supervision</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Review buyer-marked direct-to-seller transfers across all shops, including pay-on-delivery seller QR flows after delivery.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Payment status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
              <option value="PENDING">Pending prepaid review</option>
              <option value="PAY_ON_DELIVERY_SELECTED">Pay on delivery selected</option>
              <option value="DELIVERED_AWAITING_PAYMENT">Delivered awaiting payment</option>
              <option value="BUYER_MARKED_DELIVERY_PAID">Buyer marked delivery paid</option>
              <option value="DELIVERY_PAYMENT_REJECTED">Delivery payment rejected</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Proof status
            <select value={proofStatus} onChange={(event) => setProofStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
              <option value="BUYER_MARKED_PAID">Buyer marked paid</option>
              <option value="NOT_SUBMITTED">No proof yet</option>
              <option value="SELLER_CONFIRMED">Seller confirmed</option>
              <option value="SELLER_REJECTED">Seller rejected</option>
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Payment queue</h3>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Loading payments...</p>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openItem(item.id)}
                  className={`block w-full rounded-[1.25rem] border px-4 py-4 text-left ${selected?.id === item.id ? "border-indigo-400 bg-indigo-50" : "border-[var(--border)] bg-[var(--panel)]"}`}
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.orderNumber}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.shopName} - {item.customer.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.sellerName ?? "Seller"} · {item.paymentMethodLabel ?? item.paymentMethod ?? "Direct seller payment"}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {item.paymentStatus} - {item.paymentProofStatus}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Ledger {item.ledgerStatus ?? "not created"}
                  </p>
                  {item.activeReturnRefundCase ? (
                    <p className="mt-1 text-xs text-rose-700">
                      Case: {labelForReturnType(item.activeReturnRefundCase.type)} - {labelForReturnStatus(item.activeReturnRefundCase.status)}
                    </p>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No payments match the current filters.</p>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          {selected ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Selected payment</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.orderNumber}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{selected.shopName} - {selected.totalAmount}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {selected.sellerName ?? "Seller"} · {selected.sellerEmail ?? "no email"} · {selected.paymentMethodLabel ?? selected.paymentMethod ?? "Direct seller payment"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">Buyer proof status: {selected.paymentProofStatus}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Ledger: {selected.ledgerStatus ?? "not created"}{selected.ledgerCommissionAmount ? ` · fee ${selected.ledgerCommissionAmount}` : ""}{selected.ledgerInvoiceStatus ? ` · invoice ${selected.ledgerInvoiceStatus}` : ""}
                </p>
              </div>
              <PaymentDetailsPanel details={selected.paymentDetails} title="Seller payment destination" />
              {selected.paymentProof ? (
                <a href={selected.paymentProof.url} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                  Open buyer proof
                </a>
              ) : (
                <p className="text-sm text-[var(--muted)]">Buyer has not uploaded payment proof yet.</p>
              )}
              {selected.buyerPaymentNote ? (
                <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
                  Buyer note: {selected.buyerPaymentNote}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleAction("confirm")} disabled={saving} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-testid="admin-payment-confirm">
                  {saving ? "Saving..." : "Admin confirm"}
                </button>
                <button type="button" onClick={() => void handleAction("reject")} disabled={saving} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-testid="admin-payment-reject">
                  {saving ? "Saving..." : "Admin reject"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a payment to inspect it.</p>
          )}
        </section>
      </div>
    </div>
  );
}
