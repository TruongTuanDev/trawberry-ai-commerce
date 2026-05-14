"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { SectionCard } from "@/components/seller/section-card";
import {
  calculateDeliveryOffers,
  acceptDeliveryShipment,
  cancelDeliveryShipment,
  createDeliveryShipment,
  createManualDelivery,
  getDeliverySettings,
  getOrderDelivery,
  getShopOrderById,
  markManualDeliveryDelivered,
  markManualDeliveryInTransit,
  refreshDeliveryShipment,
  updateShopOrderStatus,
  updateManualDelivery,
  type DeliveryDetail,
  type DeliveryOffer,
  type DeliveryProviderName,
  type SellerOrderListItem,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const statusOptions = ["PENDING", "NEW", "ASSEMBLING", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

export function SellerOrderDetailPageClient({ orderId }: { orderId: string }) {
  const user = useAuthStore((state) => state.user);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [order, setOrder] = useState<SellerOrderListItem | null>(null);
  const [nextStatus, setNextStatus] = useState<SellerOrderListItem["status"]>("NEW");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [weightGram, setWeightGram] = useState("1000");
  const [lengthCm, setLengthCm] = useState("30");
  const [widthCm, setWidthCm] = useState("20");
  const [heightCm, setHeightCm] = useState("10");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [manualProvider, setManualProvider] = useState<DeliveryProviderName>("YANDEX");
  const [manualTrackingNumber, setManualTrackingNumber] = useState("");
  const [manualTrackingUrl, setManualTrackingUrl] = useState("");
  const [manualCourierPhone, setManualCourierPhone] = useState("");
  const [manualEstimatedDeliveryAt, setManualEstimatedDeliveryAt] = useState("");
  const [manualDeliveryNote, setManualDeliveryNote] = useState("");

  function hydrateManualForm(deliveryResult: DeliveryDetail) {
    const shipment = deliveryResult.activeShipment;
    if (!shipment) return;
    setManualProvider((shipment.provider as DeliveryProviderName) ?? "YANDEX");
    setManualTrackingNumber(shipment.trackingNumber ?? "");
    setManualTrackingUrl(shipment.trackingUrl ?? "");
    setManualCourierPhone(shipment.courierPhone ?? "");
    setManualEstimatedDeliveryAt(shipment.estimatedDeliveryAt ? shipment.estimatedDeliveryAt.slice(0, 16) : "");
    setManualDeliveryNote(shipment.deliveryNote ?? "");
  }

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user || !currentShopId) {
        setLoading(false);
        return;
      }

      try {
        const [orderResult, deliveryResult] = await Promise.all([
          getShopOrderById(currentShopId, orderId, ""),
          getOrderDelivery(currentShopId, orderId, "").catch(() => null),
        ]);
        if (!mounted) return;
        setOrder(orderResult);
        setNextStatus(orderResult.status as SellerOrderListItem["status"]);
        if (deliveryResult) {
          setDelivery(deliveryResult);
          setDeliveryOffers(deliveryResult.offers);
          setSelectedOfferId(deliveryResult.offers[0]?.id ?? "");
          setPickupAddress(deliveryResult.activeShipment?.pickupAddress ?? orderResult.shippingAddress);
          hydrateManualForm(deliveryResult);
        } else {
          setPickupAddress(orderResult.shippingAddress);
        }

        try {
          const settings = await getDeliverySettings(currentShopId, "");
          if (!mounted) return;
          setPickupAddress((current) => (deliveryResult?.activeShipment ? current : settings.pickupAddress || current));
          setWeightGram(String(settings.defaultWeightGram));
          setLengthCm(String(settings.defaultLengthCm));
          setWidthCm(String(settings.defaultWidthCm));
          setHeightCm(String(settings.defaultHeightCm));
        } catch {
          // Settings may not exist yet for the current shop.
        }

        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load order.");
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
  }, [currentShopId, orderId, user]);

  const handleUpdateStatus = async () => {
    if (!currentShopId || !order) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateShopOrderStatus(currentShopId, order.id, nextStatus, "");
      setOrder(updated);
      setNextStatus(updated.status as SellerOrderListItem["status"]);
      setSuccessMessage(`Order moved to ${updated.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status.");
    } finally {
      setSaving(false);
    }
  };

  const buildPackageInfo = () => ({
    weightGram: Number(weightGram || "0"),
    lengthCm: Number(lengthCm || "0"),
    widthCm: Number(widthCm || "0"),
    heightCm: Number(heightCm || "0"),
  });

  const refreshDeliverySnapshot = async () => {
    if (!currentShopId || !order) return;
    const [orderResult, deliveryResult] = await Promise.all([
      getShopOrderById(currentShopId, order.id, ""),
      getOrderDelivery(currentShopId, order.id, ""),
    ]);
    setOrder(orderResult);
    setDelivery(deliveryResult);
    setDeliveryOffers(deliveryResult.offers);
    hydrateManualForm(deliveryResult);
  };

  const buildManualPayload = () => ({
    provider: manualProvider,
    trackingNumber: manualTrackingNumber.trim() || null,
    trackingUrl: manualTrackingUrl.trim() || null,
    courierPhone: manualCourierPhone.trim() || null,
    estimatedDeliveryAt: manualEstimatedDeliveryAt ? new Date(manualEstimatedDeliveryAt).toISOString() : null,
    deliveryNote: manualDeliveryNote.trim() || null,
    pickupAddress: pickupAddress.trim() || null,
    note: "Seller updated manual delivery from order detail.",
  });

  const handleDeliveryAction = async (action: "calculate" | "create" | "accept" | "refresh" | "cancel") => {
    if (!currentShopId || !order) return;

    if ((action === "calculate" || action === "create") && !pickupAddress.trim()) {
      setError("Pickup address is required. Configure seller delivery settings first.");
      return;
    }

    if (action === "cancel" && !delivery?.activeShipment) {
      setError("No active shipment exists to cancel.");
      return;
    }

    if (action === "cancel") {
      const confirmed = window.confirm("Cancel this delivery shipment?");
      if (!confirmed) return;
    }

    setDeliveryLoading(true);
    setError(null);
    setDeliveryMessage(null);

    try {
      if (action === "calculate") {
        const result = await calculateDeliveryOffers(
          currentShopId,
          order.id,
          {
            pickupAddress: pickupAddress.trim(),
            packageInfo: buildPackageInfo(),
          },
          "",
        );
        setDeliveryOffers(result.offers);
        setSelectedOfferId(result.offers.find((offer) => offer.isRecommended)?.id ?? result.offers[0]?.id ?? "");
        setDeliveryMessage(`Loaded ${result.offers.length} delivery offer(s).`);
      } else if (action === "create") {
        await createDeliveryShipment(
          currentShopId,
          order.id,
          {
            provider: selectedOfferId
              ? (deliveryOffers.find((offer) => offer.id === selectedOfferId)?.provider as "CDEK" | "YANDEX" | undefined)
              : undefined,
            pickupAddress: pickupAddress.trim(),
            selectedOfferId: selectedOfferId || undefined,
            packageInfo: buildPackageInfo(),
          },
          "",
        );
        setDeliveryMessage("Delivery shipment created.");
        await refreshDeliverySnapshot();
      } else if (action === "accept") {
        if (!delivery?.activeShipment) {
          throw new Error("No active shipment exists to accept.");
        }
        await acceptDeliveryShipment(currentShopId, order.id, delivery.activeShipment.id, "");
        setDeliveryMessage("Delivery shipment accepted.");
        await refreshDeliverySnapshot();
      } else if (action === "refresh") {
        if (!delivery?.activeShipment) {
          throw new Error("No active shipment exists to refresh.");
        }
        await refreshDeliveryShipment(currentShopId, order.id, delivery.activeShipment.id, "");
        setDeliveryMessage("Delivery shipment refreshed.");
        await refreshDeliverySnapshot();
      } else {
        await cancelDeliveryShipment(
          currentShopId,
          order.id,
          delivery!.activeShipment!.id,
          { reason: "Seller cancelled shipment from the order detail page." },
          "",
        );
        setDeliveryMessage("Delivery shipment cancelled.");
        await refreshDeliverySnapshot();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery action failed.");
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleManualDeliveryAction = async (action: "save" | "in-transit" | "delivered" | "cancel") => {
    if (!currentShopId || !order) return;
    setDeliveryLoading(true);
    setError(null);
    setDeliveryMessage(null);
    try {
      if (action === "save") {
        if (activeShipment) {
          await updateManualDelivery(currentShopId, order.id, activeShipment.id, buildManualPayload(), "");
          setDeliveryMessage("Manual delivery updated.");
        } else {
          await createManualDelivery(currentShopId, order.id, buildManualPayload(), "");
          setDeliveryMessage("Manual delivery saved.");
        }
      } else {
        if (!activeShipment) throw new Error("No manual delivery exists yet.");
        if (action === "in-transit") {
          await markManualDeliveryInTransit(currentShopId, order.id, activeShipment.id, { note: "Seller marked manual delivery in transit." }, "");
          setDeliveryMessage("Manual delivery marked in transit.");
        } else if (action === "delivered") {
          await markManualDeliveryDelivered(currentShopId, order.id, activeShipment.id, { note: "Seller marked manual delivery delivered." }, "");
          setDeliveryMessage("Manual delivery marked delivered.");
        } else {
          await cancelDeliveryShipment(currentShopId, order.id, activeShipment.id, { reason: "Seller cancelled manual delivery." }, "");
          setDeliveryMessage("Manual delivery cancelled.");
        }
      }
      await refreshDeliverySnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual delivery action failed.");
    } finally {
      setDeliveryLoading(false);
    }
  };

  if (loading) {
    return (
      <SectionCard eyebrow="Order detail" title="Loading order" description="Fetching order details from the NestJS seller API.">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !order) {
    return (
      <SectionCard eyebrow="Order detail" title="Unable to load order" description="The selected order could not be loaded for the current seller shop.">
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error ?? "Order not found."}</p>
      </SectionCard>
    );
  }

  const activeShipment = delivery?.activeShipment ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/seller/orders" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Back to orders
        </Link>
        <Link href={`/seller/payments/${orderId}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Review payment
        </Link>
        <Link href="/seller/settings" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white">
          Delivery settings
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard eyebrow="Order" title={order.orderNumber} description="Order details migrated into the seller center.">
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Customer" value={order.customer.name} />
            <Metric label="Phone" value={order.customer.phone} />
            <Metric label="Email" value={order.customer.email ?? "No email"} />
            <Metric label="Total" value={order.totalAmount} />
            <Metric label="Created" value={new Date(order.createdAt).toLocaleString()} />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Status</p>
              <div className="mt-3"><OrderStatusBadge status={order.status} /></div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Payment</p>
              <div className="mt-3"><PaymentStatusBadge status={order.paymentStatus} /></div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Shipping address</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{order.shippingAddress}</p>
            {order.customerNote ? <p className="mt-4 text-sm text-[var(--muted)]">Customer note: {order.customerNote}</p> : null}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Actions" title="Fulfillment status" description="Move the order through the seller workflow when the current state allows it.">
          <div className="space-y-4">
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as SellerOrderListItem["status"])}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleUpdateStatus()}
              disabled={saving}
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating..." : "Update status"}
            </button>
            {error ? <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">{error}</div> : null}
            {successMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard eyebrow="Delivery" title="Multi-carrier shipment" description="Yandex is recommended for same-city express. CDEK stays available for fallback, pickup, and inter-city delivery.">
        <div data-testid="seller-order-delivery-section">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Manual provider">
                <select value={manualProvider} onChange={(event) => setManualProvider(event.target.value as DeliveryProviderName)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-provider">
                  <option value="YANDEX">Yandex</option>
                  <option value="CDEK">CDEK</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </Field>
              <Field label="Tracking number">
                <input value={manualTrackingNumber} onChange={(event) => setManualTrackingNumber(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-tracking-number" />
              </Field>
              <Field label="Tracking URL">
                <input value={manualTrackingUrl} onChange={(event) => setManualTrackingUrl(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-tracking-url" />
              </Field>
              <Field label="Courier phone">
                <input value={manualCourierPhone} onChange={(event) => setManualCourierPhone(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-courier-phone" />
              </Field>
              <Field label="Estimated delivery">
                <input type="datetime-local" value={manualEstimatedDeliveryAt} onChange={(event) => setManualEstimatedDeliveryAt(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-estimated-at" />
              </Field>
              <Field label="Delivery note">
                <input value={manualDeliveryNote} onChange={(event) => setManualDeliveryNote(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="manual-delivery-note" />
              </Field>
              <Field label="Pickup address">
                <input value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-order-pickup-address" />
              </Field>
              <Field label="Weight (g)">
                <input value={weightGram} onChange={(event) => setWeightGram(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-order-weight-gram" />
              </Field>
              <Field label="Length (cm)">
                <input value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-order-length-cm" />
              </Field>
              <Field label="Width (cm)">
                <input value={widthCm} onChange={(event) => setWidthCm(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-order-width-cm" />
              </Field>
              <Field label="Height (cm)">
                <input value={heightCm} onChange={(event) => setHeightCm(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-order-height-cm" />
              </Field>
              <Field label="Selected offer">
                <select value={selectedOfferId} onChange={(event) => setSelectedOfferId(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" data-testid="delivery-offer-select">
                  <option value="">Use default carrier</option>
                  {deliveryOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.isRecommended ? "Recommended · " : ""}{offer.offerType} · {offer.priceAmount} {offer.priceCurrency}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button type="button" onClick={() => void handleManualDeliveryAction("save")} disabled={deliveryLoading || order.paymentStatus !== "PAID"} className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="manual-delivery-save">
                Save delivery
              </button>
              <button type="button" onClick={() => void handleManualDeliveryAction("in-transit")} disabled={deliveryLoading || !activeShipment} className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="manual-delivery-mark-in-transit">
                Mark in transit
              </button>
              <button type="button" onClick={() => void handleManualDeliveryAction("delivered")} disabled={deliveryLoading || !activeShipment} className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="manual-delivery-mark-delivered">
                Mark delivered
              </button>
              <button type="button" onClick={() => void handleManualDeliveryAction("cancel")} disabled={deliveryLoading || !activeShipment || activeShipment.internalStatus === "DELIVERED"} className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60" data-testid="manual-delivery-cancel">
                Cancel delivery
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <button type="button" onClick={() => void handleDeliveryAction("calculate")} disabled={deliveryLoading} className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="delivery-calculate-offers">
                {deliveryLoading ? "Working..." : "Calculate offers"}
              </button>
              <button type="button" onClick={() => void handleDeliveryAction("create")} disabled={deliveryLoading || order.paymentStatus !== "PAID"} className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" data-testid="delivery-create-shipment">
                {deliveryOffers.find((offer) => offer.id === selectedOfferId)?.provider === "YANDEX" ? "Create claim" : "Create shipment"}
              </button>
              <button type="button" onClick={() => void handleDeliveryAction("accept")} disabled={deliveryLoading || !activeShipment || activeShipment.provider !== "YANDEX"} className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50">
                Accept claim
              </button>
              <button type="button" onClick={() => void handleDeliveryAction("refresh")} disabled={deliveryLoading || !activeShipment} className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50" data-testid="delivery-refresh-shipment">
                Refresh
              </button>
              <button type="button" onClick={() => void handleDeliveryAction("cancel")} disabled={deliveryLoading || !activeShipment} className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                Cancel
              </button>
            </div>

            {deliveryMessage ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" data-testid="delivery-action-message">{deliveryMessage}</div> : null}
          </div>

          <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
            <p className="text-sm font-semibold text-[var(--foreground)]">Current shipment</p>
            <div className="grid gap-4 md:grid-cols-2">
              <Metric label="Provider" value={activeShipment?.provider ?? order.delivery?.provider ?? "Not created"} testId="seller-delivery-provider" />
              <Metric label="Status" value={activeShipment?.internalStatus ?? order.delivery?.status ?? "Not created"} testId="seller-delivery-status" />
              <Metric label="Shipment id" value={activeShipment?.providerShipmentId ?? order.delivery?.providerShipmentId ?? "Not assigned"} />
              <Metric label="Tracking" value={activeShipment?.trackingNumber ?? order.delivery?.trackingNumber ?? "Not assigned"} />
              <Metric label="Courier" value={activeShipment?.courierPhone ?? order.delivery?.courierPhone ?? "Not assigned"} />
              <Metric label="ETA" value={activeShipment?.estimatedDeliveryAt ? new Date(activeShipment.estimatedDeliveryAt).toLocaleString() : "Not assigned"} />
            </div>
            {activeShipment?.deliveryNote ? <p className="text-sm text-[var(--muted)]" data-testid="seller-delivery-note">{activeShipment.deliveryNote}</p> : null}
            {activeShipment?.trackingUrl || order.delivery?.trackingUrl ? (
              <a href={activeShipment?.trackingUrl ?? order.delivery?.trackingUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]" data-testid="seller-delivery-tracking-link">
                Open tracking link
              </a>
            ) : null}
            <div className="space-y-3">
              {deliveryOffers.length ? (
                deliveryOffers.map((offer) => (
                  <article key={offer.id} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4" data-testid="delivery-offer-row">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{offer.offerType}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Provider: {offer.provider}</p>
                        {offer.isRecommended ? <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Recommended</span> : null}
                      </div>
                      <div className="text-right text-sm text-[var(--foreground)]">
                        <p>{offer.priceAmount} {offer.priceCurrency}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {offer.estimatedMinDays !== null && offer.estimatedMaxDays !== null
                            ? `${offer.estimatedMinDays}-${offer.estimatedMaxDays} day(s)`
                            : "ETA unavailable"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[var(--muted)]">No delivery offers loaded yet.</p>
              )}
            </div>
            {delivery?.events.length ? (
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                {delivery.events.map((event) => (
                  <article key={event.id} className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                        {event.eventType}
                      </span>
                      <p className="text-xs text-[var(--muted)]">{new Date(event.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--foreground)]">{event.message ?? event.providerStatus ?? "No message"}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Items" title="Ordered products" description="Snapshot data is taken from the legacy order records so seller support sees exactly what the customer bought.">
        <div className="grid gap-4">
          {order.items.map((item) => (
            <article key={item.id} className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[96px_1fr_160px]">
              <div className="overflow-hidden rounded-2xl bg-[var(--panel)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.productImageSnapshot ?? "https://placehold.co/160x160?text=No+Image"} alt={item.productTitleSnapshot} className="h-24 w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{item.productTitleSnapshot}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Slug: {item.productSlugSnapshot}</p>
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>Qty: {item.quantity}</p>
                <p className="mt-1">Price: {item.priceAtPurchase}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]" data-testid={testId}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
