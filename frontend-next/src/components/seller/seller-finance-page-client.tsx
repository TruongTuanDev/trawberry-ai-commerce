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
import { useI18n } from "@/i18n/use-i18n";

function formatRub(value: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function SellerFinancePageClient() {
  const { t } = useI18n("seller");
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
            issue instanceof Error ? issue.message : t("seller.finance.loadFailed"),
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
  }, [currentShopId, hydrated, loadShops, shops.length, t]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.id === currentShopId) ?? null,
    [currentShopId, shops],
  );

  return (
    <div className="space-y-6" data-testid="seller-finance-page">
      <SectionCard
        eyebrow={t("seller.finance.eyebrow")}
        title={t("seller.finance.title")}
        description={t("seller.finance.subtitle")}
      >
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{t("seller.finance.loading")}</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : metrics ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{t("seller.finance.shop")}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {currentShop?.name ?? t("common.unknown")}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{t("seller.finance.billingPeriod")}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {metrics.billingPeriod}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{t("seller.finance.confirmedRevenueThisMonth")}</p>
              <p
                className="mt-3 text-lg font-semibold text-[var(--foreground)]"
                data-testid="seller-finance-confirmed-revenue-this-month"
              >
                {formatRub(metrics.confirmedRevenueThisMonth)}
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
              <p className="text-sm text-[var(--muted)]">{t("seller.finance.estimatedPlatformFee")}</p>
              <p
                className="mt-3 text-lg font-semibold text-[var(--warning)]"
                data-testid="seller-finance-estimated-platform-fee"
              >
                {formatRub(metrics.estimatedPlatformFeeThisMonth)}
              </p>
            </article>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t("seller.finance.selectShop")}</p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow={t("seller.finance.ledgerEyebrow")}
        title={t("seller.finance.ledgerTitle")}
        description={t("seller.finance.ledgerDescription")}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.date")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.order")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.source")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.revenue")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.commissionPercent")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.commission")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.status")}</th>
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
                  <td className="px-3 py-3 text-[var(--muted)]">
                    {entry.source}
                    {entry.referenceCaseId ? ` (${entry.referenceCaseId.slice(0, 8)})` : ""}
                  </td>
                  <td className="px-3 py-3">{formatRub(entry.productRevenueAmount)}</td>
                  <td className="px-3 py-3">{entry.commissionPercent}%</td>
                  <td className="px-3 py-3">{formatRub(entry.commissionAmount)}</td>
                  <td className="px-3 py-3">{entry.status}</td>
                </tr>
              ))}
              {ledger.length < 1 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--muted)]">
                    {t("seller.finance.noLedger")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={t("seller.finance.invoicesEyebrow")}
        title={t("seller.finance.invoicesTitle")}
        description={t("seller.finance.invoicesDescription")}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.period")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.totalRevenue")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.totalCommission")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.status")}</th>
                <th className="px-3 py-2 font-medium">{t("seller.finance.columns.paidAt")}</th>
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
                      : t("seller.finance.notPaid")}
                  </td>
                </tr>
              ))}
              {invoices.length < 1 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                    {t("seller.finance.noInvoices")}
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
