import Link from "next/link";
import { notFound } from "next/navigation";
import { RecommendationRankingQaPanel } from "@/components/admin/recommendation-ranking-qa-panel";
import {
  getRecommendationRankingComparison,
  type RecommendationQaPlacement,
} from "@/lib/public-api";
import { getRecommendationFlags } from "@/lib/recommendation-flags";

function buildScenarioHref(query: {
  placement: RecommendationQaPlacement;
  limit: number;
  debug: boolean;
  q?: string;
  productId?: string;
}) {
  const params = new URLSearchParams();
  params.set("placement", query.placement);
  params.set("limit", String(query.limit));
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.productId) {
    params.set("productId", query.productId);
  }
  if (query.debug) {
    params.set("debug", "true");
  }

  return `/admin/recommendations-qa?${params.toString()}`;
}

export default async function AdminRecommendationsQaPage({
  searchParams,
}: {
  searchParams: Promise<{
    placement?: RecommendationQaPlacement;
    productId?: string;
    q?: string;
    limit?: string;
    debug?: string;
  }>;
}) {
  const recommendationFlags = getRecommendationFlags();
  if (!recommendationFlags.recommendationQaToolsEnabled) {
    notFound();
  }

  const query = await searchParams;
  const placement = query.placement ?? "home";
  const limit = Number(query.limit ?? "8");
  const debug =
    recommendationFlags.recommendationExplainabilityEnabled &&
    query.debug !== "false";
  const canLoadComparison =
    placement === "home" ||
    (placement === "search" && Boolean(query.q?.trim())) ||
    (placement === "product_detail" && Boolean(query.productId?.trim()));
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 8;
  const normalizedQuery = query.q?.trim() || undefined;
  const normalizedProductId = query.productId?.trim() || undefined;

  const comparison = canLoadComparison
    ? await getRecommendationRankingComparison({
        placement,
        productId: normalizedProductId,
        q: normalizedQuery,
        limit: normalizedLimit,
        debug,
      })
    : null;
  const savedScenarios = [
    {
      id: "home-baseline",
      label: "Home baseline",
      description: "Repeat the default home ranking audit with a stable limit.",
      href: buildScenarioHref({
        placement: "home",
        limit: 8,
        debug,
      }),
    },
    {
      id: "search-jacket",
      label: "Search audit",
      description: "Run a repeatable search comparison using a known keyword.",
      href: buildScenarioHref({
        placement: "search",
        q: normalizedQuery ?? "jacket",
        limit: 8,
        debug,
      }),
    },
    {
      id: "similar-current",
      label: "Similar products",
      description: normalizedProductId
        ? "Repeat the similar-products audit for the current public product."
        : "Provide a public productId, then reuse it as a repeatable similar-products audit.",
      href: buildScenarioHref({
        placement: "product_detail",
        productId:
          normalizedProductId ??
          comparison?.items[0]?.productId ??
          undefined,
        limit: 8,
        debug,
      }),
    },
  ];

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Admin internal
          </p>
          <h1 className="text-3xl font-black tracking-tight text-[var(--foreground)] sm:text-4xl">
            Recommendation QA tools
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Use this internal page to compare ranking movement between
            `rule_based_v1` and `rule_based_v2` without exposing the workflow to
            normal storefront users.
          </p>
        </div>

        <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-[var(--foreground)]">Placement</span>
              <select
                name="placement"
                defaultValue={placement}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              >
                <option value="home">home</option>
                <option value="search">search</option>
                <option value="product_detail">product_detail</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-[var(--foreground)]">Search query</span>
              <input
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Required for search"
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-[var(--foreground)]">Product ID</span>
              <input
                name="productId"
                defaultValue={query.productId ?? ""}
                placeholder="Required for product_detail"
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-[var(--foreground)]">Limit</span>
              <input
                name="limit"
                type="number"
                min={1}
                max={24}
                defaultValue={String(normalizedLimit)}
                className="w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="flex items-center gap-3 text-sm md:col-span-2">
              <input
                name="debug"
                type="checkbox"
                value="true"
                defaultChecked={debug}
                disabled={!recommendationFlags.recommendationExplainabilityEnabled}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-[var(--muted)]">
                Include explainability when
                `RECOMMENDATION_EXPLAINABILITY_ENABLED=true`
              </span>
            </label>
            <div className="flex items-end gap-3 md:col-span-2 md:justify-end">
              <button
                type="submit"
                className="inline-flex rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white"
              >
                Compare ranking
              </button>
              <Link
                href="/admin/recommendations-qa"
                className="inline-flex rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)]"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Saved scenarios
            </p>
            <h2 className="text-xl font-black tracking-tight text-[var(--foreground)]">
              Repeatable ranking audits
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Use these internal presets to rerun the same comparison inputs before and after future ranking weight changes.
            </p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {savedScenarios.map((scenario) => (
              <Link
                key={scenario.id}
                href={scenario.href}
                className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {scenario.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {scenario.description}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Open scenario
                </p>
              </Link>
            ))}
          </div>
        </section>

        {comparison ? (
          <RecommendationRankingQaPanel
            comparison={comparison}
            debugEnabled={debug}
            exportQuery={{
              placement,
              productId: normalizedProductId,
              q: normalizedQuery,
              limit: normalizedLimit,
              debug,
            }}
          />
        ) : (
          <section className="rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-sm text-[var(--muted)]">
            Pick a placement and provide the required input to run the ranking
            comparison. `search` needs `q`, and `product_detail` needs a public
            `productId`.
          </section>
        )}
      </div>
    </main>
  );
}
