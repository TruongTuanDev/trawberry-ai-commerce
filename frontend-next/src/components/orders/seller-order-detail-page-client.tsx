"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import { getShopOrderById, updateShopOrderStatus, type SellerOrderListItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const statusOptions = ["PENDING", "NEW", "ASSEMBLING", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

export function SellerOrderDetailPageClient({ orderId }: { orderId: string }) {
  const user = useAuthStore((state) => state.user);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [order, setOrder] = useState<SellerOrderListItem | null>(null);
  const [nextStatus, setNextStatus] = useState<SellerOrderListItem["status"]>("NEW");
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
        const result = await getShopOrderById(currentShopId, orderId, "");
        if (!mounted) return;
        setOrder(result);
        setNextStatus(result.status as SellerOrderListItem["status"]);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load order.");
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

  const handleUpdateStatus = async () => {
    if (!user || !currentShopId || !order) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateShopOrderStatus(currentShopId, order.id, nextStatus, "");
      setOrder(updated);
      setNextStatus(updated.status as SellerOrderListItem["status"]);
      setSuccessMessage(`Order moved to ${updated.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionCard eyebrow="Order detail" title="Loading order" description="Fetching order details from the NestJS seller API.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !order) {
    return (
      <SectionCard eyebrow="Order detail" title="Unable to load order" description="The selected order could not be loaded for the current seller shop.">
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error ?? "Order not found."}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/seller/orders" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Back to orders
        </Link>
        <Link href={`/seller/payments/${orderId}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Review payment
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard eyebrow="Order" title={order.orderNumber} description="Order details migrated into the seller center.">
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Customer" value={order.customer.name} />
            <Metric label="Phone" value={order.customer.phone} />
            <Metric label="Email" value={order.customer.email ?? "No email"} />
            <Metric label="Total" value={order.totalAmount} />
            <Metric label="Created" value={new Date(order.createdAt).toLocaleString()} />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Status</p>
              <div className="mt-3"><OrderStatusBadge status={order.status} /></div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Shipping address</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{order.shippingAddress}</p>
            {order.customerNote ? <p className="mt-4 text-sm text-[var(--muted)]">Customer note: {order.customerNote}</p> : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Actions" title="Fulfillment status" description="Move the order through the seller workflow when the current state allows it.">
          <div className="space-y-4">
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as SellerOrderListItem["status"])}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleUpdateStatus()}
              disabled={saving}
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update status"}
            </button>
            {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Items" title="Ordered products" description="Snapshot data is taken from the legacy order records so seller support sees exactly what the customer bought.">
        <div className="grid gap-4">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[96px_1fr_160px]">
              <div className="overflow-hidden rounded-2xl bg-[var(--panel)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.productImageSnapshot ?? "https://placehold.co/160x160?text=No+Image"}
                  alt={item.productTitleSnapshot}
                  className="h-24 w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.productTitleSnapshot}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Slug: {item.productSlugSnapshot}</p>
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>Qty: {item.quantity}</p>
                <p className="mt-1">Price: {item.priceAtPurchase}</p>
              </div>
            </article>
          ))}
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
