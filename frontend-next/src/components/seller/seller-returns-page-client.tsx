"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useActionFeedback } from "@/hooks/use-action-feedback";
import {
  formatRub,
  isReturnCaseClosed,
  labelForReturnReason,
  labelForReturnStatus,
  labelForReturnType,
} from "@/components/returns/return-refund-utils";
import { useI18n } from "@/i18n/use-i18n";

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
  const { t } = useI18n("seller");
  const hydrate = useSellerWorkspaceStore((state) => state.hydrate);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const [items, setItems] = useState<SellerReturnRefundCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(caseId ?? null);
  const [selected, setSelected] = useState<SellerReturnRefundCase | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const { run, isRunning: saving } = useActionFeedback();
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
          setError(issue instanceof Error ? issue.message : t("seller.returns.loadFailed"));
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
  }, [caseId, filterStatus, hydrated, loadShops, t]);

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
          setError(issue instanceof Error ? issue.message : t("seller.returns.selectedLoadFailed"));
        }
      });
    return () => {
      active = false;
    };
  }, [currentShopId, selectedId, t]);

  const visibleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const handleRespond = async () => {
    if (!currentShopId || !selected) return;

    if (action === "REJECT") {
      const confirmed = window.confirm(t("seller.returns.rejectConfirm"));
      if (!confirmed) return;
    }

    setError(null);
    setMessage(null);
    await run({
      action: async () => {
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
        setMessage(t("seller.returns.responseSaved"));
        return updated;
      },
      successMessage: t("seller.returns.responseSaved"),
      errorMessage: t("seller.returns.responseFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleSendReply = async () => {
    if (!currentShopId || !selected || !reply.trim()) return;
    setError(null);
    setMessage(null);
    await run({
      action: async () => {
        const updated = await addShopReturnRefundMessage(currentShopId, selected.id, reply, "");
        setSelected(updated);
        await refreshList(updated.id);
        setReply("");
        setMessage(t("seller.returns.replySent"));
        return updated;
      },
      successMessage: t("seller.returns.replySent"),
      errorMessage: t("seller.returns.replyFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleMarkReturnReceived = async () => {
    if (!currentShopId || !selected) return;
    setError(null);
    setMessage(null);
    await run({
      action: async () => {
        const updated = await markShopReturnReceived(currentShopId, selected.id, "");
        setSelected(updated);
        await refreshList(updated.id);
        setMessage(t("seller.returns.returnReceived"));
        return updated;
      },
      successMessage: t("seller.returns.returnReceived"),
      errorMessage: t("seller.returns.returnReceivedFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleMarkRefundSent = async () => {
    if (!currentShopId || !selected || !refundAmount.trim()) return;
    setError(null);
    setMessage(null);
    await run({
      action: async () => {
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
        setMessage(t("seller.returns.refundSent"));
        return updated;
      },
      successMessage: t("seller.returns.refundSent"),
      errorMessage: t("seller.returns.refundSentFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  return (
    <div className="space-y-6" data-testid="seller-returns-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("seller.returns.sellerReturns")}</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">{t("seller.returns.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t("seller.returns.subtitle")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <option value="ALL">{t("seller.returns.allStatuses")}</option>
            <option value="WAITING_SELLER_RESPONSE">{labelForReturnStatus("WAITING_SELLER_RESPONSE")}</option>
            <option value="WAITING_BUYER_EVIDENCE">{labelForReturnStatus("WAITING_BUYER_EVIDENCE")}</option>
            <option value="ADMIN_REVIEW">{labelForReturnStatus("ADMIN_REVIEW")}</option>
            <option value="REFUND_PENDING">{labelForReturnStatus("REFUND_PENDING")}</option>
            <option value="REFUND_MARKED_SENT">{labelForReturnStatus("REFUND_MARKED_SENT")}</option>
            <option value="REFUND_CONFIRMED">{labelForReturnStatus("REFUND_CONFIRMED")}</option>
          </select>
          <div className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("seller.returns.statusSummary", { count: items.length })}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-5 py-4 text-sm text-[var(--muted)]">
            {t("seller.returns.counts", {
              waitingSeller: visibleCounts.get("WAITING_SELLER_RESPONSE") ?? 0,
              adminReview: visibleCounts.get("ADMIN_REVIEW") ?? 0,
              refundPending: visibleCounts.get("REFUND_PENDING") ?? 0,
            })}
          </div>
          <div className="divide-y divide-[var(--border)]" data-testid="seller-returns-list">
            {loading ? <p className="px-5 py-5 text-sm text-[var(--muted)]">{t("seller.returns.loading")}</p> : null}
            {!loading && !items.length ? <p className="px-5 py-5 text-sm text-[var(--muted)]">{t("seller.returns.empty")}</p> : null}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full px-5 py-4 text-left ${selectedId === item.id ? "bg-[var(--panel)]" : "bg-white"}`} data-testid="seller-return-row">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.order.orderCode}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{labelForReturnStatus(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.customer.name ?? t("seller.returns.customerFallback")} - {labelForReturnReason(item.reason)}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{formatRub(item.requestedAmount)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">{t("seller.returns.selectCase")}</p>
          ) : (
            <div className="space-y-5" data-testid="seller-return-detail">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{labelForReturnType(selected.type)}</p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.order.orderCode}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{selected.customer.name ?? t("seller.returns.customerFallback")} - {selected.shop.name}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">{labelForReturnStatus(selected.status)}</span>
                  <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.returns.requested")} {formatRub(selected.requestedAmount)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label={t("seller.returns.requested")} value={formatRub(selected.requestedAmount)} />
                <Metric label={t("seller.returns.approved")} value={formatRub(selected.approvedAmount ?? "0")} />
                <Metric label={t("seller.returns.orderTotal")} value={formatRub(selected.order.totalAmount)} />
                <Metric label={t("seller.returns.feeAdjustment")} value={formatRub(selected.platformFeeAdjustmentAmount)} />
              </div>

              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.returns.orderContext")}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{t("seller.returns.paymentStatus", { value: selected.order.paymentStatus })}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{t("seller.returns.paymentMethod", { value: selected.order.paymentMethod ?? t("common.unknown") })}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{t("seller.returns.buyerComment", { value: selected.buyerComment })}</p>
                {selected.finance.latestAdjustmentId ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">{t("seller.returns.feeAdjustmentCreated", { value: selected.finance.latestAdjustmentId })}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={`/seller/orders/${selected.order.id}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                    {t("seller.returns.openOrderDetail")}
                  </Link>
                </div>
              </div>

              {!isReturnCaseClosed(selected.status) ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.returns.sellerDecision")}</p>
                    <select value={action} onChange={(event) => setAction(event.target.value as (typeof sellerActions)[number]["value"])} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-return-action-select">
                      {sellerActions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value === "ACCEPT" ? t("common.actions.accept") : option.value === "REJECT" ? t("common.actions.reject") : option.value === "REQUEST_EVIDENCE" ? t("seller.returns.requestEvidence") : t("seller.returns.escalateAdmin")}
                        </option>
                      ))}
                    </select>
                    <textarea value={sellerComment} onChange={(event) => setSellerComment(event.target.value)} rows={4} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="seller-return-comment" />
                    <Button
                      onClick={() => void handleRespond()}
                      disabled={saving}
                      loading={saving}
                      className="mt-3"
                      data-testid="seller-return-respond"
                    >
                      {t("seller.returns.saveResponse")}
                    </Button>
                  </div>

                  <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.returns.refundTransfer")}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <input value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder={t("seller.returns.amount")} data-testid="seller-refund-amount" />
                      <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as "SBP" | "BANK_TRANSFER" | "CASH" | "OTHER")} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
                        <option value="SBP">SBP</option>
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <input value={bankReference} onChange={(event) => setBankReference(event.target.value)} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder={t("seller.returns.bankReference")} />
                    <textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder={t("seller.returns.refundNote")} />
                    <input type="file" accept="image/*,.pdf" onChange={(event) => setRefundProofFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" data-testid="seller-refund-proof-file" />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        onClick={() => void handleMarkReturnReceived()}
                        disabled={saving}
                        loading={saving}
                      >
                        {t("seller.returns.markReturnReceived")}
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => void handleMarkRefundSent()}
                        disabled={saving || !refundAmount.trim()}
                        loading={saving}
                        data-testid="seller-refund-mark-sent"
                      >
                        {t("seller.returns.markRefundSent")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3" data-testid="seller-return-thread">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">{t("seller.returns.messages")}</h4>
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
                      <Button
                        variant="outline"
                        onClick={() => void handleSendReply()}
                        disabled={saving || !reply.trim()}
                        loading={saving}
                        className="mt-3"
                      >
                        {t("seller.returns.sendReply")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">{t("seller.returns.evidenceTitle")}</h4>
                  {selected.evidence.map((entry) => (
                    <a key={entry.id} href={entry.fileUrl} target="_blank" rel="noreferrer" className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
                      {entry.label || entry.originalName || entry.fileType}
                    </a>
                  ))}
                  {!selected.evidence.length ? <p className="text-sm text-[var(--muted)]">{t("seller.returns.noEvidence")}</p> : null}
                  {selected.manualTransfers.map((entry) => (
                    <article key={entry.id} className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{entry.method} - {formatRub(entry.amount)}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{entry.status}</p>
                      {entry.bankReference ? <p className="mt-1 text-sm text-[var(--muted)]">{t("seller.returns.reference", { value: entry.bankReference })}</p> : null}
                      {entry.proofImageUrl ? (
                        <a href={entry.proofImageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                          {t("seller.returns.openProof")}
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
