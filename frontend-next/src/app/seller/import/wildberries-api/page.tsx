"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const refreshStatus = async () => {
    if (!currentShopId) {
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
      setCredentials(await saveWbSyncCredentials(currentShopId, apiKey.trim()));
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save WB credentials.");
    } finally {
      setLoading(false);
    }
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
      setError(err instanceof Error ? err.message : "Unable to verify WB connection.");
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
      setCredentials(null);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete WB credentials.");
    } finally {
      setLoading(false);
    }
  };

  const runAll = async (mode: "PREVIEW" | "IMPORT") => {
    if (!currentShopId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await syncWbProducts(currentShopId, { mode, limit: 100, publishMode, imageMode: "REMOTE_URL" }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unable to sync WB products.");
    } finally {
      setLoading(false);
    }
  };

  const runArticle = async (mode: "PREVIEW" | "IMPORT") => {
    if (!currentShopId || !article.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await syncWbProductByArticle(currentShopId, { article: article.trim(), mode, publishMode, imageMode: "REMOTE_URL" }));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unable to sync WB article.");
    } finally {
      setLoading(false);
    }
  };

  const modeMessage =
    visibleCredentials?.mode === "real"
      ? visibleCredentials.connected
        ? `Connected with key ending ****${visibleCredentials.keyLast4 ?? "----"}.`
        : "Real mode active - this shop needs its own WB API key."
      : "Mock mode active - API key is not required.";

  return (
    <div className="space-y-6" data-testid="wb-api-sync-page">
      <SectionCard
        eyebrow="Wildberries API"
        title="Sync products from Wildberries"
        description="Preview or import Wildberries Content API product cards into this shop. Real mode must call Wildberries directly and never falls back to mock data."
      >
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Current mode</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]" data-testid="wb-api-mode-badge">
                    {visibleCredentials?.mode?.toUpperCase() ?? "MOCK"}
                  </p>
                </div>
                <div className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                  {visibleCredentials?.connected ? `Connected - ${visibleCredentials.keyLast4 ?? "saved"}` : "No saved key"}
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]" data-testid="wb-api-mode-message">{modeMessage}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">Publish mode</span>
                <select value={publishMode} onChange={(event) => setPublishMode(event.target.value as "DRAFT" | "ACTIVE_IF_VALID")} data-testid="wb-api-publish-mode" className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE_IF_VALID">Active if valid</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">Image mode</span>
                <select value="REMOTE_URL" disabled className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm">
                  <option value="REMOTE_URL">Remote URL</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--foreground)]">Article / APT / vendorCode</span>
                <input value={article} onChange={(event) => setArticle(event.target.value)} data-testid="wb-api-article" className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!currentShopId || loading} onClick={() => void runAll("PREVIEW")} data-testid="wb-api-preview-all" className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">Preview all products</button>
              <button type="button" disabled={!currentShopId || loading} onClick={() => void runAll("IMPORT")} data-testid="wb-api-import-all" className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Sync all products</button>
              <button type="button" disabled={!currentShopId || loading || !article.trim()} onClick={() => void runArticle("PREVIEW")} data-testid="wb-api-preview-article" className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold disabled:opacity-50">Preview by article</button>
              <button type="button" disabled={!currentShopId || loading || !article.trim()} onClick={() => void runArticle("IMPORT")} data-testid="wb-api-import-article" className="rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Sync by article</button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Connection</p>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{currentShop?.name ?? "No shop selected"}</p>
            <div className="mt-4 space-y-2 text-sm" data-testid="wb-api-credentials-status">
              <p><span className="font-semibold">Mode:</span> {visibleCredentials?.mode?.toUpperCase() ?? "MOCK"}</p>
              <p><span className="font-semibold">Connected:</span> {visibleCredentials?.connected ? "Yes" : "No"}</p>
              <p><span className="font-semibold">Key last4:</span> {visibleCredentials?.keyLast4 ?? "--"}</p>
              <p><span className="font-semibold">Last verify:</span> {visibleCredentials?.lastVerificationStatus ?? "NOT_VERIFIED"}</p>
              <p><span className="font-semibold">Verified at:</span> {visibleCredentials?.lastVerifiedAt ?? "--"}</p>
              {visibleCredentials?.lastVerificationError ? <p className="text-[var(--accent-strong)]"><span className="font-semibold">Last error:</span> {visibleCredentials.lastVerificationError}</p> : null}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="WB API key" type="password" data-testid="wb-api-key" className="min-w-0 flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm" />
              <button type="button" onClick={() => void saveCredentials()} disabled={!currentShopId || !apiKey.trim() || loading} data-testid="wb-api-save-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">{visibleCredentials?.connected ? "Update API key" : "Save API key"}</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void verifyConnection()} disabled={!currentShopId || !visibleCredentials?.connected || verifying} data-testid="wb-api-verify-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {verifying ? "Verifying..." : "Verify connection"}
              </button>
              <button type="button" onClick={() => void clearCredentials()} disabled={!currentShopId || !visibleCredentials?.connected || loading} data-testid="wb-api-delete-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Delete key
              </button>
            </div>
            {verifyResult ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm" data-testid="wb-api-verify-result">
                <p className="font-semibold text-[var(--foreground)]">{verifyResult.message}</p>
                <p className="mt-1 text-[var(--muted)]">Fetched: {verifyResult.fetched} - Source mode: {verifyResult.mode.toUpperCase()}</p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className="mt-5 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      </SectionCard>

      {result ? (
        <SectionCard eyebrow="WB API result" title={`${result.syncType} ${result.mode}`} description={`Run status: ${result.status}`}>
          <div className="grid gap-3 sm:grid-cols-4" data-testid="wb-api-result">
            <Metric label="Source mode" value={result.sourceMode.toUpperCase()} />
            <Metric label="Fetched" value={String(result.totalFetched)} />
            <Metric label="Products" value={String(result.totalProducts)} />
            <Metric label="Variants" value={String(result.totalVariants)} />
            <Metric label="Images" value={String(result.totalImages)} />
            <Metric label="Created" value={String(result.createdProducts)} />
            <Metric label="Updated" value={String(result.updatedProducts)} />
            <Metric label="Warnings" value={String(result.warnings.length)} />
          </div>
          <div className="mt-4 space-y-1 text-sm text-[var(--muted)]">
            <p><span className="font-semibold text-[var(--foreground)]">Sync run:</span> {result.syncRunId}</p>
            <p><span className="font-semibold text-[var(--foreground)]">Status:</span> {result.status}</p>
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
                  <p>{product.variantsCount} variants</p>
                  <p>{product.imagesCount} images</p>
                </div>
              ))}
            </div>
          ) : null}
          <Link href="/seller/products" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">
            Open products
          </Link>
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
