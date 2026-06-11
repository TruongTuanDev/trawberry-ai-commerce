"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminAdsMonitoringAnomalies,
  getAdminAdsMonitoringRuntimeConfig,
  getAdminAdsMonitoringSummary,
  type AdminAdsMonitoringAnomaly,
  type AdminAdsMonitoringRuntimeConfig,
  type AdminAdsMonitoringSummary,
  type AdsMonitoringWindow,
} from "@/lib/admin-api";

const windows: AdsMonitoringWindow[] = ["1h", "24h", "7d"];

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function StatusPill({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className={`mt-2 font-bold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>
        {enabled ? "Enabled" : "Disabled"}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p> : null}
    </div>
  );
}

export function AdminAdsMonitoringPageClient() {
  const [window, setWindow] = useState<AdsMonitoringWindow>("24h");
  const [summary, setSummary] = useState<AdminAdsMonitoringSummary | null>(null);
  const [runtime, setRuntime] = useState<AdminAdsMonitoringRuntimeConfig | null>(null);
  const [anomalies, setAnomalies] = useState<AdminAdsMonitoringAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(
    () =>
      Promise.all([
        getAdminAdsMonitoringSummary(window),
        getAdminAdsMonitoringAnomalies(window),
        getAdminAdsMonitoringRuntimeConfig(),
      ]),
    [window],
  );

  const refresh = useCallback(async () => {
    try {
      const [nextSummary, nextAnomalies, nextRuntime] = await loadSnapshot();
      setSummary(nextSummary);
      setAnomalies(nextAnomalies.items);
      setRuntime(nextRuntime);
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load Ads monitoring.");
    } finally {
      setLoading(false);
    }
  }, [loadSnapshot]);

  useEffect(() => {
    let active = true;

    void loadSnapshot()
      .then(([nextSummary, nextAnomalies, nextRuntime]) => {
        if (!active) return;
        setSummary(nextSummary);
        setAnomalies(nextAnomalies.items);
        setRuntime(nextRuntime);
        setError(null);
      })
      .catch((issue: unknown) => {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load Ads monitoring.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadSnapshot]);

  return (
    <div className="space-y-6" data-testid="admin-ads-monitoring-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
              Ads operations
            </p>
            <h2 className="mt-3 text-3xl font-bold text-[var(--foreground)]">
              Production monitoring
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Read-only wallet, ledger, campaign, click, top-up, and runtime safety signals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={window}
              onChange={(event) => setWindow(event.target.value as AdsMonitoringWindow)}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              data-testid="ads-monitoring-window"
            >
              {windows.map((item) => (
                <option key={item} value={item}>
                  Last {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              data-testid="ads-monitoring-refresh"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}
      {loading && !summary ? <p className="text-sm text-[var(--muted)]">Loading monitoring snapshot...</p> : null}

      {runtime ? (
        <section className="space-y-3" data-testid="ads-monitoring-runtime-config">
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)]">Runtime config</h3>
            <p className="text-sm text-[var(--muted)]">
              {runtime.environment} / preset {runtime.sponsoredPreset} / rollout {runtime.sponsoredRollout}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusPill enabled={runtime.sponsoredRankingEnabled} label="Sponsored ranking" />
            <StatusPill enabled={runtime.moderationRequiredForServing} label="Moderation required" />
            <StatusPill enabled={runtime.invalidClickProtectionEnabled} label="Invalid-click protection" />
            <StatusPill enabled={runtime.manualTopUpEnabled} label="Manual top-up" />
            <StatusPill enabled={runtime.demoFundingEnabled} label="Demo funding" />
            <StatusPill enabled={runtime.selfClickBlockEnabled} label="Self-click blocking" />
            <MetricCard label="Minor spend alert" value={formatMoney(runtime.thresholds.spendSpikeMinor)} />
            <MetricCard label="Invalid click alert" value={`${(runtime.thresholds.invalidClickRate * 100).toFixed(0)}%`} />
          </div>
        </section>
      ) : null}

      {summary ? (
        <>
          <section className="space-y-3" data-testid="ads-monitoring-health-summary">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">Ads health summary</h3>
                <p className="text-sm text-[var(--muted)]">
                  Generated {new Date(summary.generatedAt).toLocaleString()}
                </p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-bold uppercase ${
                  summary.health.status === "critical"
                    ? "bg-rose-100 text-rose-800"
                    : summary.health.status === "attention"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                }`}
                data-testid="ads-monitoring-health-status"
              >
                {summary.health.status}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Wallet balance" value={formatMoney(summary.wallet.totalBalance)} detail={`${summary.wallet.walletCount} wallets`} />
              <MetricCard label="Pending top-ups" value={summary.topUps.pendingCount} detail={formatMoney(summary.topUps.pendingAmount)} />
              <MetricCard label="Active / approved campaigns" value={`${summary.campaigns.activeCount} / ${summary.campaigns.approvedCount}`} />
              <MetricCard label="Spend" value={formatMoney(summary.campaigns.spendAmount)} detail={`Window ${summary.window}`} />
              <MetricCard label="Charged clicks" value={summary.clicks.chargedClicks} />
              <MetricCard label="Invalid clicks" value={summary.clicks.invalidClicks} detail={`${(summary.clicks.invalidClickRate * 100).toFixed(1)}% rate`} />
              <MetricCard label="Wallet mismatches" value={summary.wallet.ledgerMismatchCount} detail={`${summary.wallet.negativeWalletCount} negative`} />
              <MetricCard label="Duplicate references" value={summary.ledger.duplicateReferenceCount} detail={`${summary.ledger.failedChargeAttempts} failed charges`} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="ads-monitoring-invalid-breakdown">
              <h3 className="text-lg font-bold text-[var(--foreground)]">Invalid click breakdown</h3>
              <div className="mt-4 space-y-2">
                {Object.keys(summary.clicks.invalidReasons).length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No invalid sponsored clicks in this window.</p>
                ) : null}
                {Object.entries(summary.clicks.invalidReasons).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>{formatLabel(reason)}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="ads-monitoring-ledger-checks">
              <h3 className="text-lg font-bold text-[var(--foreground)]">Wallet and ledger checks</h3>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[var(--muted)]">Negative wallets</dt><dd className="font-bold">{summary.wallet.negativeWalletCount}</dd></div>
                <div><dt className="text-[var(--muted)]">Ledger mismatches</dt><dd className="font-bold">{summary.wallet.ledgerMismatchCount}</dd></div>
                <div><dt className="text-[var(--muted)]">Debit without campaign</dt><dd className="font-bold">{summary.ledger.debitWithoutCampaignCount}</dd></div>
                <div><dt className="text-[var(--muted)]">Top-up without ledger</dt><dd className="font-bold">{summary.topUps.confirmedWithoutLedgerCount}</dd></div>
                <div><dt className="text-[var(--muted)]">Budget exhausted</dt><dd className="font-bold">{summary.campaigns.budgetExhaustedCount}</dd></div>
                <div><dt className="text-[var(--muted)]">Wallet insufficient</dt><dd className="font-bold">{summary.campaigns.walletInsufficientCount}</dd></div>
              </dl>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="ads-monitoring-anomalies">
        <h3 className="text-xl font-bold text-[var(--foreground)]">Anomalies</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Detection only. Financial records are never auto-corrected.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)]" data-testid="ads-monitoring-anomaly-row">
                  <td className="px-3 py-3 font-bold uppercase">{item.severity}</td>
                  <td className="px-3 py-3">{formatLabel(item.type)}</td>
                  <td className="px-3 py-3">{item.description}</td>
                  <td className="px-3 py-3 text-[var(--muted)]">{item.suggestedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && anomalies.length === 0 ? (
            <p className="py-5 text-sm text-[var(--muted)]">No anomalies detected in this window.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
