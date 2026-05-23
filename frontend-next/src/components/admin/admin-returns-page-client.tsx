"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addAdminReturnRefundInternalNote,
  addAdminReturnRefundMessage,
  decideAdminReturnRefundCase,
  getAdminReturnRefundCase,
  listAdminReturnRefundCases,
  type AdminReturnRefundCase,
} from "@/lib/admin-api";
import {
  formatRub,
  isReturnCaseClosed,
  labelForReturnReason,
  labelForReturnStatus,
  labelForReturnType,
} from "@/components/returns/return-refund-utils";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const decisionOptions = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE_EVIDENCE",
  "CLOSE",
  "OVERRIDE_REFUND_CONFIRMED",
] as const;

export function AdminReturnsPageClient({
  caseId,
}: {
  caseId?: string | null;
}) {
  const [items, setItems] = useState<AdminReturnRefundCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(caseId ?? null);
  const [selected, setSelected] = useState<AdminReturnRefundCase | null>(null);
  const [filterStatus, setFilterStatus] = useState("OPENED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { run: runAction, isRunning: saving } = useActionFeedback();
  const [decision, setDecision] = useState<(typeof decisionOptions)[number]>("APPROVE");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const refreshList = async (preferredSelectedId?: string | null) => {
    const response = await listAdminReturnRefundCases({
      status: filterStatus === "ALL" ? undefined : filterStatus,
      page: 1,
      limit: 50,
    });
    setItems(response.items);
    setSelectedId((current) => preferredSelectedId ?? current ?? response.items[0]?.id ?? null);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const response = await listAdminReturnRefundCases({
          status: filterStatus === "ALL" ? undefined : filterStatus,
          page: 1,
          limit: 50,
        });
        if (!active) return;
        setItems(response.items);
        setSelectedId(caseId ?? response.items[0]?.id ?? null);
        setError(null);
      } catch (issue) {
        if (active) {
          setError(issue instanceof Error ? issue.message : "Unable to load admin return cases.");
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
  }, [caseId, filterStatus]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let active = true;
    void getAdminReturnRefundCase(selectedId)
      .then((response) => {
        if (active) {
          setSelected(response);
          setApprovedAmount(response.approvedAmount ?? response.requestedAmount);
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
  }, [selectedId]);

  const handleDecision = async () => {
    if (!selected || !adminNote.trim()) {
      setError("Admin note is required.");
      return;
    }
    if (decision === "REJECT" && !window.confirm("Bạn có chắc chắn muốn TỪ CHỐI yêu cầu trả hàng/hoàn tiền này không?")) {
      return;
    }
    if (decision === "OVERRIDE_REFUND_CONFIRMED" && !window.confirm("Bạn có chắc chắn muốn GHI ĐÈ xác nhận hoàn tiền này không?")) {
      return;
    }
    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        return decideAdminReturnRefundCase(selected.id, {
          decision,
          approvedAmount: approvedAmount.trim() ? Number(approvedAmount) : undefined,
          adminNote,
        });
      },
      successMessage: "Đã lưu quyết định xử lý trả hàng/hoàn tiền.",
      onSuccess: async (updated) => {
        setSelected(updated);
        await refreshList(updated.id);
        setAdminNote("");
      }
    });
  };

  const handlePublicMessage = async () => {
    if (!selected || !publicMessage.trim()) return;
    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        return addAdminReturnRefundMessage(selected.id, {
          message: publicMessage,
        });
      },
      successMessage: "Đã gửi tin nhắn công khai.",
      onSuccess: async (updated) => {
        setSelected(updated);
        await refreshList(updated.id);
        setPublicMessage("");
      }
    });
  };

  const handleInternalNote = async () => {
    if (!selected || !internalNote.trim()) return;
    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        return addAdminReturnRefundInternalNote(selected.id, {
          message: internalNote,
        });
      },
      successMessage: "Đã thêm ghi chú nội bộ.",
      onSuccess: async (updated) => {
        setSelected(updated);
        await refreshList(updated.id);
        setInternalNote("");
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-returns-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Marketplace disputes</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Returns / refunds / disputes</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">This queue governs manual refund evidence, seller response SLA, and platform fee adjustments after direct-to-seller payments.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <option value="ALL">All</option>
            <option value="OPENED">Opened</option>
            <option value="WAITING_SELLER_RESPONSE">Waiting seller</option>
            <option value="ADMIN_REVIEW">Admin review</option>
            <option value="REFUND_PENDING">Refund pending</option>
            <option value="REFUND_CONFIRMED">Refund confirmed</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          <h3 className="text-lg font-bold text-[var(--foreground)]">Case queue</h3>
          <div className="mt-4 space-y-3" data-testid="admin-returns-list">
            {loading ? (
              <p className="text-sm text-[var(--muted)]">Loading cases...</p>
            ) : items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`block w-full rounded-[1.25rem] border px-4 py-4 text-left ${selected?.id === item.id ? "border-indigo-400 bg-indigo-50" : "border-[var(--border)] bg-[var(--panel)]"}`}
                  data-testid="admin-return-row"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.order.orderCode}</p>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{labelForReturnStatus(item.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">{item.shop.name} - {item.customer.name ?? "Customer"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{labelForReturnType(item.type)} - {labelForReturnReason(item.reason)}</p>
                  <p className="mt-2 text-xs text-[var(--muted)]">Adjustment {formatRub(item.platformFeeAdjustmentAmount)}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No cases match the current filters.</p>
            )}
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a case to review it.</p>
          ) : (
            <div className="space-y-5" data-testid="admin-return-detail">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{labelForReturnType(selected.type)}</p>
                <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.order.orderCode}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{selected.shop.name} - {selected.customer.name ?? "Customer"} - {selected.seller.name ?? "Seller"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Payment method {selected.order.paymentMethod ?? "Unknown"} - status {selected.order.paymentStatus}</p>
                <p className="mt-2 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {labelForReturnStatus(selected.status)}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Requested" value={formatRub(selected.requestedAmount)} />
                <Metric label="Approved" value={formatRub(selected.approvedAmount ?? "0")} />
                <Metric label="Product amount" value={formatRub(selected.productAmount)} />
                <Metric label="Fee adjustment" value={formatRub(selected.platformFeeAdjustmentAmount)} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Decision</p>
                  {!isReturnCaseClosed(selected.status) ? (
                    <>
                      <select value={decision} onChange={(event) => setDecision(event.target.value as (typeof decisionOptions)[number])} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-return-decision-select">
                        {decisionOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <input value={approvedAmount} onChange={(event) => setApprovedAmount(event.target.value)} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Approved amount" data-testid="admin-return-approved-amount" />
                      <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={4} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Admin note" data-testid="admin-return-note" />
                      <button
                        type="button"
                        onClick={() => void handleDecision()}
                        disabled={saving}
                        className="mt-3 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        data-testid="admin-return-save-decision"
                      >
                        {saving ? (
                          decision === "APPROVE" ? "Đang xác nhận..." :
                          decision === "REJECT" ? "Đang từ chối..." :
                          "Đang cập nhật..."
                        ) : "Save decision"}
                      </button>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">This case is already closed.</p>
                  )}
                  {selected.finance.latestAdjustmentId ? (
                    <p className="mt-3 text-sm text-[var(--muted)]">Ledger adjustment: {selected.finance.latestAdjustmentId}</p>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--muted)]">No fee adjustment created yet.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link href={`/admin/finance/seller-fees`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">
                      Open finance
                    </Link>
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Messages</p>
                  <div className="mt-3 space-y-3" data-testid="admin-return-thread">
                    {selected.messages.map((entry) => (
                      <article key={entry.id} className="rounded-[1rem] border border-[var(--border)] bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{entry.authorRole}{entry.authorName ? ` - ${entry.authorName}` : ""}</p>
                          <p className="text-xs text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">{entry.message}</p>
                      </article>
                    ))}
                  </div>
                  <textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Public admin message" data-testid="admin-return-public-message" />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void handlePublicMessage()} disabled={saving || !publicMessage.trim()} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                      {saving ? "Đang gửi..." : "Send public message"}
                    </button>
                  </div>
                  <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Internal admin note" data-testid="admin-return-internal-note" />
                  <button type="button" onClick={() => void handleInternalNote()} disabled={saving || !internalNote.trim()} className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">
                    {saving ? "Đang gửi..." : "Add internal note"}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">Evidence</h4>
                  {selected.evidence.map((entry) => (
                    <a key={entry.id} href={entry.fileUrl} target="_blank" rel="noreferrer" className="block rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]">
                      {entry.label || entry.originalName || entry.fileType}
                    </a>
                  ))}
                  {!selected.evidence.length ? <p className="text-sm text-[var(--muted)]">No evidence uploaded.</p> : null}
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-bold text-[var(--foreground)]">Refund transfer</h4>
                  {selected.manualTransfers.map((entry) => (
                    <article key={entry.id} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
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
                  {!selected.manualTransfers.length ? <p className="text-sm text-[var(--muted)]">Seller has not marked any refund transfer yet.</p> : null}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
