"use client";

import { useEffect, useState } from "react";
import {
  getSellerRecommendationAnalyticsOverview,
  type SellerRecommendationAnalyticsOverview,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "last7d", label: "Last 7 days" },
  { value: "last30d", label: "Last 30 days" },
] as const;

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatCurrency(value: string) {
  return `${value} RUB`;
}

export function SellerRecommendationsAnalyticsPageClient() {
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);

  const [range, setRange] = useState<"today" | "last7d" | "last30d">("last7d");
  const [overview, setOverview] = useState<SellerRecommendationAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        if (shops.length < 1) {
          await loadShops();
        }
        if (!active) return;
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (!shopId) {
          setOverview(null);
          setError(null);
          return;
        }
        const nextOverview = await getSellerRecommendationAnalyticsOverview(shopId, {
          range,
          limit: 6,
        });
        if (!active) return;
        setOverview(nextOverview);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(
          issue instanceof Error ? issue.message : "Unable to load seller recommendation analytics.",
        );
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
  }, [currentShopId, hydrated, loadShops, range, shops.length]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Seller recommendations
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
              Recommendation analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Review how your products perform inside recommendation placements,
              including CTR, sponsored clicks, charged amount, and tracked personalization impact.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Current shop
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {overview?.shopName ?? "Pick a shop"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                range === option.value
                  ? "bg-[var(--foreground)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
          <p className="text-sm text-[var(--muted)]">Loading recommendation analytics...</p>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-8">
          <p className="text-sm text-[var(--accent-strong)]">{error}</p>
        </section>
      ) : null}

      {!loading && !error && overview ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Impressions"
              value={overview.summary.overall.impressions}
              detail={`Clicks ${overview.summary.overall.clicks} | CTR ${formatPercent(
                overview.summary.overall.ctr,
              )}`}
            />
            <MetricCard
              title="Sponsored"
              value={overview.summary.sponsored.clicks}
              detail={`Impressions ${overview.summary.sponsored.impressions} | CTR ${formatPercent(
                overview.summary.sponsored.ctr,
              )}`}
            />
            <MetricCard
              title="Charged amount"
              value={formatCurrency(overview.summary.sponsored.chargedAmount)}
              detail="Successful sponsored CPC charges for this shop's recommendation events"
            />
            <MetricCard
              title="Tracked personalization"
              value={formatPercent(overview.summary.personalization.personalizedCtr)}
              detail={`Non-personalized ${formatPercent(
                overview.summary.personalization.nonPersonalizedCtr,
              )}`}
            />
          </section>

          <AnalyticsTable
            title="Top clicked products"
            columns={["Product", "Clicks", "Impressions", "CTR", "Charged"]}
            rows={overview.topClickedProducts.map((item) => [
              item.productName,
              String(item.clicks),
              String(item.impressions),
              formatPercent(item.ctr),
              formatCurrency(item.chargedAmount),
            ])}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <AnalyticsTable
              title="Algorithms"
              columns={["Algorithm", "Impressions", "Clicks", "CTR", "Sponsored CTR"]}
              rows={overview.algorithms.map((item) => [
                item.algorithm,
                String(item.impressions),
                String(item.clicks),
                formatPercent(item.ctr),
                formatPercent(item.sponsoredCtr),
              ])}
            />
            <AnalyticsTable
              title="Scenarios"
              columns={["Scenario", "Impressions", "Clicks", "CTR", "Charged"]}
              rows={overview.scenarios.map((item) => [
                item.scenarioType,
                String(item.impressions),
                String(item.clicks),
                formatPercent(item.ctr),
                formatCurrency(item.chargedAmount),
              ])}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-3 text-3xl font-black text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function AnalyticsTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
      <h2 className="text-xl font-black text-[var(--foreground)]">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {columns.map((column) => (
                <th key={column} className="border-b border-[var(--border)] px-3 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {row.map((value, valueIndex) => (
                    <td
                      key={`${title}-${index}-${valueIndex}`}
                      className="border-b border-[var(--border)] px-3 py-3 text-[var(--foreground)]"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-sm text-[var(--muted)]"
                >
                  No analytics data in the selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
