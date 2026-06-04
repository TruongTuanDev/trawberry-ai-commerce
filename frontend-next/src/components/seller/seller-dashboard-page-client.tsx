"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/seller/section-card";
import { useI18n } from "@/i18n/use-i18n";
import {
  getSellerDashboardMetrics,
  type SellerDashboardMetrics,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

function formatRub(value: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function SellerDashboardPageClient() {
  const { t } = useI18n("seller");
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const [metrics, setMetrics] = useState<SellerDashboardMetrics | null>(null);
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
      } catch (issue) {
        if (active) {
          setError(
            issue instanceof Error ? issue.message : t("seller.dashboard.loadShopsFailed"),
          );
          setLoading(false);
        }
        return;
      }

      const shopId = useSellerWorkspaceStore.getState().currentShopId;
      if (!shopId) {
        if (active) {
          setMetrics(null);
          setLoading(false);
        }
        return;
      }

      try {
        const nextMetrics = await getSellerDashboardMetrics(shopId);
        if (!active) return;
        setMetrics(nextMetrics);
        setError(null);
      } catch (issue) {
        if (active) {
          setError(
            issue instanceof Error
              ? issue.message
              : t("seller.dashboard.loadMetricsFailed"),
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

  const cards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: t("seller.dashboard.ordersToday"), value: String(metrics.ordersToday), tone: "text-[var(--accent)]" },
      { label: t("seller.dashboard.revenueToday"), value: formatRub(metrics.revenueToday), tone: "text-[var(--success)]" },
      { label: t("seller.dashboard.ordersThisMonth"), value: String(metrics.ordersThisMonth), tone: "text-[var(--foreground)]" },
      { label: t("seller.dashboard.revenueThisMonth"), value: formatRub(metrics.revenueThisMonth), tone: "text-[var(--foreground)]" },
      {
        label: t("seller.dashboard.confirmedRevenue"),
        value: formatRub(metrics.confirmedRevenueThisMonth),
        tone: "text-[var(--success)]",
      },
      {
        label: t("seller.dashboard.estimatedPlatformFee"),
        value: formatRub(metrics.estimatedPlatformFeeThisMonth),
        tone: "text-[var(--warning)]",
      },
    ];
  }, [metrics, t]);

  return (
    <div className="space-y-6" data-testid="seller-dashboard-page">
      <SectionCard
        eyebrow={t("seller.dashboard.eyebrow")}
        title={t("seller.dashboard.title")}
        description={t("seller.dashboard.description")}
      >
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("seller.dashboard.activeShop")}
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {currentShop?.name ?? t("seller.dashboard.noShopSelected")}
            </p>
          </div>
          {metrics ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("seller.dashboard.period")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.billingPeriod}
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("seller.dashboard.commission")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.commissionPercent}%
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t("seller.dashboard.daysLeft")}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.daysLeftInMonth}
                </p>
              </article>
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">{t("seller.dashboard.loading")}</p>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : metrics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                >
                  <p className="text-sm text-[var(--muted)]">{metric.label}</p>
                  <p
                    className={`mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold ${metric.tone}`}
                  >
                    {metric.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm text-[var(--muted)]">{t("seller.dashboard.pendingPaymentOrders")}</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {metrics.pendingPaymentOrders}
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm text-[var(--muted)]">{t("seller.dashboard.deliveryInProgress")}</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {metrics.deliveryInProgressOrders}
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm text-[var(--muted)]">{t("seller.dashboard.confirmedRevenueToday")}</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {formatRub(metrics.confirmedRevenueToday)}
                </p>
              </article>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {t("seller.dashboard.selectShopHint")}
          </p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow={t("seller.dashboard.financeEyebrow")}
        title={t("seller.dashboard.financeTitle")}
        description={t("seller.dashboard.financeDescription")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t("seller.dashboard.financeHelp")}
          </p>
          <Link
            href="/seller/finance"
            className="public-button-primary inline-flex items-center justify-center px-5 py-3 text-sm"
          >
            {t("seller.dashboard.openLedger")}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
