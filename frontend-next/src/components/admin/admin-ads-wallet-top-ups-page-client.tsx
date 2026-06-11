"use client";

import { useCallback, useEffect, useState } from "react";
import {
  confirmAdminAdsWalletTopUp,
  getAdminAdsWalletTopUp,
  listAdminAdsWalletTopUps,
  rejectAdminAdsWalletTopUp,
  type AdminAdsWalletTopUp,
} from "@/lib/admin-api";

const statuses = ["pending", "confirmed", "rejected", "cancelled"] as const;

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function AdminAdsWalletTopUpsPageClient() {
  const [items, setItems] = useState<AdminAdsWalletTopUp[]>([]);
  const [selected, setSelected] = useState<AdminAdsWalletTopUp | null>(null);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(
    () => listAdminAdsWalletTopUps({ status: status || undefined, search: search.trim() || undefined }),
    [search, status],
  );

  const refresh = useCallback(async () => {
    const response = await fetchItems();
    setItems(response.items);
    setError(null);
  }, [fetchItems]);

  useEffect(() => {
    let active = true;
    void fetchItems()
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((issue: unknown) => {
        if (active) setError(issue instanceof Error ? issue.message : "Unable to load top-up requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  const openDetail = async (id: string) => {
    setBusy(true);
    try {
      setSelected(await getAdminAdsWalletTopUp(id));
      setAdminNote("");
      setRejectionReason("");
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load the top-up request.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!selected) return;
    const approved = window.confirm(
      `Confirm ${formatMoney(selected.amount, selected.currency)}? This will credit the seller ads wallet exactly once.`,
    );
    if (!approved) return;
    setBusy(true);
    try {
      setSelected(await confirmAdminAdsWalletTopUp(selected.id, adminNote.trim() || undefined));
      await refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to confirm the top-up request.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected || rejectionReason.trim().length < 3) return;
    setBusy(true);
    try {
      setSelected(
        await rejectAdminAdsWalletTopUp(
          selected.id,
          rejectionReason.trim(),
          adminNote.trim() || undefined,
        ),
      );
      await refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to reject the top-up request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-ads-wallet-top-ups-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Ads finance</p>
        <h2 className="mt-3 text-3xl font-bold text-[var(--foreground)]">Manual ads wallet top-ups</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Match off-platform transfers, then confirm or reject seller requests. Only confirmation credits the ads wallet.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller, shop, or transfer reference" className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm" data-testid="admin-top-up-search" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm" data-testid="admin-top-up-status-filter">
            <option value="">All statuses</option>
            {statuses.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="space-y-3">
          {loading ? <p className="text-sm text-[var(--muted)]">Loading top-up requests...</p> : null}
          {!loading && items.length === 0 ? <p className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">No top-up requests match this filter.</p> : null}
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => void openDetail(item.id)} className="block w-full rounded-[1.5rem] border border-[var(--border)] bg-white p-5 text-left" data-testid="admin-top-up-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--foreground)]">{formatMoney(item.amount, item.currency)}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.shop.name} · {item.seller.email}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">{item.status}</span>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="admin-top-up-detail">
          {!selected ? <p className="text-sm text-[var(--muted)]">Select a request to review its details.</p> : (
            <div className="space-y-5">
              <div>
                <h3 className="text-2xl font-black text-[var(--foreground)]">{formatMoney(selected.amount, selected.currency)}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.shop.name} · {selected.seller.email}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[var(--muted)]">Status</dt><dd className="font-semibold">{selected.status}</dd></div>
                <div><dt className="text-[var(--muted)]">Created</dt><dd className="font-semibold">{new Date(selected.createdAt).toLocaleString()}</dd></div>
                <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Transfer reference</dt><dd className="font-semibold">{selected.transferReference || "-"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Seller note</dt><dd className="font-semibold">{selected.sellerNote || "-"}</dd></div>
                {selected.proofUrl ? <div className="sm:col-span-2"><dt className="text-[var(--muted)]">Proof URL</dt><dd><a href={selected.proofUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-700 underline">Open proof</a></dd></div> : null}
                {selected.confirmedLedger ? <div className="sm:col-span-2 rounded-xl bg-emerald-50 p-3"><dt className="text-emerald-700">Confirmed ledger</dt><dd className="font-semibold text-emerald-950">{selected.confirmedLedger.id} · balance {formatMoney(selected.confirmedLedger.balanceAfter, selected.confirmedLedger.currency)}</dd></div> : null}
                {selected.rejectionReason ? <div className="sm:col-span-2 rounded-xl bg-rose-50 p-3"><dt className="text-rose-700">Rejection reason</dt><dd className="font-semibold text-rose-950">{selected.rejectionReason}</dd></div> : null}
              </dl>
              {selected.status === "pending" ? (
                <>
                  <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Optional admin note" className="min-h-20 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm" data-testid="admin-top-up-note" />
                  <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Rejection reason (required to reject)" className="min-h-24 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm" data-testid="admin-top-up-rejection-reason" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" data-testid="admin-top-up-confirm">Confirm and credit wallet</button>
                    <button type="button" disabled={busy || rejectionReason.trim().length < 3} onClick={() => void reject()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" data-testid="admin-top-up-reject">Reject request</button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
