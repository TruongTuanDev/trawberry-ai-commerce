"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminCancelDelivery,
  adminAddDeliveryComment,
  adminMarkDeliveryDelivered,
  adminMarkDeliveryCourierAssigned,
  adminMarkDeliveryFailed,
  adminMarkDeliveryInTransit,
  adminMarkDeliveryPickedUp,
  adminUpdateDeliveryCustomerMessage,
  listAdminDeliveries,
  type AdminDeliveryRow,
} from "@/lib/admin-api";
import type { DeliveryExceptionReasonCode } from "@/lib/seller-api";

const statusFilters = [
  { label: "Paid without delivery", value: "PAID_WITHOUT_DELIVERY" },
  { label: "Ready for Yandex", value: "READY_TO_CREATE_YANDEX" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Exceptions only", value: "EXCEPTIONS" },
  { label: "Created", value: "YANDEX_MANUAL_CREATED" },
  { label: "Courier assigned", value: "COURIER_ASSIGNED" },
  { label: "Picked up", value: "PICKED_UP" },
  { label: "On the way", value: "ON_THE_WAY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Failed", value: "FAILED" },
] as const;

export function AdminDeliveriesPageClient() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("exceptionOnly") === "true"
    ? "EXCEPTIONS"
    : searchParams.get("paidWithoutDelivery") === "true"
      ? "PAID_WITHOUT_DELIVERY"
      : ((searchParams.get("status") as (typeof statusFilters)[number]["value"] | null) ?? "PAID_WITHOUT_DELIVERY");
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>(initialFilter);
  const [provider, setProvider] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<AdminDeliveryRow[]>([]);
  const [selected, setSelected] = useState<AdminDeliveryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [reasonCode, setReasonCode] = useState<DeliveryExceptionReasonCode>("OTHER");

  const query = useMemo(
    () => ({
      paidWithoutDelivery: filter === "PAID_WITHOUT_DELIVERY" || filter === "READY_TO_CREATE_YANDEX",
      exceptionOnly: filter === "EXCEPTIONS",
      status: filter === "PAID_WITHOUT_DELIVERY" || filter === "EXCEPTIONS" ? undefined : filter,
      provider: provider || undefined,
      search: search.trim() || undefined,
    }),
    [filter, provider, search],
  );

  const load = async () => {
    setLoading(true);
    try {
      const result = await listAdminDeliveries(query);
      setItems(result.items);
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load deliveries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleOverride = async (action: "courier-assigned" | "picked-up" | "in-transit" | "delivered" | "cancel") => {
    if (!selected?.deliveryShipmentId) return;
    setMessage(null);
    setError(null);
    try {
      if (action === "courier-assigned") {
        await adminMarkDeliveryCourierAssigned(selected.deliveryShipmentId, { note: "Admin supervision override." });
        setMessage("Courier assigned.");
      } else if (action === "picked-up") {
        await adminMarkDeliveryPickedUp(selected.deliveryShipmentId, { note: "Admin supervision override." });
        setMessage("Package marked picked up.");
      } else if (action === "in-transit") {
        await adminMarkDeliveryInTransit(selected.deliveryShipmentId, "Admin supervision override.");
        setMessage("Delivery marked on the way.");
      } else if (action === "delivered") {
        await adminMarkDeliveryDelivered(selected.deliveryShipmentId, "Admin supervision override.");
        setMessage("Delivery marked delivered.");
      } else {
        await adminCancelDelivery(selected.deliveryShipmentId, "Admin supervision override.");
        setMessage("Delivery cancelled.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin delivery action failed.");
    }
  };

  const handleMarkFailed = async () => {
    if (!selected?.deliveryShipmentId) return;
    setMessage(null);
    setError(null);
    try {
      await adminMarkDeliveryFailed(selected.deliveryShipmentId, {
        reasonCode,
        reasonText: adminNote.trim() || null,
        customerVisibleMessage: customerMessage.trim() || null,
      });
      setMessage("Delivery marked failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark failed.");
    }
  };

  const handleAddAdminNote = async () => {
    if (!selected?.deliveryShipmentId || !adminNote.trim()) return;
    setMessage(null);
    setError(null);
    try {
      await adminAddDeliveryComment(selected.deliveryShipmentId, {
        visibility: "INTERNAL",
        message: adminNote.trim(),
      });
      setAdminNote("");
      setMessage("Internal admin comment added.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add admin comment.");
    }
  };

  const handleUpdateCustomerMessage = async () => {
    if (!selected?.deliveryShipmentId || !customerMessage.trim()) return;
    setMessage(null);
    setError(null);
    try {
      await adminUpdateDeliveryCustomerMessage(selected.deliveryShipmentId, customerMessage.trim());
      setMessage("Customer message updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update customer message.");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-deliveries-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Delivery supervision</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Seller-managed delivery</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Monitor paid orders without delivery and seller-entered tracking across all marketplace shops.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Visible</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{items.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Delivery filters">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === item.value ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              data-testid={`admin-delivery-filter-${item.value}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-delivery-provider-filter">
            <option value="">All providers</option>
            <option value="YANDEX">Yandex</option>
            <option value="CDEK">CDEK</option>
            <option value="MANUAL">Manual</option>
          </select>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, phone" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-delivery-search" />
          <button type="button" onClick={() => void load()} className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold">Refresh</button>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="admin-delivery-message">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[150px_1.1fr_1fr_140px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] lg:grid">
            <div>Order</div>
            <div>Shop / seller</div>
            <div>Customer</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading deliveries...</div>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[var(--panel)] lg:grid-cols-[150px_1.1fr_1fr_140px] lg:items-center"
                  data-testid="admin-delivery-row"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.orderNumber}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.paymentStatus}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.shopName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.sellerEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--foreground)]">{item.customer.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.customer.phone}</p>
                  </div>
                  <span className="w-fit rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]" data-testid="admin-delivery-row-status">
                    {item.internalStatus}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">No deliveries match the current filters.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="admin-delivery-detail">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Selected delivery</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{selected.orderNumber}</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Metric label="Provider" value={selected.provider ?? "Not created"} />
                <Metric label="Status" value={selected.internalStatus} testId="admin-delivery-detail-status" />
                <Metric label="Tracking" value={selected.trackingNumber ?? "Not assigned"} />
                <Metric label="Courier" value={selected.courierPhone ?? "Not assigned"} />
                <Metric label="Reason" value={selected.failureReasonCode ?? "None"} />
                <Metric label="Customer message" value={selected.customerVisibleMessage ?? "None"} />
              </div>
              <p className="text-sm text-[var(--muted)]">{selected.customer.address}</p>
              {selected.deliveryNote ? <p className="text-sm text-[var(--muted)]">{selected.deliveryNote}</p> : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void handleOverride("courier-assigned")} disabled={!selected.deliveryShipmentId} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Courier assigned</button>
                <button type="button" onClick={() => void handleOverride("picked-up")} disabled={!selected.deliveryShipmentId} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Picked up</button>
                <button type="button" onClick={() => void handleOverride("in-transit")} disabled={!selected.deliveryShipmentId} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50" data-testid="admin-delivery-mark-in-transit">Mark in transit</button>
                <button type="button" onClick={() => void handleOverride("delivered")} disabled={!selected.deliveryShipmentId} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50" data-testid="admin-delivery-mark-delivered">Mark delivered</button>
                <button type="button" onClick={() => void handleOverride("cancel")} disabled={!selected.deliveryShipmentId} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void handleMarkFailed()} disabled={!selected.deliveryShipmentId} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" data-testid="admin-delivery-mark-failed">Mark failed</button>
              </div>
              <div className="grid gap-3 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value as DeliveryExceptionReasonCode)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-delivery-reason-code">
                  {["CUSTOMER_UNAVAILABLE", "WRONG_ADDRESS", "COURIER_CANCELLED", "SELLER_CANCELLED", "CUSTOMER_CANCELLED", "DAMAGED_PACKAGE", "LOST_PACKAGE", "DELIVERY_TIMEOUT", "OTHER"].map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={3} placeholder="Internal admin comment" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-delivery-internal-comment" />
                <textarea value={customerMessage} onChange={(event) => setCustomerMessage(event.target.value)} rows={3} placeholder="Customer-visible message" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-delivery-customer-message" />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleAddAdminNote()} disabled={!selected.deliveryShipmentId || !adminNote.trim()} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50" data-testid="admin-delivery-add-comment">Add internal comment</button>
                  <button type="button" onClick={() => void handleUpdateCustomerMessage()} disabled={!selected.deliveryShipmentId || !customerMessage.trim()} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50" data-testid="admin-delivery-update-customer-message">Update customer message</button>
                </div>
              </div>
              {selected.events.length ? (
                <div className="space-y-3 border-t border-[var(--border)] pt-4">
                  {selected.events.map((event) => (
                    <article key={event.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">{event.eventType}</p>
                      <p className="mt-1 text-[var(--muted)]">{event.message ?? event.newStatus}</p>
                    </article>
                  ))}
                </div>
              ) : null}
              {selected.comments?.length ? (
                <div className="space-y-3 border-t border-[var(--border)] pt-4">
                  {selected.comments.map((comment) => (
                    <article key={comment.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">{comment.visibility}</p>
                      <p className="mt-1 text-[var(--muted)]">{comment.message}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select a delivery row to inspect details.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]" data-testid={testId}>{value}</p>
    </div>
  );
}
