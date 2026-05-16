"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import {
  getWbSyncCredentialsStatus,
  saveWbSyncCredentials,
  syncWbProductByArticle,
  syncWbProducts,
  type WbSyncRun,
  type WbCredentialsStatus,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentShop = useMemo(() => shops.find((shop) => shop.id === currentShopId) ?? null, [currentShopId, shops]);

  useEffect(() => {
    if (!currentShopId) return;
    let mounted = true;
    void getWbSyncCredentialsStatus(currentShopId)
      .then((response) => {
        if (mounted) setCredentials(response);
      })
      .catch(() => {
        if (mounted) setCredentials(null);
      });
    return () => {
      mounted = false;
    };
  }, [currentShopId]);

  const saveCredentials = async () => {
    if (!currentShopId || !apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setCredentials(await saveWbSyncCredentials(currentShopId, apiKey.trim()));
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save WB credentials.");
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
      setError(err instanceof Error ? err.message : "Unable to sync WB article.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wb-api-sync-page">
      <SectionCard
        eyebrow="Wildberries API"
        title="Sync products from Wildberries"
        description="Preview or import WB Content API cards into this shop. Mock mode is used unless backend WB_SYNC_MODE is real."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-4">
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
                <span className="text-sm font-semibold text-[var(--foreground)]">Article / APT</span>
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
            <p className="mt-2 text-sm text-[var(--muted)]" data-testid="wb-api-credentials-status">
              {credentials?.hasCredentials ? `Connected (${credentials.mode})` : `Not connected (${credentials?.mode ?? "mock"})`}
            </p>
            <div className="mt-4 flex gap-2">
              <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="WB API key" type="password" data-testid="wb-api-key" className="min-w-0 flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm" />
              <button type="button" onClick={() => void saveCredentials()} disabled={!currentShopId || !apiKey.trim() || loading} data-testid="wb-api-save-credentials" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
        {error ? <div className="mt-5 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
      </SectionCard>

      {result ? (
        <SectionCard eyebrow="WB API result" title={`${result.syncType} ${result.mode}`} description={`Run status: ${result.status}`}>
          <div className="grid gap-3 sm:grid-cols-4" data-testid="wb-api-result">
            <Metric label="Fetched" value={result.totalFetched} />
            <Metric label="Products" value={result.totalProducts} />
            <Metric label="Variants" value={result.totalVariants} />
            <Metric label="Images" value={result.totalImages} />
            <Metric label="Created" value={result.createdProducts} />
            <Metric label="Updated" value={result.updatedProducts} />
            <Metric label="Warnings" value={result.warnings.length} />
            <Metric label="Errors" value={result.errors.length} />
          </div>
          {result.rawSummary?.products?.length ? (
            <div className="mt-5 divide-y divide-[var(--border)] rounded-[1rem] border border-[var(--border)] bg-white">
              {result.rawSummary.products.map((product) => (
                <div key={`${product.sellerSku}-${product.externalProductId}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1fr_100px_100px]" data-testid="wb-api-product-row">
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
