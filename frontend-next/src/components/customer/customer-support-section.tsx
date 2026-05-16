"use client";

import { useMemo, useState } from "react";
import {
  addCustomerSupportCaseMessage,
  createCustomerSupportCase,
  getCustomerSupportCase,
  type CustomerCheckoutReceipt,
  type CustomerSupportCase,
} from "@/lib/customer-api";

const issueTypes = [
  "PAYMENT_PROOF",
  "DELIVERY_DELAY",
  "WRONG_ITEM",
  "DAMAGED_ITEM",
  "REFUND_REQUEST",
  "CANCEL_REQUEST",
  "OTHER",
] as const;

export function CustomerSupportSection({ receipt }: { receipt: CustomerCheckoutReceipt }) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(receipt.supportCases[0]?.id ?? null);
  const [selectedCase, setSelectedCase] = useState<CustomerSupportCase | null>(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>("DELIVERY_DELAY");
  const [targetOrderId, setTargetOrderId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const selectedSummary = useMemo(
    () => receipt.supportCases.find((entry) => entry.id === selectedCaseId) ?? null,
    [receipt.supportCases, selectedCaseId],
  );

  const loadCase = async (caseId: string) => {
    setLoadingCase(true);
    setError(null);
    try {
      const response = await getCustomerSupportCase(caseId);
      setSelectedCase(response);
      setSelectedCaseId(caseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load support case.");
    } finally {
      setLoadingCase(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createCustomerSupportCase(receipt.checkoutCode, {
        orderId: targetOrderId || undefined,
        issueType,
        subject,
        description,
      });
      receipt.supportCases.unshift({
        id: created.id,
        issueType: created.issueType,
        status: created.status,
        subject: created.subject,
        orderId: created.orderId,
        createdAt: created.createdAt,
      });
      setSelectedCase(created);
      setSelectedCaseId(created.id);
      setSubject("");
      setDescription("");
      setTargetOrderId("");
      setSuccess("Support case created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create support case.");
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!selectedCaseId || !replyMessage.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await addCustomerSupportCaseMessage(selectedCaseId, replyMessage.trim());
      setSelectedCase(updated);
      setReplyMessage("");
      setSuccess("Reply sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reply.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8" data-testid="customer-support-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Support</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Checkout support cases</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Open a case for the full marketplace receipt or for one child order.</p>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Open support case</h3>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Issue type
                <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="customer-support-issue-type">
                  {issueTypes.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[var(--foreground)]">
                Scope
                <select value={targetOrderId} onChange={(event) => setTargetOrderId(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="customer-support-target">
                  <option value="">Entire checkout</option>
                  {receipt.orders.map((order) => (
                    <option key={order.orderId} value={order.orderId}>{order.shopName} - {order.orderCode}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[var(--foreground)]">
                Subject
                <input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="customer-support-subject" />
              </label>
              <label className="text-sm font-medium text-[var(--foreground)]">
                Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="customer-support-description" />
              </label>
              <button type="button" onClick={() => void handleCreate()} disabled={saving || !subject.trim() || !description.trim()} className="public-button-primary px-5 py-3 text-sm" data-testid="customer-support-submit">
                {saving ? "Submitting..." : "Open support case"}
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Existing cases</h3>
            <div className="mt-4 space-y-3" data-testid="customer-support-case-list">
              {receipt.supportCases.length ? (
                receipt.supportCases.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void loadCase(item.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedCaseId === item.id ? "border-[var(--accent)] bg-[var(--accent-soft)]/35" : "border-[var(--border)] bg-[var(--panel)]"}`}
                    data-testid="customer-support-case-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.subject}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{item.status}</span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{item.issueType}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No support cases yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          {!selectedSummary && !selectedCase ? (
            <p className="text-sm text-[var(--muted)]">Select a support case to review the thread.</p>
          ) : loadingCase ? (
            <p className="text-sm text-[var(--muted)]">Loading support case...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{selectedCase?.issueType ?? selectedSummary?.issueType}</p>
                  <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{selectedCase?.subject ?? selectedSummary?.subject}</h3>
                  {selectedCase?.order ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">{selectedCase.shopName} - {selectedCase.order.orderCode}</p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--muted)]">Applies to full checkout receipt</p>
                  )}
                </div>
                <div className="rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">{selectedCase?.status ?? selectedSummary?.status}</div>
              </div>
              {selectedCase?.description ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{selectedCase.description}</p> : null}
              <div className="mt-6 space-y-3" data-testid="customer-support-thread">
                {selectedCase?.messages.map((message) => (
                  <article key={message.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{message.senderRole}{message.senderName ? ` - ${message.senderName}` : ""}</p>
                      <p className="text-xs text-[var(--muted)]">{new Date(message.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message.message}</p>
                  </article>
                ))}
              </div>
              {selectedCaseId ? (
                <div className="mt-6">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    Reply
                    <textarea value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="customer-support-reply-message" />
                  </label>
                  <button type="button" onClick={() => void handleReply()} disabled={saving || !replyMessage.trim()} className="public-button-secondary mt-3 px-5 py-3 text-sm" data-testid="customer-support-reply-submit">
                    {saving ? "Sending..." : "Send reply"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
