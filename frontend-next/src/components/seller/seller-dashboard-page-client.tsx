"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/seller/section-card";
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
            issue instanceof Error ? issue.message : "Unable to load seller shops.",
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
              : "Unable to load seller dashboard metrics.",
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

  const cards = metrics
    ? [
        { label: "Orders today", value: String(metrics.ordersToday), tone: "text-[var(--accent)]" },
        { label: "Revenue today", value: formatRub(metrics.revenueToday), tone: "text-[var(--success)]" },
        { label: "Orders this month", value: String(metrics.ordersThisMonth), tone: "text-[var(--foreground)]" },
        { label: "Revenue this month", value: formatRub(metrics.revenueThisMonth), tone: "text-[var(--foreground)]" },
        {
          label: "Confirmed revenue",
          value: formatRub(metrics.confirmedRevenueThisMonth),
          tone: "text-[var(--success)]",
        },
        {
          label: "Estimated platform fee",
          value: formatRub(metrics.estimatedPlatformFeeThisMonth),
          tone: "text-[var(--warning)]",
        },
      ]
    : [];

  return (
    <div className="space-y-6" data-testid="seller-dashboard-page">
      <SectionCard
        eyebrow="Overview"
        title="Dashboard"
        description="Live revenue, confirmed payment volume, and expected marketplace fee for the selected shop."
      >
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Active shop
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {currentShop?.name ?? "No shop selected"}
            </p>
          </div>
          {metrics ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Period
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.billingPeriod}
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Commission
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.commissionPercent}%
                </p>
              </article>
              <article className="rounded-[1.2rem] bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Days left
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {metrics.daysLeftInMonth}
                </p>
              </article>
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading dashboard...</p>
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
                <p className="text-sm text-[var(--muted)]">Pending payment orders</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {metrics.pendingPaymentOrders}
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm text-[var(--muted)]">Delivery in progress</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {metrics.deliveryInProgressOrders}
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm text-[var(--muted)]">Confirmed revenue today</p>
                <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
                  {formatRub(metrics.confirmedRevenueToday)}
                </p>
              </article>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Select a shop to see live seller revenue metrics.
          </p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Finance"
        title="Seller Finance"
        description="Confirmed paid orders generate a ledger-based platform fee. Invoices are issued manually by admin."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Only confirmed seller-paid orders count toward marketplace commission. Delivery fee is excluded when tracked separately.
          </p>
          <Link
            href="/seller/finance"
            className="public-button-primary inline-flex items-center justify-center px-5 py-3 text-sm"
          >
            Open finance ledger
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
