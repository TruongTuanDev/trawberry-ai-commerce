"use client";

import Link from "next/link";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import type { CustomerCheckoutReceipt } from "@/lib/customer-api";

export function CheckoutReceiptView({
  receipt,
  phone,
}: {
  receipt: CustomerCheckoutReceipt;
  phone?: string;
}) {
  return (
    <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8" data-testid="checkout-receipt">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Marketplace receipt</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]" data-testid="receipt-checkout-code">
            {receipt.checkoutCode}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{new Date(receipt.createdAt).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Grand total</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]" data-testid="receipt-grand-total">{receipt.grandTotal}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Metric label="Status" value={receipt.status} />
        <Metric label="Orders" value={String(receipt.orders.length)} />
        <Metric label="Customer" value={receipt.customer.name} />
      </div>
      <div className="mt-6 grid gap-4" data-testid="receipt-child-orders">
        {receipt.orders.map((order) => (
          <article key={order.orderId} className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="receipt-order-card">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{order.shopName}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{order.orderCode}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[56px_1fr_auto] gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.productImageSnapshot ?? "https://placehold.co/120x120?text=No+Image"} alt={item.productTitleSnapshot} className="h-14 w-14 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.productTitleSnapshot}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.variantNameSnapshot ?? "Default variant"} x {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.lineTotal}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Order total {order.totalAmount}</p>
              <Link href={`${order.trackingPath}${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`} className="public-button-secondary px-4 py-2 text-sm" data-testid="receipt-track-link">
                Track order
              </Link>
            </div>
          </article>
        ))}
      </div>
      {receipt.supportCases.length ? (
        <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5" data-testid="receipt-support-summary">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Support</p>
              <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">{receipt.supportCases.length} case(s)</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {receipt.supportCases.map((supportCase) => (
              <article key={supportCase.id} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{supportCase.subject}</p>
                  <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{supportCase.status}</span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{supportCase.issueType}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
