"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminDashboardSummary,
  type AdminDashboardSummary,
} from "@/lib/admin-api";

type AttentionItem = {
  label: string;
  value: number;
  href: string;
  tone: "rose" | "amber" | "blue";
};

export function AdminDashboardPageClient() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);
      try {
        const result = await getAdminDashboardSummary();
        if (!mounted) return;
        setSummary(result);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load dashboard.",
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
  }, []);

  const attention = useMemo<AttentionItem[]>(() => {
    if (!summary) return [];
    return [
      {
        label: "Paid without delivery",
        value: summary.orders.paidWithoutDelivery,
        href: "/admin/queues?tab=deliveries&status=PAID_WITHOUT_DELIVERY",
        tone: "amber",
      },
      {
        label: "Pending payment review",
        value: summary.payments.pending,
        href: "/admin/queues?tab=payments&status=PENDING",
        tone: "blue",
      },
      {
        label: "Delivery exceptions",
        value: summary.deliveries.exceptions,
        href: "/admin/queues?tab=deliveries&status=EXCEPTION",
        tone: "rose",
      },
      {
        label: "Low or out of stock",
        value: summary.inventory.lowStock + summary.inventory.outOfStock,
        href: "/admin/queues?tab=inventory&status=LOW_STOCK",
        tone: "amber",
      },
      {
        label: "Pending seller approvals",
        value: summary.sellers.pending,
        href: "/admin/queues?tab=sellers&status=PENDING",
        tone: "blue",
      },
    ];
  }, [summary]);

  if (loading) {
    return (
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
        <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
        <p className="text-sm text-[var(--accent-strong)]">
          {error ?? "Dashboard data was not available."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Marketplace operations
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
              Admin dashboard
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Daily operating view across sellers, payments, inventory, orders,
              and seller-managed delivery.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Range
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {summary.filters.defaultRange}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Orders"
          value={summary.orders.total}
          detail={`${summary.orders.pending} pending · ${summary.orders.paid} paid`}
          href="/admin/queues?tab=deliveries&status=PAID_WITHOUT_DELIVERY"
          testId="admin-dashboard-card-orders"
        />
        <DashboardCard
          title="Payments"
          value={summary.payments.pending}
          detail={`${summary.payments.paid} paid · ${summary.payments.rejected} rejected`}
          href="/admin/queues?tab=payments&status=PENDING"
          testId="admin-dashboard-card-payments"
        />
        <DashboardCard
          title="Deliveries"
          value={summary.deliveries.inTransit}
          detail={`${summary.deliveries.notCreated} not created · ${summary.deliveries.deliveredThisWeek} delivered this week`}
          href="/admin/deliveries"
          testId="admin-dashboard-card-deliveries"
        />
        <DashboardCard
          title="Inventory"
          value={summary.inventory.lowStock + summary.inventory.outOfStock}
          detail={`${summary.inventory.lowStock} low · ${summary.inventory.outOfStock} out`}
          href="/admin/queues?tab=inventory&status=LOW_STOCK"
          testId="admin-dashboard-card-inventory"
        />
        <DashboardCard
          title="Sellers"
          value={summary.sellers.pending}
          detail={`${summary.sellers.approved} approved · ${summary.sellers.rejected} rejected`}
          href="/admin/queues?tab=sellers&status=PENDING"
          testId="admin-dashboard-card-sellers"
        />
        <DashboardCard
          title="Exceptions"
          value={summary.deliveries.exceptions}
          detail={`${summary.deliveries.failed} failed · ${summary.deliveries.cancelled} cancelled`}
          href="/admin/queues?tab=deliveries&status=EXCEPTION"
          testId="admin-dashboard-card-exceptions"
        />
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Needs attention
            </p>
            <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              Operational queue
            </h3>
          </div>
          <Link
            href="/admin/deliveries"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
          >
            Delivery supervision
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {attention.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-[1rem] border px-4 py-4 transition hover:bg-[var(--panel)] ${toneClass(item.tone)}`}
              data-testid={`admin-dashboard-attention-${slugify(item.label)}`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-3 text-3xl font-bold">{item.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <RecentPanel title="Latest orders">
          {summary.recent.orders.map((order) => (
            <RecentRow
              key={order.id}
              title={order.orderNumber}
              meta={`${order.shopName} · ${order.paymentStatus}`}
              time={order.createdAt}
            />
          ))}
        </RecentPanel>
        <RecentPanel title="Delivery exceptions">
          {summary.recent.deliveryExceptions.map((delivery) => (
            <RecentRow
              key={delivery.id}
              title={delivery.orderNumber}
              meta={`${delivery.status} · ${delivery.reasonCode ?? "No reason"}`}
              time={delivery.updatedAt}
            />
          ))}
        </RecentPanel>
        <RecentPanel title="Audit actions">
          {summary.recent.auditLogs.map((log) => (
            <RecentRow
              key={log.id}
              title={log.action}
              meta={log.entityType}
              time={log.createdAt}
            />
          ))}
        </RecentPanel>
      </section>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  detail,
  href,
  testId,
}: {
  title: string;
  value: number;
  detail: string;
  href: string;
  testId: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 transition hover:bg-[var(--panel)]"
      data-testid={testId}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </p>
      <p
        className="mt-4 text-4xl font-bold text-[var(--foreground)]"
        data-testid={`${testId}-value`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p>
    </Link>
  );
}

function RecentPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {children || <p className="text-sm text-[var(--muted)]">No activity.</p>}
      </div>
    </section>
  );
}

function RecentRow({
  title,
  meta,
  time,
}: {
  title: string;
  meta: string;
  time: string;
}) {
  return (
    <article className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{meta}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {new Date(time).toLocaleString()}
      </p>
    </article>
  );
}

function toneClass(tone: AttentionItem["tone"]) {
  if (tone === "rose") return "border-rose-100 bg-rose-50 text-rose-800";
  if (tone === "amber") return "border-amber-100 bg-amber-50 text-amber-800";
  return "border-sky-100 bg-sky-50 text-sky-800";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
