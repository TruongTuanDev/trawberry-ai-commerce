"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import {
  diffRecommendationRankingSnapshots,
  validateRecommendationQaPack,
  type RecommendationQaDiffResponse,
  type RecommendationQaPack,
  type RecommendationQaPackValidationResponse,
  type RecommendationQaSnapshotResponse,
} from "@/lib/public-api";
import {
  RECOMMENDATION_QA_BASELINE_FIXTURES,
  RECOMMENDATION_QA_SAMPLE_PACKS,
} from "@/lib/recommendation-qa-fixtures";

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

function parseQaPack(value: string) {
  const parsed = JSON.parse(value) as RecommendationQaPack;
  if (
    !parsed ||
    typeof parsed.packName !== "string" ||
    !parsed.baselineSnapshot ||
    !parsed.candidateSnapshot
  ) {
    throw new Error("QA pack JSON is missing required pack fields.");
  }
  return parsed;
}

function formatThresholdLabel(
  key: RecommendationQaPackValidationResponse["evaluation"]["thresholds"][number]["key"],
) {
  switch (key) {
    case "maxMovedDownCount":
      return "Max moved down";
    case "maxMovedUpCount":
      return "Max moved up";
    case "maxAddedCount":
      return "Max added";
    case "maxRemovedCount":
      return "Max removed";
    case "maxScoreDelta":
      return "Max score delta";
    case "maxAbsoluteRankMovement":
      return "Max rank movement";
    case "minUnchangedCount":
      return "Min unchanged";
    case "maxTotalChangedCount":
      return "Max total changed";
  }
}

function buildMarkdownSummary(
  packValidation: RecommendationQaPackValidationResponse | null,
  diff: RecommendationQaDiffResponse,
) {
  const topMovedUp = diff.items.filter((item) => item.status === "moved_up").slice(0, 5);
  const topMovedDown = diff.items
    .filter((item) => item.status === "moved_down")
    .slice(0, 5);
  const added = diff.items.filter((item) => item.status === "added").slice(0, 5);
  const removed = diff.items.filter((item) => item.status === "removed").slice(0, 5);
  const evaluation = packValidation?.evaluation ?? null;

  const thresholdLines = evaluation?.thresholds.length
    ? evaluation.thresholds.map(
        (threshold) =>
          `- ${formatThresholdLabel(threshold.key)}: ${threshold.status.toUpperCase()} (${threshold.actualValue} ${threshold.operator} ${threshold.expectedValue}) - ${threshold.message}`,
      )
    : ["- none"];

  const lines = [
    `# Recommendation QA Diff Summary`,
    ``,
    `- Pack: ${packValidation?.pack.packName ?? "Manual snapshot diff"}`,
    `- Scenario: ${packValidation?.pack.scenarioType ?? diff.scenario.baseline.scenarioType}`,
    `- Baseline generatedAt: ${diff.scenario.baseline.generatedAt}`,
    `- Candidate generatedAt: ${diff.scenario.candidate.generatedAt}`,
    `- Total compared: ${diff.summary.totalItemsCompared}`,
    `- Moved up: ${diff.summary.movedUpCount}`,
    `- Moved down: ${diff.summary.movedDownCount}`,
    `- Added: ${diff.summary.addedCount}`,
    `- Removed: ${diff.summary.removedCount}`,
    `- Unchanged: ${diff.summary.unchangedCount}`,
    ``,
    `## Threshold evaluation`,
    `- Overall status: ${evaluation?.overallStatus ?? "not_evaluated"}`,
    ...(evaluation
      ? [
          `- Total changed: ${evaluation.summary.totalChangedCount}`,
          `- Max score delta: ${evaluation.summary.maxScoreDelta}`,
          `- Max absolute rank movement: ${evaluation.summary.maxAbsoluteRankMovement}`,
        ]
      : []),
    ...thresholdLines,
    ``,
    `## Top moved_up`,
    ...(topMovedUp.length
      ? topMovedUp.map(
          (item) =>
            `- ${item.productName} (${item.productId}) old rank ${item.oldRank ?? "n/a"} -> new rank ${item.newRank ?? "n/a"} score delta ${formatSignedNumber(item.scoreDelta)}`,
        )
      : ["- none"]),
    ``,
    `## Top moved_down`,
    ...(topMovedDown.length
      ? topMovedDown.map(
          (item) =>
            `- ${item.productName} (${item.productId}) old rank ${item.oldRank ?? "n/a"} -> new rank ${item.newRank ?? "n/a"} score delta ${formatSignedNumber(item.scoreDelta)}`,
        )
      : ["- none"]),
    ``,
    `## Added`,
    ...(added.length
      ? added.map((item) => `- ${item.productName} (${item.productId})`)
      : ["- none"]),
    ``,
    `## Removed`,
    ...(removed.length
      ? removed.map((item) => `- ${item.productName} (${item.productId})`)
      : ["- none"]),
  ];

  return lines.join("\n");
}

export function RecommendationRankingSnapshotDiffPanel() {
  const [baselineText, setBaselineText] = useState("");
  const [candidateText, setCandidateText] = useState("");
  const [packText, setPackText] = useState("");
  const [validatedPack, setValidatedPack] =
    useState<RecommendationQaPackValidationResponse | null>(null);
  const [diffResult, setDiffResult] = useState<RecommendationQaDiffResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingPack, setIsValidatingPack] = useState(false);

  const markdownSummary =
    diffResult ? buildMarkdownSummary(validatedPack, diffResult) : "";

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

  async function handleValidatePack(nextPackText?: string) {
    try {
      setIsValidatingPack(true);
      setError(null);
      const pack = parseQaPack(nextPackText ?? packText);
      const validation = await validateRecommendationQaPack(pack);
      setValidatedPack(validation);
      setBaselineText(JSON.stringify(validation.pack.baselineSnapshot, null, 2));
      setCandidateText(JSON.stringify(validation.pack.candidateSnapshot, null, 2));
    } catch (nextError) {
      setValidatedPack(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to validate QA pack.",
      );
    } finally {
      setIsValidatingPack(false);
    }
  }

  async function handleImport(
    event: ChangeEvent<HTMLInputElement>,
    target: "baseline" | "candidate" | "pack",
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    if (target === "baseline") {
      setBaselineText(text);
    } else if (target === "candidate") {
      setCandidateText(text);
    } else {
      setPackText(text);
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
          calculate moved-up, moved-down, added, removed, unchanged, and QA pack
          threshold results.
        </p>
      </div>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              QA packs
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Load a safe sample pack or paste/import a QA pack JSON that bundles
              scenario metadata, baseline snapshot, candidate snapshot, and optional thresholds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {RECOMMENDATION_QA_SAMPLE_PACKS.map((fixture) => (
              <button
                key={fixture.id}
                type="button"
                onClick={() => {
                  const sampleText = JSON.stringify(fixture.pack, null, 2);
                  setPackText(sampleText);
                  void handleValidatePack(sampleText);
                }}
                className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              >
                {fixture.label}
              </button>
            ))}
            <label className="cursor-pointer rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
              Import pack JSON
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => handleImport(event, "pack")}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleValidatePack()}
              disabled={isValidatingPack || !packText.trim()}
              className="inline-flex rounded-full bg-[var(--foreground)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isValidatingPack ? "Validating pack..." : "Validate pack"}
            </button>
          </div>
        </div>
        <textarea
          value={packText}
          onChange={(event) => setPackText(event.target.value)}
          placeholder="Paste QA pack JSON here"
          className="mt-4 min-h-56 w-full rounded-[1.25rem] border border-[var(--border)] bg-white p-4 font-mono text-xs leading-6 text-[var(--foreground)]"
        />
        {validatedPack ? (
          <div className="mt-4 space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-white p-4 text-sm">
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                Pack validated: {validatedPack.pack.packName}
              </p>
              <p className="mt-2 text-[var(--muted)]">
                {validatedPack.pack.description}
              </p>
              <p className="mt-2 text-[var(--muted)]">
                Scenario: {validatedPack.pack.scenarioType} · limit {validatedPack.pack.limit}
              </p>
              {validatedPack.notices.length ? (
                <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                  {validatedPack.notices.map((notice) => (
                    <p key={notice}>{notice}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Threshold evaluation
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Overall status:{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {validatedPack.evaluation.overallStatus}
                    </span>
                  </p>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <p className="rounded-full border border-[var(--border)] bg-white px-3 py-2">
                    Total changed: {validatedPack.evaluation.summary.totalChangedCount}
                  </p>
                  <p className="rounded-full border border-[var(--border)] bg-white px-3 py-2">
                    Max score delta: {validatedPack.evaluation.summary.maxScoreDelta}
                  </p>
                  <p className="rounded-full border border-[var(--border)] bg-white px-3 py-2">
                    Max rank movement: {validatedPack.evaluation.summary.maxAbsoluteRankMovement}
                  </p>
                </div>
              </div>

              {validatedPack.evaluation.thresholds.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        <th className="border-b border-[var(--border)] px-3 py-3">Threshold</th>
                        <th className="border-b border-[var(--border)] px-3 py-3">Status</th>
                        <th className="border-b border-[var(--border)] px-3 py-3">Actual</th>
                        <th className="border-b border-[var(--border)] px-3 py-3">Rule</th>
                        <th className="border-b border-[var(--border)] px-3 py-3">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validatedPack.evaluation.thresholds.map((threshold) => (
                        <tr key={threshold.key}>
                          <td className="border-b border-[var(--border)] px-3 py-3 font-semibold text-[var(--foreground)]">
                            {formatThresholdLabel(threshold.key)}
                          </td>
                          <td className="border-b border-[var(--border)] px-3 py-3">
                            {threshold.status}
                          </td>
                          <td className="border-b border-[var(--border)] px-3 py-3">
                            {threshold.actualValue}
                          </td>
                          <td className="border-b border-[var(--border)] px-3 py-3 font-mono">
                            {threshold.operator} {threshold.expectedValue}
                          </td>
                          <td className="border-b border-[var(--border)] px-3 py-3 text-[var(--muted)]">
                            {threshold.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  This pack does not define thresholds yet, so the evaluation stays
                  in `not_evaluated`.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>

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
            setPackText("");
            setValidatedPack(null);
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
            Baseline fixture library
          </p>
          <p className="text-sm leading-7 text-[var(--muted)]">
            Use these safe internal fixture scenarios when building repeatable
            before-and-after ranking audits.
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {RECOMMENDATION_QA_BASELINE_FIXTURES.map((item) => (
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
              <p className="mt-3 text-xs text-[var(--muted)]">
                {item.scenarioType}
                {item.query ? ` · q=${item.query}` : ""}
                {item.productId ? ` · productId=${item.productId}` : ""}
                {` · limit=${item.limit}`}
              </p>
            </article>
          ))}
        </div>
      </section>

      {diffResult ? (
        <div className="space-y-4">
          <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Visual export
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  Export a lightweight Markdown summary or print this QA diff for internal review.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(markdownSummary);
                    } catch {
                      setError("Could not copy the Markdown summary to clipboard.");
                    }
                  }}
                  className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Copy Markdown summary
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                >
                  Print summary
                </button>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-[1.25rem] border border-[var(--border)] bg-white p-4 text-xs leading-6 text-[var(--foreground)]">
              {markdownSummary}
            </pre>
          </section>

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
