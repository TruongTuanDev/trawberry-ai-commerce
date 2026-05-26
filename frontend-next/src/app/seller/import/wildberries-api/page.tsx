"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { SectionCard } from "@/components/seller/section-card";
import {
  deleteWbSyncCredentials,
  getWbSyncCredentialsStatus,
  saveWbSyncCredentials,
  syncWbProductByArticle,
  syncWbProducts,
  verifyWbSyncCredentials,
  type WbConnectionVerifyResult,
  type WbCredentialsStatus,
  type WbSyncRun,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export default function WildberriesApiSyncPage() {
  const { t } = useI18n("seller");
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const [credentials, setCredentials] = useState<WbCredentialsStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [article, setArticle] = useState("APT-MOCK-HOODIE");
  const [publishMode, setPublishMode] = useState<"DRAFT" | "ACTIVE_IF_VALID">("DRAFT");
  const [result, setResult] = useState<WbSyncRun | null>(null);
  const [verifyResult, setVerifyResult] = useState<WbConnectionVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentShop = useMemo(() => shops.find((shop) => shop.id === currentShopId) ?? null, [currentShopId, shops]);
  const visibleCredentials = currentShopId ? credentials : null;
  const isMockMode = visibleCredentials?.mode !== "real";
  const canAttemptRealVerify =
    visibleCredentials?.mode === "real" &&
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

  const requireRealCredential = () => {
    if (!currentShopId) {
      setError(t("seller.wbSync.noShopSelected"));
      return true;
    }
    if (visibleCredentials?.mode === "real" && !visibleCredentials.connected) {
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
    if (requireRealCredential()) return;
    const shopId = currentShopId;
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await syncWbProducts(shopId, { mode, limit: 100, publishMode, imageMode: "REMOTE_URL" }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setLoading(false);
    }
  };

  const runArticle = async (mode: "PREVIEW" | "IMPORT") => {
    if (!article.trim() || requireRealCredential()) return;
    const shopId = currentShopId;
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await syncWbProductByArticle(shopId, { article: article.trim(), mode, publishMode, imageMode: "REMOTE_URL" }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : t("errors.default"));
    } finally {
      setLoading(false);
    }
  };

  const modeMessage =
    visibleCredentials?.mode === "real"
      ? visibleCredentials.connected
        ? t("seller.wbSync.connectedKeyMsg", { last4: visibleCredentials.keyLast4 ?? "----" })
        : t("seller.wbSync.realModeKeyMsg")
      : t("seller.wbSync.mockModeKeyMsg");

  return (
    <div className="space-y-6" data-testid="wb-api-sync-page">
      <SectionCard
        eyebrow={t("seller.wbSync.eyebrow")}
        title={t("seller.wbSync.title")}
        description={t("seller.wbSync.description")}
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.wbSync.currentMode")}</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]" data-testid="wb-api-mode-badge">
                    {visibleCredentials?.mode?.toUpperCase() ?? "MOCK"}
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

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.publishMode")}</span>
                <select value={publishMode} onChange={(event) => setPublishMode(event.target.value as "DRAFT" | "ACTIVE_IF_VALID")} data-testid="wb-api-publish-mode" className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                  <option value="DRAFT">{t("seller.wbSync.draft")}</option>
                  <option value="ACTIVE_IF_VALID">{t("seller.wbSync.activeIfValid")}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.imageMode")}</span>
                <select value="REMOTE_URL" disabled className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                  <option value="REMOTE_URL">{t("seller.wbSync.remoteUrl")}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("seller.wbSync.articleLabel")}</span>
                <input value={article} onChange={(event) => setArticle(event.target.value)} data-testid="wb-api-article" className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!currentShopId || loading} onClick={() => void runAll("PREVIEW")} data-testid="wb-api-preview-all" className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">{t("seller.wbSync.previewAll")}</button>
              <button type="button" disabled={!currentShopId || loading} onClick={() => void runAll("IMPORT")} data-testid="wb-api-import-all" className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{t("seller.wbSync.syncAll")}</button>
              <button type="button" disabled={!currentShopId || loading || !article.trim()} onClick={() => void runArticle("PREVIEW")} data-testid="wb-api-preview-article" className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">{t("seller.wbSync.previewByArticle")}</button>
              <button type="button" disabled={!currentShopId || loading || !article.trim()} onClick={() => void runArticle("IMPORT")} data-testid="wb-api-import-article" className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{t("seller.wbSync.syncByArticle")}</button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{t("seller.wbSync.connection")}</p>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{currentShop?.name ?? t("seller.wbSync.noShopSelected")}</p>
            <div className="mt-4 space-y-2 text-sm" data-testid="wb-api-credentials-status">
              <p><span className="font-semibold">{t("seller.wbSync.mode")}:</span> {visibleCredentials?.mode?.toUpperCase() ?? "MOCK"}</p>
              <p><span className="font-semibold">{t("seller.wbSync.connected")}:</span> {visibleCredentials?.connected ? "Yes" : "No"}</p>
              <p><span className="font-semibold">{t("seller.wbSync.keyLast4")}:</span> {visibleCredentials?.keyLast4 ?? "--"}</p>
              <p><span className="font-semibold">{t("seller.wbSync.lastVerify")}:</span> {visibleCredentials?.lastVerificationStatus ?? "NOT_VERIFIED"}</p>
              <p><span className="font-semibold">{t("seller.wbSync.verifiedAt")}:</span> {visibleCredentials?.lastVerifiedAt ?? "--"}</p>
              {visibleCredentials?.missingConfig?.length ? <p className="text-[var(--accent-strong)]"><span className="font-semibold">{t("seller.wbSync.missingConfig")}:</span> {visibleCredentials.missingConfig.join(", ")}</p> : null}
              {visibleCredentials?.lastVerificationError ? <p className="text-[var(--accent-strong)]"><span className="font-semibold">{t("seller.wbSync.lastError")}:</span> {visibleCredentials.lastVerificationError}</p> : null}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("seller.wbSync.apiKeyPlaceholder")} type="password" data-testid="wb-api-key" className="min-w-0 flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm" />
              <button type="button" onClick={() => void saveCredentials()} disabled={!currentShopId || !apiKey.trim() || loading} data-testid="wb-api-save-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {visibleCredentials?.connected ? t("seller.wbSync.updateApiKey") : t("seller.wbSync.saveApiKey")}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void verifyConnection()} disabled={!currentShopId || !canAttemptRealVerify || verifying} data-testid="wb-api-verify-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {verifying ? t("seller.wbSync.verifying") : isMockMode ? t("seller.wbSync.verifyRealMode") : t("seller.wbSync.verifyConnection")}
              </button>
              <button type="button" onClick={() => void clearCredentials()} disabled={!currentShopId || !visibleCredentials?.connected || loading} data-testid="wb-api-delete-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {t("seller.wbSync.deleteKey")}
              </button>
            </div>
            {verifyResult ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm" data-testid="wb-api-verify-result">
                <p className="font-semibold text-[var(--foreground)]">{verifyResult.message}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {t("seller.wbSync.verifyResult", { fetched: verifyResult.fetched, mode: verifyResult.mode.toUpperCase() })}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      </SectionCard>

      {result ? (
        <SectionCard
          eyebrow="WB API result"
          title={`${result.syncType} ${result.mode}`}
          description={`Run status: ${result.status}. Imported products stay private until you review and publish them.`}
        >
          <div className="grid gap-3 sm:grid-cols-4" data-testid="wb-api-result">
            <Metric label={t("seller.wbSync.mode")} value={result.sourceMode.toUpperCase()} />
            <Metric label="Fetched" value={String(result.totalFetched)} />
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
