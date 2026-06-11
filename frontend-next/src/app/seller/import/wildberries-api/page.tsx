"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { SectionCard } from "@/components/seller/section-card";
import {
  deleteWbSyncCredentials,
  getWbSyncCredentialsStatus,
  saveWbSyncCredentials,
  syncWbProductsByCodes,
  syncWbProducts,
  verifyWbSyncCredentials,
  type WbConnectionVerifyResult,
  type WbCredentialsStatus,
  type WbSelectedCodesSyncResult,
  type WbSyncRun,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const MAX_MANUAL_CODES_LENGTH = 5000;
const MAX_MANUAL_CODES_COUNT = 100;

function parseManualCodes(input: string) {
  const codes: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of input.split(/[,;\r\n]+/)) {
    const code = token.trim();
    if (!code) continue;
    const normalized = /^\d+$/.test(code) ? BigInt(code).toString() : code.toLowerCase();
    const dedupeKey = `${/^\d+$/.test(code) ? "valid" : "invalid"}:${normalized}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    codes.push(code);
    if (!/^\d+$/.test(code)) invalid.push(code);
  }

  return { codes, invalid };
}

export default function WildberriesApiSyncPage() {
  const { t } = useI18n("seller");
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const [credentials, setCredentials] = useState<WbCredentialsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [manualCodes, setManualCodes] = useState("");
  const [publishMode, setPublishMode] = useState<"DRAFT" | "ACTIVE_IF_VALID">("DRAFT");
  const [result, setResult] = useState<WbSyncRun | null>(null);
  const [selectedResult, setSelectedResult] = useState<WbSelectedCodesSyncResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<WbConnectionVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSyncing, setSelectedSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentShop = useMemo(() => shops.find((shop) => shop.id === currentShopId) ?? null, [currentShopId, shops]);
  const visibleCredentials = currentShopId ? credentials : null;
  const integrationReady = visibleCredentials?.mode === "real";
  const canAttemptRealVerify =
    integrationReady &&
    visibleCredentials?.connected &&
    (visibleCredentials?.canAttemptRealVerify ?? true);

  const refreshStatus = async () => {
    if (!currentShopId) {
      setCredentials(null);
      return;
    }
    setCredentials(await getWbSyncCredentialsStatus(currentShopId));
  };

  useEffect(() => {
    let mounted = true;
    if (!currentShopId) {
      return () => {
        mounted = false;
      };
    }

    void getWbSyncCredentialsStatus(currentShopId)
      .then((response) => {
        if (mounted) {
          setCredentials(response);
        }
      })
      .catch(() => {
        if (mounted) {
          setCredentials(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentShopId]);

  const saveCredentials = async () => {
    if (!currentShopId || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    try {
      await saveWbSyncCredentials(currentShopId, apiKey.trim());
      setApiKey("");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setLoading(false);
    }
  };

  const requireProductionConnection = () => {
    if (!currentShopId) {
      setError(t("seller.wbSync.noShopSelected"));
      return true;
    }
    if (!integrationReady) {
      setError(t("seller.wbSync.integrationUnavailable"));
      return true;
    }
    if (!visibleCredentials.connected) {
      setError(t("seller.wbSync.realModeKeyMsg"));
      return true;
    }
    return false;
  };

  const verifyConnection = async () => {
    if (!currentShopId) return;
    setVerifying(true);
    setError(null);
    setVerifyResult(null);
    try {
      const response = await verifyWbSyncCredentials(currentShopId);
      setVerifyResult(response);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.default"));
      await refreshStatus();
    } finally {
      setVerifying(false);
    }
  };

  const clearCredentials = async () => {
    if (!currentShopId) return;
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    try {
      await deleteWbSyncCredentials(currentShopId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setLoading(false);
    }
  };

  const runAll = async (mode: "PREVIEW" | "IMPORT") => {
    if (requireProductionConnection()) return;
    const shopId = currentShopId;
    if (!shopId) return;
    setLoading(true);
    setError(null);
    setSelectedResult(null);
    try {
      setResult(await syncWbProducts(shopId, { mode, limit: 100, publishMode, imageMode: "REMOTE_URL" }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setLoading(false);
    }
  };

  const runSelected = async (mode: "PREVIEW" | "IMPORT") => {
    if (manualCodes.length > MAX_MANUAL_CODES_LENGTH) {
      setError(t("seller.wbSync.codesInputTooLong", { max: MAX_MANUAL_CODES_LENGTH }));
      return;
    }
    const parsedCodes = parseManualCodes(manualCodes);
    if (parsedCodes.codes.length === 0) {
      setError(t("seller.wbSync.noCodesEntered"));
      return;
    }
    if (parsedCodes.codes.length > MAX_MANUAL_CODES_COUNT) {
      setError(t("seller.wbSync.tooManyCodes", { max: MAX_MANUAL_CODES_COUNT }));
      return;
    }
    if (parsedCodes.invalid.length === parsedCodes.codes.length) {
      setError(t("seller.wbSync.invalidCodesInput", { codes: parsedCodes.invalid.join(", ") }));
      return;
    }
    if (requireProductionConnection()) return;
    const shopId = currentShopId;
    if (!shopId) return;
    setSelectedSyncing(true);
    setError(null);
    try {
      const response = await syncWbProductsByCodes(shopId, {
        codes: manualCodes,
        mode,
        publishMode,
        imageMode: "REMOTE_URL",
      });
      setSelectedResult(response);
      setResult(response.run);
    } catch (err) {
      setResult(null);
      setSelectedResult(null);
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setSelectedSyncing(false);
    }
  };

  const modeMessage =
    integrationReady
      ? visibleCredentials.connected
        ? t("seller.wbSync.connectedKeyMsg", { last4: visibleCredentials.keyLast4 ?? "----" })
        : t("seller.wbSync.realModeKeyMsg")
      : t("seller.wbSync.integrationUnavailable");

  const formatConnectionValue = (value: boolean) =>
    value ? t("common.yes") : t("common.no");

  return (
    <div className="space-y-6" data-testid="wb-api-sync-page">
      <SectionCard
        eyebrow={t("seller.wbSync.eyebrow")}
        title={t("seller.wbSync.title")}
        description={t("seller.wbSync.description")}
        className="min-w-0"
      >
        <div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.wbSync.integrationStatus")}</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]" data-testid="wb-api-mode-badge">
                    {integrationReady ? t("seller.wbSync.integrationReady") : t("seller.wbSync.integrationUnavailableTitle")}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                  {visibleCredentials?.connected
                    ? t("seller.wbSync.connectedInfo", { last4: visibleCredentials.keyLast4 ?? "saved" })
                    : t("seller.wbSync.noSavedKey")}
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]" data-testid="wb-api-mode-message">{modeMessage}</p>
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <label className="min-w-0">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.publishMode")}</span>
                <select value={publishMode} onChange={(event) => setPublishMode(event.target.value as "DRAFT" | "ACTIVE_IF_VALID")} data-testid="wb-api-publish-mode" className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                  <option value="DRAFT">{t("seller.wbSync.draft")}</option>
                  <option value="ACTIVE_IF_VALID">{t("seller.wbSync.activeIfValid")}</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.imageMode")}</span>
                <select value="REMOTE_URL" disabled className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                  <option value="REMOTE_URL">{t("seller.wbSync.remoteUrl")}</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!currentShopId || !integrationReady || loading || selectedSyncing} onClick={() => void runAll("PREVIEW")} data-testid="wb-api-preview-all" className="max-w-full whitespace-normal rounded-full border border-[var(--border)] px-5 py-3 text-center text-sm font-semibold disabled:opacity-50">{t("seller.wbSync.previewAll")}</button>
              <button type="button" disabled={!currentShopId || !integrationReady || loading || selectedSyncing} onClick={() => void runAll("IMPORT")} data-testid="wb-api-import-all" className="max-w-full whitespace-normal rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-white disabled:opacity-50">{t("seller.wbSync.syncAll")}</button>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.codesLabel")}</span>
                <textarea
                  value={manualCodes}
                  onChange={(event) => setManualCodes(event.target.value)}
                  placeholder={t("seller.wbSync.codesPlaceholder")}
                  rows={5}
                  data-testid="wb-api-codes"
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                />
              </label>
              <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.wbSync.codesHelper")}</p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]" data-testid="wb-api-codes-identity">
                {t("seller.wbSync.codesIdentityHelper")}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" disabled={!currentShopId || !integrationReady || loading || selectedSyncing} onClick={() => void runSelected("PREVIEW")} data-testid="wb-api-preview-selected" className="max-w-full whitespace-normal rounded-full border border-[var(--border)] bg-white px-5 py-3 text-center text-sm font-semibold disabled:opacity-50">
                  {selectedSyncing ? t("seller.wbSync.syncingSelected") : t("seller.wbSync.previewSelected")}
                </button>
                <button type="button" disabled={!currentShopId || !integrationReady || loading || selectedSyncing} onClick={() => void runSelected("IMPORT")} data-testid="wb-api-import-selected" className="max-w-full whitespace-normal rounded-full bg-[var(--foreground)] px-5 py-3 text-center text-sm font-semibold text-white disabled:opacity-50">
                  {selectedSyncing ? t("seller.wbSync.syncingSelected") : t("seller.wbSync.syncSelected")}
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.wbSync.connection")}</p>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{currentShop?.name ?? t("seller.wbSync.noShopSelected")}</p>
            <div className="mt-4 space-y-2 text-sm" data-testid="wb-api-credentials-status">
              <p><span className="font-semibold">{t("seller.wbSync.integrationStatus")}:</span> {integrationReady ? t("seller.wbSync.integrationReady") : t("seller.wbSync.integrationUnavailableTitle")}</p>
              <p><span className="font-semibold">{t("seller.wbSync.connected")}:</span> {formatConnectionValue(Boolean(visibleCredentials?.connected))}</p>
              <p><span className="font-semibold">{t("seller.wbSync.keyLast4")}:</span> {visibleCredentials?.keyLast4 ?? "--"}</p>
              <p><span className="font-semibold">{t("seller.wbSync.lastVerify")}:</span> {visibleCredentials?.lastVerificationStatus ?? t("seller.wbSync.notVerified")}</p>
              <p><span className="font-semibold">{t("seller.wbSync.verifiedAt")}:</span> {visibleCredentials?.lastVerifiedAt ?? "--"}</p>
              {visibleCredentials?.missingConfig?.length ? <p className="text-[var(--accent-strong)]"><span className="font-semibold">{t("seller.wbSync.missingConfig")}:</span> {visibleCredentials.missingConfig.join(", ")}</p> : null}
              {visibleCredentials?.lastVerificationError ? <p className="text-[var(--accent-strong)]"><span className="font-semibold">{t("seller.wbSync.lastError")}:</span> {visibleCredentials.lastVerificationError}</p> : null}
            </div>
            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("seller.wbSync.apiKeyPlaceholder")} type="password" data-testid="wb-api-key" className="w-full min-w-0 flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm" />
              <button type="button" onClick={() => void saveCredentials()} disabled={!currentShopId || !integrationReady || !apiKey.trim() || loading} data-testid="wb-api-save-credentials" className="max-w-full whitespace-normal rounded-full border border-[var(--border)] px-4 py-2 text-center text-sm font-semibold disabled:opacity-50">
                {visibleCredentials?.connected ? t("seller.wbSync.updateApiKey") : t("seller.wbSync.saveApiKey")}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void verifyConnection()} disabled={!currentShopId || !canAttemptRealVerify || verifying} data-testid="wb-api-verify-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {verifying ? t("seller.wbSync.verifying") : t("seller.wbSync.verifyConnection")}
              </button>
              <button type="button" onClick={() => void clearCredentials()} disabled={!currentShopId || !visibleCredentials?.connected || loading} data-testid="wb-api-delete-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {t("seller.wbSync.deleteKey")}
              </button>
            </div>
            {verifyResult ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm" data-testid="wb-api-verify-result">
                <p className="font-semibold text-[var(--foreground)]">{verifyResult.message}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {t("seller.wbSync.verifyResult", { fetched: verifyResult.fetched })}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]" data-testid="wb-api-error">{error}</div> : null}
      </SectionCard>

      {result ? (
        <SectionCard
          eyebrow={t("seller.wbSync.resultEyebrow")}
          title={t("seller.wbSync.resultTitle", { syncType: result.syncType, mode: result.mode })}
          description={t("seller.wbSync.runStatusDescription", { status: result.status })}
        >
          <div className="grid gap-3 sm:grid-cols-4" data-testid="wb-api-result">
            <Metric label={t("seller.wbSync.fetched")} value={String(result.totalFetched)} />
            <Metric label={t("seller.wbExcel.metricProducts")} value={String(result.totalProducts)} />
            <Metric label={t("seller.wbExcel.metricVariants")} value={String(result.totalVariants)} />
            <Metric label={t("seller.wbExcel.metricImages")} value={String(result.totalImages)} />
            <Metric label={t("seller.wbExcel.createdProducts")} value={String(result.createdProducts)} />
            <Metric label={t("seller.wbExcel.updatedProducts")} value={String(result.updatedProducts)} />
            <Metric label={t("seller.wbExcel.metricWarnings")} value={String(result.warnings.length)} />
          </div>
          <div className="mt-4 space-y-1 text-sm text-[var(--muted)]">
            <p><span className="font-semibold text-[var(--foreground)]">{t("seller.wbSync.syncRun")}:</span> {result.syncRunId}</p>
            <p><span className="font-semibold text-[var(--foreground)]">{t("seller.wbSync.status")}:</span> {result.status}</p>
          </div>
          {selectedResult ? (
            <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-5" data-testid="wb-api-selected-summary">
              <p className="font-semibold text-[var(--foreground)]">{t("seller.wbSync.selectedSummary")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t("seller.wbSync.requestedCodes")} value={String(selectedResult.requestedCount)} />
                <Metric label={t("seller.wbSync.syncedProducts")} value={String(selectedResult.syncedCount)} />
                <Metric label={t("seller.wbSync.notFound")} value={String(selectedResult.notFound.length)} />
                <Metric label={t("seller.wbSync.errorsLabel")} value={String(selectedResult.errors.length)} />
              </div>
              <SummaryCodes label={t("seller.wbSync.notFound")} codes={selectedResult.notFound} emptyLabel={t("seller.wbSync.none")} testId="wb-api-selected-not-found" />
              <SummaryCodes label={t("seller.wbSync.invalidCodes")} codes={selectedResult.invalid} emptyLabel={t("seller.wbSync.none")} />
              <SummaryCodes label={t("seller.wbSync.normalizedNmIds")} codes={selectedResult.normalizedNmIds} emptyLabel={t("seller.wbSync.none")} />
              <SummaryCodes label={t("seller.wbSync.matchedNmIds")} codes={selectedResult.matchedNmIds} emptyLabel={t("seller.wbSync.none")} />
              <SummaryCodes label={t("seller.wbSync.skippedCodes")} codes={selectedResult.skipped} emptyLabel={t("seller.wbSync.none")} />
            </div>
          ) : null}
          {result.errors.length ? (
            <div className="mt-5 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]" data-testid="wb-api-errors">
              {result.errors.map((entry, index) => (
                <p key={`${entry.code}-${index}`}>{entry.code}: {entry.message}</p>
              ))}
            </div>
          ) : null}
          {result.warnings.length ? (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]" data-testid="wb-api-warnings">
              {result.warnings.map((entry, index) => (
                <p key={`${entry.code}-${index}`}>{entry.code}: {entry.message}</p>
              ))}
            </div>
          ) : null}
          {result.rawSummary?.products?.length ? (
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[1rem] border border-[var(--border)] bg-white">
              {result.rawSummary.products.map((product) => (
                <div key={`${product.sellerSku}-${product.externalProductId}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1.2fr_100px_100px]" data-testid="wb-api-product-row">
                  <p className="font-semibold">{product.sellerSku ?? product.externalProductId}</p>
                  <p className="text-[var(--muted)]">{product.name}</p>
                  <p>{product.variantsCount} {t("seller.wbSync.variantsCount")}</p>
                  <p>{product.imagesCount} {t("seller.wbSync.imagesCount")}</p>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-sm text-[var(--muted)]">
            {t("seller.wbSync.resultHelper")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/seller/products?tab=IMPORTED" className="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
              {t("seller.wbSync.viewImported")}
            </Link>
            <Link href="/seller/products?tab=NEEDS_REVIEW" className="inline-flex rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground)]">
              {t("seller.wbSync.viewNeedsReview")}
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SummaryCodes({ label, codes, emptyLabel, testId }: { label: string; codes: string[]; emptyLabel: string; testId?: string }) {
  return (
    <p className="mt-3 text-sm text-[var(--muted)]" data-testid={testId}>
      <span className="font-semibold text-[var(--foreground)]">{label}:</span>{" "}
      {codes.length ? codes.join(", ") : emptyLabel}
    </p>
  );
}
