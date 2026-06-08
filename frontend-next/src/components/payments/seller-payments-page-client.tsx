"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/seller/section-card";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { confirmPayment, listPayments, rejectPayment, type SellerPaymentItem } from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/use-i18n";

function isImageProof(item: SellerPaymentItem) {
  return Boolean(item.paymentProof?.mimeType?.startsWith("image/"));
}

export function SellerPaymentsPageClient({
  initialProofStatus = "BUYER_MARKED_PAID",
  title,
  description,
}: {
  initialProofStatus?: string;
  title?: string;
  description?: string;
}) {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const shops = useSellerWorkspaceStore((state) => state.shops);
  const loadShops = useSellerWorkspaceStore((state) => state.loadShops);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [payments, setPayments] = useState<SellerPaymentItem[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [proofStatus, setProofStatus] = useState(initialProofStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SellerPaymentItem | null>(null);
  const { run: runAction, isRunning } = useActionFeedback();

  const proofTabs = useMemo(
    () => [
      { value: "BUYER_MARKED_PAID", label: t("seller.payments.tabs.pending") },
      { value: "SELLER_REJECTED", label: t("seller.payments.tabs.rejected") },
      { value: "SELLER_CONFIRMED", label: t("seller.payments.tabs.confirmed") },
    ],
    [t],
  );

  const pendingCount = useMemo(() => payments.filter((item) => item.paymentProofStatus === "BUYER_MARKED_PAID").length, [payments]);

  useEffect(() => {
    hydrateWorkspace();
  }, [hydrateWorkspace]);

  const load = useCallback(async () => {
    if (!user || !hydrated) {
      return;
    }

    setLoading(true);
    try {
      if (shops.length < 1) {
        await loadShops();
      }
      const shopId = useSellerWorkspaceStore.getState().currentShopId;
      if (!shopId) {
        setPayments([]);
        setTotalPages(1);
        setError(null);
        return;
      }
      const response = await listPayments(shopId, { page, size, search: search || undefined, proofStatus: proofStatus || undefined }, "");
      setPayments(response.items);
      setTotalPages(response.meta.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("seller.payments.updateFailed"));
    } finally {
      setLoading(false);
    }
  }, [hydrated, loadShops, page, proofStatus, search, shops.length, size, t, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const handleDecision = async (item: SellerPaymentItem, action: "confirm" | "reject") => {
    if (!currentShopId) {
      return;
    }
    if (action === "reject") {
      const confirmed = window.confirm(t("common.confirm.rejectPayment"));
      if (!confirmed) {
        return;
      }
    }

    await runAction({
      action: async () => {
        if (action === "confirm") {
          await confirmPayment(currentShopId, item.id, { note: "Seller confirmed payment proof from review queue." }, "");
        } else {
          await rejectPayment(currentShopId, item.id, { note: "Seller rejected payment proof from review queue." }, "");
        }
      },
      successMessage: action === "confirm" ? t("seller.payments.confirmedToast") : t("seller.payments.rejectedToast"),
      errorMessage: t("seller.payments.updateFailed"),
      onSuccess: async () => {
        if (preview?.id === item.id) {
          setPreview(null);
        }
        await load();
      },
    }).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <SectionCard eyebrow={t("seller.payments.title")} title={title ?? t("seller.payments.title")} description={description ?? t("seller.payments.subtitle")}>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(79,70,229,0.06),rgba(255,255,255,0.96))] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Seller queue
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Review buyer proof first, then move approved orders into fulfillment. The queue below stays operationally focused and does not change payment business rules.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/80 px-4 py-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Open reviews
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {proofTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setProofStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                proofStatus === tab.value
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--muted)]">
            {t("seller.payments.pendingOnPage", { count: pendingCount })}
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("seller.payments.searchPlaceholder")} className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" />
          <Button variant="outline" onClick={() => void load()}>
            {t("seller.payments.reloadQueue")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard eyebrow={t("seller.payments.title")} title={t("seller.payments.queueTitle")} description={t("seller.payments.queueSubtitle")}>
        {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}

        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-white">
          <div className="hidden grid-cols-[140px_1fr_1.2fr_120px_170px_120px_220px] gap-4 border-b border-[var(--border)] bg-[var(--panel-strong)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)] lg:grid">
            <div>{t("seller.payments.columns.order")}</div>
            <div>{t("seller.payments.columns.buyer")}</div>
            <div>{t("seller.payments.columns.products")}</div>
            <div>{t("seller.payments.columns.amount")}</div>
            <div>{t("seller.payments.columns.proofSent")}</div>
            <div>{t("seller.payments.columns.image")}</div>
            <div>{t("seller.payments.columns.actions")}</div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {loading ? (
              <div className="px-5 py-8 text-sm text-[var(--muted)]">{t("seller.payments.loading")}</div>
            ) : payments.length ? (
              payments.map((payment) => (
                <article key={payment.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[140px_1fr_1.2fr_120px_170px_120px_220px] lg:px-5" data-testid="seller-payment-review-row">
                  <div>
                    <Link href={`/seller/payments/${payment.id}`} className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)]">
                      {payment.orderNumber}
                    </Link>
                    <div className="mt-2">
                      <PaymentStatusBadge status={payment.paymentStatus} />
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    <p className="font-semibold text-[var(--foreground)]">{payment.customer.name}</p>
                    <p>{payment.customer.phone}</p>
                    <p>{payment.customer.email ?? t("sellerPayments.noEmail")}</p>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {payment.items.slice(0, 2).map((item) => (
                      <p key={item.id} className="rounded-xl bg-[var(--panel-strong)] px-3 py-2">
                        {item.productTitleSnapshot} x {item.quantity}
                      </p>
                    ))}
                    {payment.items.length > 2 ? <p>{t("sellerPayments.moreProducts", { count: payment.items.length - 2 })}</p> : null}
                  </div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">{payment.totalAmount}</div>
                  <div className="text-sm text-[var(--muted)]">
                    {payment.paymentProof?.uploadedAt ? new Date(payment.paymentProof.uploadedAt).toLocaleString() : t("common.status.none")}
                  </div>
                  <div>
                    {payment.paymentProof ? (
                      <button type="button" onClick={() => setPreview(payment)} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-1 transition hover:border-[var(--accent)]" data-testid="seller-payment-proof-preview">
                        {isImageProof(payment) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={payment.paymentProof.url} alt={payment.paymentProof.originalName ?? payment.orderNumber} className="h-16 w-16 rounded-xl object-cover" />
                        ) : (
                          <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white text-xs font-semibold text-[var(--foreground)]">PDF</span>
                        )}
                      </button>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">{t("common.status.none")}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="success" size="sm" onClick={() => void handleDecision(payment, "confirm")} disabled={isRunning || payment.paymentProofStatus !== "BUYER_MARKED_PAID"} loading={isRunning}>
                      {t("common.actions.confirm")}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void handleDecision(payment, "reject")} disabled={isRunning || payment.paymentProofStatus !== "BUYER_MARKED_PAID"} loading={isRunning}>
                      {t("common.actions.reject")}
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-5 py-8">
                <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--panel-strong)] px-5 py-8 text-sm text-[var(--muted)]">
                  {t("seller.payments.empty")}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">{t("common.pageOf", { page, total: totalPages })}</p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              {t("common.actions.back")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
              {t("common.actions.next")}
            </Button>
          </div>
        </div>
      </SectionCard>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t("seller.payments.proofPreview")}</p>
                <h3 className="mt-2 text-xl font-bold text-[var(--foreground)]">{preview.orderNumber}</h3>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                {t("common.actions.close")}
              </Button>
            </div>
            <div className="mt-6">
              {isImageProof(preview) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.paymentProof!.url} alt={preview.paymentProof?.originalName ?? preview.orderNumber} className="max-h-[70vh] w-full rounded-[1.5rem] object-contain" />
              ) : (
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">{t("seller.payments.notImageProof")}</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={preview.paymentProof?.url} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                {t("seller.payments.openOriginal")}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
