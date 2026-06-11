"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import {
  activateAdminRecommendationTuningPreset,
  archiveAdminRecommendationTuningPreset,
  createAdminRecommendationTuningPreset,
  getAdminRecommendationTuningPreset,
  listAdminRecommendationTuningPresets,
  previewAdminRecommendationTuningPreset,
  rollbackAdminRecommendationTuningPreset,
  updateAdminRecommendationTuningPreset,
  type RecommendationTuningFlags,
  type RecommendationTuningGuardrails,
  type RecommendationTuningPreset,
  type RecommendationTuningPresetDetail,
  type RecommendationTuningPreview,
  type RecommendationTuningWeights,
} from "@/lib/admin-api";

const DEFAULT_WEIGHTS: RecommendationTuningWeights = {
  categoryScore: 1,
  textScore: 1,
  popularityScore: 1,
  freshnessScore: 1,
  ratingScore: 1,
  stockScore: 1,
  shopScore: 1,
  personalizationScore: 1,
  analyticsPerformanceScore: 1,
  sponsoredBoost: 1,
};

const DEFAULT_GUARDRAILS: RecommendationTuningGuardrails = {
  maxSponsoredBoostScore: 5,
  maxBusinessBoostScore: 2,
  maxAnalyticsPerformanceScore: 6,
  maxPersonalizationScore: 18,
};

const CORE_WEIGHT_KEYS: Array<keyof RecommendationTuningWeights> = [
  "categoryScore",
  "textScore",
  "popularityScore",
  "freshnessScore",
  "ratingScore",
  "stockScore",
  "shopScore",
];

const OPTIONAL_WEIGHT_KEYS: Array<keyof RecommendationTuningWeights> = [
  "personalizationScore",
  "analyticsPerformanceScore",
  "sponsoredBoost",
];

const GUARDRAIL_KEYS: Array<keyof RecommendationTuningGuardrails> = [
  "maxSponsoredBoostScore",
  "maxBusinessBoostScore",
  "maxAnalyticsPerformanceScore",
  "maxPersonalizationScore",
];

export function AdminRecommendationTuningPageClient() {
  const { t } = useI18n("admin");
  const [flags, setFlags] = useState<RecommendationTuningFlags | null>(null);
  const [presets, setPresets] = useState<RecommendationTuningPreset[]>([]);
  const [detail, setDetail] = useState<RecommendationTuningPresetDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weights, setWeights] = useState<RecommendationTuningWeights>(DEFAULT_WEIGHTS);
  const [guardrails, setGuardrails] =
    useState<RecommendationTuningGuardrails>(DEFAULT_GUARDRAILS);
  const [placement, setPlacement] = useState<"home" | "product_detail" | "search">("home");
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [preview, setPreview] = useState<RecommendationTuningPreview | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const coreWeightSum = useMemo(
    () => CORE_WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0),
    [weights],
  );
  const localGuardrailWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (coreWeightSum < 4 || coreWeightSum > 9.5) {
      warnings.push(t("recommendationTuning.coreWeightWarning"));
    }
    if (weights.sponsoredBoost > 1) {
      warnings.push(t("recommendationTuning.sponsoredWarning"));
    }
    return warnings;
  }, [coreWeightSum, t, weights.sponsoredBoost]);

  const loadPresets = useCallback(async () => {
    const response = await listAdminRecommendationTuningPresets();
    setFlags(response.flags);
    setPresets(response.presets);
    return response.presets;
  }, []);

  const selectPreset = useCallback(async (id: string, preservePreview = false) => {
    const response = await getAdminRecommendationTuningPreset(id);
    setDetail(response);
    setSelectedId(id);
    setName(response.preset.name);
    setDescription(response.preset.description ?? "");
    setWeights(response.preset.weights);
    setGuardrails(response.preset.guardrails);
    setRollbackVersion(
      response.versions.find((version) => version.version < response.preset.version)
        ?.version,
    );
    if (!preservePreview) {
      setPreview(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const response = await listAdminRecommendationTuningPresets();
        if (!active) return;
        setFlags(response.flags);
        setPresets(response.presets);
        if (response.presets[0]) {
          const nextDetail = await getAdminRecommendationTuningPreset(
            response.presets[0].id,
          );
          if (!active) return;
          setDetail(nextDetail);
          setSelectedId(nextDetail.preset.id);
          setName(nextDetail.preset.name);
          setDescription(nextDetail.preset.description ?? "");
          setWeights(nextDetail.preset.weights);
          setGuardrails(nextDetail.preset.guardrails);
          setRollbackVersion(
            nextDetail.versions.find(
              (version) => version.version < nextDetail.preset.version,
            )?.version,
          );
        }
      } catch (issue) {
        if (!active) return;
        setError(
          issue instanceof Error
            ? issue.message
            : t("recommendationTuning.loadFailed"),
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [t]);

  async function runAction(action: () => Promise<unknown>, success: string) {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const result = await action();
      const items = await loadPresets();
      const resultId = getActionResultId(result);
      const nextSelected =
        items.find((preset) => preset.id === resultId) ??
        items.find((preset) => preset.status === "active") ??
        items.find((preset) => preset.id === selectedId) ??
        items[0];
      if (nextSelected) await selectPreset(nextSelected.id);
      setNotice(success);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t("recommendationTuning.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    await runAction(
      () =>
        createAdminRecommendationTuningPreset({
          name: name.trim() || t("recommendationTuning.defaultPresetName"),
          description: description.trim() || undefined,
          weights,
          guardrails,
        }),
      t("recommendationTuning.created"),
    );
  }

  async function handleNewVersion() {
    if (!selectedId) return;
    await runAction(
      () =>
        updateAdminRecommendationTuningPreset(selectedId, {
          name: name.trim(),
          description,
          weights,
          guardrails,
        }),
      t("recommendationTuning.versionCreated"),
    );
  }

  async function handlePreview() {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      const result = await previewAdminRecommendationTuningPreset(selectedId, {
        placement,
        q: placement === "search" ? query.trim() : undefined,
        productId: placement === "product_detail" ? productId.trim() : undefined,
        limit: 8,
      });
      setPreview(result);
      await selectPreset(selectedId, true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : t("recommendationTuning.previewFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{t("recommendationTuning.loading")}</p>;
  }

  return (
    <div className="space-y-6" data-testid="admin-recommendation-tuning-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          {t("recommendationTuning.eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-black text-[var(--foreground)]">
          {t("recommendationTuning.title")}
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">
          {t("recommendationTuning.description")}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FlagCard label={t("recommendationTuning.workflowFlag")} enabled={Boolean(flags?.workflowEnabled)} />
          <FlagCard label={t("recommendationTuning.presetsFlag")} enabled={Boolean(flags?.presetsEnabled)} />
          <FlagCard label={t("recommendationTuning.runtimeFlag")} enabled={Boolean(flags?.activePresetEnabled)} />
        </div>
        {!flags?.activePresetEnabled ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {t("recommendationTuning.runtimeOff")}
          </p>
        ) : null}
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t("recommendationTuning.presets")}</h2>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
                setName("");
                setDescription("");
                setWeights(DEFAULT_WEIGHTS);
                setGuardrails(DEFAULT_GUARDRAILS);
                setPreview(null);
              }}
              className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-semibold"
              data-testid="tuning-new-preset"
            >
              {t("recommendationTuning.newPreset")}
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => void selectPreset(preset.id)}
                className={`w-full rounded-2xl border p-4 text-left ${
                  selectedId === preset.id
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-[var(--border)]"
                }`}
                data-testid={`tuning-preset-${preset.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{preset.name}</span>
                  <span className="rounded-full bg-[var(--panel)] px-2 py-1 text-xs">
                    {preset.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  v{preset.version} - {new Date(preset.updatedAt).toLocaleString()}
                </p>
              </button>
            ))}
            {!presets.length ? (
              <p className="text-sm text-[var(--muted)]">{t("recommendationTuning.empty")}</p>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <h2 className="text-xl font-bold">{t("recommendationTuning.editor")}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{t("recommendationTuning.name")}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                  data-testid="tuning-preset-name"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-semibold">{t("recommendationTuning.descriptionLabel")}</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                />
              </label>
            </div>
            <h3 className="mt-6 font-bold">{t("recommendationTuning.weights")}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t("recommendationTuning.coreWeightSum", { value: coreWeightSum.toFixed(2) })}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...CORE_WEIGHT_KEYS, ...OPTIONAL_WEIGHT_KEYS].map((key) => (
                <NumberField
                  key={key}
                  label={key}
                  value={weights[key]}
                  min={key === "sponsoredBoost" ? 0 : CORE_WEIGHT_KEYS.includes(key) ? 0.5 : 0}
                  max={key === "sponsoredBoost" ? 1 : 1.5}
                  onChange={(value) => setWeights((current) => ({ ...current, [key]: value }))}
                />
              ))}
            </div>
            <h3 className="mt-6 font-bold">{t("recommendationTuning.guardrails")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {GUARDRAIL_KEYS.map((key) => (
                <NumberField
                  key={key}
                  label={key}
                  value={guardrails[key]}
                  min={0}
                  max={
                    key === "maxSponsoredBoostScore"
                      ? 5
                      : key === "maxBusinessBoostScore"
                        ? 2
                        : key === "maxAnalyticsPerformanceScore"
                          ? 6
                          : 18
                  }
                  onChange={(value) =>
                    setGuardrails((current) => ({ ...current, [key]: value }))
                  }
                />
              ))}
            </div>
            {localGuardrailWarnings.map((warning) => (
              <p
                key={warning}
                className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
                data-testid="tuning-guardrail-warning"
              >
                {warning}
              </p>
            ))}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void (selectedId ? handleNewVersion() : handleCreate())}
                disabled={busy || !flags?.presetsEnabled || localGuardrailWarnings.length > 0}
                className="rounded-full bg-[var(--foreground)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="tuning-save-preset"
              >
                {selectedId ? t("recommendationTuning.createVersion") : t("recommendationTuning.createDraft")}
              </button>
              {selectedId ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t("recommendationTuning.confirmActivate"))) {
                        void runAction(
                          () => activateAdminRecommendationTuningPreset(selectedId),
                          t("recommendationTuning.activated"),
                        );
                      }
                    }}
                    disabled={busy || !flags?.presetsEnabled || detail?.preset.status === "archived"}
                    className="rounded-full border border-emerald-300 px-5 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                    data-testid="tuning-activate"
                  >
                    {t("recommendationTuning.activate")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        () => archiveAdminRecommendationTuningPreset(selectedId),
                        t("recommendationTuning.archived"),
                      )
                    }
                    disabled={busy || !flags?.presetsEnabled || detail?.preset.status === "archived"}
                    className="rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {t("recommendationTuning.archive")}
                  </button>
                </>
              ) : null}
            </div>
          </section>

          {selectedId ? (
            <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <h2 className="text-xl font-bold">{t("recommendationTuning.preview")}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select
                  value={placement}
                  onChange={(event) =>
                    setPlacement(event.target.value as "home" | "product_detail" | "search")
                  }
                  className="rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <option value="home">home</option>
                  <option value="search">search</option>
                  <option value="product_detail">product_detail</option>
                </select>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("recommendationTuning.searchQuery")}
                  disabled={placement !== "search"}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-50"
                />
                <input
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  placeholder={t("recommendationTuning.productId")}
                  disabled={placement !== "product_detail"}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={
                  busy ||
                  (placement === "search" && !query.trim()) ||
                  (placement === "product_detail" && !productId.trim())
                }
                className="mt-4 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                data-testid="tuning-preview"
              >
                {t("recommendationTuning.runPreview")}
              </button>
              {preview ? <PreviewTable preview={preview} /> : null}
            </section>
          ) : null}

          {detail ? (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <h2 className="text-xl font-bold">{t("recommendationTuning.rollback")}</h2>
                <select
                  value={rollbackVersion ?? ""}
                  onChange={(event) =>
                    setRollbackVersion(event.target.value ? Number(event.target.value) : undefined)
                  }
                  className="mt-4 w-full rounded-xl border border-[var(--border)] px-3 py-2"
                  data-testid="tuning-rollback-version"
                >
                  <option value="">{t("recommendationTuning.selectVersion")}</option>
                  {detail.versions
                    .filter((version) => version.version < detail.preset.version)
                    .map((version) => (
                      <option key={version.id} value={version.version}>
                        v{version.version} - {version.status}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      selectedId &&
                      rollbackVersion &&
                      window.confirm(t("recommendationTuning.confirmRollback"))
                    ) {
                      void runAction(
                        () =>
                          rollbackAdminRecommendationTuningPreset(
                            selectedId,
                            rollbackVersion,
                          ),
                        t("recommendationTuning.rolledBack"),
                      );
                    }
                  }}
                  disabled={
                    busy ||
                    !rollbackVersion ||
                    !flags?.presetsEnabled ||
                    detail.preset.status !== "active"
                  }
                  className="mt-3 rounded-full border border-amber-300 px-5 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
                  data-testid="tuning-rollback"
                >
                  {t("recommendationTuning.rollback")}
                </button>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <h2 className="text-xl font-bold">{t("recommendationTuning.auditLog")}</h2>
                <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
                  {detail.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                      <p className="font-semibold">{log.action}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {!detail.auditLogs.length ? (
                    <p className="text-sm text-[var(--muted)]">{t("recommendationTuning.noAudit")}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FlagCard({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
      <p className="font-semibold">{label}</p>
      <p className={enabled ? "mt-1 text-emerald-700" : "mt-1 text-amber-700"}>
        {enabled ? "enabled" : "disabled"}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-semibold text-[var(--muted)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="0.05"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
      />
    </label>
  );
}

function PreviewTable({ preview }: { preview: RecommendationTuningPreview }) {
  return (
    <div className="mt-5 space-y-3" data-testid="tuning-preview-results">
      {preview.guardrailViolations.map((violation) => (
        <p key={violation} className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {violation}
        </p>
      ))}
      {!preview.guardrailViolations.length ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          No guardrail violations detected.
        </p>
      ) : null}
      <div className="table-shell overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[var(--panel)] text-left">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Current rank</th>
              <th className="px-3 py-2">Tuned rank</th>
              <th className="px-3 py-2">Movement</th>
              <th className="px-3 py-2">Score delta</th>
              <th className="px-3 py-2">Sponsored change</th>
              <th className="px-3 py-2">Explanation change</th>
            </tr>
          </thead>
          <tbody>
            {preview.items.map((item) => (
              <tr key={item.productId} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-semibold">{item.productName}</td>
                <td className="px-3 py-2">{item.current?.rank ?? "n/a"}</td>
                <td className="px-3 py-2">{item.tuned?.rank ?? "n/a"}</td>
                <td className="px-3 py-2">{item.rankMovement ?? "n/a"}</td>
                <td className="px-3 py-2">{item.scoreDelta ?? "n/a"}</td>
                <td className="px-3 py-2">
                  {item.sponsoredMarkerChanged
                    ? `${String(item.currentSponsored)} -> ${String(item.tunedSponsored)}`
                    : "unchanged"}
                </td>
                <td className="min-w-72 px-3 py-2 text-xs text-[var(--muted)]">
                  {formatReasonChange(item.current?.reasons, item.tuned?.reasons)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatReasonChange(current: string[] | undefined, tuned: string[] | undefined) {
  const before = current?.join(", ") || "none";
  const after = tuned?.join(", ") || "none";
  return before === after ? "unchanged" : `${before} -> ${after}`;
}

function getActionResultId(result: unknown) {
  if (!result || typeof result !== "object" || !("id" in result)) {
    return null;
  }
  return typeof result.id === "string" ? result.id : null;
}
