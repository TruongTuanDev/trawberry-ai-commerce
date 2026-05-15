"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  adminReportCsvUrl,
  getAdminOpsSummaryReport,
  listAdminDeliveryExceptionsReport,
  listAdminPaymentAgingReport,
  listAdminSlaBreachesReport,
  listAdminWorkloadReport,
  type AdminDeliveryExceptionReportRow,
  type AdminOpsSummaryReport,
  type AdminPaymentAgingReportRow,
  type AdminSlaBreachReportRow,
  type AdminWorkloadReportRow,
} from "@/lib/admin-api";

type ReportTab = "summary" | "sla" | "workload" | "delivery" | "payments";

const tabs: Array<{ value: ReportTab; label: string }> = [
  { value: "summary", label: "Ops Summary" },
  { value: "sla", label: "SLA Breaches" },
  { value: "workload", label: "Workload" },
  { value: "delivery", label: "Delivery Exceptions" },
  { value: "payments", label: "Payment Aging" },
];

export function AdminReportsPageClient() {
  const [tab, setTab] = useState<ReportTab>("summary");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<AdminOpsSummaryReport | null>(null);
  const [slaRows, setSlaRows] = useState<AdminSlaBreachReportRow[]>([]);
  const [workloadRows, setWorkloadRows] = useState<AdminWorkloadReportRow[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<AdminDeliveryExceptionReportRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<AdminPaymentAgingReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => ({ dateFrom, dateTo, limit: 20 }), [dateFrom, dateTo]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryResult, slaResult, workloadResult, deliveryResult, paymentResult] = await Promise.all([
          getAdminOpsSummaryReport({ dateFrom, dateTo }),
          listAdminSlaBreachesReport(query),
          listAdminWorkloadReport({ dateFrom, dateTo }),
          listAdminDeliveryExceptionsReport(query),
          listAdminPaymentAgingReport(query),
        ]);
        if (!mounted) return;
        setSummary(summaryResult);
        setSlaRows(slaResult.items);
        setWorkloadRows(workloadResult.items);
        setDeliveryRows(deliveryResult.items);
        setPaymentRows(paymentResult.items);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load reports.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [dateFrom, dateTo, query]);

  return (
    <div className="space-y-6" data-testid="admin-reports-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Marketplace operations</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Ops reports</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">SLA, workload, delivery exception, and payment aging reports for admin operations.</p>
          </div>
          <Link href="/admin/queues" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
            Queues
          </Link>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Date from
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-reports-date-from" />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Date to
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-reports-date-to" />
          </label>
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="self-end rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold">
            Reset
          </button>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.value ? "bg-[#2f2025] text-white" : "border border-[var(--border)] text-[var(--foreground)]"}`}
              data-testid={`admin-report-tab-${item.value}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? <p className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 text-sm text-[var(--muted)]">Loading reports...</p> : null}
      {!loading && tab === "summary" && summary ? <SummaryView summary={summary} /> : null}
      {!loading && tab === "sla" ? <SlaView rows={slaRows} query={query} /> : null}
      {!loading && tab === "workload" ? <WorkloadView rows={workloadRows} query={{ dateFrom, dateTo }} /> : null}
      {!loading && tab === "delivery" ? <DeliveryView rows={deliveryRows} query={query} /> : null}
      {!loading && tab === "payments" ? <PaymentView rows={paymentRows} query={query} /> : null}
    </div>
  );
}

function SummaryView({ summary }: { summary: AdminOpsSummaryReport }) {
  const cards = [
    ["Total tasks", summary.totalTasks],
    ["Open", summary.openTasks],
    ["In progress", summary.inProgressTasks],
    ["Escalated", summary.escalatedTasks],
    ["Resolved", summary.resolvedTasks],
    ["Breached", summary.breachedTasks],
    ["Pending payments", summary.pendingPayments],
    ["Delivery exceptions", summary.deliveryExceptions],
    ["Low stock", summary.lowStockProducts],
    ["Out of stock", summary.outOfStockProducts],
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="admin-reports-summary">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-[1rem] border border-[var(--border)] bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
        </div>
      ))}
    </section>
  );
}

function SlaView({ rows, query }: { rows: AdminSlaBreachReportRow[]; query: Record<string, string | number | undefined> }) {
  return (
    <ReportSection title="SLA breaches" csvHref={adminReportCsvUrl("sla-breaches", query)} testId="admin-report-sla">
      {rows.map((row) => (
        <ReportRow key={row.id} title={row.title} meta={`${row.entityType} - ${row.status} - ${row.priority}`} detail={`${row.assignedToEmail ?? "Unassigned"} - ${row.ageHours}h`} href="/admin/queues" />
      ))}
    </ReportSection>
  );
}

function WorkloadView({ rows, query }: { rows: AdminWorkloadReportRow[]; query: Record<string, string | number | undefined> }) {
  return (
    <ReportSection title="Workload" csvHref={adminReportCsvUrl("workload", query)} testId="admin-report-workload">
      {rows.map((row) => (
        <ReportRow key={row.adminUserId} title={row.adminEmail} meta={`${row.assignedTasks} assigned - ${row.escalatedTasks} escalated`} detail={`${row.resolvedTasks} resolved - avg ${row.averageResolutionHours}h`} href="/admin/queues" />
      ))}
    </ReportSection>
  );
}

function DeliveryView({ rows, query }: { rows: AdminDeliveryExceptionReportRow[]; query: Record<string, string | number | undefined> }) {
  return (
    <ReportSection title="Delivery exceptions" csvHref={adminReportCsvUrl("delivery-exceptions", query)} testId="admin-report-delivery">
      {rows.map((row) => (
        <ReportRow key={row.id} title={row.orderNumber} meta={`${row.provider} - ${row.status} - ${row.reasonCode ?? "No reason"}`} detail={`${row.shopName} - ${row.sellerEmail} - ${row.ageHours}h`} href={row.actionUrl} />
      ))}
    </ReportSection>
  );
}

function PaymentView({ rows, query }: { rows: AdminPaymentAgingReportRow[]; query: Record<string, string | number | undefined> }) {
  return (
    <ReportSection title="Payment aging" csvHref={adminReportCsvUrl("payment-aging", query)} testId="admin-report-payments">
      {rows.map((row) => (
        <ReportRow key={row.id} title={row.orderNumber} meta={`${row.paymentStatus} - ${row.ageBucket} - ${row.totalAmount}`} detail={`${row.shopName} - ${row.customerName}`} href={row.actionUrl} />
      ))}
    </ReportSection>
  );
}

function ReportSection({ title, csvHref, testId, children }: { title: string; csvHref: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-[var(--foreground)]">{title}</h3>
        <a href={csvHref} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold" data-testid="admin-report-csv">
          Export CSV
        </a>
      </div>
      <div className="mt-4 divide-y divide-[var(--border)] rounded-[1rem] border border-[var(--border)]">
        {Array.isArray(children) && children.length === 0 ? <p className="px-4 py-5 text-sm text-[var(--muted)]">No report rows.</p> : children}
      </div>
    </section>
  );
}

function ReportRow({ title, meta, detail, href }: { title: string; meta: string; detail: string; href: string }) {
  return (
    <article className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center" data-testid="admin-report-row">
      <div>
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{meta}</p>
      </div>
      <p className="text-sm text-[var(--muted)]">{detail}</p>
      <Link href={href} className="rounded-full border border-[var(--border)] px-3 py-2 text-center text-xs font-semibold">
        Open
      </Link>
    </article>
  );
}
