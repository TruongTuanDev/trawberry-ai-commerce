"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  getSellerDashboardMetrics,
  getSellerFinanceInvoices,
  getSellerFinanceLedger,
  type SellerDashboardMetrics,
  type SellerFinanceInvoice,
  type SellerFinanceLedgerEntry,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

function formatRub(value: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function SellerFinancePageClient() {
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const [metrics, setMetrics] = useState<SellerDashboardMetrics | null>(null);
  const [ledger, setLedger] = useState<SellerFinanceLedgerEntry[]>([]);
  const [invoices, setInvoices] = useState<SellerFinanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        if (shops.length < 1) {
          await loadShops();
        }
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (!shopId) {
          if (active) {
            setMetrics(null);
            setLedger([]);
            setInvoices([]);
            setLoading(false);
          }
          return;
        }

        const [nextMetrics, nextLedger, nextInvoices] = await Promise.all([
          getSellerDashboardMetrics(shopId),
          getSellerFinanceLedger(shopId),
          getSellerFinanceInvoices(shopId),
        ]);

        if (!active) return;
        setMetrics(nextMetrics);
        setLedger(nextLedger);
        setInvoices(nextInvoices);
        setError(null);
      } catch (issue) {
        if (active) {
          setError(
            issue instanceof Error ? issue.message : "Unable to load seller finance.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [currentShopId, hydrated, loadShops, shops.length]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  return (
    <div className="space-y-6" data-testid="seller-finance-page">
      <SectionCard
        eyebrow="Finance"
        title="Seller Finance"
        description="Platform commission is calculated from confirmed paid product revenue only."
      >
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading finance data...</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : metrics ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">Shop</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {currentShop?.name ?? "Unknown shop"}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">Billing period</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {metrics.billingPeriod}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">Confirmed revenue this month</p>
              <p
                className="mt-3 text-lg font-semibold text-[var(--foreground)]"
                data-testid="seller-finance-confirmed-revenue-this-month"
              >
                {formatRub(metrics.confirmedRevenueThisMonth)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">Estimated platform fee</p>
              <p
                className="mt-3 text-lg font-semibold text-[var(--warning)]"
                data-testid="seller-finance-estimated-platform-fee"
              >
                {formatRub(metrics.estimatedPlatformFeeThisMonth)}
              </p>
            </article>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Select a shop to see finance data.</p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Ledger"
        title="Fee Ledger"
        description="Each final confirmed order snapshots commission percent at confirmation time."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium">Commission %</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {new Date(entry.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-3 py-3 font-medium text-[var(--foreground)]">
                    {entry.orderCode}
                  </td>
                  <td className="px-3 py-3">{formatRub(entry.productRevenueAmount)}</td>
                  <td className="px-3 py-3">{entry.commissionPercent}%</td>
                  <td className="px-3 py-3">{formatRub(entry.commissionAmount)}</td>
                  <td className="px-3 py-3">{entry.status}</td>
                </tr>
              ))}
              {ledger.length < 1 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                    No ledger entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Invoices"
        title="Monthly Invoices"
        description="Admin issues and marks invoices paid manually in this MVP phase."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Total revenue</th>
                <th className="px-3 py-2 font-medium">Total commission</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Paid at</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-[var(--border)]">
                  <td
                    className="px-3 py-3 font-medium text-[var(--foreground)]"
                    data-testid={`seller-finance-invoice-period-${invoice.id}`}
                  >
                    {invoice.billingPeriod}
                  </td>
                  <td className="px-3 py-3">{formatRub(invoice.totalRevenue)}</td>
                  <td className="px-3 py-3">{formatRub(invoice.totalCommission)}</td>
                  <td
                    className="px-3 py-3"
                    data-testid={`seller-finance-invoice-status-${invoice.id}`}
                  >
                    {invoice.status}
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {invoice.paidAt
                      ? new Date(invoice.paidAt).toLocaleDateString("ru-RU")
                      : "Not paid"}
                  </td>
                </tr>
              ))}
              {invoices.length < 1 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                    No invoices generated yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
