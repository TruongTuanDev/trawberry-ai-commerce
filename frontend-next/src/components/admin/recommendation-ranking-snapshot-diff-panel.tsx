"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import {
  diffRecommendationRankingSnapshots,
  type RecommendationQaDiffResponse,
  type RecommendationQaSnapshotResponse,
} from "@/lib/public-api";

const SAMPLE_BASELINE_CATALOG = [
  {
    id: "home-baseline-v2",
    label: "Home baseline",
    scenario: "Run `/admin/recommendations-qa?placement=home&limit=8` before tuning.",
  },
  {
    id: "search-jacket-v2",
    label: "Search baseline",
    scenario:
      "Run `/admin/recommendations-qa?placement=search&q=jacket&limit=8` before tuning.",
  },
  {
    id: "similar-known-product",
    label: "Similar products baseline",
    scenario:
      "Run `/admin/recommendations-qa?placement=product_detail&productId=<public-product-id>&limit=8` for a stable public product.",
  },
];

function formatSignedNumber(value: number | null) {
  if (value === null) {
    return "n/a";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function parseSnapshot(value: string) {
  const parsed = JSON.parse(value) as RecommendationQaSnapshotResponse;
  if (!parsed || !Array.isArray(parsed.items) || !parsed.generatedAt) {
    throw new Error("Snapshot JSON is missing required recommendation QA fields.");
  }
  return parsed;
}

export function RecommendationRankingSnapshotDiffPanel() {
  const [baselineText, setBaselineText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [diffResult, setDiffResult] = useState<RecommendationQaDiffResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCompare() {
    try {
      setIsLoading(true);
      setError(null);
      const baseline = parseSnapshot(baselineText);
      const candidate = parseSnapshot(candidateText);
      const diff = await diffRecommendationRankingSnapshots({
        baseline,
        candidate,
      });
      setDiffResult(diff);
    } catch (nextError) {
      setDiffResult(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to compare snapshots.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>,
    target: "baseline" | "candidate",
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    if (target === "baseline") {
      setBaselineText(text);
    } else {
      setCandidateText(text);
    }
    event.target.value = "";
  }

  return (
    <section className="space-y-5 rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Snapshot diff
        </p>
        <h2 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
          Compare exported ranking snapshots
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
          Paste or import snapshot A and snapshot B, then let the internal API
          calculate moved-up, moved-down, added, removed, and unchanged items.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Snapshot A
            </h3>
            <label className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => handleImport(event, "baseline")}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={baselineText}
            onChange={(event) => setBaselineText(event.target.value)}
            placeholder="Paste baseline snapshot JSON here"
            className="min-h-64 w-full rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4 font-mono text-xs leading-6 text-[var(--foreground)]"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Snapshot B
            </h3>
            <label className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => handleImport(event, "candidate")}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={candidateText}
            onChange={(event) => setCandidateText(event.target.value)}
            placeholder="Paste candidate snapshot JSON here"
            className="min-h-64 w-full rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4 font-mono text-xs leading-6 text-[var(--foreground)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCompare}
          disabled={isLoading}
          className="inline-flex rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Comparing snapshots..." : "Compare snapshots"}
        </button>
        <button
          type="button"
          onClick={() => {
            setBaselineText("");
            setCandidateText("");
            setDiffResult(null);
            setError(null);
          }}
          className="inline-flex rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
        >
          Clear
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Baseline catalog
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            Use these safe internal baseline scenarios when building repeatable
            before-and-after ranking audits.
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {SAMPLE_BASELINE_CATALOG.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4"
            >
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {item.scenario}
              </p>
            </article>
          ))}
        </div>
      </section>

      {diffResult ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Total
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.totalItemsCompared}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Moved up
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.movedUpCount}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Moved down
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.movedDownCount}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Added
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.addedCount}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Removed
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.removedCount}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Unchanged
              </p>
              <p className="mt-2 text-2xl font-black text-[var(--foreground)]">
                {diffResult.summary.unchangedCount}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                  <th className="border-b border-[var(--border)] px-3 py-3">Product</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Status</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Old rank</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">New rank</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Movement</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Old score</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">New score</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Score delta</th>
                  <th className="border-b border-[var(--border)] px-3 py-3">Explainability delta</th>
                </tr>
              </thead>
              <tbody>
                {diffResult.items.map((item) => (
                  <tr key={item.productId} className="align-top">
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <p className="font-semibold text-[var(--foreground)]">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.productId}
                      </p>
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3 font-semibold text-[var(--foreground)]">
                      {item.status}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {item.oldRank ?? "n/a"}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {item.newRank ?? "n/a"}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {formatSignedNumber(item.rankMovement)}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {item.oldScore ?? "n/a"}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {item.newScore ?? "n/a"}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      {formatSignedNumber(item.scoreDelta)}
                    </td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <div className="space-y-2 text-xs text-[var(--muted)]">
                        <p>
                          reasons +
                          {item.reasonDelta?.added.length
                            ? ` ${item.reasonDelta.added.join(" | ")}`
                            : " n/a"}
                        </p>
                        <p>
                          reasons -
                          {item.reasonDelta?.removed.length
                            ? ` ${item.reasonDelta.removed.join(" | ")}`
                            : " n/a"}
                        </p>
                        <p className="font-mono leading-5">
                          {item.scoreBreakdownDelta
                            ? `cat ${formatSignedNumber(item.scoreBreakdownDelta.categoryScore)} | text ${formatSignedNumber(item.scoreBreakdownDelta.textScore)} | pop ${formatSignedNumber(item.scoreBreakdownDelta.popularityScore)} | fresh ${formatSignedNumber(item.scoreBreakdownDelta.freshnessScore)} | rating ${formatSignedNumber(item.scoreBreakdownDelta.ratingScore)} | stock ${formatSignedNumber(item.scoreBreakdownDelta.stockScore)} | shop ${formatSignedNumber(item.scoreBreakdownDelta.shopScore)} | penalty ${formatSignedNumber(item.scoreBreakdownDelta.penaltyScore)}`
                            : "breakdown n/a"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
