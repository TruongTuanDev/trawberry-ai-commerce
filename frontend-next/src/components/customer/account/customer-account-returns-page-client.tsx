"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CustomerAccountShell } from "@/components/customer/account/customer-account-shell";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";
import {
  addCustomerReturnRefundMessage,
  cancelCustomerReturnRefundCase,
  confirmCustomerRefundReceived,
  createCustomerReturnRefundCase,
  getCustomerOrderHistory,
  getCustomerReturnRefundCase,
  listCustomerReturnRefundCases,
  uploadCustomerReturnRefundEvidence,
  type CustomerCheckoutReceipt,
  type CustomerReturnRefundCase,
} from "@/lib/customer-api";
import {
  canCustomerConfirmRefund,
  formatRub,
  isReturnCaseClosed,
  labelForReturnReason,
  labelForReturnStatus,
  labelForReturnType,
} from "@/components/returns/return-refund-utils";

const typeOptions = [
  "REFUND_ONLY",
  "RETURN_AND_REFUND",
  "EXCHANGE_REQUEST",
  "PAYMENT_DISPUTE_ONLY",
] as const;

const reasonOptions = [
  "WRONG_SIZE",
  "ITEM_NOT_AS_DESCRIBED",
  "DAMAGED_ITEM",
  "MISSING_ITEM",
  "WRONG_ITEM",
  "LATE_DELIVERY",
  "BUYER_CHANGED_MIND",
  "PAYMENT_DISPUTE",
  "OTHER",
] as const;

export function CustomerAccountReturnsPageClient({
  caseId,
  initialOrderId,
}: {
  caseId?: string | null;
  initialOrderId?: string | null;
}) {
  const { t, locale } = useI18n("customer");
  const [items, setItems] = useState<CustomerReturnRefundCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(caseId ?? null);
  const [selected, setSelected] = useState<CustomerReturnRefundCase | null>(null);
  const [receipts, setReceipts] = useState<CustomerCheckoutReceipt[]>([]);
  const [orderId, setOrderId] = useState(initialOrderId ?? "");
  const [type, setType] = useState<(typeof typeOptions)[number]>("REFUND_ONLY");
  const [reason, setReason] = useState<(typeof reasonOptions)[number]>("WRONG_SIZE");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [buyerComment, setBuyerComment] = useState("");
  const [reply, setReply] = useState("");
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const { run: runCreate, isRunning: creating } = useActionFeedback();
  const { run: runAction, isRunning: saving } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadList = async (preferredSelectedId?: string | null) => {
    const [casesResponse, ordersResponse] = await Promise.all([
      listCustomerReturnRefundCases(),
      getCustomerOrderHistory(),
    ]);
    setItems(casesResponse.items);
    setReceipts(ordersResponse.items);
    setSelectedId(
      (current) =>
        preferredSelectedId ?? current ?? casesResponse.items[0]?.id ?? null,
    );
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [casesResponse, ordersResponse] = await Promise.all([
          listCustomerReturnRefundCases(),
          getCustomerOrderHistory(),
        ]);
        if (!active) return;
        setItems(casesResponse.items);
        setReceipts(ordersResponse.items);
        const nextSelectedId = caseId ?? casesResponse.items[0]?.id ?? null;
        setSelectedId(nextSelectedId);
        setError(null);
      } catch (issue) {
        if (active) {
          setError(
            issue instanceof Error ? issue.message : t("customer.returns.loadFailed"),
          );
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
  }, [caseId, t]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let active = true;
    void getCustomerReturnRefundCase(selectedId)
      .then((response) => {
        if (active) {
          setSelected(response);
        }
      })
      .catch((issue) => {
        if (active) {
          setError(
            issue instanceof Error
              ? issue.message
              : t("customer.returns.selectedLoadFailed"),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId, t]);

  const orderOptions = useMemo(
    () =>
      receipts.flatMap((receipt) =>
        receipt.orders.map((order) => ({
          id: order.orderId,
          label: `${order.orderCode} - ${order.shopName} - ${order.totalAmount}`,
          totalAmount: order.totalAmount,
        })),
      ),
    [receipts],
  );

  const selectedOrder = orderOptions.find((entry) => entry.id === orderId) ?? null;

  const handleCreate = async () => {
    if (!orderId || !requestedAmount.trim() || !buyerComment.trim()) {
      setError(t("customer.returns.requiredFields"));
      return;
    }

    setError(null);
    setMessage(null);
    await runCreate({
      action: async () => {
        const created = await createCustomerReturnRefundCase(orderId, {
          type,
          reason,
          requestedAmount: Number(requestedAmount),
          buyerComment,
        });
        if (evidenceFile) {
          await uploadCustomerReturnRefundEvidence(created.id, {
            file: evidenceFile,
            label: evidenceLabel,
          });
        }
        await loadList(created.id);
        const refreshed = await getCustomerReturnRefundCase(created.id);
        setSelected(refreshed);
        setBuyerComment("");
        setRequestedAmount("");
        setEvidenceFile(null);
        setEvidenceLabel("");
        return created;
      },
      successMessage: t("customer.returns.createSuccess"),
      errorMessage: t("customer.returns.createFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleSendMessage = async () => {
    if (!selected || !reply.trim()) return;
    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        const updated = await addCustomerReturnRefundMessage(selected.id, reply);
        setSelected(updated);
        await loadList(updated.id);
        setReply("");
        return updated;
      },
      successMessage: t("customer.returns.replySuccess"),
      errorMessage: t("customer.returns.replyFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleUploadEvidence = async () => {
    if (!selected || !evidenceFile) return;
    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        const updated = await uploadCustomerReturnRefundEvidence(selected.id, {
          file: evidenceFile,
          label: evidenceLabel,
        });
        setSelected(updated);
        await loadList(updated.id);
        setEvidenceFile(null);
        setEvidenceLabel("");
        return updated;
      },
      successMessage: t("customer.returns.uploadSuccess"),
      errorMessage: t("customer.returns.uploadFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleConfirmRefund = async () => {
    if (!selected) return;
    if (!window.confirm(t("customer.returns.confirmRefundReceivedConfirm"))) {
      return;
    }

    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        const updated = await confirmCustomerRefundReceived(selected.id);
        setSelected(updated);
        await loadList(updated.id);
        return updated;
      },
      successMessage: t("customer.returns.confirmRefundReceivedSuccess"),
      errorMessage: t("customer.returns.confirmRefundReceivedFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  const handleCancelCase = async () => {
    if (!selected) return;
    if (!window.confirm(t("customer.returns.cancelCaseConfirm"))) {
      return;
    }

    setError(null);
    setMessage(null);
    await runAction({
      action: async () => {
        const updated = await cancelCustomerReturnRefundCase(selected.id);
        setSelected(updated);
        await loadList(updated.id);
        return updated;
      },
      successMessage: t("customer.returns.cancelSuccess"),
      errorMessage: t("customer.returns.cancelFailed"),
    }).catch((issue) => {
      setError(issue.message);
    });
  };

  return (
    <CustomerAccountShell
      title={t("customer.returns.title")}
      description={t("customer.returns.description")}
      actions={
        <Link
          href="/customer/orders"
          className="public-button-secondary inline-flex px-4 py-2 text-sm"
        >
          {t("customer.orders.backToOrders")}
        </Link>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="card-panel rounded-[2rem] px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.order")}
            <select
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
              data-testid="customer-return-order-select"
            >
              <option value="">{t("customer.returns.selectOrder")}</option>
              {orderOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.caseType")}
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as (typeof typeOptions)[number])
              }
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
              data-testid="customer-return-type-select"
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {labelForReturnType(option, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.reason")}
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as (typeof reasonOptions)[number])
              }
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
              data-testid="customer-return-reason-select"
            >
              {reasonOptions.map((option) => (
                <option key={option} value={option}>
                  {labelForReturnReason(option, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.requestedAmount")}
            <input
              value={requestedAmount}
              onChange={(event) => setRequestedAmount(event.target.value)}
              placeholder={selectedOrder?.totalAmount ?? "0"}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
              data-testid="customer-return-requested-amount"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.evidenceLabel")}
            <input
              value={evidenceLabel}
              onChange={(event) => setEvidenceLabel(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--foreground)]">
            {t("customer.returns.optionalEvidence")}
            <input
              id="customer-return-evidence-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
              className="sr-only"
              data-testid="customer-return-evidence-file"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label
                htmlFor="customer-return-evidence-file"
                className="public-button-secondary inline-flex cursor-pointer px-4 py-2 text-sm"
              >
                {t("customer.returns.chooseFile")}
              </label>
              <span
                className="text-sm text-[var(--muted)]"
                data-testid="customer-return-evidence-file-name"
              >
                {evidenceFile?.name || t("customer.returns.noFileSelected")}
              </span>
            </div>
          </label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-[var(--foreground)]">
          {t("customer.returns.comment")}
          <textarea
            value={buyerComment}
            onChange={(event) => setBuyerComment(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
            data-testid="customer-return-comment"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || loading}
            className="public-button-primary px-5 py-3 text-sm disabled:opacity-60"
            data-testid="customer-return-submit"
          >
            {creating ? t("customer.returns.submitting") : t("customer.returns.openCase")}
          </button>
          <p className="text-sm text-[var(--muted)]">{t("customer.returns.hint")}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="card-panel rounded-[2rem] px-3 py-3" data-testid="customer-returns-list">
          {loading ? (
            <p className="px-4 py-5 text-sm text-[var(--muted)]">{t("customer.returns.loading")}</p>
          ) : null}
          {!loading && !items.length ? (
            <p className="px-4 py-5 text-sm text-[var(--muted)]">{t("customer.returns.empty")}</p>
          ) : null}
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left ${
                  selectedId === item.id
                    ? "border-[var(--accent)] bg-[var(--panel-strong)]"
                    : "border-[var(--border)] bg-white"
                }`}
                data-testid="customer-return-row"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {item.order.orderCode}
                  </p>
                  <span
                    className="rounded-full bg-[var(--panel)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]"
                    data-testid="customer-return-row-status"
                    data-status={item.status}
                  >
                    {labelForReturnStatus(item.status, locale)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {labelForReturnType(item.type, locale)} -{" "}
                  {labelForReturnReason(item.reason, locale)}
                </p>
                <p className="mt-2 text-sm text-[var(--foreground)]">
                  {formatRub(item.requestedAmount)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="card-panel rounded-[2rem] px-6 py-6" data-testid="customer-return-detail">
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">{t("customer.returns.selectCase")}</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {selected.order.orderCode}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                    {labelForReturnType(selected.type, locale)}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {selected.shop.name} - {labelForReturnReason(selected.reason, locale)}
                  </p>
                </div>
                <span
                  className="rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  data-testid="customer-return-detail-status"
                  data-status={selected.status}
                >
                  {labelForReturnStatus(selected.status, locale)}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label={t("customer.returns.metrics.requested")}
                  value={formatRub(selected.requestedAmount)}
                />
                <Metric
                  label={t("customer.returns.metrics.approved")}
                  value={formatRub(selected.approvedAmount ?? "0")}
                />
                <Metric
                  label={t("customer.returns.metrics.feeAdjustment")}
                  value={formatRub(selected.platformFeeAdjustmentAmount)}
                />
                <Metric
                  label={t("customer.returns.metrics.refundState")}
                  value={selected.manualTransfers[0]?.status ?? t("customer.returns.notSent")}
                />
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t("customer.returns.buyerComment")}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {selected.buyerComment}
                </p>
                {selected.sellerComment ? (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">
                      {t("customer.returns.sellerResponse")}:
                    </span>{" "}
                    {selected.sellerComment}
                  </p>
                ) : null}
                {selected.adminDecision ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">
                      {t("customer.returns.adminReview")}:
                    </span>{" "}
                    {selected.adminDecision}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {t("customer.returns.messages")}
                  </h3>
                  <div className="space-y-3" data-testid="customer-return-thread">
                    {selected.messages.map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {entry.authorRole}
                            {entry.authorName ? ` - ${entry.authorName}` : ""}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {entry.message}
                        </p>
                      </article>
                    ))}
                  </div>
                  {!isReturnCaseClosed(selected.status) ? (
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                      <textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                        data-testid="customer-return-reply"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={saving || !reply.trim()}
                        className="mt-3 rounded-full bg-[#2f2025] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        data-testid="customer-return-send-message"
                      >
                        {saving ? t("customer.returns.submitting") : t("customer.returns.sendMessage")}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {t("customer.returns.evidenceAndRefund")}
                  </h3>
                  <div className="space-y-3">
                    {selected.evidence.map((entry) => (
                      <a
                        key={entry.id}
                        href={entry.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground)]"
                      >
                        {entry.label || entry.originalName || entry.fileType}
                      </a>
                    ))}
                    {!selected.evidence.length ? (
                      <p className="text-sm text-[var(--muted)]">{t("customer.returns.noEvidence")}</p>
                    ) : null}
                  </div>
                  {!isReturnCaseClosed(selected.status) ? (
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                      <input
                        value={evidenceLabel}
                        onChange={(event) => setEvidenceLabel(event.target.value)}
                        placeholder={t("customer.returns.evidenceLabel")}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                      />
                      <input
                        id="customer-return-upload-evidence"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                        className="sr-only"
                        data-testid="customer-return-upload-evidence"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label
                          htmlFor="customer-return-upload-evidence"
                          className="public-button-secondary inline-flex cursor-pointer px-4 py-2 text-sm"
                        >
                          {t("customer.returns.chooseFile")}
                        </label>
                        <span
                          className="text-sm text-[var(--muted)]"
                          data-testid="customer-return-upload-evidence-file-name"
                        >
                          {evidenceFile?.name || t("customer.returns.noFileSelected")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleUploadEvidence()}
                        disabled={saving || !evidenceFile}
                        className="mt-3 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        {saving ? t("customer.returns.uploading") : t("customer.returns.uploadEvidence")}
                      </button>
                    </div>
                  ) : null}
                  {selected.manualTransfers.length ? (
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {t("customer.returns.manualRefundTransfer")}
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {t("customer.returns.method")}: {selected.manualTransfers[0].method}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {t("customer.returns.amount")}: {formatRub(selected.manualTransfers[0].amount)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {t("customer.returns.status")}: {selected.manualTransfers[0].status}
                      </p>
                      {selected.manualTransfers[0].bankReference ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {t("customer.returns.reference")}: {selected.manualTransfers[0].bankReference}
                        </p>
                      ) : null}
                      {selected.manualTransfers[0].proofImageUrl ? (
                        <a
                          href={selected.manualTransfers[0].proofImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                        >
                          {t("customer.returns.openRefundProof")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    {canCustomerConfirmRefund(selected.status) ? (
                      <button
                        type="button"
                        onClick={() => void handleConfirmRefund()}
                        disabled={saving}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        data-testid="customer-confirm-refund-received"
                      >
                        {saving ? t("customer.returns.confirming") : t("customer.returns.confirmRefundReceived")}
                      </button>
                    ) : null}
                    {["OPENED", "WAITING_SELLER_RESPONSE", "WAITING_BUYER_EVIDENCE"].includes(selected.status) ? (
                      <button
                        type="button"
                        onClick={() => void handleCancelCase()}
                        disabled={saving}
                        className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving ? t("customer.returns.updating") : t("customer.returns.cancelCase")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </CustomerAccountShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
