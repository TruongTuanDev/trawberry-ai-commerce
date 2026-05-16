"use client";

import { useEffect, useState } from "react";
import {
  addShopSupportCaseMessage,
  getShopSupportCase,
  listShopSupportCases,
  type SellerSupportCase,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerSupportCasesPageClient() {
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [items, setItems] = useState<SellerSupportCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SellerSupportCase | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShopId) return;
    let cancelled = false;
    void listShopSupportCases(currentShopId, "")
      .then((response) => {
        if (cancelled) return;
        setItems(response.items);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load support cases.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentShopId]);

  useEffect(() => {
    if (!currentShopId || !selectedId) return;
    let cancelled = false;
    void getShopSupportCase(currentShopId, selectedId, "")
      .then((response) => {
        if (cancelled) return;
        setSelected(response);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load support case.");
      });
    return () => {
      cancelled = true;
    };
  }, [currentShopId, selectedId]);

  const refreshList = async () => {
    if (!currentShopId) return;
    const response = await listShopSupportCases(currentShopId, "");
    setItems(response.items);
  };

  return (
    <div className="space-y-6" data-testid="seller-support-cases-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller support</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Support cases</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Cases linked to the active shop and child orders only.</p>
      </section>
      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="divide-y divide-[var(--border)]" data-testid="seller-support-case-list">
            {loading ? <p className="px-5 py-5 text-sm text-[var(--muted)]">Loading support cases...</p> : null}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full px-5 py-4 text-left ${selectedId === item.id ? "bg-[var(--panel)]" : "bg-white"}`} data-testid="seller-support-case-row">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.subject}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{item.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.order?.orderCode ?? item.checkoutCode}</p>
              </button>
            ))}
            {!loading && !items.length ? <p className="px-5 py-5 text-sm text-[var(--muted)]">No support cases for this shop.</p> : null}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a support case.</p>
          ) : (
            <div className="space-y-5" data-testid="seller-support-case-detail">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{selected.issueType}</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.subject}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{selected.order?.orderCode ?? selected.checkoutCode}</p>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">{selected.description}</p>
              <div className="space-y-3" data-testid="seller-support-thread">
                {selected.messages.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{entry.senderRole}{entry.senderName ? ` - ${entry.senderName}` : ""}</p>
                      <p className="text-xs text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{entry.message}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-support-reply-message" />
                <button type="button" onClick={async () => { if (!currentShopId) return; const updated = await addShopSupportCaseMessage(currentShopId, selected.id, reply, ""); setSelected(updated); setReply(""); await refreshList(); }} disabled={!reply.trim()} className="mt-3 rounded-full bg-[#2f2025] px-4 py-2 text-sm font-semibold text-white" data-testid="seller-support-reply-submit">
                  Send reply
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
