"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
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
  const [loading, setLoading] = useState(Boolean(initialPhone));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    if (!phone.trim() || !file) {
      setError("Phone and payment proof file are required.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updated = await uploadPaymentProof(orderId, phone.trim(), file);
      setOrder(updated);
      setFile(null);
      setSuccessMessage("Payment proof uploaded. Seller can review it now.");
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
            <div className="rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/50 px-4 py-3 text-sm text-[var(--accent-strong)]">
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
                  <h1 className="mt-3 font-[family-name:var(--font-mono-app)] text-4xl font-bold text-[var(--foreground)]">
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
                      {order.paymentMethod ?? "Unknown"}
                    </Metric>
                    <Metric label="Total">{order.totalAmount}</Metric>
                  </div>
                  <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Payment instructions
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {order.paymentInstructions ??
                        "This shop did not provide manual payment instructions."}
                    </p>
                  </div>
                  <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5 md:grid-cols-2">
                    <TextMetric label="Customer" value={order.customer.name} />
                    <TextMetric label="Phone" value={order.customer.phone} />
                    <TextMetric
                      label="Email"
                      value={order.customer.email ?? "Not provided"}
                    />
                    <TextMetric
                      label="Address"
                      value={order.customer.address}
                    />
                  </div>
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
                      No payment proof uploaded yet.
                    </p>
                  )}

                  <div className="mt-6 grid gap-4">
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
                    </Field>
                    <button
                      type="button"
                      onClick={() => void handleUpload()}
                      disabled={uploading || !file}
                      className="public-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      data-testid="payment-proof-submit"
                    >
                      {uploading ? "Uploading..." : "Upload payment proof"}
                    </button>
                  </div>
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
                        {order.delivery.courierPhone ? (
                          <p
                            className="mt-3 text-sm text-[var(--muted)]"
                            data-testid="tracked-delivery-courier-phone"
                          >
                            Courier phone: {order.delivery.courierPhone}
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
                            Open delivery tracking
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
                      Delivery has not been created for this order yet.
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
