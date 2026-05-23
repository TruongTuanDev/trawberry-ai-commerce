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
  uploadPaymentProof,
  type PublicTrackedOrder,
} from "@/lib/public-api";

export function OrderTrackDetailPageClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? "";
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [buyerNote, setBuyerNote] = useState("");
  const [loading, setLoading] = useState(Boolean(initialPhone));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isPayOnDeliverySellerQr =
    order?.paymentMethod === "PAY_ON_DELIVERY_SELLER_QR";

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
      setError("Phone is required.");
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
      setError("Phone and payment proof file are required.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await uploadPaymentProof(
        orderId,
        phone.trim(),
        file,
        buyerNote,
      );
      setOrder(updated);
      setFile(null);
      setBuyerNote("");
      setSuccessMessage(
        isPayOnDeliverySellerQr
          ? "Marked as paid after delivery. Seller can review it now."
          : "Payment proof uploaded. Seller can review it now.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to upload payment proof.",
      );
    } finally {
      setUploading(false);
    }
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
              Back to tracking
            </Link>
            <Link
              href="/products"
              className="public-button-secondary inline-flex px-4 py-2 text-sm"
            >
              Marketplace
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
              Order lookup
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Order id">
                <input
                  value={orderId}
                  disabled
                  className="public-input bg-[var(--panel)] text-[var(--muted)]"
                />
              </Field>
              <Field label="Phone">
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
                  {loading ? "Loading..." : "Load order"}
                </button>
              </div>
            </div>
          </section>

          {order ? (
            <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
              <section className="space-y-6">
                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Order snapshot
                  </p>
                  <h1 className="text-gradient-primary mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold">
                    {order.orderCode}
                  </h1>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Metric label="Order status">
                      <div data-testid="tracked-order-status">
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </Metric>
                    <Metric label="Payment status">
                      <PaymentStatusBadge
                        status={order.paymentStatus}
                        testId="tracked-payment-status"
                      />
                    </Metric>
                    <Metric label="Payment method">
                      {order.paymentMethodLabel ??
                        order.paymentMethod ??
                        "Unknown"}
                    </Metric>
                    <Metric label="Total">{order.totalAmount}</Metric>
                  </div>
                  <PaymentDetailsPanel
                    details={order.paymentDetails}
                    title={
                      isPayOnDeliverySellerQr
                        ? "Seller QR / SBP payment after delivery"
                        : "Direct seller payment"
                    }
                    className="mt-6"
                  />
                  {isPayOnDeliverySellerQr ? (
                    <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4 text-sm leading-6 text-[var(--foreground)]">
                      {order.delivery?.status === "DELIVERED"
                        ? "Vui lòng thanh toán cho người bán bằng QR/SBP nếu chưa thanh toán."
                        : "Bạn sẽ thanh toán cho người bán khi nhận hàng."}
                    </div>
                  ) : null}
                  <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
                    <TextMetric label="Customer" value={order.customer.name} />
                    <TextMetric label="Phone" value={order.customer.phone} />
                    <TextMetric
                      label="Email"
                      value={order.customer.email ?? "Not provided"}
                    />
                    <TextMetric
                      label="Address"
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
                      Customer note: {order.customerNote}
                    </p>
                  ) : null}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8 sm:px-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Items
                  </p>
                  <div className="mt-4 space-y-4">
                    {order.items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[1.5rem] border border-[var(--border)] bg-white p-4"
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
                              Quantity: {item.quantity}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              Unit price:{" "}
                              {item.unitPrice ?? item.priceAtPurchase}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              Line total: {item.lineTotal}
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
                    Payment proof
                  </p>
                  {order.paymentProof ? (
                    <div className="mt-4 space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {order.paymentProof.originalName ?? "Uploaded proof"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Uploaded at:{" "}
                        {order.paymentProof.uploadedAt
                          ? new Date(
                              order.paymentProof.uploadedAt,
                            ).toLocaleString()
                          : "Unknown"}
                      </p>
                      <a
                        href={order.paymentProof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="public-button-secondary inline-flex px-4 py-2 text-sm"
                        data-testid="tracked-payment-proof-link"
                      >
                        Open proof
                      </a>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {isPayOnDeliverySellerQr
                        ? "No delivery payment mark submitted yet."
                        : "No payment proof uploaded yet."}
                    </p>
                  )}

                  <div className="mt-6 grid gap-4">
                    <Field label="Buyer note">
                      <textarea
                        value={buyerNote}
                        onChange={(event) => setBuyerNote(event.target.value)}
                        rows={3}
                        className="public-input min-h-24"
                        placeholder="Optional bank transfer reference or note for the seller"
                      />
                    </Field>
                    <Field label="Upload proof">
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
                          Bill upload is optional for payment-on-delivery via
                          seller QR.
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
                        ? "Submitting..."
                        : isPayOnDeliverySellerQr
                          ? "Tôi đã thanh toán khi nhận"
                          : "I transferred the money"}
                    </button>
                  </div>
                  {order.buyerPaymentNote ? (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      Latest buyer note: {order.buyerPaymentNote}
                    </p>
                  ) : null}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Delivery
                  </p>
                  {order.delivery ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Metric label="Provider">
                          <p
                            className="text-sm font-semibold text-[var(--foreground)]"
                            data-testid="tracked-delivery-provider"
                          >
                            {order.delivery.provider}
                          </p>
                        </Metric>
                        <Metric label="Status">
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
                            ? "Delivery issue"
                            : order.delivery.status === "CANCELLED"
                              ? "Delivery cancelled"
                              : "Claim reference"}
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
                              Please contact support if you need help with the
                              next delivery step.
                            </p>
                          </div>
                        ) : null}
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          {order.delivery.providerShipmentId ??
                            "Awaiting provider shipment id."}
                        </p>
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          Tracking number:{" "}
                          {order.delivery.trackingNumber ?? "Not assigned yet."}
                        </p>
                        {order.delivery.manualYandexOrderId ? (
                          <p
                            className="mt-3 text-sm font-semibold text-[var(--foreground)]"
                            data-testid="tracked-yandex-order-id"
                          >
                            Mã vận đơn Yandex: {order.delivery.manualYandexOrderId}
                          </p>
                        ) : (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-yandex-order-id-pending"
                          >
                            Shop đang tạo đơn giao hàng Yandex.
                          </p>
                        )}
                        {order.delivery.courierPhone ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-courier-phone"
                          >
                            Courier phone: {order.delivery.courierPhone}
                          </p>
                        ) : null}
                        {order.delivery.courierName ? (
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            Courier: {order.delivery.courierName}
                          </p>
                        ) : null}
                        {order.delivery.estimatedDeliveryAt ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-eta"
                          >
                            ETA:{" "}
                            {new Date(
                              order.delivery.estimatedDeliveryAt,
                            ).toLocaleString()}
                          </p>
                        ) : null}
                        {order.delivery.deliveryNote ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-note"
                          >
                            {order.delivery.deliveryNote}
                          </p>
                        ) : null}
                        <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            Timeline
                          </p>
                          <ol className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
                            {[
                              "Payment confirmed",
                              order.delivery.status === "YANDEX_MANUAL_CREATED" || order.delivery.status === "COURIER_ASSIGNED" || order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? "Yandex order created" : null,
                              order.delivery.status === "COURIER_ASSIGNED" || order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? "Courier assigned" : null,
                              order.delivery.status === "PICKED_UP" || order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? "Package picked up" : null,
                              order.delivery.status === "ON_THE_WAY" || order.delivery.status === "DELIVERED" ? "On the way" : null,
                              order.delivery.status === "DELIVERED" ? "Delivered" : null,
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
                              ? "Theo dõi Yandex"
                              : "Open delivery tracking"}
                          </a>
                        ) : (
                          <p className="mt-3 text-sm text-[var(--muted)]">
                            Tracking link will appear after the seller accepts
                            the delivery claim.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      {order.status === "READY_TO_CREATE_YANDEX"
                        ? "Shop đang tạo đơn giao hàng Yandex."
                        : "Delivery has not been created for this order yet."}
                    </p>
                  )}
                </section>

                <section className="card-panel rounded-[2rem] px-6 py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Payment log
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
                          <p className="mt-2 text-sm text-[var(--foreground)]">
                            {log.note ?? "No note attached."}
                          </p>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No payment activity recorded yet.
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
