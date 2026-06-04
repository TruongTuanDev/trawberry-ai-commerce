"use client";

import { useEffect, useState } from "react";
import {
  addAdminSupportCaseMessage,
  getAdminSupportCase,
  listAdminSupportCases,
  updateAdminSupportCase,
  type SupportCaseDetail,
} from "@/lib/admin-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const issueTypes = ["", "PAYMENT_PROOF", "DELIVERY_DELAY", "WRONG_ITEM", "DAMAGED_ITEM", "REFUND_REQUEST", "CANCEL_REQUEST", "OTHER"];
const statuses = ["", "OPEN", "IN_REVIEW", "WAITING_CUSTOMER", "WAITING_SELLER", "RESOLVED", "REJECTED", "CLOSED"];
const priorities = ["", "LOW", "NORMAL", "HIGH", "URGENT"];

function formatIssueType(value: string) {
  switch (value) {
    case "PAYMENT_PROOF":
      return "Payment proof";
    case "DELIVERY_DELAY":
      return "Delivery delay";
    case "WRONG_ITEM":
      return "Wrong item";
    case "DAMAGED_ITEM":
      return "Damaged item";
    case "REFUND_REQUEST":
      return "Refund request";
    case "CANCEL_REQUEST":
      return "Cancel request";
    case "OTHER":
      return "Other";
    default:
      return value;
  }
}

function formatStatus(value: string) {
  switch (value) {
    case "OPEN":
      return "Open";
    case "IN_REVIEW":
      return "In review";
    case "WAITING_CUSTOMER":
      return "Waiting for customer";
    case "WAITING_SELLER":
      return "Waiting for seller";
    case "RESOLVED":
      return "Resolved";
    case "REJECTED":
      return "Rejected";
    case "CLOSED":
      return "Closed";
    default:
      return value;
  }
}

function formatPriority(value: string) {
  switch (value) {
    case "LOW":
      return "Low";
    case "NORMAL":
      return "Normal";
    case "HIGH":
      return "High";
    case "URGENT":
      return "Urgent";
    default:
      return value;
  }
}

function formatSenderRole(value: string) {
  switch (value) {
    case "CUSTOMER":
      return "Customer";
    case "SELLER":
      return "Seller";
    case "ADMIN":
      return "Admin";
    case "SYSTEM":
      return "System";
    default:
      return value;
  }
}

export function AdminSupportCasesPageClient() {
  const [items, setItems] = useState<SupportCaseDetail[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportCaseDetail | null>(null);
  const [status, setStatus] = useState("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState("");
  const [checkoutCode, setCheckoutCode] = useState("");
  const [queryCheckoutCode, setQueryCheckoutCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const { run: runUpdateCase, isRunning: isUpdatingCase } = useActionFeedback();
  const { run: runSendMessage, isRunning: isSendingMessage } = useActionFeedback();

  useEffect(() => {
    let cancelled = false;
    void listAdminSupportCases({
      status: status || undefined,
      issueType: issueType || undefined,
      priority: priority || undefined,
      checkoutCode: queryCheckoutCode || undefined,
    })
      .then((response) => {
        if (cancelled) return;
        setItems(response.items);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
        if (!response.items.length) {
          setSelected(null);
        }
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
  }, [status, issueType, priority, queryCheckoutCode]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void getAdminSupportCase(selectedId)
      .then((response) => {
        if (cancelled) return;
        setSelected(response);
        setResolutionNote(response.resolutionNote ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load support case.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const refreshList = async () => {
    const response = await listAdminSupportCases({
      status: status || undefined,
      issueType: issueType || undefined,
      priority: priority || undefined,
      checkoutCode: queryCheckoutCode || undefined,
    });
    setItems(response.items);
  };

  return (
    <div className="space-y-6" data-testid="admin-support-cases-page">
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Customer support</p>
        <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">Support cases</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Admin review queue for checkout-level and order-level customer cases.</p>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-support-status-filter">
            {statuses.map((item) => <option key={item} value={item}>{item ? formatStatus(item) : "All statuses"}</option>)}
          </select>
          <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-support-issue-filter">
            {issueTypes.map((item) => <option key={item} value={item}>{item ? formatIssueType(item) : "All issue types"}</option>)}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-support-priority-filter">
            {priorities.map((item) => <option key={item} value={item}>{item ? formatPriority(item) : "All priorities"}</option>)}
          </select>
          <div className="flex gap-2">
            <input value={checkoutCode} onChange={(event) => setCheckoutCode(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" placeholder="Checkout code" />
            <button type="button" onClick={() => setQueryCheckoutCode(checkoutCode.trim())} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold">Apply</button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white">
          {loading ? <p className="px-5 py-5 text-sm text-[var(--muted)]">Loading support cases...</p> : null}
          <div className="divide-y divide-[var(--border)]" data-testid="admin-support-case-list">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full px-5 py-4 text-left ${selectedId === item.id ? "bg-[var(--panel)]" : "bg-white"}`} data-testid="admin-support-case-row">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--foreground)]">{item.subject}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">{formatStatus(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.checkoutCode}{item.shopName ? ` - ${item.shopName}` : ""}</p>
              </button>
            ))}
            {!loading && !items.length ? <p className="px-5 py-5 text-sm text-[var(--muted)]">No support cases found.</p> : null}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select a support case.</p>
          ) : (
            <div className="space-y-5" data-testid="admin-support-case-detail">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{formatIssueType(selected.issueType)}</p>
                  <h3 className="mt-2 text-2xl font-bold text-[var(--foreground)]">{selected.subject}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{selected.checkoutCode}{selected.order ? ` - ${selected.order.orderCode}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selected.status}
                    disabled={isUpdatingCase || isSendingMessage}
                    onChange={async (event) => {
                      const newStatus = event.target.value;
                      await runUpdateCase({
                        action: async () => updateAdminSupportCase(selected.id, { status: newStatus, priority: selected.priority, resolutionNote }),
                        successMessage: "Support case status updated.",
                        onSuccess: async (updated) => {
                          setSelected(updated);
                          await refreshList();
                        },
                      });
                    }}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                    data-testid="admin-support-status-select"
                  >
                    {statuses.filter(Boolean).map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
                  </select>
                  <select
                    value={selected.priority}
                    disabled={isUpdatingCase || isSendingMessage}
                    onChange={async (event) => {
                      const newPriority = event.target.value;
                      await runUpdateCase({
                        action: async () => updateAdminSupportCase(selected.id, { priority: newPriority, status: selected.status, resolutionNote }),
                        successMessage: "Support case priority updated.",
                        onSuccess: async (updated) => {
                          setSelected(updated);
                          await refreshList();
                        },
                      });
                    }}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                  >
                    {priorities.filter(Boolean).map((item) => <option key={item} value={item}>{formatPriority(item)}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">{selected.description}</p>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Resolution note
                <textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" />
              </label>
              <button
                type="button"
                onClick={async () => {
                  await runUpdateCase({
                    action: async () => updateAdminSupportCase(selected.id, { resolutionNote }),
                    successMessage: "Resolution note saved.",
                    onSuccess: async (updated) => {
                      setSelected(updated);
                      await refreshList();
                    },
                  });
                }}
                disabled={isUpdatingCase || isSendingMessage}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {isUpdatingCase ? "Saving..." : "Save note"}
              </button>
              <div className="space-y-3" data-testid="admin-support-thread">
                {selected.messages.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{formatSenderRole(entry.senderRole)}{entry.senderName ? ` - ${entry.senderName}` : ""}{entry.isInternal ? " (Internal)" : ""}</p>
                      <p className="text-xs text-[var(--muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">{entry.message}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm" data-testid="admin-support-message" />
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} data-testid="admin-support-internal-toggle" />
                  Internal only
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    await runSendMessage({
                      action: async () => addAdminSupportCaseMessage(selected.id, { message, isInternal: internal }),
                      successMessage: internal ? "Internal note saved." : "Support reply sent.",
                      onSuccess: async (updated) => {
                        setSelected(updated);
                        setMessage("");
                        setInternal(false);
                        await refreshList();
                      },
                    });
                  }}
                  disabled={!message.trim() || isUpdatingCase || isSendingMessage}
                  className="mt-3 rounded-full bg-[#2f2025] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  data-testid="admin-support-send"
                >
                  {isSendingMessage ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
