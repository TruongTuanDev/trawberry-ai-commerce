"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { getShopOrders, type SellerOrderListItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerOrdersPageClient() {
  const user = useAuthStore((state) => state.user);
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
        description="Seller order queue migrated to Next.js. Filter by status, date, or customer/order search while staying scoped to the active shop."
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_180px_180px_180px]">
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
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="NEW">New</option>
            <option value="ASSEMBLING">Assembling</option>
            <option value="SHIPPING">Shipping</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
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
        description="The queue shows order number, customer, products, totals, status, and creation date."
      >
        {error ? (
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div>
        ) : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[160px_1.2fr_1.3fr_160px_160px_160px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>Order</div>
            <div>Customer</div>
            <div>Products</div>
            <div>Total</div>
            <div>Status</div>
            <div>Date</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading orders...</div>
            ) : orders.length ? (
              orders.map((order) => (
                <article key={order.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[160px_1.2fr_1.3fr_160px_160px_160px] lg:px-5">
                  <div>
                    <Link href={`/seller/orders/${order.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">{order.paymentStatus}</p>
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
                  <div><OrderStatusBadge status={order.status} /></div>
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
