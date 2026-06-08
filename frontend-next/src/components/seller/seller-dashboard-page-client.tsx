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

const WORKSPACE_LINKS = [
  {
    href: "/seller/payments-to-confirm",
    title: "Review payments",
    description: "Confirm buyer proofs before orders move into fulfillment.",
  },
  {
    href: "/seller/orders",
    title: "Manage orders",
    description: "Pick up new orders, hand off deliveries, and close completed work.",
  },
  {
    href: "/seller/products",
    title: "Update products",
    description: "Tighten pricing, stock, and publishing readiness from one queue.",
  },
  {
    href: "/seller/campaigns",
    title: "Plan growth",
    description: "Tune campaigns and recommendation visibility without touching storefront logic.",
  },
];

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

  const priorities = useMemo(() => {
    if (!metrics) {
      return [];
    }

    return [
      {
        label: "Payments waiting for review",
        value: metrics.pendingPaymentOrders,
        href: "/seller/payments-to-confirm",
        tone:
          metrics.pendingPaymentOrders > 0
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-[var(--border)] bg-white text-[var(--foreground)]",
      },
      {
        label: "Orders in delivery",
        value: metrics.deliveryInProgressOrders,
        href: "/seller/orders?status=IN_TRANSIT",
        tone:
          metrics.deliveryInProgressOrders > 0
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : "border-[var(--border)] bg-white text-[var(--foreground)]",
      },
      {
        label: "Confirmed revenue today",
        value: formatRub(metrics.confirmedRevenueToday),
        href: "/seller/finance",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      },
    ];
  }, [metrics]);

  return (
    <div className="space-y-6" data-testid="seller-dashboard-page">
      <SectionCard
        eyebrow={t("seller.dashboard.eyebrow")}
        title={t("seller.dashboard.title")}
        description={t("seller.dashboard.description")}
      >
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(255,255,255,0.96))] p-4 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Seller workflow
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                      Start with the queues that unblock revenue
                    </h3>
                  </div>
                  <Link
                    href="/seller/orders"
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
                  >
                    Open orders
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {priorities.map((priority) => (
                    <Link
                      key={priority.label}
                      href={priority.href}
                      className={`rounded-[1.25rem] border px-4 py-4 transition hover:-translate-y-0.5 ${priority.tone}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                        {priority.label}
                      </p>
                      <p className="mt-3 text-2xl font-bold">{priority.value}</p>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Quick access
                </p>
                <div className="mt-4 space-y-3">
                  {WORKSPACE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 transition hover:border-[var(--accent)]/30 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {link.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        {link.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

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
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {t("seller.dashboard.financeHelp")}
            </p>
            <Link
              href="/seller/finance"
              className="public-button-primary mt-4 inline-flex items-center justify-center px-5 py-3 text-sm"
            >
              {t("seller.dashboard.openLedger")}
            </Link>
          </div>
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Monthly snapshot
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Confirmed revenue</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatRub(metrics?.confirmedRevenueThisMonth ?? "0")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Estimated platform fee</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatRub(metrics?.estimatedPlatformFeeThisMonth ?? "0")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[var(--muted)]">Days left in cycle</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {metrics?.daysLeftInMonth ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
