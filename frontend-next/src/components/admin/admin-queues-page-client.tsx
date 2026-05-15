"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  listAdminQueueDeliveries,
  listAdminQueueInventory,
  listAdminQueuePayments,
  listAdminQueueSellers,
  type AdminQueueItem,
  type AdminQueueResponse,
  type AdminQueueSlaStatus,
} from "@/lib/admin-api";

type QueueTab = "sellers" | "payments" | "deliveries" | "inventory";

const tabs: Array<{ value: QueueTab; label: string }> = [
  { value: "sellers", label: "Sellers" },
  { value: "payments", label: "Payments" },
  { value: "deliveries", label: "Deliveries" },
  { value: "inventory", label: "Inventory" },
];

export function AdminQueuesPageClient() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as QueueTab | null) ?? "sellers";
  const [tab, setTab] = useState<QueueTab>(tabs.some((item) => item.value === initialTab) ? initialTab : "sellers");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [ageBucket, setAgeBucket] = useState(searchParams.get("ageBucket") ?? "");
  const [provider, setProvider] = useState(searchParams.get("provider") ?? "");
  const [data, setData] = useState<AdminQueueResponse<AdminQueueItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await loadQueue(tab, status, ageBucket, provider);
        if (!mounted) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load queue.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [tab, status, ageBucket, provider]);

  const statusOptions = useMemo(() => {
    if (tab === "sellers") return ["PENDING", "APPROVED", "REJECTED"];
    if (tab === "payments") return ["PENDING", "PAID", "REJECTED"];
    if (tab === "deliveries") return ["PAID_WITHOUT_DELIVERY", "EXCEPTION", "IN_TRANSIT", "DELIVERED"];
    return ["LOW_STOCK", "OUT_OF_STOCK"];
  }, [tab]);

  const currentStatus = status || statusOptions[0];

  return (
    <div className="space-y-6" data-testid="admin-queues-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Marketplace operations</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Operational queues</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Worklists for seller approvals, payment review, delivery supervision, and inventory alerts with SLA indicators.</p>
          </div>
          <Link href="/admin/dashboard" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
            Dashboard
          </Link>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setTab(item.value);
                setStatus("");
                setAgeBucket("");
                setProvider("");
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.value ? "bg-[#2f2025] text-white" : "border border-[var(--border)] text-[var(--foreground)]"}`}
              data-testid={`admin-queue-tab-${item.value}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Status
            <select value={currentStatus} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-queue-status-filter">
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            SLA
            <select value={ageBucket} onChange={(event) => setAgeBucket(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-queue-sla-filter">
              <option value="">All</option>
              <option value="OK">OK</option>
              <option value="WARNING">Warning</option>
              <option value="BREACHED">Breached</option>
            </select>
          </label>
          {tab === "deliveries" ? (
            <label className="text-sm font-semibold text-[var(--foreground)]">
              Provider
              <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-queue-provider-filter">
                <option value="">All</option>
                <option value="YANDEX">YANDEX</option>
                <option value="CDEK">CDEK</option>
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Queue</p>
            <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{tabs.find((item) => item.value === tab)?.label}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {Object.entries(data?.summary ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-[0.85rem] border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
                <p className="text-[11px] uppercase text-[var(--muted)]">{key}</p>
                <p className="text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[1rem] border border-[var(--border)]">
          {loading ? (
            <p className="px-4 py-5 text-sm text-[var(--muted)]">Loading queue...</p>
          ) : data && data.items.length > 0 ? (
            <div className="divide-y divide-[var(--border)]" data-testid="admin-queue-list">
              {data.items.map((item) => <QueueRow key={`${tab}-${item.id}`} item={item} />)}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[var(--muted)]">No queue items match these filters.</p>
          )}
        </div>
      </section>
    </div>
  );
}

async function loadQueue(tab: QueueTab, status: string, ageBucket: string, provider: string) {
  const limit = 20;
  if (tab === "sellers") return listAdminQueueSellers({ status: status || "PENDING", ageBucket, limit });
  if (tab === "payments") return listAdminQueuePayments({ status: status || "PENDING", ageBucket, limit });
  if (tab === "deliveries") return listAdminQueueDeliveries({ queueType: status || "PAID_WITHOUT_DELIVERY", ageBucket, provider, limit });
  return listAdminQueueInventory({ stockStatus: status || "LOW_STOCK", limit });
}

function QueueRow({ item }: { item: AdminQueueItem }) {
  const title = item.orderCode ?? item.productName ?? item.sellerName ?? item.sellerEmail;
  return (
    <article className="grid gap-4 px-4 py-4 lg:grid-cols-[1.3fr_1fr_auto] lg:items-center" data-testid="admin-queue-row">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[var(--foreground)]">{title}</p>
          <StatusBadge value={item.status} />
          <SlaBadge value={item.slaStatus} />
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {item.shopName ?? "No shop"} · {item.sellerEmail}
        </p>
        {item.customerName ? <p className="mt-1 text-xs text-[var(--muted)]">Customer: {item.customerName}</p> : null}
      </div>
      <div className="text-sm text-[var(--muted)]">
        <p>{item.ageHours}h old ({item.ageMinutes}m)</p>
        <p>Updated {new Date(item.updatedAt).toLocaleString()}</p>
        {typeof item.stockQuantity === "number" ? <p>Stock {item.stockQuantity} / threshold {item.lowStockThreshold}</p> : null}
      </div>
      <Link href={item.actionUrl} className="rounded-full border border-[var(--border)] px-4 py-2 text-center text-sm font-semibold" data-testid="admin-queue-action">
        Open
      </Link>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  return <span className="rounded-full bg-[var(--panel)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">{value}</span>;
}

function SlaBadge({ value }: { value: AdminQueueSlaStatus }) {
  const styles = value === "BREACHED" ? "bg-rose-100 text-rose-800" : value === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`} data-testid="admin-queue-sla">{value}</span>;
}
