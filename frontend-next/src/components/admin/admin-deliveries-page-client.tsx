"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminRemindYandex,
  listAdminFulfillmentOrders,
  type AdminFulfillmentAction,
  type AdminFulfillmentBucket,
  type AdminFulfillmentResponse,
  type AdminFulfillmentRow,
} from "@/lib/admin-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const fulfillmentTabs: Array<{
  value: AdminFulfillmentBucket;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "NEW", label: "New" },
  { value: "ASSEMBLING", label: "Assembling" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
];

const paymentStatusOptions = [
  "",
  "PENDING",
  "APPROVED",
  "PAID",
  "SELLER_CONFIRMED_DELIVERY_PAYMENT",
  "REJECTED",
  "FAILED",
];

const deliveryStatusOptions = [
  "",
  "YANDEX_MANUAL_CREATED",
  "CREATED_MANUALLY",
  "CREATED",
  "COURIER_ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

function resolveInitialTab(searchParams: URLSearchParams): AdminFulfillmentBucket {
  const bucket = searchParams.get("bucket");
  if (bucket && fulfillmentTabs.some((tab) => tab.value === bucket)) {
    return bucket as AdminFulfillmentBucket;
  }

  const legacyStatus = searchParams.get("status");
  if (legacyStatus === "MISSING_YANDEX_ORDER_ID" || legacyStatus === "PAID_WITHOUT_DELIVERY") {
    return "NEW";
  }
  if (legacyStatus === "READY_TO_CREATE_YANDEX" || legacyStatus === "CREATED_MANUALLY" || legacyStatus === "YANDEX_MANUAL_CREATED") {
    return "ASSEMBLING";
  }
  if (legacyStatus === "ON_THE_WAY" || legacyStatus === "IN_TRANSIT" || legacyStatus === "PICKED_UP" || legacyStatus === "COURIER_ASSIGNED") {
    return "IN_TRANSIT";
  }
  if (legacyStatus === "DELIVERED") {
    return "COMPLETED";
  }
  if (legacyStatus === "FAILED" || legacyStatus === "CANCELLED" || searchParams.get("exceptionOnly") === "true") {
    return "CANCELLED";
  }

  return "NEW";
}

function formatAge(ageMinutes: number) {
  if (ageMinutes < 60) return `${ageMinutes}m`;
  if (ageMinutes < 1440) return `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`;
  const days = Math.floor(ageMinutes / 1440);
  const hours = Math.floor((ageMinutes % 1440) / 60);
  return `${days}d ${hours}h`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function actionLabel(action: AdminFulfillmentAction) {
  switch (action) {
    case "VIEW":
      return "Open detail";
    case "REMIND_SELLER":
      return "Remind seller";
    default:
      return action;
  }
}

function isReminderResult(
  value: unknown,
): value is {
  reminderCreated: boolean;
  lastReminderAt: string | null;
  nextAllowedAt: string | null;
} {
  return value !== null && typeof value === "object" && "reminderCreated" in value;
}

export function AdminDeliveriesPageClient() {
  const searchParams = useSearchParams();
  const [bucket, setBucket] = useState<AdminFulfillmentBucket>(() => resolveInitialTab(searchParams));
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [sellerId, setSellerId] = useState(searchParams.get("sellerId") ?? "");
  const [shopId, setShopId] = useState(searchParams.get("shopId") ?? "");
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") ?? "");
  const [deliveryStatus, setDeliveryStatus] = useState(searchParams.get("deliveryStatus") ?? "");
  const [provider, setProvider] = useState(searchParams.get("provider") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") ?? "");
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get("overdueOnly") === "true" || searchParams.get("status") === "OVERDUE");
  const [response, setResponse] = useState<AdminFulfillmentResponse | null>(null);
  const [selected, setSelected] = useState<AdminFulfillmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { run: runAction, isRunning } = useActionFeedback();

  const query = useMemo(
    () => ({
      page: 1,
      size: 50,
      bucket: bucket === "ALL" ? undefined : bucket,
      search: search.trim() || undefined,
      sellerId: sellerId.trim() || undefined,
      shopId: shopId.trim() || undefined,
      paymentStatus: paymentStatus || undefined,
      deliveryStatus: deliveryStatus || undefined,
      provider: provider || undefined,
      overdueOnly: overdueOnly || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [bucket, dateFrom, dateTo, deliveryStatus, overdueOnly, paymentStatus, provider, search, sellerId, shopId],
  );

  const items = response?.items ?? [];
  const summary = response?.summary ?? {
    ALL: 0,
    NEW: 0,
    ASSEMBLING: 0,
    IN_TRANSIT: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    ARCHIVED: 0,
  };

  const load = async () => {
    setLoading(true);
    try {
      const next = await listAdminFulfillmentOrders(query);
      setResponse(next);
      setSelected((current) => next.items.find((item) => item.orderId === current?.orderId) ?? next.items[0] ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fulfillment supervision.");
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

  const performAction = async (action: AdminFulfillmentAction) => {
    if (!selected || action !== "REMIND_SELLER") return;

    await runAction({
      action: async () => adminRemindYandex(selected.orderId),
      successMessage: `Processed: ${actionLabel(action)}.`,
      errorMessage: "Unable to process admin supervision action.",
      onSuccess: async (result) => {
        if (isReminderResult(result) && !result.reminderCreated) {
          setMessage(
            `A reminder already exists. Next reminder is available ${result.nextAllowedAt ? formatDateTime(String(result.nextAllowedAt)) : "soon"}.`,
          );
        } else {
          setMessage("Seller reminder sent.");
        }
        await load();
      },
      onError: (_, nextError) => {
        setError(nextError);
      },
    }).catch(() => {});
  };

  return (
    <div className="space-y-6" data-testid="admin-deliveries-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Fulfillment supervision</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Admin order fulfillment</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Admin supervises seller operations across the same lifecycle buckets sellers use, without taking over operational state changes.
            </p>
            <p
              className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
              data-testid="admin-supervision-readonly-note"
            >
              Admin only supervises, reminds, and escalates. Seller owns fulfillment status transitions.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Visible" value={String(items.length)} />
            <MetricCard label="Overdue" value={String(items.filter((item) => item.isOverdue).length)} />
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin fulfillment buckets">
          {fulfillmentTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setBucket(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                bucket === tab.value ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              data-testid={`admin-fulfillment-tab-${tab.value}`}
            >
              {tab.label} ({summary[tab.value]})
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, seller, shop, buyer"
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="admin-delivery-search"
          />
          <input value={sellerId} onChange={(event) => setSellerId(event.target.value)} placeholder="Filter sellerId" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
          <input value={shopId} onChange={(event) => setShopId(event.target.value)} placeholder="Filter shopId" className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
          <button type="button" onClick={() => void load()} className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold">
            Refresh
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_170px_170px_170px]">
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            {paymentStatusOptions.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All payment statuses"}
              </option>
            ))}
          </select>
          <select value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            {deliveryStatusOptions.map((value) => (
              <option key={value || "all"} value={value}>
                {value || "All delivery statuses"}
              </option>
            ))}
          </select>
          <select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <option value="">All providers</option>
            <option value="YANDEX">YANDEX</option>
            <option value="CDEK">CDEK</option>
            <option value="MANUAL">MANUAL</option>
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
            Overdue only
          </label>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      {message ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="admin-delivery-message">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[130px_1.1fr_1fr_140px_140px_140px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)] lg:grid">
            <div>Order</div>
            <div>Seller / Shop</div>
            <div>Buyer / Products</div>
            <div>Payment</div>
            <div>Yandex</div>
            <div>Age</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">Loading fulfillment orders...</div>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.orderId}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`grid w-full gap-4 px-5 py-4 text-left transition hover:bg-[var(--panel)] lg:grid-cols-[130px_1.1fr_1fr_140px_140px_140px] ${selected?.orderId === item.orderId ? "bg-[var(--panel)]" : ""}`}
                  data-testid="admin-delivery-row"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.orderCode}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.fulfillmentLabel}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.sellerName ?? item.sellerEmail}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.shopName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.sellerEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.customerName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.customerPhone}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {item.items.slice(0, 2).map((entry) => `${entry.productTitleSnapshot} x${entry.quantity}`).join(", ")}
                      {item.items.length > 2 ? ` +${item.items.length - 2}` : ""}
                    </p>
                  </div>
                  <div>
                    <span className="inline-flex rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {item.paymentStatus}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-[var(--foreground)]">{item.manualYandexOrderId ?? "Missing"}</p>
                    {item.yandexTrackingUrl ? (
                      <a href={item.yandexTrackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-[var(--accent)] underline">
                        Tracking
                      </a>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatAge(item.ageMinutes)}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(item.updatedAt)}</p>
                    {item.isOverdue ? (
                      <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Overdue
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">No orders match the current supervision filter.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="admin-delivery-detail">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Selected order</p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{selected.orderCode}</h3>
                </div>
                {selected.isOverdue ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Overdue</span>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Metric label="Bucket" value={selected.fulfillmentLabel} testId="admin-delivery-detail-status" />
                <Metric label="Payment status" value={selected.paymentStatus} />
                <Metric label="Seller" value={selected.sellerName ?? selected.sellerEmail} />
                <Metric label="Shop" value={selected.shopName} />
                <Metric label="Buyer" value={`${selected.customerName} - ${selected.customerPhone}`} />
                <Metric label="Yandex ID" value={selected.manualYandexOrderId ?? "Missing"} />
                <Metric label="Delivery status" value={selected.deliveryStatus ?? "Not created"} />
                <Metric label="Last update" value={formatDateTime(selected.updatedAt)} />
                <Metric label="Last reminder" value={selected.lastReminderAt ? formatDateTime(selected.lastReminderAt) : "Not reminded"} />
                <Metric label="Provider" value={selected.provider ?? "Not assigned"} />
              </div>

              <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Products</p>
                <div className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
                  {selected.items.map((item) => (
                    <p key={item.id}>
                      {item.productTitleSnapshot} x {item.quantity}
                    </p>
                  ))}
                </div>
              </div>

              {selected.yandexTrackingUrl ? (
                <a href={selected.yandexTrackingUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-[var(--accent)] underline">
                  Open tracking URL
                </a>
              ) : null}

              <div className="space-y-3 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Admin supervision actions</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Admin can view, filter, inspect payment and Yandex details, and remind the seller to continue operations.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setSelected(selected)}
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                    >
                      {actionLabel("VIEW")}
                    </button>
                    {selected.nextAdminActions.includes("REMIND_SELLER") ? (
                      <button
                        type="button"
                        onClick={() => void performAction("REMIND_SELLER")}
                        disabled={isRunning}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        data-testid="admin-remind-seller-yandex"
                      >
                        {isRunning ? "Processing..." : actionLabel("REMIND_SELLER")}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Age in bucket" value={formatAge(selected.ageMinutes)} />
                  <Metric label="Order action ownership" value="Seller-operated" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Select an order to inspect supervision detail.</p>
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
      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
