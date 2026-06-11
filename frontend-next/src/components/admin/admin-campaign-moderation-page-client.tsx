"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminCampaignModeration,
  listAdminCampaignModeration,
  moderateAdminCampaign,
  type AdminCampaignModeration,
} from "@/lib/admin-api";

const statuses = [
  "pending_review",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
] as const;

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function AdminCampaignModerationPageClient() {
  const [items, setItems] = useState<AdminCampaignModeration[]>([]);
  const [selected, setSelected] = useState<AdminCampaignModeration | null>(null);
  const [status, setStatus] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(
    () =>
      listAdminCampaignModeration({
        moderationStatus: status || undefined,
        search: search.trim() || undefined,
      }),
    [search, status],
  );

  useEffect(() => {
    let active = true;
    void fetchItems()
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setError(null);
      })
      .catch((issue: unknown) => {
        if (!active) return;
        setError(issue instanceof Error ? issue.message : "Unable to load campaign moderation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchItems]);

  const refreshItems = async () => {
    const response = await fetchItems();
    setItems(response.items);
    setError(null);
  };

  const openDetail = async (id: string) => {
    setBusy(true);
    try {
      setSelected(await getAdminCampaignModeration(id));
      setReason("");
      setError(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load campaign detail.");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (
    action: "approve" | "reject" | "request-changes" | "suspend",
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await moderateAdminCampaign(selected.id, action, reason.trim() || undefined);
      setSelected(updated);
      setReason("");
      await refreshItems();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to moderate campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-campaign-moderation-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Ads safety
        </p>
        <h2 className="mt-3 text-3xl font-bold text-[var(--foreground)]">
          Campaign moderation
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Review seller sponsored campaigns before they become eligible for serving.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search campaign or shop"
            className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
            data-testid="campaign-moderation-search"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
            data-testid="campaign-moderation-status-filter"
          >
            <option value="">All statuses</option>
            {statuses.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="space-y-3">
          {loading ? <p className="text-sm text-[var(--muted)]">Loading campaigns...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5 text-sm text-[var(--muted)]">
              No campaigns match the current filters.
            </p>
          ) : null}
          {items.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => void openDetail(campaign.id)}
              className="block w-full rounded-[1.5rem] border border-[var(--border)] bg-white p-5 text-left"
              data-testid="campaign-moderation-row"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{campaign.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{campaign.shop?.name ?? campaign.shopId}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                  {statusLabel(campaign.moderationStatus)}
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Lifecycle: {campaign.status} · Targets: {campaign.summary.totalTargets}
              </p>
            </button>
          ))}
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5" data-testid="campaign-moderation-detail">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a campaign to review details.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">{selected.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.description || "No description"}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-[var(--muted)]">Moderation</dt><dd className="font-semibold">{statusLabel(selected.moderationStatus)}</dd></div>
                <div><dt className="text-[var(--muted)]">Lifecycle</dt><dd className="font-semibold">{selected.status}</dd></div>
                <div><dt className="text-[var(--muted)]">Billing</dt><dd className="font-semibold">{selected.billingMode}</dd></div>
                <div><dt className="text-[var(--muted)]">Targets</dt><dd className="font-semibold">{selected.summary.totalTargets}</dd></div>
                <div><dt className="text-[var(--muted)]">Total clicks</dt><dd className="font-semibold">{selected.billing.totalClicks}</dd></div>
                <div><dt className="text-[var(--muted)]">Charged clicks</dt><dd className="font-semibold">{selected.billing.chargedClicks}</dd></div>
                <div><dt className="text-[var(--muted)]">Invalid clicks</dt><dd className="font-semibold">{selected.billing.invalidClicks}</dd></div>
                <div><dt className="text-[var(--muted)]">Spend / remaining</dt><dd className="font-semibold">{selected.billing.spentAmount} / {selected.billing.remainingBudget ?? "unlimited"}</dd></div>
              </dl>
              {selected.moderationReason ? (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  {selected.moderationReason}
                </p>
              ) : null}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason required for reject, request changes, or suspend"
                className="min-h-24 w-full rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                data-testid="campaign-moderation-reason"
              />
              <div className="flex flex-wrap gap-2">
                {["pending_review", "suspended"].includes(selected.moderationStatus) ? (
                  <button type="button" disabled={busy} onClick={() => void runAction("approve")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" data-testid="campaign-approve">Approve</button>
                ) : null}
                {selected.moderationStatus === "pending_review" ? (
                  <>
                    <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void runAction("request-changes")} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white" data-testid="campaign-request-changes">Request changes</button>
                    <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void runAction("reject")} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" data-testid="campaign-reject">Reject</button>
                  </>
                ) : null}
                {selected.moderationStatus === "approved" ? (
                  <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => void runAction("suspend")} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white" data-testid="campaign-suspend">Suspend</button>
                ) : null}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--foreground)]">Audit history</h4>
                <div className="mt-3 space-y-2">
                  {(selected.moderationAuditLogs ?? []).map((log) => (
                    <div key={log.id} className="rounded-xl border border-[var(--border)] p-3 text-xs text-[var(--muted)]">
                      <strong className="text-[var(--foreground)]">{statusLabel(log.action)}</strong>
                      {" · "}{new Date(log.createdAt).toLocaleString()}
                      {log.reason ? <p className="mt-1">{log.reason}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
