"use client";

import { useEffect, useState } from "react";
import {
  getAdminRecommendationAnalyticsAlgorithms,
  getAdminRecommendationAnalyticsOverview,
  getAdminRecommendationAnalyticsProducts,
  getAdminRecommendationAnalyticsScenarios,
  type RecommendationAnalyticsAlgorithmRow,
  type RecommendationAnalyticsOverview,
  type RecommendationAnalyticsProductsResponse,
  type RecommendationAnalyticsRangePreset,
  type RecommendationAnalyticsScenarioRow,
} from "@/lib/admin-api";
import { readRecommendationFlagsFromDocument } from "@/lib/recommendation-flags";

const RANGE_OPTIONS: Array<{
  value: RecommendationAnalyticsRangePreset;
  label: string;
}> = [
  { value: "today", label: "Today" },
  { value: "last7d", label: "Last 7 days" },
  { value: "last30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" },
];

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatCurrency(value: string) {
  return `${value} RUB`;
}

export function AdminRecommendationsAnalyticsPageClient() {
  const recommendationFlags = readRecommendationFlagsFromDocument();
  const [range, setRange] = useState<RecommendationAnalyticsRangePreset>("last7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [overview, setOverview] = useState<RecommendationAnalyticsOverview | null>(null);
  const [algorithms, setAlgorithms] = useState<RecommendationAnalyticsAlgorithmRow[]>([]);
  const [scenarios, setScenarios] = useState<RecommendationAnalyticsScenarioRow[]>([]);
  const [products, setProducts] = useState<RecommendationAnalyticsProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const query = {
          range,
          from: range === "custom" ? from || undefined : undefined,
          to: range === "custom" ? to || undefined : undefined,
          limit: 8,
        };
        const [nextOverview, nextAlgorithms, nextScenarios, nextProducts] =
          await Promise.all([
            getAdminRecommendationAnalyticsOverview(query),
            getAdminRecommendationAnalyticsAlgorithms(query),
            getAdminRecommendationAnalyticsScenarios(query),
            getAdminRecommendationAnalyticsProducts(query),
          ]);
        if (!active) return;
        setOverview(nextOverview);
        setAlgorithms(nextAlgorithms.items);
        setScenarios(nextScenarios.items);
        setProducts(nextProducts);
        setError(null);
      } catch (issue) {
        if (!active) return;
        setError(
          issue instanceof Error ? issue.message : "Unable to load recommendation analytics.",
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
  }, [from, range, to]);

  return (
    <div className="space-y-6" data-testid="admin-recommendations-analytics-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Marketplace recommendations
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
              Recommendation analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Review recommendation impressions, clicks, CTR, sponsored charge flow,
              and lightweight personalization impact without exposing raw user or session data.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Range
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {overview?.range.range ?? range}
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
          {range === "custom" ? (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
              />
            </div>
          ) : null}
        </div>
        {recommendationFlags.recommendationAnalyticsTuningEnabled ? (
          <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Analytics-based ranking tuning is enabled for internal evaluation. Public
            recommendation payloads stay backward compatible, while QA/debug views may
            show bounded CTR and engagement tuning hints.
          </div>
        ) : null}
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
              title="Total impressions"
              value={overview.summary.overall.impressions}
              detail={`Clicks ${overview.summary.overall.clicks} | CTR ${formatPercent(
                overview.summary.overall.ctr,
              )}`}
            />
            <MetricCard
              title="Sponsored"
              value={overview.summary.sponsored.impressions}
              detail={`Clicks ${overview.summary.sponsored.clicks} | CTR ${formatPercent(
                overview.summary.sponsored.ctr,
              )}`}
            />
            <MetricCard
              title="Sponsored charged"
              value={formatCurrency(overview.summary.sponsored.chargedAmount)}
              detail="Charged CPC amount from successful sponsored clicks"
            />
            <MetricCard
              title="Personalized tracked CTR"
              value={formatPercent(overview.summary.personalization.personalizedCtr)}
              detail={`Personalized ${overview.summary.personalization.personalizedClicks}/${overview.summary.personalization.personalizedImpressions} | Non-personalized ${formatPercent(
                overview.summary.personalization.nonPersonalizedCtr,
              )}`}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <AnalyticsTable
              title="Algorithm performance"
              description="Impressions, clicks, sponsored flow, and tracked personalized CTR by algorithm."
              columns={["Algorithm", "Impressions", "Clicks", "CTR", "Sponsored CTR", "Charged"]}
              rows={algorithms.map((row) => [
                row.algorithm,
                String(row.impressions),
                String(row.clicks),
                formatPercent(row.ctr),
                formatPercent(row.sponsoredCtr),
                formatCurrency(row.chargedAmount),
              ])}
            />
            <AnalyticsTable
              title="Scenario performance"
              description="Compare homepage, similar-product, and search recommendation behavior."
              columns={["Scenario", "Impressions", "Clicks", "CTR", "Sponsored CTR", "Charged"]}
              rows={scenarios.map((row) => [
                row.scenarioType,
                String(row.impressions),
                String(row.clicks),
                formatPercent(row.ctr),
                formatPercent(row.sponsoredCtr),
                formatCurrency(row.chargedAmount),
              ])}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <AnalyticsTable
              title="Top recommended products"
              description="Products with the most recommendation impressions in the selected range."
              columns={["Product", "Shop", "Impressions", "Clicks", "CTR", "Sponsored CTR"]}
              rows={(products?.topRecommendedProducts ?? []).map((row) => [
                row.productName,
                row.shopName,
                String(row.impressions),
                String(row.clicks),
                formatPercent(row.ctr),
                formatPercent(row.sponsoredCtr),
              ])}
            />
            <AnalyticsTable
              title="Top clicked products"
              description="Products with the strongest click-through activity from recommendations."
              columns={["Product", "Shop", "Clicks", "Impressions", "CTR", "Charged"]}
              rows={(products?.topClickedProducts ?? []).map((row) => [
                row.productName,
                row.shopName,
                String(row.clicks),
                String(row.impressions),
                formatPercent(row.ctr),
                formatCurrency(row.chargedAmount),
              ])}
            />
          </section>
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
  description,
  columns,
  rows,
}: {
  title: string;
  description: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Recommendation analytics
        </p>
        <h2 className="mt-2 text-xl font-black text-[var(--foreground)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
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
