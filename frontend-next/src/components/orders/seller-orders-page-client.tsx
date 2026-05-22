"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { getShopOrders, type SellerOrderListItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const sellerTabs = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { value: "PAYMENT_PROOF", label: "Payment proof" },
  { value: "TO_PACK", label: "To pack" },
  { value: "READY_FOR_YANDEX", label: "Ready for Yandex" },
  { value: "IN_DELIVERY", label: "In delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "PAYMENT_ISSUES", label: "Payment issues" },
] as const;

export function SellerOrdersPageClient() {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [orders, setOrders] = useState<SellerOrderListItem[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
        const response = await getShopOrders(
          currentShopId,
          {
            page,
            size,
            search: search || undefined,
            status: status || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
          "",
        );
        if (!mounted) return;
        setOrders(response.items);
        setTotalPages(response.meta.totalPages);
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
  }, [currentShopId, dateFrom, dateTo, page, search, size, status, user]);

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Fulfillment"
        title="Orders"
        description="Seller order queue synced with payment, delivery, and finance states for the active shop."
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seller order filters">
          {sellerTabs.map((tab) => (
            <button
              key={tab.value || "ALL"}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                status === tab.value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              data-testid={`seller-order-tab-${tab.value || "ALL"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_180px_180px_180px]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by order, customer, phone, product"
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
            {sellerTabs.map((tab) => (
              <option key={tab.value || "ALL"} value={tab.value}>
                {tab.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Orders list"
        title="Shop orders"
        description="Each order shows the seller-facing sync status and the next operational action."
      >
        {error ? (
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[150px_1.2fr_1.3fr_150px_170px_170px_180px_130px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>Order</div>
            <div>Customer</div>
            <div>Products</div>
            <div>Total</div>
            <div>Seller sync</div>
            <div>Payment</div>
            <div>Next action</div>
            <div>Date</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading orders...</div>
            ) : orders.length ? (
              orders.map((order) => (
                <article key={order.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[150px_1.2fr_1.3fr_150px_170px_170px_180px_130px] lg:px-5" data-testid="seller-order-card">
                  <div>
                    <Link href={`/seller/orders/${order.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{order.paymentMethodLabel ?? order.paymentMethod ?? "Direct seller payment"}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{order.customer.name}</p>
                    <p>{order.customer.phone}</p>
                    <p>{order.customer.email ?? "No email"}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {order.items.slice(0, 2).map((item) => (
                      <p key={item.id}>
                        {item.productTitleSnapshot} x {item.quantity}
                      </p>
                    ))}
                    {order.items.length > 2 ? <p>+{order.items.length - 2} more items</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{order.totalAmount}</div>
                  <div className="space-y-2">
                    <OrderStatusBadge status={order.sellerDisplayStatus} />
                    <p className="text-xs text-[var(--muted)]">{order.sellerDisplayLabel}</p>
                  </div>
                  <div className="space-y-2">
                    <PaymentStatusBadge status={order.paymentStatus} />
                    {order.finance?.ledgerStatus ? (
                      <p className="text-xs text-[var(--muted)]">Ledger {order.finance.ledgerStatus}</p>
                    ) : null}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {formatNextAction(order.nextAction)}
                  </div>
                  <div className="text-sm text-[var(--muted)]">{new Date(order.createdAt).toLocaleDateString()}</div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">No orders match the current filters.</div>
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

function formatNextAction(nextAction: string | null) {
  const labels: Record<string, string> = {
    review_payment_proof: "Confirm or reject proof",
    accept_pay_on_delivery_order: "Accept COD and create Yandex",
    create_yandex_delivery: "Create Yandex manually",
    prepare_order: "Start preparing order",
    continue_preparing: "Continue packing",
    mark_picked_up: "Mark picked up",
    mark_on_the_way: "Mark on the way",
    mark_delivered: "Mark delivered",
    confirm_delivery_payment: "Confirm delivery payment",
    wait_for_delivery_payment: "Wait for buyer payment",
    resolve_delivery_payment_issue: "Resolve payment dispute",
    review_payment_issue: "Resolve payment issue",
    wait_for_payment: "Wait for buyer payment",
    monitor_delivery: "Monitor delivery",
    review_order: "Open order detail",
  };

  return nextAction ? labels[nextAction] ?? nextAction : "No action";
}
