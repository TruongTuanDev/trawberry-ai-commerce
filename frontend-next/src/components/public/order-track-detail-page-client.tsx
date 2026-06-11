"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentDetailsPanel } from "@/components/payments/payment-details-panel";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { PublicShell } from "@/components/public/public-shell";
import {
  trackOrderById,
  type CheckoutPaymentMethod,
  uploadPaymentProof,
  type PublicTrackedOrder,
} from "@/lib/public-api";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useI18n } from "@/i18n/use-i18n";

const paymentMethodTranslationKeys: Partial<
  Record<CheckoutPaymentMethod, string>
> = {
  PREPAID_SELLER_QR: "checkout.prepaidSellerQrLabel",
  PAY_ON_DELIVERY_SELLER_QR: "checkout.podSellerQrLabel",
  DEPOSIT_THEN_DELIVERY_PAYMENT: "checkout.depositLabel",
};

export function OrderTrackDetailPageClient({ orderId }: { orderId: string }) {
  const { t } = useI18n("customer");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? "";
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [buyerNote, setBuyerNote] = useState("");
  const [loading, setLoading] = useState(Boolean(initialPhone));
  const { run: runUpload, isRunning: uploading } = useActionFeedback();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const formatPaymentMethodLabel = (
    method: string | null | undefined,
    fallbackLabel: string | null | undefined,
  ) => {
    if (method && method in paymentMethodTranslationKeys) {
      return t(
        paymentMethodTranslationKeys[method as CheckoutPaymentMethod] as string,
      );
    }

    return fallbackLabel ?? method ?? t("common.unknown");
  };
  const isPayOnDeliverySellerQr =
    order?.paymentMethod === "PAY_ON_DELIVERY_SELLER_QR";
  const fulfillmentStatus = order ? getBuyerFulfillmentStatus(order, t) : null;

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!initialPhone.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const tracked = await trackOrderById(orderId, initialPhone.trim());
        if (!mounted) return;
        setOrder(tracked);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load order.",
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
  }, [initialPhone, orderId]);

  const handleLookup = async () => {
    if (!phone.trim()) {
      setError(t("errors.validation"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const tracked = await trackOrderById(orderId, phone.trim());
      setOrder(tracked);
      router.replace(
        `/orders/${orderId}?phone=${encodeURIComponent(phone.trim())}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!phone.trim() || (!file && !isPayOnDeliverySellerQr)) {
      setError(t("errors.validation"));
      return;
    }

    setError(null);
    setSuccessMessage(null);

    await runUpload({
      action: async () => {
        const updated = await uploadPaymentProof(
          orderId,
          phone.trim(),
          file,
          buyerNote,
        );
        setOrder(updated);
        setFile(null);
        setBuyerNote("");
        const msg = isPayOnDeliverySellerQr
          ? t("orderTrack.confirmSuccess")
          : t("orderTrack.uploadSuccess");
        setSuccessMessage(msg);
        router.refresh();
        return updated;
      },
      successMessage: isPayOnDeliverySellerQr
        ? t("orderTrack.confirmSuccess")
        : t("orderTrack.uploadSuccess"),
      errorMessage: isPayOnDeliverySellerQr
        ? t("orderTrack.confirmFailed")
        : t("orderTrack.uploadFailed"),
    }).catch((err) => {
      setError(err.message);
    });
  };

  return (
    <PublicShell>
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/orders/track"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("orderTrack.backToTracking")}
            </Link>
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              {t("orderTrack.marketplace")}
            </Link>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
              {error}
            </div>
          ) : null}
          {successMessage ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <section
            className="card-panel rounded-[2rem] px-6 py-6 sm:px-8"
            data-testid="tracked-order-page"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("orderTrack.lookup")}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label={t("orderTrack.orderId")}>
                <input
                  value={orderId}
                  disabled
                  className="public-input bg-[var(--panel)] text-[var(--muted)]"
                />
              </Field>
              <Field label={t("orderTrack.phone")}>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="public-input"
                  data-testid="track-detail-phone"
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={loading}
                  className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="track-detail-load-order"
                >
                  {loading ? t("orderTrack.tracking") : t("orderTrack.loadOrder")}
                </button>
              </div>
            </div>
          </section>

          {order ? (
            <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
              <section className="space-y-6">
                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("orderTrack.snapshot")}
                  </p>
                  <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold">
                    {order.orderCode}
                  </h1>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Metric label={t("orderTrack.orderStatus")}>
                      <div data-testid="tracked-order-status">
                        <OrderStatusBadge
                          status={fulfillmentStatus?.code ?? order.status}
                          displayText={fulfillmentStatus?.code ?? order.status}
                        />
                      </div>
                      {fulfillmentStatus ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {fulfillmentStatus.label}
                        </p>
                      ) : null}
                    </Metric>
                    <Metric label={t("orderTrack.paymentStatus")}>
                      <>
                        <PaymentStatusBadge
                          status={order.paymentStatus}
                          testId="tracked-payment-status"
                          displayText={order.paymentStatus}
                        />
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {formatPaymentStatusLabel(order.paymentStatus, t)}
                        </p>
                      </>
                    </Metric>
                    <Metric label={t("orderTrack.paymentConfirmed")}>
                      {isPaymentConfirmed(order.paymentStatus)
                        ? t("common.yes")
                        : t("orderTrack.pendingReview")}
                    </Metric>
                    <Metric label={t("orderTrack.paymentMethod")}>
                      {formatPaymentMethodLabel(
                        order.paymentMethod,
                        order.paymentMethodLabel,
                      )}
                    </Metric>
                    <Metric label={t("seller.paymentDetail.total")}>{order.totalAmount}</Metric>
                  </div>
                  <PaymentDetailsPanel
                    details={order.paymentDetails}
                    title={
                      isPayOnDeliverySellerQr
                        ? t("orderTrack.sellerQrAfterDelivery")
                        : t("orderTrack.directSellerPayment")
                    }
                    className="mt-6"
                    role="customer"
                  />
                  {isPayOnDeliverySellerQr ? (
                    <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
                      {order.delivery?.status === "DELIVERED"
                        ? t("orderTrack.payIfPending")
                        : t("orderTrack.payAfterDelivery")}
                    </div>
                  ) : null}
                  <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
                    <TextMetric label={t("seller.paymentDetail.customer")} value={order.customer.name} />
                    <TextMetric label={t("seller.paymentDetail.phone")} value={order.customer.phone} />
                    <TextMetric
                      label={t("checkout.email")}
                      value={order.customer.email ?? t("common.notProvided")}
                    />
                    <TextMetric
                      label={t("checkout.address")}
                      value={order.customer.addressFullName ?? order.customer.address}
                    />
                  </div>
                  {order.customer.entrance ||
                  order.customer.noEntrance ||
                  order.customer.intercom ||
                  order.customer.floor ||
                  order.customer.noFloor ||
                  order.customer.apartment ||
                  order.customer.noApartment ||
                  order.customer.deliveryComment ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {[
                        order.customer.entrance
                          ? `Entrance ${order.customer.entrance}`
                          : order.customer.noEntrance
                            ? "No private entrance"
                          : null,
                        order.customer.intercom
                          ? `Intercom ${order.customer.intercom}`
                          : null,
                        order.customer.floor
                          ? `Floor ${order.customer.floor}`
                          : order.customer.noFloor
                            ? "Floor unknown"
                          : null,
                        order.customer.apartment
                          ? `Apartment ${order.customer.apartment}`
                          : order.customer.noApartment
                            ? "No apartment"
                          : null,
                        order.customer.deliveryComment ?? null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                  {order.customerNote ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {t("checkout.note")}: {order.customerNote}
                    </p>
                  ) : null}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("seller.paymentDetail.itemsEyebrow")}
                  </p>
                  <div className="mt-4 space-y-4">
                    {order.items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
                        data-testid="tracked-order-item"
                      >
                        <div className="flex gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              item.productImageSnapshot ??
                              "https://placehold.co/160x160?text=No+Image"
                            }
                            alt={item.productTitleSnapshot}
                            className="h-20 w-20 rounded-2xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {item.productTitleSnapshot}
                            </p>
                            {item.variantNameSnapshot ? (
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                {item.variantNameSnapshot}
                              </p>
                            ) : null}
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {t("seller.paymentDetail.qty", { value: item.quantity })}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {t("seller.paymentDetail.unit", { value: item.unitPrice ?? item.priceAtPurchase })}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {t("seller.paymentDetail.line", { value: item.lineTotal })}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </section>

              <section className="space-y-6">
                <section className="card-panel rounded-[2rem] px-6 py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("seller.paymentDetail.paymentProof")}
                  </p>
                  {order.paymentProof ? (
                    <div className="mt-4 space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {order.paymentProof.originalName ?? t("seller.paymentDetail.uploadedProof")}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {t("seller.paymentDetail.uploadedAt", {
                          value: order.paymentProof.uploadedAt
                            ? new Date(order.paymentProof.uploadedAt).toLocaleString()
                            : t("common.unknown")
                        })}
                      </p>
                      <a
                        href={order.paymentProof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="public-button-secondary inline-flex px-4 py-2 text-sm"
                        data-testid="tracked-payment-proof-link"
                      >
                        {t("seller.paymentDetail.openProof")}
                      </a>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {isPayOnDeliverySellerQr
                        ? t("orderTrack.noPodMark")
                        : t("orderTrack.noProof")}
                    </p>
                  )}

                  <div className="mt-6 grid gap-4">
                    <Field label={t("orderTrack.buyerNote")}>
                      <textarea
                        value={buyerNote}
                        onChange={(event) => setBuyerNote(event.target.value)}
                        rows={3}
                        className="public-input min-h-24"
                        placeholder={t("orderTrack.buyerNotePlaceholder")}
                      />
                    </Field>
                    <Field label={t("orderTrack.uploadProof")}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(event) =>
                          setFile(event.target.files?.[0] ?? null)
                        }
                        className="public-input"
                        data-testid="payment-proof-input"
                      />
                      {isPayOnDeliverySellerQr ? (
                        <p className="text-xs leading-6 text-[var(--muted)]">
                          {t("orderTrack.podUploadNote")}
                        </p>
                      ) : null}
                    </Field>
                    <button
                      type="button"
                      onClick={() => void handleUpload()}
                      disabled={uploading || (!file && !isPayOnDeliverySellerQr)}
                      className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid="payment-proof-submit"
                    >
                      {uploading
                        ? (isPayOnDeliverySellerQr ? t("orderTrack.confirming") : t("orderTrack.uploading"))
                        : isPayOnDeliverySellerQr
                          ? t("orderTrack.confirmPaidOnDelivery")
                          : t("orderTrack.transferredMoney")}
                    </button>
                  </div>
                  {order.buyerPaymentNote ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {t("seller.paymentDetail.buyerPaymentNote", { value: order.buyerPaymentNote })}
                    </p>
                  ) : null}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("sellerOrders.delivery")}
                  </p>
                  {order.delivery ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Metric label={t("orderTrack.provider")}>
                          <p
                            className="text-sm font-semibold text-[var(--foreground)]"
                            data-testid="tracked-delivery-provider"
                          >
                            {order.delivery.provider}
                          </p>
                        </Metric>
                        <Metric label={t("common.status.ready")}>
                          <p
                            className="text-sm font-semibold text-[var(--foreground)]"
                            data-testid="tracked-delivery-status"
                          >
                            {order.delivery.status}
                          </p>
                          <p
                            className="mt-1 text-xs text-[var(--muted)]"
                            data-testid="tracked-delivery-status-label"
                          >
                            {order.delivery.statusLabel}
                          </p>
                        </Metric>
                      </div>
                      <div className="rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {order.delivery.status === "FAILED"
                            ? t("orderTrack.deliveryIssue")
                            : order.delivery.status === "CANCELLED"
                              ? t("orderTrack.deliveryCancelled")
                              : t("orderTrack.claimReference")}
                        </p>
                        <p
                          className="mt-2 text-sm text-[var(--foreground)]"
                          data-testid="tracked-delivery-message"
                        >
                          {order.delivery.customerVisibleMessage ??
                            order.delivery.statusMessage}
                        </p>
                        {order.delivery.status === "FAILED" ||
                        order.delivery.status === "CANCELLED" ? (
                          <div
                            className="mt-3 rounded-[1rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                            data-testid="tracked-delivery-exception"
                          >
                            {order.delivery.failureReasonCode ? (
                              <p className="font-semibold">
                                {order.delivery.failureReasonCode}
                              </p>
                            ) : null}
                            <p className="mt-1">
                              {t("orderTrack.deliverySupportNote")}
                            </p>
                          </div>
                        ) : null}
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {t("orderTrack.trackingNumber", {
                            value: order.delivery.trackingNumber ?? t("orderTrack.trackingNumberNotAssigned")
                          })}
                        </p>
                        {order.delivery.manualYandexOrderId ? (
                          <p
                            className="mt-3 text-sm font-semibold text-[var(--foreground)]"
                            data-testid="tracked-yandex-order-id"
                          >
                            {t("orderTrack.yandexWaybill", { id: order.delivery.manualYandexOrderId })}
                          </p>
                        ) : (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-yandex-order-id-pending"
                          >
                            {t("orderTrack.yandexCreating")}
                          </p>
                        )}
                        {order.delivery.courierPhone ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-courier-phone"
                          >
                            {t("orderTrack.courierPhone")}: {order.delivery.courierPhone}
                          </p>
                        ) : null}
                        {order.delivery.courierName ? (
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            {t("orderTrack.courier")}: {order.delivery.courierName}
                          </p>
                        ) : null}
                        {order.delivery.estimatedDeliveryAt ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-eta"
                          >
                            {t("orderTrack.deliveryEta", {
                              value: new Date(order.delivery.estimatedDeliveryAt).toLocaleString()
                            })}
                          </p>
                        ) : null}
                        <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            {t("orderTrack.timelineLabel")}
                          </p>
                          <ol className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
                            {[
                              t("orderTrack.paymentConfirmed"),
                              order.delivery.status === "YANDEX_MANUAL_CREATED" || order.delivery.status === "COURIER_ASSIGNED" || order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? t("orderTrack.timeline.yandexCreated") : null,
                              order.delivery.status === "COURIER_ASSIGNED" || order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? t("orderTrack.timeline.courierAssigned") : null,
                              order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? t("orderTrack.timeline.pickedUp") : null,
                              order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? t("orderTrack.timeline.onTheWay") : null,
                              order.delivery.status === "DELIVERED" ? t("orderTrack.timeline.delivered") : null,
                            ].filter(Boolean).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ol>
                        </div>
                        {order.delivery.deliveryComments.length ? (
                          <div
                            className="mt-4 space-y-3"
                            data-testid="tracked-delivery-comments"
                          >
                            {order.delivery.deliveryComments.map((comment) => (
                              <article
                                key={comment.id}
                                className="rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--foreground)]"
                              >
                                {comment.message}
                              </article>
                            ))}
                          </div>
                        ) : null}
                        {order.delivery.trackingUrl ? (
                          <a
                            href={order.delivery.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="public-button-secondary mt-4 inline-flex px-4 py-2 text-sm"
                            data-testid="tracked-delivery-link"
                          >
                            {order.delivery.manualYandexOrderId
                              ? t("orderTrack.yandexTracking")
                              : t("sellerOrders.trackYandex")}
                          </a>
                        ) : (
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            {t("orderTrack.trackingLinkAwaiting")}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {order.status === "READY_TO_CREATE_YANDEX"
                        ? t("orderTrack.yandexCreating")
                        : t("orderTrack.noProof")}
                    </p>
                  )}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    {t("orderTrack.paymentLog")}
                  </p>
                  <div className="mt-4 space-y-4">
                    {order.paymentLogs.length ? (
                      order.paymentLogs.map((log) => (
                        <article
                          key={log.id}
                          className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                              {log.action}
                            </span>
                            <p className="text-xs text-[var(--muted)]">
                              {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            {log.fromStatus ?? "N/A"}{" "}
                            {log.toStatus ? `-> ${log.toStatus}` : ""}
                          </p>
                          {log.note ? (
                            <p className="mt-2 text-sm text-[var(--foreground)]">
                              {log.note}
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        {t("orderTrack.noPaymentActivity")}
                      </p>
                    )}
                  </div>
                </section>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </PublicShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function TextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold break-words text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function isPaymentConfirmed(paymentStatus: string) {
  return [
    "PAID",
    "APPROVED",
    "SELLER_CONFIRMED_DELIVERY_PAYMENT",
    "YANDEX_PAYMENT_ON_DELIVERY_PAID",
  ].includes(paymentStatus);
}

function formatPaymentStatusLabel(
  paymentStatus: string,
  t: (key: string) => string,
) {
  switch (paymentStatus) {
    case "PENDING":
      return t("common.status.payment.PENDING");
    case "UNPAID":
      return t("common.status.payment.UNPAID");
    case "PAID":
      return t("common.status.payment.PAID");
    case "APPROVED":
      return t("common.status.payment.APPROVED");
    case "REJECTED":
      return t("common.status.payment.REJECTED");
    case "FAILED":
      return t("common.status.payment.FAILED");
    case "CANCELLED":
      return t("common.status.payment.CANCELLED");
    default:
      return paymentStatus;
  }
}

function getBuyerFulfillmentStatus(order: PublicTrackedOrder, t: (key: string) => string) {
  if (order.delivery?.status === "FAILED" || order.status === "CANCELLED") {
    return { code: "CANCELLED", label: t("orderTrack.status.cancelled") };
  }
  if (order.delivery?.status === "DELIVERED" || order.status === "DELIVERED") {
    return { code: "DELIVERED", label: t("orderTrack.status.completed") };
  }
  if (
    ["COURIER_ASSIGNED", "PICKED_UP", "ON_THE_WAY", "IN_TRANSIT", "SHIPPING"].includes(
      order.delivery?.status ?? order.status,
    )
  ) {
    return { code: "SHIPPING", label: t("orderTrack.status.shipping") };
  }
  if (
    ["READY_TO_CREATE_YANDEX", "YANDEX_MANUAL_CREATED", "CREATED_MANUALLY", "CREATED", "ASSEMBLING"].includes(
      order.delivery?.status ?? order.status,
    )
  ) {
    return { code: "ASSEMBLING", label: t("orderTrack.status.assembling") };
  }
  return { code: "NEW", label: t("orderTrack.status.new") };
}
