"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addShopReturnRefundMessage,
  getShopReturnRefundCase,
  listShopReturnRefundCases,
  markShopRefundSent,
  markShopReturnReceived,
  respondShopReturnRefundCase,
  type SellerReturnRefundCase,
} from "@/lib/seller-api";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import {
  formatRub,
  isReturnCaseClosed,
  labelForReturnReason,
  labelForReturnStatus,
  labelForReturnType,
} from "@/components/returns/return-refund-utils";

const sellerActions = [
  { value: "ACCEPT", label: "Accept" },
  { value: "REJECT", label: "Reject" },
  { value: "REQUEST_EVIDENCE", label: "Request evidence" },
  { value: "ESCALATE_ADMIN", label: "Escalate to admin" },
] as const;

export function SellerReturnsPageClient({
  caseId,
}: {
  caseId?: string | null;
}) {
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const [items, setItems] = useState<SellerReturnRefundCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(caseId ?? null);
  const [selected, setSelected] = useState<SellerReturnRefundCase | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<(typeof sellerActions)[number]["value"]>("ACCEPT");
  const [sellerComment, setSellerComment] = useState("");
  const [reply, setReply] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<"SBP" | "BANK_TRANSFER" | "CASH" | "OTHER">("SBP");
  const [bankReference, setBankReference] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundProofFile, setRefundProofFile] = useState<File | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const refreshList = async (preferredSelectedId?: string | null) => {
    if (!currentShopId) return;
    const response = await listShopReturnRefundCases(
      currentShopId,
      filterStatus === "ALL" ? undefined : { status: filterStatus },
      "",
    );
    setItems(response.items);
    setSelectedId((current) => preferredSelectedId ?? current ?? response.items[0]?.id ?? null);
  };

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        await loadShops();
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (!shopId) {
          if (active) {
            setItems([]);
            setLoading(false);
          }
          return;
        }
        const response = await listShopReturnRefundCases(
          shopId,
          filterStatus === "ALL" ? undefined : { status: filterStatus },
          "",
        );
        if (!active) return;
        setItems(response.items);
        setSelectedId(caseId ?? response.items[0]?.id ?? null);
        setError(null);
      } catch (issue) {
        if (active) {
          setError(issue instanceof Error ? issue.message : "Unable to load return / refund cases.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [caseId, filterStatus, hydrated, loadShops]);

  useEffect(() => {
    if (!currentShopId || !selectedId) {
      return;
    }
    let active = true;
    void getShopReturnRefundCase(currentShopId, selectedId, "")
      .then((response) => {
        if (active) {
          setSelected(response);
          setRefundAmount(response.approvedAmount ?? response.requestedAmount);
        }
      })
      .catch((issue) => {
        if (active) {
          setError(issue instanceof Error ? issue.message : "Unable to load the selected case.");
        }
      });
    return () => {
      active = false;
    };
  }, [currentShopId, selectedId]);

  const visibleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const handleRespond = async () => {
    if (!currentShopId || !selected) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await respondShopReturnRefundCase(
        currentShopId,
        selected.id,
        {
          action,
          sellerComment,
        },
        "",
      );
      setSelected(updated);
      await refreshList(updated.id);
      setSellerComment("");
      setMessage("Seller response saved.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to save seller response.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendReply = async () => {
    if (!currentShopId || !selected || !reply.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await addShopReturnRefundMessage(currentShopId, selected.id, reply, "");
      setSelected(updated);
      await refreshList(updated.id);
      setReply("");
      setMessage("Reply sent.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to send reply.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReturnReceived = async () => {
    if (!currentShopId || !selected) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await markShopReturnReceived(currentShopId, selected.id, "");
      setSelected(updated);
      await refreshList(updated.id);
      setMessage("Return marked received.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to mark return received.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRefundSent = async () => {
    if (!currentShopId || !selected || !refundAmount.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await markShopRefundSent(
        currentShopId,
        selected.id,
        {
          amount: Number(refundAmount),
          method: refundMethod,
          bankReference,
          note: refundNote,
          file: refundProofFile,
        },
        "",
      );
      setSelected(updated);
      await refreshList(updated.id);
      setRefundProofFile(null);
      setRefundNote("");
      setBankReference("");
      setMessage("Refund marked sent.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to mark refund sent.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="seller-returns-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Seller returns</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Return / refund cases</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Manual refund cases linked to the active shop. The seller returns money directly to the buyer outside the platform, then records proof here.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <option value="ALL">All statuses</option>
            <option value="WAITING_SELLER_RESPONSE">Waiting seller response</option>
            <option value="WAITING_BUYER_EVIDENCE">Waiting buyer evidence</option>
            <option value="ADMIN_REVIEW">Admin review</option>
            <option value="REFUND_PENDING">Refund pending</option>
            <option value="REFUND_MARKED_SENT">Refund marked sent</option>
            <option value="REFUND_CONFIRMED">Refund confirmed</option>
          </select>
          <div className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            Active shop filters live. Current list: {items.length} case(s)
          </div>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-5 py-4 text-sm text-[var(--muted)]">
            Status counts: waiting seller {visibleCounts.get("WAITING_SELLER_RESPONSE") ?? 0}, admin review {visibleCounts.get("ADMIN_REVIEW") ?? 0}, refund pending {visibleCounts.get("REFUND_PENDING") ?? 0}
          </div>
          <div className="divide-y divide-[var(--border)]" data-testid="seller-returns-list">
            {loading ? <p className="px-5 py-5 text-sm text-[var(--muted)]">Loading return cases...</p> : null}
            {!loading && !items.length ? <p className="px-5 py-5 text-sm text-[var(--muted)]">No return or refund cases for this filter.</p> : null}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full px-5 py-4 text-left ${selectedId === item.id ? "bg-[var(--panel)]" : "bg-white"}`} data-testid="seller-return-row">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.order.orderCode}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{labelForReturnStatus(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.customer.name ?? "Customer"} - {labelForReturnReason(item.reason)}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatRub(item.requestedAmount)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a return or refund case.</p>
          ) : (
            <div className="space-y-5" data-testid="seller-return-detail">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{labelForReturnType(selected.type)}</p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.order.orderCode}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{selected.customer.name ?? "Customer"} - {selected.shop.name}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">{labelForReturnStatus(selected.status)}</span>
                  <p className="mt-2 text-sm text-[var(--muted)]">Requested {formatRub(selected.requestedAmount)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Requested" value={formatRub(selected.requestedAmount)} />
                <Metric label="Approved" value={formatRub(selected.approvedAmount ?? "0")} />
                <Metric label="Order total" value={formatRub(selected.order.totalAmount)} />
                <Metric label="Fee adjustment" value={formatRub(selected.platformFeeAdjustmentAmount)} />
              </div>

              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">Order context</p>
                <p className="mt-2 text-sm text-[var(--muted)]">Payment status: {selected.order.paymentStatus}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Payment method: {selected.order.paymentMethod ?? "Unknown"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Buyer comment: {selected.buyerComment}</p>
                {selected.finance.latestAdjustmentId ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">Fee adjustment created: {selected.finance.latestAdjustmentId}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={`/seller/orders/${selected.order.id}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                    Open order detail
                  </Link>
                </div>
              </div>

              {!isReturnCaseClosed(selected.status) ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Seller decision</p>
                    <select value={action} onChange={(event) => setAction(event.target.value as (typeof sellerActions)[number]["value"])} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-return-action-select">
                      {sellerActions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <textarea value={sellerComment} onChange={(event) => setSellerComment(event.target.value)} rows={4} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-return-comment" />
                    <button type="button" onClick={() => void handleRespond()} disabled={saving} className="mt-3 rounded-full bg-[#2f2025] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-testid="seller-return-respond">
                      {saving ? "Saving..." : "Save response"}
                    </button>
                  </div>

                  <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">Refund transfer</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Amount" data-testid="seller-refund-amount" />
                      <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as "SBP" | "BANK_TRANSFER" | "CASH" | "OTHER")} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                        <option value="SBP">SBP</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <input value={bankReference} onChange={(event) => setBankReference(event.target.value)} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Bank reference" />
                    <textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Refund note" />
                    <input type="file" accept="image/*,.pdf" onChange={(event) => setRefundProofFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" data-testid="seller-refund-proof-file" />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" onClick={() => void handleMarkReturnReceived()} disabled={saving} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                        Mark return received
                      </button>
                      <button type="button" onClick={() => void handleMarkRefundSent()} disabled={saving || !refundAmount.trim()} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-testid="seller-refund-mark-sent">
                        Mark refund sent
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3" data-testid="seller-return-thread">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">Messages</h4>
                  {selected.messages.map((entry) => (
                    <article key={entry.id} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{entry.authorRole}{entry.authorName ? ` - ${entry.authorName}` : ""}</p>
                        <p className="text-xs text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{entry.message}</p>
                    </article>
                  ))}
                  {!isReturnCaseClosed(selected.status) ? (
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4">
                      <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-return-reply-message" />
                      <button type="button" onClick={() => void handleSendReply()} disabled={saving || !reply.trim()} className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                        Send reply
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">Evidence and manual transfer</h4>
                  {selected.evidence.map((entry) => (
                    <a key={entry.id} href={entry.fileUrl} target="_blank" rel="noreferrer" className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
                      {entry.label || entry.originalName || entry.fileType}
                    </a>
                  ))}
                  {!selected.evidence.length ? <p className="text-sm text-[var(--muted)]">No buyer evidence uploaded yet.</p> : null}
                  {selected.manualTransfers.map((entry) => (
                    <article key={entry.id} className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{entry.method} - {formatRub(entry.amount)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{entry.status}</p>
                      {entry.bankReference ? <p className="mt-1 text-sm text-[var(--muted)]">Reference: {entry.bankReference}</p> : null}
                      {entry.proofImageUrl ? (
                        <a href={entry.proofImageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                          Open proof
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
