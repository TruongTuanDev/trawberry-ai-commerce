import type { RecommendationQaComparisonResponse } from "@/lib/public-api";

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
}: {
  comparison: RecommendationQaComparisonResponse;
  debugEnabled: boolean;
}) {
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
                            ? `cat ${item.ruleBasedV1.scoreBreakdown.categoryScore} | text ${item.ruleBasedV1.scoreBreakdown.textScore} | pop ${item.ruleBasedV1.scoreBreakdown.popularityScore} | fresh ${item.ruleBasedV1.scoreBreakdown.freshnessScore} | rating ${item.ruleBasedV1.scoreBreakdown.ratingScore} | stock ${item.ruleBasedV1.scoreBreakdown.stockScore} | shop ${item.ruleBasedV1.scoreBreakdown.shopScore} | penalty ${item.ruleBasedV1.scoreBreakdown.penaltyScore}`
                            : "n/a"}
                        </p>
                        <p className="mt-2">v2 breakdown:</p>
                        <p>
                          {item.ruleBasedV2?.scoreBreakdown
                            ? `cat ${item.ruleBasedV2.scoreBreakdown.categoryScore} | text ${item.ruleBasedV2.scoreBreakdown.textScore} | pop ${item.ruleBasedV2.scoreBreakdown.popularityScore} | fresh ${item.ruleBasedV2.scoreBreakdown.freshnessScore} | rating ${item.ruleBasedV2.scoreBreakdown.ratingScore} | stock ${item.ruleBasedV2.scoreBreakdown.stockScore} | shop ${item.ruleBasedV2.scoreBreakdown.shopScore} | penalty ${item.ruleBasedV2.scoreBreakdown.penaltyScore}`
                            : "n/a"}
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
