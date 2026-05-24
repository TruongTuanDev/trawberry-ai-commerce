"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentDetailsPanel } from "@/components/payments/payment-details-panel";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";
import {
  addPaymentNote,
  confirmPayment,
  getPaymentDetail,
  getSellerPaymentDetail,
  rejectPayment,
  type SellerPaymentItem,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

export function SellerPaymentDetailPageClient({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);
  const [payment, setPayment] = useState<SellerPaymentItem | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    hydrateWorkspace();
  }, [hydrateWorkspace]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !hydrated) {
        return;
      }

      try {
        if (shops.length < 1) {
          await loadShops();
        }

        let result: SellerPaymentItem;
        const shopId = useSellerWorkspaceStore.getState().currentShopId;
        if (shopId) {
          try {
            result = await getPaymentDetail(shopId, orderId, "");
          } catch {
            result = await getSellerPaymentDetail(orderId, "");
          }
        } else {
          result = await getSellerPaymentDetail(orderId, "");
        }
        if (!mounted) {
          return;
        }
        setPayment(result);
        if (result.shopId && result.shopId !== useSellerWorkspaceStore.getState().currentShopId) {
          selectShop(result.shopId);
        }
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : t("seller.paymentDetail.errorDescription"),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [currentShopId, hydrated, loadShops, orderId, selectShop, shops.length, t, user]);

  const performAction = async (action: "markPaid" | "reject" | "note") => {
    const activeShopId = payment?.shopId ?? currentShopId;
    if (!activeShopId || !payment) {
      return;
    }

    if (action !== "note") {
      const confirmed = window.confirm(
        action === "markPaid"
          ? t("common.confirm.markPaid")
          : t("common.confirm.rejectThisPayment"),
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let updated: SellerPaymentItem;
      if (action === "markPaid") {
        updated = await confirmPayment(
          activeShopId,
          payment.id,
          note.trim() ? { note: note.trim() } : undefined,
          "",
        );
        setSuccessMessage(t("seller.paymentDetail.paymentConfirmed"));
      } else if (action === "reject") {
        updated = await rejectPayment(
          activeShopId,
          payment.id,
          note.trim() ? { note: note.trim() } : undefined,
          "",
        );
        setSuccessMessage(t("seller.paymentDetail.paymentRejected"));
      } else {
        updated = await addPaymentNote(
          activeShopId,
          payment.id,
          { note: note.trim() },
          "",
        );
        setSuccessMessage(t("seller.paymentDetail.paymentNoteAdded"));
      }

      setPayment(updated);
      if (action === "note") {
        setNote("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("seller.paymentDetail.paymentActionFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionCard
        eyebrow={t("seller.paymentDetail.eyebrow")}
        title={t("seller.paymentDetail.loadingTitle")}
        description={t("seller.paymentDetail.loadingDescription")}
      >
        <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
      </SectionCard>
    );
  }

  if (error || !payment) {
    return (
      <SectionCard
        eyebrow={t("seller.paymentDetail.eyebrow")}
        title={t("seller.paymentDetail.errorTitle")}
        description={t("seller.paymentDetail.errorDescription")}
      >
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? t("seller.paymentDetail.notFound")}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/seller/payments")}
        >
          {t("seller.paymentDetail.backToPayments")}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/seller/orders/${payment.id}`)}
        >
          {t("seller.paymentDetail.openOrder")}
        </Button>
      </div>

      <div
        className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]"
        data-testid="seller-payment-detail-page"
      >
        <SectionCard
          eyebrow={t("seller.paymentDetail.payment")}
          title={payment.orderNumber}
          description={t("seller.paymentDetail.description")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label={t("seller.paymentDetail.customer")} value={payment.customer.name} />
            <Metric label={t("seller.paymentDetail.phone")} value={payment.customer.phone} />
            <Metric
              label={t("seller.paymentDetail.paymentMethod")}
              value={payment.paymentMethod ?? t("common.unknown")}
            />
            <Metric
              label={t("seller.paymentDetail.proofStatus")}
              value={payment.paymentProofStatus}
            />
            <Metric label={t("seller.paymentDetail.total")} value={payment.totalAmount} />
            <Metric
              label={t("seller.paymentDetail.created")}
              value={new Date(payment.createdAt).toLocaleString()}
            />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("seller.paymentDetail.paymentStatus")}
              </p>
              <div className="mt-3">
                <PaymentStatusBadge
                  status={payment.paymentStatus}
                  testId="seller-payment-status"
                />
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("seller.paymentDetail.orderStatus")}
              </p>
              <div className="mt-3">
                <OrderStatusBadge status={payment.status} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <PaymentDetailsPanel
              details={payment.paymentDetails}
              title={t("seller.paymentDetail.sellerDetails")}
            />
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t("seller.paymentDetail.shippingAddress")}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {payment.shippingAddress}
              </p>
            </div>
            {payment.customerNote ? (
              <p className="text-sm text-[var(--muted)]">
                {t("seller.paymentDetail.customerNote", {
                  value: payment.customerNote,
                })}
              </p>
            ) : null}
            {payment.buyerPaymentNote ? (
              <p className="text-sm text-[var(--muted)]">
                {t("seller.paymentDetail.buyerPaymentNote", {
                  value: payment.buyerPaymentNote,
                })}
              </p>
            ) : null}
            {payment.paymentProof ? (
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t("seller.paymentDetail.paymentProof")}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {payment.paymentProof.originalName ??
                    t("seller.paymentDetail.uploadedProof")}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t("seller.paymentDetail.uploadedAt", {
                    value: payment.paymentProof.uploadedAt
                      ? new Date(payment.paymentProof.uploadedAt).toLocaleString()
                      : t("common.unknown"),
                  })}
                </p>
                <a
                  href={payment.paymentProof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
                  data-testid="seller-payment-proof-link"
                >
                  {t("seller.paymentDetail.openProof")}
                </a>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow={t("seller.paymentDetail.reviewActions")}
          title={t("seller.paymentDetail.reviewTitle")}
          description={t("seller.paymentDetail.reviewDescription")}
        >
          <div className="space-y-4">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={5}
              placeholder={t("seller.paymentDetail.optionalReviewNote")}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => void performAction("note")}
                disabled={saving || !note.trim()}
                loading={saving}
              >
                {t("seller.paymentDetail.addNote")}
              </Button>
              <Button
                variant="success"
                onClick={() => void performAction("markPaid")}
                disabled={saving}
                loading={saving}
                data-testid="seller-mark-paid-button"
              >
                {t("seller.paymentDetail.confirmPaymentReceived")}
              </Button>
              <Button
                variant="danger"
                onClick={() => void performAction("reject")}
                disabled={saving}
                loading={saving}
              >
                {t("seller.paymentDetail.rejectProof")}
              </Button>
            </div>
            {error ? (
              <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {error}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow={t("seller.paymentDetail.itemsEyebrow")}
        title={t("seller.paymentDetail.itemsTitle")}
        description={t("seller.paymentDetail.itemsDescription")}
      >
        <div className="grid gap-4">
          {payment.items.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[80px_1fr_160px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  item.productImageSnapshot ??
                  "https://placehold.co/160x160?text=No+Image"
                }
                alt={item.productTitleSnapshot}
                className="h-20 w-20 rounded-2xl object-cover"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {item.productTitleSnapshot}
                </p>
                {item.variantNameSnapshot ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {t("seller.paymentDetail.variant", {
                      value: item.variantNameSnapshot,
                    })}
                  </p>
                ) : null}
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>{t("seller.paymentDetail.qty", { value: item.quantity })}</p>
                <p className="mt-1">
                  {t("seller.paymentDetail.unit", {
                    value: item.unitPrice ?? item.priceAtPurchase,
                  })}
                </p>
                <p className="mt-1">
                  {t("seller.paymentDetail.line", { value: item.lineTotal })}
                </p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow={t("seller.paymentDetail.auditEyebrow")}
        title={t("seller.paymentDetail.auditTitle")}
        description={t("seller.paymentDetail.auditDescription")}
      >
        <div className="space-y-4">
          {payment.reviewLogs.length ? (
            payment.reviewLogs.map((log) => (
              <article
                key={log.id}
                className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                      {log.action}
                    </span>
                    <p className="text-sm text-[var(--muted)]">
                      {t("seller.paymentDetail.transition", {
                        from: log.fromStatus ?? "N/A",
                        to: log.toStatus ?? "",
                      }).trim()}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-3 text-sm text-[var(--foreground)]">
                  {log.note ?? t("seller.paymentDetail.noNote")}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t("seller.paymentDetail.reviewer", {
                    value: log.reviewerName ?? log.reviewerUserId,
                  })}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {t("seller.paymentDetail.noLog")}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
