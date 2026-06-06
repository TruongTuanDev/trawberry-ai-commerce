"use client";

import { useState } from "react";
import {
  getRecommendationRankingSnapshot,
  type RecommendationQaComparisonResponse,
  type RecommendationQaPlacement,
  type RecommendationSponsoredPresetCatalog,
} from "@/lib/public-api";

function formatMovement(value: number | null) {
  if (value === null) {
    return "n/a";
  }
  if (value > 0) {
    return `up ${value}`;
  }
  if (value < 0) {
    return `down ${Math.abs(value)}`;
  }
  return "no change";
}

export function RecommendationRankingQaPanel({
  comparison,
  debugEnabled,
  sponsoredPresetCatalog,
  exportQuery,
}: {
  comparison: RecommendationQaComparisonResponse;
  debugEnabled: boolean;
  sponsoredPresetCatalog: RecommendationSponsoredPresetCatalog;
  exportQuery: {
    placement: RecommendationQaPlacement;
    productId?: string;
    q?: string;
    limit: number;
    debug: boolean;
  };
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    try {
      setIsExporting(true);
      setExportError(null);
      const snapshot = await getRecommendationRankingSnapshot(exportQuery);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const timestamp = snapshot.generatedAt
        .replace(/[:]/g, "-")
        .replace(/\.\d{3}Z$/, "Z");
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `recommendation-qa-${snapshot.scenarioType}-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Failed to export snapshot.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Internal QA
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--foreground)]">
            Recommendation ranking comparison
          </h2>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
          placement: {comparison.placement}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? "Exporting snapshot..." : "Export JSON snapshot"}
        </button>
        <p className="text-xs text-[var(--muted)]">
          Export the current comparison as an internal QA JSON snapshot for later audits.
        </p>
      </div>
      {exportError ? (
        <p className="text-sm text-red-600">{exportError}</p>
      ) : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Sponsored rollout preset
            </p>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Internal-only metadata for the current sponsored ranking preset and
              the safe preset catalog used during QA.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
            ranking {comparison.sponsoredRanking?.sponsoredRankingEnabled ? "enabled" : "disabled"}
          </span>
        </div>

        {comparison.sponsoredRanking?.activePreset ? (
          <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Active preset: {comparison.sponsoredRanking.activePreset.name}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {comparison.sponsoredRanking.activePreset.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                id {comparison.sponsoredRanking.activePreset.id}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                v{comparison.sponsoredRanking.activePreset.version}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                {comparison.sponsoredRanking.activePreset.stability}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                sponsored cap {comparison.sponsoredRanking.activePreset.maxSponsoredBoost}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                business cap {comparison.sponsoredRanking.activePreset.maxBusinessBoost}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                scenarios {comparison.sponsoredRanking.activePreset.allowedScenarioTypes.join(", ")}
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {sponsoredPresetCatalog.presets.map((preset) => (
            <article
              key={preset.id}
              className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {preset.name}
                </p>
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {preset.stability}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {preset.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  {preset.id}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  v{preset.version}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  sponsored {preset.maxSponsoredBoost}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  business {preset.maxBusinessBoost}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1">
                  {preset.allowedScenarioTypes.join(", ")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              <th className="border-b border-[var(--border)] px-3 py-3">Product</th>
              <th className="border-b border-[var(--border)] px-3 py-3">V1 rank</th>
              <th className="border-b border-[var(--border)] px-3 py-3">V2 rank</th>
              <th className="border-b border-[var(--border)] px-3 py-3">Movement</th>
              <th className="border-b border-[var(--border)] px-3 py-3">V1 score</th>
              <th className="border-b border-[var(--border)] px-3 py-3">V2 score</th>
              {debugEnabled ? (
                <th className="border-b border-[var(--border)] px-3 py-3">
                  Explainability
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {comparison.items.map((item) => (
              <tr key={item.productId} className="align-top">
                <td className="border-b border-[var(--border)] px-3 py-3">
                  <p className="font-semibold text-[var(--foreground)]">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.productId}
                  </p>
                </td>
                <td className="border-b border-[var(--border)] px-3 py-3">
                  {item.ruleBasedV1?.rank ?? "n/a"}
                </td>
                <td className="border-b border-[var(--border)] px-3 py-3">
                  {item.ruleBasedV2?.rank ?? "n/a"}
                </td>
                <td className="border-b border-[var(--border)] px-3 py-3 font-semibold text-[var(--foreground)]">
                  {formatMovement(item.rankMovement)}
                </td>
                <td className="border-b border-[var(--border)] px-3 py-3">
                  {item.ruleBasedV1?.finalScore ?? "n/a"}
                </td>
                <td className="border-b border-[var(--border)] px-3 py-3">
                  {item.ruleBasedV2?.finalScore ?? "n/a"}
                </td>
                {debugEnabled ? (
                  <td className="border-b border-[var(--border)] px-3 py-3">
                    <div className="space-y-3 text-xs text-[var(--muted)]">
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          V1 reasons
                        </p>
                        <p className="mt-1 leading-5">
                          {item.ruleBasedV1?.reasons.length
                            ? item.ruleBasedV1.reasons.join(" | ")
                            : "n/a"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">
                          V2 reasons
                        </p>
                        <p className="mt-1 leading-5">
                          {item.ruleBasedV2?.reasons.length
                            ? item.ruleBasedV2.reasons.join(" | ")
                            : "n/a"}
                        </p>
                      </div>
                      <div className="font-mono leading-5">
                        <p>v1 breakdown:</p>
                        <p>
                          {item.ruleBasedV1?.scoreBreakdown
                            ? `cat ${item.ruleBasedV1.scoreBreakdown.categoryScore} | text ${item.ruleBasedV1.scoreBreakdown.textScore} | pop ${item.ruleBasedV1.scoreBreakdown.popularityScore} | fresh ${item.ruleBasedV1.scoreBreakdown.freshnessScore} | rating ${item.ruleBasedV1.scoreBreakdown.ratingScore} | stock ${item.ruleBasedV1.scoreBreakdown.stockScore} | shop ${item.ruleBasedV1.scoreBreakdown.shopScore} | penalty ${item.ruleBasedV1.scoreBreakdown.penaltyScore} | sponsored ${item.ruleBasedV1.scoreBreakdown.sponsoredBoostScore} | business ${item.ruleBasedV1.scoreBreakdown.businessBoostScore} | max ${item.ruleBasedV1.scoreBreakdown.maxSponsoredBoost}`
                            : "n/a"}
                        </p>
                        <p className="mt-1">
                          v1 sponsored reason: {item.ruleBasedV1?.sponsoredReason ?? "n/a"}
                        </p>
                        <p className="mt-1">
                          v1 preset: {item.ruleBasedV1?.sponsoredPreset?.id ?? "n/a"}
                        </p>
                        <p className="mt-2">v2 breakdown:</p>
                        <p>
                          {item.ruleBasedV2?.scoreBreakdown
                            ? `cat ${item.ruleBasedV2.scoreBreakdown.categoryScore} | text ${item.ruleBasedV2.scoreBreakdown.textScore} | pop ${item.ruleBasedV2.scoreBreakdown.popularityScore} | fresh ${item.ruleBasedV2.scoreBreakdown.freshnessScore} | rating ${item.ruleBasedV2.scoreBreakdown.ratingScore} | stock ${item.ruleBasedV2.scoreBreakdown.stockScore} | shop ${item.ruleBasedV2.scoreBreakdown.shopScore} | penalty ${item.ruleBasedV2.scoreBreakdown.penaltyScore} | sponsored ${item.ruleBasedV2.scoreBreakdown.sponsoredBoostScore} | business ${item.ruleBasedV2.scoreBreakdown.businessBoostScore} | max ${item.ruleBasedV2.scoreBreakdown.maxSponsoredBoost}`
                            : "n/a"}
                        </p>
                        <p className="mt-1">
                          v2 sponsored reason: {item.ruleBasedV2?.sponsoredReason ?? "n/a"}
                        </p>
                        <p className="mt-1">
                          v2 preset: {item.ruleBasedV2?.sponsoredPreset?.id ?? "n/a"}
                        </p>
                      </div>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
