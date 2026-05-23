"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { labelForReturnStatus, labelForReturnType } from "@/components/returns/return-refund-utils";
import { SectionCard } from "@/components/seller/section-card";
import {
  calculateDeliveryOffers,
  acceptDeliveryShipment,
  addDeliveryComment,
  cancelDeliveryShipment,
  confirmPayment,
  createDeliveryShipment,
  createManualDelivery,
  getDeliverySettings,
  getOrderDelivery,
  getShopOrderById,
  markManualDeliveryCourierAssigned,
  markManualDeliveryDelivered,
  markManualDeliveryFailed,
  markManualDeliveryInTransit,
  markManualDeliveryPickedUp,
  refreshDeliveryShipment,
  rejectPayment,
  updateShopOrderStatus,
  updateManualDelivery,
  type DeliveryDetail,
  type DeliveryOffer,
  type DeliveryProviderName,
  type DeliveryExceptionReasonCode,
  type SellerOrderListItem,
} from "@/lib/seller-api";
import { useAuthStore } from "@/stores/auth-store";
import { useSellerWorkspaceStore } from "@/stores/seller-workspace-store";

const statusOptions = [
  "PENDING",
  "NEW",
  "READY_TO_CREATE_YANDEX",
  "YANDEX_MANUAL_CREATED",
  "ASSEMBLING",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
] as const;

const fashionPackagePresets = {
  FASHION_BAG: { label: "Fashion bag", weightGram: "700", lengthCm: "35", widthCm: "25", heightCm: "8" },
  SHOE_BOX: { label: "Shoe box", weightGram: "1200", lengthCm: "36", widthCm: "24", heightCm: "14" },
  OUTERWEAR_BOX: { label: "Outerwear box", weightGram: "1800", lengthCm: "42", widthCm: "32", heightCm: "16" },
  CUSTOM: { label: "Custom", weightGram: "", lengthCm: "", widthCm: "", heightCm: "" },
} as const;
const exceptionReasons: DeliveryExceptionReasonCode[] = [
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ADDRESS",
  "COURIER_CANCELLED",
  "SELLER_CANCELLED",
  "CUSTOMER_CANCELLED",
  "DAMAGED_PACKAGE",
  "LOST_PACKAGE",
  "DELIVERY_TIMEOUT",
  "OTHER",
];

export function SellerOrderDetailPageClient({ orderId }: { orderId: string }) {
  const user = useAuthStore((state) => state.sellerUser);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const [order, setOrder] = useState<SellerOrderListItem | null>(null);
  const [nextStatus, setNextStatus] =
    useState<SellerOrderListItem["status"]>("NEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [deliveryOffers, setDeliveryOffers] = useState<DeliveryOffer[]>([]);

  const { run: runStatusAction, isRunning: savingStatus } = useActionFeedback();
  const { run: runPaymentAction, isRunning: savingPayment } = useActionFeedback();
  const { run: runDeliveryAction, isRunning: runningDelivery } = useActionFeedback();
  const { run: runManualDeliveryAction, isRunning: runningManualDelivery } = useActionFeedback();
  const { run: runReportAction, isRunning: runningReport } = useActionFeedback();
  const { run: runCommentAction, isRunning: runningComment } = useActionFeedback();

  const saving = savingStatus || savingPayment;
  const deliveryLoading = runningDelivery || runningManualDelivery || runningReport || runningComment;
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLatitude, setPickupLatitude] = useState<string | null>(null);
  const [pickupLongitude, setPickupLongitude] = useState<string | null>(null);
  const [weightGram, setWeightGram] = useState("1000");
  const [lengthCm, setLengthCm] = useState("30");
  const [widthCm, setWidthCm] = useState("20");
  const [heightCm, setHeightCm] = useState("10");
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [manualProvider, setManualProvider] =
    useState<DeliveryProviderName>("YANDEX");
  const [manualTrackingNumber, setManualTrackingNumber] = useState("");
  const [manualTrackingUrl, setManualTrackingUrl] = useState("");
  const [manualCourierName, setManualCourierName] = useState("");
  const [manualCourierPhone, setManualCourierPhone] = useState("");
  const [manualYandexOrderId, setManualYandexOrderId] = useState("");
  const [manualYandexClaimId, setManualYandexClaimId] = useState("");
  const [manualDeliveryPrice, setManualDeliveryPrice] = useState("");
  const [packagePreset, setPackagePreset] =
    useState<keyof typeof fashionPackagePresets>("FASHION_BAG");
  const [manualEstimatedDeliveryAt, setManualEstimatedDeliveryAt] =
    useState("");
  const [manualDeliveryNote, setManualDeliveryNote] = useState("");
  const [exceptionReasonCode, setExceptionReasonCode] =
    useState<DeliveryExceptionReasonCode>("CUSTOMER_UNAVAILABLE");
  const [exceptionReasonText, setExceptionReasonText] = useState("");
  const [exceptionCustomerMessage, setExceptionCustomerMessage] = useState("");
  const [internalComment, setInternalComment] = useState("");
  const isPayOnDeliverySellerQr =
    order?.shippingMethodName === "PAY_ON_DELIVERY_SELLER_QR";

  function hydrateManualForm(deliveryResult: DeliveryDetail) {
    const shipment = deliveryResult.activeShipment;
    if (!shipment) return;
    setManualProvider((shipment.provider as DeliveryProviderName) ?? "YANDEX");
    setManualTrackingNumber(shipment.trackingNumber ?? "");
    setManualTrackingUrl(shipment.trackingUrl ?? "");
    setManualCourierName(shipment.courierName ?? "");
    setManualCourierPhone(shipment.courierPhone ?? "");
    setManualYandexOrderId(shipment.manualYandexOrderId ?? "");
    setManualYandexClaimId(shipment.yandexClaimId ?? "");
    setManualDeliveryPrice(shipment.yandexPrice ?? shipment.priceAmount ?? "");
    setPackagePreset(
      (shipment.packagePreset as keyof typeof fashionPackagePresets) ??
        "FASHION_BAG",
    );
    setManualEstimatedDeliveryAt(
      shipment.estimatedDeliveryAt
        ? shipment.estimatedDeliveryAt.slice(0, 16)
        : "",
    );
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
          setPickupAddress(
            deliveryResult.activeShipment?.pickupAddress ??
              orderResult.shippingAddress,
          );
          hydrateManualForm(deliveryResult);
        } else {
          setPickupAddress(orderResult.shippingAddress);
        }

        try {
          const settings = await getDeliverySettings(currentShopId, "");
          if (!mounted) return;
          setPickupAddress((current) =>
            deliveryResult?.activeShipment
              ? current
              : settings.pickupAddress || current,
          );
          setPickupLatitude(settings.pickupLatitude);
          setPickupLongitude(settings.pickupLongitude);
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
  }, [currentShopId, orderId, user]);

  const handleUpdateStatus = async () => {
    if (!currentShopId || !order) return;
    setError(null);
    await runStatusAction({
      action: async () => {
        const updated = await updateShopOrderStatus(
          currentShopId,
          order.id,
          nextStatus,
          "",
        );
        return updated;
      },
      successMessage: `Đã cập nhật trạng thái đơn hàng.`,
      errorMessage: "Không thể cập nhật trạng thái đơn hàng.",
      onSuccess: async (updated) => {
        setOrder(updated);
        setNextStatus(updated.status as SellerOrderListItem["status"]);
      },
    }).catch(() => {});
  };

  const buildPackageInfo = () => ({
    weightGram: Number(weightGram || "0"),
    lengthCm: Number(lengthCm || "0"),
    widthCm: Number(widthCm || "0"),
    heightCm: Number(heightCm || "0"),
  });

  const applyPackagePreset = (
    preset: keyof typeof fashionPackagePresets,
  ) => {
    setPackagePreset(preset);
    const value = fashionPackagePresets[preset];
    if (preset === "CUSTOM") return;
    setWeightGram(value.weightGram);
    setLengthCm(value.lengthCm);
    setWidthCm(value.widthCm);
    setHeightCm(value.heightCm);
  };

  const handleDeliveryPaymentDecision = async (
    action: "confirm" | "reject",
  ) => {
    if (!currentShopId || !order) return;
    if (action === "reject") {
      if (!window.confirm("Bạn có chắc chắn muốn từ chối thanh toán giao hàng?")) return;
    }
    setError(null);
    await runPaymentAction({
      action: async () => {
        if (action === "confirm") {
          await confirmPayment(
            currentShopId,
            order.id,
            {
              note:
                order.paymentStatus === "PAY_ON_DELIVERY_SELECTED"
                  ? "Seller accepted pay-on-delivery via seller QR."
                  : "Seller confirmed delivery payment.",
            },
            "",
          );
        } else {
          await rejectPayment(
            currentShopId,
            order.id,
            {
              note: "Seller did not receive delivery payment and opened dispute.",
            },
            "",
          );
        }
        const refreshed = await getShopOrderById(currentShopId, order.id, "");
        return refreshed;
      },
      successMessage:
        action === "confirm"
          ? "Đã xác nhận thanh toán."
          : "Đã ghi nhận tranh chấp thanh toán.",
      errorMessage: "Không thể cập nhật trạng thái thanh toán.",
      onSuccess: async (refreshed) => {
        setOrder(refreshed);
        setNextStatus(refreshed.status as SellerOrderListItem["status"]);
      },
    }).catch(() => {});
  };

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
    manualYandexOrderId: manualYandexOrderId.trim() || null,
    yandexClaimId: manualYandexClaimId.trim() || null,
    trackingNumber: manualTrackingNumber.trim() || null,
    trackingUrl: manualTrackingUrl.trim() || null,
    courierName: manualCourierName.trim() || null,
    courierPhone: manualCourierPhone.trim() || null,
    deliveryPrice: manualDeliveryPrice.trim()
      ? Number(manualDeliveryPrice)
      : null,
    estimatedDeliveryAt: manualEstimatedDeliveryAt
      ? new Date(manualEstimatedDeliveryAt).toISOString()
      : null,
    packagePreset,
    packageWeightGram: Number(weightGram || "0") || null,
    packageLengthCm: Number(lengthCm || "0") || null,
    packageWidthCm: Number(widthCm || "0") || null,
    packageHeightCm: Number(heightCm || "0") || null,
    deliveryNote: manualDeliveryNote.trim() || null,
    pickupAddress: pickupAddress.trim() || null,
    pickupLatitude: delivery?.activeShipment?.pickupLatitude
      ? Number(delivery.activeShipment.pickupLatitude)
      : undefined,
    pickupLongitude: delivery?.activeShipment?.pickupLongitude
      ? Number(delivery.activeShipment.pickupLongitude)
      : undefined,
    dropoffLatitude: delivery?.activeShipment?.dropoffLatitude
      ? Number(delivery.activeShipment.dropoffLatitude)
      : undefined,
    dropoffLongitude: delivery?.activeShipment?.dropoffLongitude
      ? Number(delivery.activeShipment.dropoffLongitude)
      : undefined,
    recipientName: order?.customer.name ?? null,
    recipientPhone: order?.customer.phone ?? null,
    yandexTrackingLink: manualTrackingUrl.trim() || null,
    note: "Seller updated manual delivery from order detail.",
  });

  const handleDeliveryAction = async (
    action: "calculate" | "create" | "accept" | "refresh" | "cancel",
  ) => {
    if (!currentShopId || !order) return;

    if (
      (action === "calculate" || action === "create") &&
      !pickupAddress.trim()
    ) {
      setError(
        "Pickup address is required. Configure seller delivery settings first.",
      );
      return;
    }

    if (action === "cancel" && !delivery?.activeShipment) {
      setError("No active shipment exists to cancel.");
      return;
    }

    if (action === "cancel") {
      if (!window.confirm("Hủy lô giao hàng này?")) return;
    }

    setError(null);
    setDeliveryMessage(null);

    await runDeliveryAction({
      action: async () => {
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
          setSelectedOfferId(
            result.offers.find((offer) => offer.isRecommended)?.id ??
              result.offers[0]?.id ??
              "",
          );
          setDeliveryMessage(`Loaded ${result.offers.length} delivery offer(s).`);
          return;
        } else if (action === "create") {
          await createDeliveryShipment(
            currentShopId,
            order.id,
            {
              provider: selectedOfferId
                ? (deliveryOffers.find((offer) => offer.id === selectedOfferId)
                    ?.provider as "CDEK" | "YANDEX" | undefined)
                : undefined,
              pickupAddress: pickupAddress.trim(),
              selectedOfferId: selectedOfferId || undefined,
              packageInfo: buildPackageInfo(),
            },
            "",
          );
          setDeliveryMessage("Delivery shipment created.");
        } else if (action === "accept") {
          if (!delivery?.activeShipment) {
            throw new Error("No active shipment exists to accept.");
          }
          await acceptDeliveryShipment(
            currentShopId,
            order.id,
            delivery.activeShipment.id,
            "",
          );
          setDeliveryMessage("Delivery shipment accepted.");
        } else if (action === "refresh") {
          if (!delivery?.activeShipment) {
            throw new Error("No active shipment exists to refresh.");
          }
          await refreshDeliveryShipment(
            currentShopId,
            order.id,
            delivery.activeShipment.id,
            "",
          );
          setDeliveryMessage("Delivery shipment refreshed.");
        } else {
          await cancelDeliveryShipment(
            currentShopId,
            order.id,
            delivery!.activeShipment!.id,
            { reason: "Seller cancelled shipment from the order detail page." },
            "",
          );
          setDeliveryMessage("Delivery shipment cancelled.");
        }
        await refreshDeliverySnapshot();
      },
      successMessage: action === "calculate" ? undefined : "Đã cập nhật giao hàng.",
      errorMessage: "Thao tác giao hàng thất bại.",
    }).catch(() => {});
  };

  const handleManualDeliveryAction = async (
    action: "save" | "courier-assigned" | "picked-up" | "in-transit" | "delivered" | "cancel",
  ) => {
    if (!currentShopId || !order) return;
    if (action === "delivered") {
      if (!window.confirm("Xác nhận đã giao hàng thành công?")) return;
    }
    if (action === "cancel") {
      if (!window.confirm("Hủy giao hàng thủ công này?")) return;
    }
    setError(null);
    setDeliveryMessage(null);
    await runManualDeliveryAction({
      action: async () => {
        if (action === "save") {
          if (activeShipment) {
            await updateManualDelivery(
              currentShopId,
              order.id,
              activeShipment.id,
              buildManualPayload(),
              "",
            );
            setDeliveryMessage("Manual delivery updated.");
          } else {
            await createManualDelivery(
              currentShopId,
              order.id,
              buildManualPayload(),
              "",
            );
            setDeliveryMessage("Manual delivery saved.");
          }
        } else {
          if (!activeShipment) throw new Error("No manual delivery exists yet.");
          if (action === "in-transit") {
            await markManualDeliveryInTransit(
              currentShopId,
              order.id,
              activeShipment.id,
              {
                note: "Seller marked manual Yandex delivery on the way.",
                courierName: manualCourierName.trim() || null,
                courierPhone: manualCourierPhone.trim() || null,
                estimatedDeliveryAt: manualEstimatedDeliveryAt
                  ? new Date(manualEstimatedDeliveryAt).toISOString()
                  : null,
              },
              "",
            );
            setDeliveryMessage("Manual Yandex delivery marked on the way.");
          } else if (action === "courier-assigned") {
            await markManualDeliveryCourierAssigned(
              currentShopId,
              order.id,
              activeShipment.id,
              {
                note: "Seller assigned courier in manual Yandex workbench.",
                courierName: manualCourierName.trim() || null,
                courierPhone: manualCourierPhone.trim() || null,
                estimatedDeliveryAt: manualEstimatedDeliveryAt
                  ? new Date(manualEstimatedDeliveryAt).toISOString()
                  : null,
              },
              "",
            );
            setDeliveryMessage("Courier assigned.");
          } else if (action === "picked-up") {
            await markManualDeliveryPickedUp(
              currentShopId,
              order.id,
              activeShipment.id,
              {
                note: "Seller marked package picked up.",
                courierName: manualCourierName.trim() || null,
                courierPhone: manualCourierPhone.trim() || null,
                estimatedDeliveryAt: manualEstimatedDeliveryAt
                  ? new Date(manualEstimatedDeliveryAt).toISOString()
                  : null,
              },
              "",
            );
            setDeliveryMessage("Package marked picked up.");
          } else if (action === "delivered") {
            await markManualDeliveryDelivered(
              currentShopId,
              order.id,
              activeShipment.id,
              { note: "Seller marked manual delivery delivered." },
              "",
            );
            setDeliveryMessage("Manual delivery marked delivered.");
          } else {
            await cancelDeliveryShipment(
              currentShopId,
              order.id,
              activeShipment.id,
              { reason: "Seller cancelled manual delivery." },
              "",
            );
            setDeliveryMessage("Manual delivery cancelled.");
          }
        }
        await refreshDeliverySnapshot();
      },
      successMessage: action === "save" ? "Đã lưu giao hàng." : "Đã cập nhật giao hàng.",
      errorMessage: "Thao tác giao hàng thủ công thất bại.",
    }).catch(() => {});
  };

  const handleReportProblem = async () => {
    if (!currentShopId || !order || !activeShipment) return;
    setError(null);
    setDeliveryMessage(null);
    await runReportAction({
      action: async () => {
        await markManualDeliveryFailed(
          currentShopId,
          order.id,
          activeShipment.id,
          {
            reasonCode: exceptionReasonCode,
            reasonText: exceptionReasonText.trim() || null,
            customerVisibleMessage: exceptionCustomerMessage.trim() || null,
          },
          "",
        );
        setDeliveryMessage("Delivery problem reported.");
        await refreshDeliverySnapshot();
      },
      successMessage: "Đã báo cáo sự cố giao hàng.",
      errorMessage: "Không thể báo cáo sự cố giao hàng.",
    }).catch(() => {});
  };

  const handleAddInternalComment = async () => {
    if (!currentShopId || !order || !activeShipment || !internalComment.trim())
      return;
    setError(null);
    setDeliveryMessage(null);
    await runCommentAction({
      action: async () => {
        await addDeliveryComment(
          currentShopId,
          order.id,
          activeShipment.id,
          { visibility: "INTERNAL", message: internalComment.trim() },
          "",
        );
        setInternalComment("");
        setDeliveryMessage("Internal delivery comment added.");
        await refreshDeliverySnapshot();
      },
      successMessage: "Đã thêm ghi chú nội bộ.",
      errorMessage: "Không thể thêm ghi chú.",
    }).catch(() => {});
  };

  if (loading) {
    return (
      <SectionCard
        eyebrow="Order detail"
        title="Loading order"
        description="Fetching order details from the NestJS seller API."
      >
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </SectionCard>
    );
  }

  if (error || !order) {
    return (
      <SectionCard
        eyebrow="Order detail"
        title="Unable to load order"
        description="The selected order could not be loaded for the current seller shop."
      >
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? "Order not found."}
        </p>
      </SectionCard>
    );
  }

  const activeShipment = delivery?.activeShipment ?? null;
  const pickupLat = activeShipment?.pickupLatitude
    ? Number(activeShipment.pickupLatitude)
    : pickupLatitude
      ? Number(pickupLatitude)
      : null;
  const pickupLng = activeShipment?.pickupLongitude
    ? Number(activeShipment.pickupLongitude)
    : pickupLongitude
      ? Number(pickupLongitude)
      : null;
  const dropoffLat = activeShipment?.dropoffLatitude
    ? Number(activeShipment.dropoffLatitude)
    : order.dropoffLatitude
      ? Number(order.dropoffLatitude)
      : null;
  const dropoffLng = activeShipment?.dropoffLongitude
    ? Number(activeShipment.dropoffLongitude)
    : order.dropoffLongitude
      ? Number(order.dropoffLongitude)
      : null;
  const dropoffAddressFullName =
    activeShipment?.dropoffAddressFullName ??
    order.dropoffAddressFullName ??
    order.shippingAddress;
  const dropoffCommentNote = activeShipment?.dropoffComment ?? order.dropoffComment ?? null;
  const entranceValue =
    activeShipment?.dropoffEntrance ??
    order.dropoffEntrance ??
    (order.dropoffNoEntrance ? "No private entrance" : null);
  const intercomValue = activeShipment?.dropoffIntercom ?? order.dropoffIntercom ?? null;
  const floorValue =
    activeShipment?.dropoffFloor ??
    order.dropoffFloor ??
    (order.dropoffNoFloor ? "Floor unknown" : null);
  const apartmentValue =
    activeShipment?.dropoffApartment ??
    order.dropoffApartment ??
    (order.dropoffNoApartment ? "No apartment" : null);
  const dropoffComment = [
    entranceValue ? `Entrance ${entranceValue}` : null,
    intercomValue ? `Intercom ${intercomValue}` : null,
    floorValue ? `Floor ${floorValue}` : null,
    apartmentValue ? `Apartment ${apartmentValue}` : null,
    dropoffCommentNote,
  ]
    .filter(Boolean)
    .join(", ");
  const pickupReady = Boolean(
    activeShipment?.pickupGeoReadiness?.hasCoordinates ??
      (pickupLat !== null && pickupLng !== null),
  );
  const dropoffReady = Boolean(
    activeShipment?.dropoffGeoReadiness?.hasCoordinates ??
      order.dropoffGeoReadiness?.hasCoordinates ??
      (dropoffLat !== null && dropoffLng !== null),
  );
  const yandexManualReady = Boolean(
    activeShipment?.yandexManualReady ?? order.yandexManualReady ?? true,
  );
  const yandexApiReady = Boolean(
    activeShipment?.yandexApiReady ?? order.yandexApiReady ?? false,
  );
  const senderText = [
    `Pickup: ${activeShipment?.pickupAddressFullName ?? pickupAddress}`,
    pickupLat !== null && pickupLng !== null
      ? `GPS: ${pickupLat}, ${pickupLng}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const recipientText = [
    `Recipient: ${order.customer.name}, ${order.customer.phone}`,
    `Address: ${dropoffAddressFullName}`,
    entranceValue ? `Entrance: ${entranceValue}` : null,
    intercomValue ? `Door code: ${intercomValue}` : null,
    floorValue ? `Floor: ${floorValue}` : null,
    apartmentValue ? `Apartment: ${apartmentValue}` : null,
    dropoffCommentNote ? `Comment: ${dropoffCommentNote}` : null,
    dropoffLat !== null && dropoffLng !== null
      ? `Coordinates: ${dropoffLat}, ${dropoffLng}`
      : null,
  ].filter(Boolean).join("\n");
  const packageText = [
    `Package: ${packagePreset}, ${weightGram} g, ${lengthCm} x ${widthCm} x ${heightCm} cm`,
    `Declared value: ${order.totalAmount}`,
    `Items: ${order.itemsCount}`,
  ].join("\n");
  const fullYandexBlock = [
    `ORDER: ${order.orderNumber}`,
    `Recipient: ${order.customer.name}, ${order.customer.phone}`,
    `Address: ${dropoffAddressFullName}`,
    `Entrance: ${entranceValue ?? "-"}`,
    `Door code: ${intercomValue ?? "-"}`,
    `Floor: ${floorValue ?? "-"}`,
    `Apartment: ${apartmentValue ?? "-"}`,
    `Comment: ${dropoffCommentNote ?? "-"}`,
    `Coordinates: ${dropoffLat !== null && dropoffLng !== null ? `${dropoffLat}, ${dropoffLng}` : "-"}`,
    `Package: ${packagePreset}, ${weightGram} g, ${lengthCm} x ${widthCm} x ${heightCm} cm`,
    `Declared value: ${order.totalAmount}`,
  ].join("\n");
  const canCreateDelivery =
    order.paymentStatus === "PAID" ||
    order.paymentStatus === "SELLER_ACCEPTED_PAY_ON_DELIVERY";
  const copyToClipboard = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setDeliveryMessage(`${label} copied.`);
  };
  const openMaps = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return;
    window.open(`https://yandex.ru/maps/?pt=${lng},${lat}&z=16`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/seller/orders"
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          Back to orders
        </Link>
        <Link
          href={`/seller/payments/${orderId}`}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          Review payment
        </Link>
        <Link
          href="/seller/settings"
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          Delivery settings
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          eyebrow="Order"
          title={order.orderNumber}
          description="Order details migrated into the seller center."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Customer" value={order.customer.name} />
            <Metric label="Phone" value={order.customer.phone} />
            <Metric label="Email" value={order.customer.email ?? "No email"} />
            <Metric label="Total" value={order.totalAmount} />
            <Metric
              label="Seller sync"
              value={order.sellerDisplayLabel}
              testId="seller-order-display-status"
            />
            <Metric
              label="Next action"
              value={formatNextAction(order.nextAction)}
              testId="seller-order-next-action"
            />
            <Metric
              label="Created"
              value={new Date(order.createdAt).toLocaleString()}
            />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Status
              </p>
              <div className="mt-3" data-testid="seller-order-status">
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Payment
              </p>
              <div className="mt-3">
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
            <Metric
              label="Payment method"
              value={order.paymentMethodLabel ?? order.paymentMethod ?? "Not set"}
            />
            <Metric
              label="Finance"
              value={
                order.finance?.ledgerStatus
                  ? `${order.finance.ledgerStatus} · fee ${order.finance.commissionAmount ?? "0"}`
                  : "Ledger pending"
              }
            />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Shipping address
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {dropoffAddressFullName}
            </p>
            {dropoffComment ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{dropoffComment}</p>
            ) : null}
            <p className="mt-3 text-xs text-[var(--muted)]">
              Geo status: {activeShipment?.dropoffGeoPrecision ?? order.dropoffGeoPrecision ?? "UNKNOWN"}
              {dropoffLat !== null && dropoffLng !== null ? ` · ${dropoffLat}, ${dropoffLng}` : ""}
            </p>
            {order.customerNote ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Customer note: {order.customerNote}
              </p>
            ) : null}
          </div>
          {order.paymentDetails ? (
            <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Payment destination
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {order.paymentMethodLabel ?? order.paymentMethod ?? "Direct seller payment"}
              </p>
              {order.paymentDetails.paymentInstruction ? (
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {order.paymentDetails.paymentInstruction}
                </p>
              ) : null}
            </div>
          ) : null}
          {isPayOnDeliverySellerQr ? (
            <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Payment on delivery via seller QR
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Buyer will pay the seller directly by QR/SBP when receiving the
                parcel. Yandex only handles delivery and does not collect cash
                or card payment for this flow.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {order.paymentStatus === "PAY_ON_DELIVERY_SELECTED" ? (
                  <button
                    type="button"
                    onClick={() => void handleDeliveryPaymentDecision("confirm")}
                    disabled={saving}
                    className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    data-testid="seller-accept-pay-on-delivery"
                  >
                    {saving ? "Đang xác nhận..." : "Accept pay on delivery and prepare Yandex"}
                  </button>
                ) : null}
                {order.status === "DELIVERED" ||
                order.paymentStatus === "DELIVERED_AWAITING_PAYMENT" ||
                order.paymentStatus === "BUYER_MARKED_DELIVERY_PAID" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleDeliveryPaymentDecision("confirm")}
                      disabled={saving}
                      className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      data-testid="seller-confirm-delivery-payment"
                    >
                      {saving ? "Đang xác nhận..." : "Đã nhận tiền khi giao hàng"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeliveryPaymentDecision("reject")}
                      disabled={saving}
                      className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      data-testid="seller-reject-delivery-payment"
                    >
                      {saving ? "Đang từ chối..." : "Chưa nhận được tiền / mở tranh chấp"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          eyebrow="Actions"
          title="Fulfillment status"
          description="Move the order through the seller workflow when the current state allows it."
        >
          <div className="space-y-4">
            <select
              value={nextStatus}
              onChange={(event) =>
                setNextStatus(
                  event.target.value as SellerOrderListItem["status"],
                )
              }
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
              {saving ? "Đang cập nhật..." : "Update status"}
            </button>
            {error ? (
              <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                {error}
              </div>
            ) : null}

          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Delivery"
        title="Yandex Delivery Handoff"
        description="Use this workbench after payment is confirmed to create and supervise a manual Yandex shipment without calling the real Yandex API."
      >
        <div data-testid="seller-order-delivery-section">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              {order.latestYandexReminder ? (
                <div
                  className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  data-testid="seller-yandex-reminder-banner"
                >
                  Admin reminded you to create Yandex delivery for this order.
                  <span className="ml-2 text-xs text-amber-700">
                    {new Date(order.latestYandexReminder.createdAt).toLocaleString()}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Manual provider">
                  <select
                    value={manualProvider}
                    onChange={(event) =>
                      setManualProvider(
                        event.target.value as DeliveryProviderName,
                      )
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-provider"
                  >
                    <option value="YANDEX">Yandex</option>
                    <option value="CDEK">CDEK</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </Field>
                <Field label="Mã vận đơn Yandex">
                  <input
                    value={manualYandexOrderId}
                    onChange={(event) =>
                      setManualYandexOrderId(event.target.value)
                    }
                    disabled={
                      activeShipment?.internalStatus === "DELIVERED" ||
                      activeShipment?.internalStatus === "CANCELLED"
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-yandex-order-id"
                  />
                </Field>
                <Field label="Yandex claim id">
                  <input
                    value={manualYandexClaimId}
                    onChange={(event) =>
                      setManualYandexClaimId(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-yandex-claim-id"
                  />
                </Field>
                <Field label="Tracking number">
                  <input
                    value={manualTrackingNumber}
                    onChange={(event) =>
                      setManualTrackingNumber(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-tracking-number"
                  />
                </Field>
                <Field label="Tracking URL">
                  <input
                    value={manualTrackingUrl}
                    onChange={(event) =>
                      setManualTrackingUrl(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-tracking-url"
                  />
                </Field>
                <Field label="Courier name">
                  <input
                    value={manualCourierName}
                    onChange={(event) =>
                      setManualCourierName(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-courier-name"
                  />
                </Field>
                <Field label="Courier phone">
                  <input
                    value={manualCourierPhone}
                    onChange={(event) =>
                      setManualCourierPhone(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-courier-phone"
                  />
                </Field>
                <Field label="Delivery price">
                  <input
                    value={manualDeliveryPrice}
                    onChange={(event) =>
                      setManualDeliveryPrice(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-price"
                  />
                </Field>
                <Field label="Estimated delivery">
                  <input
                    type="datetime-local"
                    value={manualEstimatedDeliveryAt}
                    onChange={(event) =>
                      setManualEstimatedDeliveryAt(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-estimated-at"
                  />
                </Field>
                <Field label="Delivery note">
                  <input
                    value={manualDeliveryNote}
                    onChange={(event) =>
                      setManualDeliveryNote(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-note"
                  />
                </Field>
                <Field label="Pickup address">
                  <input
                    value={pickupAddress}
                    onChange={(event) => setPickupAddress(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-pickup-address"
                  />
                </Field>
                <Field label="Package preset">
                  <select
                    value={packagePreset}
                    onChange={(event) =>
                      applyPackagePreset(
                        event.target.value as keyof typeof fashionPackagePresets,
                      )
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-package-preset"
                  >
                    {Object.entries(fashionPackagePresets).map(([value, item]) => (
                      <option key={value} value={value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Weight (g)">
                  <input
                    value={weightGram}
                    onChange={(event) => setWeightGram(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-weight-gram"
                  />
                </Field>
                <Field label="Length (cm)">
                  <input
                    value={lengthCm}
                    onChange={(event) => setLengthCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-length-cm"
                  />
                </Field>
                <Field label="Width (cm)">
                  <input
                    value={widthCm}
                    onChange={(event) => setWidthCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-width-cm"
                  />
                </Field>
                <Field label="Height (cm)">
                  <input
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-height-cm"
                  />
                </Field>
                <Field label="Selected offer">
                  <select
                    value={selectedOfferId}
                    onChange={(event) => setSelectedOfferId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-offer-select"
                  >
                    <option value="">Use default carrier</option>
                    {deliveryOffers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.isRecommended ? "Recommended · " : ""}
                        {offer.offerType} · {offer.priceAmount}{" "}
                        {offer.priceCurrency}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${pickupReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {pickupReady ? "Pickup ready" : "Missing pickup coordinates"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${dropoffReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {dropoffReady ? "Dropoff ready" : "Missing dropoff coordinates"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${yandexApiReady ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                    {yandexApiReady ? "API-ready" : yandexManualReady ? "Manual-only" : "Needs address fixes"}
                  </span>
                  {!pickupReady || !dropoffReady ? (
                    <span className="text-xs text-amber-700">
                      Seller may need to verify pickup or dropoff coordinates manually.
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyToClipboard(senderText, "Sender")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    Copy sender
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(recipientText, "Recipient")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    Copy recipient
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(dropoffAddressFullName, "Address")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    Copy address
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(dropoffComment || "No extra courier details", "Courier details")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    Copy courier details
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(fullYandexBlock, "Full Yandex block")} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold" data-testid="copy-full-delivery-block">
                    Copy full Yandex block
                  </button>
                  <button type="button" onClick={() => openMaps(pickupLat, pickupLng)} disabled={pickupLat === null || pickupLng === null} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    Open pickup map
                  </button>
                  <button type="button" onClick={() => openMaps(dropoffLat, dropoffLng)} disabled={dropoffLat === null || dropoffLng === null} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    Open dropoff map
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-[var(--muted)]">
                  <p>{senderText}</p>
                  <p>{recipientText}</p>
                  <p>{packageText}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("save")}
                  disabled={deliveryLoading || !canCreateDelivery}
                  className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="manual-delivery-save"
                >
                  {deliveryLoading ? "Đang lưu..." : "Save delivery"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("courier-assigned")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-courier-assigned"
                >
                  {deliveryLoading ? "Đang cập nhật..." : "Courier assigned"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("picked-up")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-picked-up"
                >
                  {deliveryLoading ? "Đang cập nhật..." : "Picked up"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("in-transit")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-in-transit"
                >
                  {deliveryLoading ? "Đang cập nhật..." : "On the way"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("delivered")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-delivered"
                >
                  {deliveryLoading ? "Đang cập nhật..." : "Mark delivered"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("cancel")}
                  disabled={
                    deliveryLoading ||
                    !activeShipment ||
                    activeShipment.internalStatus === "DELIVERED"
                  }
                  className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="manual-delivery-cancel"
                >
                  {deliveryLoading ? "Đang hủy..." : "Cancel delivery"}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("calculate")}
                  disabled={deliveryLoading}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="delivery-calculate-offers"
                >
                  {deliveryLoading ? "Đang tính..." : "Calculate offers"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("create")}
                  disabled={deliveryLoading || !canCreateDelivery}
                  className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="delivery-create-shipment"
                >
                  {deliveryOffers.find((offer) => offer.id === selectedOfferId)
                    ?.provider === "YANDEX"
                    ? "Create claim"
                    : "Create shipment"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("accept")}
                  disabled={
                    deliveryLoading ||
                    !activeShipment ||
                    activeShipment.provider !== "YANDEX"
                  }
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Accept claim
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("refresh")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="delivery-refresh-shipment"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("cancel")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deliveryLoading ? "Đang hủy..." : "Cancel"}
                </button>
              </div>

              <div
                className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4"
                data-testid="delivery-exception-panel"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Report delivery problem
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Reason code">
                    <select
                      value={exceptionReasonCode}
                      onChange={(event) =>
                        setExceptionReasonCode(
                          event.target.value as DeliveryExceptionReasonCode,
                        )
                      }
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid="delivery-exception-reason"
                    >
                      {exceptionReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Customer message">
                    <textarea
                      value={exceptionCustomerMessage}
                      onChange={(event) =>
                        setExceptionCustomerMessage(event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid="delivery-exception-customer-message"
                    />
                  </Field>
                  <Field label="Reason note">
                    <textarea
                      value={exceptionReasonText}
                      onChange={(event) =>
                        setExceptionReasonText(event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid="delivery-exception-note"
                    />
                  </Field>
                  <Field label="Internal comment">
                    <textarea
                      value={internalComment}
                      onChange={(event) =>
                        setInternalComment(event.target.value)
                      }
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid="delivery-internal-comment"
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleReportProblem()}
                    disabled={
                      deliveryLoading ||
                      !activeShipment ||
                      activeShipment.internalStatus === "DELIVERED"
                    }
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="delivery-report-problem"
                  >
                    {deliveryLoading ? "Đang gửi..." : "Submit problem"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddInternalComment()}
                    disabled={
                      deliveryLoading ||
                      !activeShipment ||
                      !internalComment.trim()
                    }
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="delivery-add-internal-comment"
                  >
                    {deliveryLoading ? "Đang gửi..." : "Add internal comment"}
                  </button>
                </div>
              </div>

              {deliveryMessage ? (
                <div
                  className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  data-testid="delivery-action-message"
                >
                  {deliveryMessage}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Current shipment
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Metric
                  label="Provider"
                  value={
                    activeShipment?.provider ??
                    order.delivery?.provider ??
                    "Not created"
                  }
                  testId="seller-delivery-provider"
                />
                <Metric
                  label="Status"
                  value={
                    activeShipment?.internalStatus ??
                    order.delivery?.status ??
                    "Not created"
                  }
                  testId="seller-delivery-status"
                />
                <Metric
                  label="Shipment id"
                  value={
                    activeShipment?.providerShipmentId ??
                    order.delivery?.providerShipmentId ??
                    "Not assigned"
                  }
                />
                <Metric
                  label="Tracking"
                  value={
                    activeShipment?.trackingNumber ??
                    order.delivery?.trackingNumber ??
                    "Not assigned"
                  }
                />
                <Metric
                  label="Courier"
                  value={
                    activeShipment?.courierPhone ??
                    order.delivery?.courierPhone ??
                    "Not assigned"
                  }
                />
                <Metric
                  label="ETA"
                  value={
                    activeShipment?.estimatedDeliveryAt
                      ? new Date(
                          activeShipment.estimatedDeliveryAt,
                        ).toLocaleString()
                      : "Not assigned"
                  }
                />
              </div>
              {activeShipment?.deliveryNote ? (
                <p
                  className="text-sm text-[var(--muted)]"
                  data-testid="seller-delivery-note"
                >
                  {activeShipment.deliveryNote}
                </p>
              ) : null}
              {activeShipment?.failureReasonCode ? (
                <div
                  className="rounded-[1rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                  data-testid="seller-delivery-exception"
                >
                  <p className="font-semibold">
                    {activeShipment.failureReasonCode}
                  </p>
                  <p className="mt-1">
                    {activeShipment.customerVisibleMessage ??
                      activeShipment.failureReasonText ??
                      "No customer message set."}
                  </p>
                </div>
              ) : null}
              {activeShipment?.trackingUrl || order.delivery?.trackingUrl ? (
                <a
                  href={
                    activeShipment?.trackingUrl ??
                    order.delivery?.trackingUrl ??
                    "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
                  data-testid="seller-delivery-tracking-link"
                >
                  Open tracking link
                </a>
              ) : null}
              <div className="space-y-3">
                {deliveryOffers.length ? (
                  deliveryOffers.map((offer) => (
                    <article
                      key={offer.id}
                      className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
                      data-testid="delivery-offer-row"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {offer.offerType}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Provider: {offer.provider}
                          </p>
                          {offer.isRecommended ? (
                            <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Recommended
                            </span>
                          ) : null}
                        </div>
                        <div className="text-right text-sm text-[var(--foreground)]">
                          <p>
                            {offer.priceAmount} {offer.priceCurrency}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {offer.estimatedMinDays !== null &&
                            offer.estimatedMaxDays !== null
                              ? `${offer.estimatedMinDays}-${offer.estimatedMaxDays} day(s)`
                              : "ETA unavailable"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No delivery offers loaded yet.
                  </p>
                )}
              </div>
              {delivery?.events.length ? (
                <div className="space-y-3 border-t border-[var(--border)] pt-4">
                  {delivery.events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                          {event.eventType}
                        </span>
                        <p className="text-xs text-[var(--muted)]">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[var(--foreground)]">
                        {event.message ?? event.providerStatus ?? "No message"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
              {delivery?.comments.length ? (
                <div
                  className="space-y-3 border-t border-[var(--border)] pt-4"
                  data-testid="seller-delivery-comments"
                >
                  {delivery.comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--foreground)]">
                          {comment.visibility}
                        </span>
                        <p className="text-xs text-[var(--muted)]">
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[var(--foreground)]">
                        {comment.message}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Items"
        title="Ordered products"
        description="Snapshot data is taken from the legacy order records so seller support sees exactly what the customer bought."
      >
        {order.returnRefundCases?.length ? (
          <div className="mb-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5" data-testid="seller-order-active-return-cases">
            <p className="text-sm font-semibold text-[var(--foreground)]">Active return / refund cases</p>
            <div className="mt-3 grid gap-3">
              {order.returnRefundCases.map((entry) => (
                <Link key={entry.id} href={`/seller/returns/${entry.id}`} className="rounded-[1.25rem] border border-[var(--border)] bg-white px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-[var(--foreground)]">{labelForReturnType(entry.type)}</span>
                    <span className="text-[var(--muted)]">{labelForReturnStatus(entry.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid gap-4">
          {order.items.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 md:grid-cols-[96px_1fr_160px]"
            >
              <div className="overflow-hidden rounded-2xl bg-[var(--panel)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    item.productImageSnapshot ??
                    "https://placehold.co/160x160?text=No+Image"
                  }
                  alt={item.productTitleSnapshot}
                  className="h-24 w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {item.productTitleSnapshot}
                </p>
                {item.variantNameSnapshot ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Variant: {item.variantNameSnapshot}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Slug: {item.productSlugSnapshot}
                </p>
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>Qty: {item.quantity}</p>
                <p className="mt-1">
                  Unit: {item.unitPrice ?? item.priceAtPurchase}
                </p>
                <p className="mt-1">Line: {item.lineTotal}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 text-sm font-semibold text-[var(--foreground)]"
        data-testid={testId}
      >
        {value}
      </p>
    </div>
  );
}

function formatNextAction(nextAction: string | null) {
  const labels: Record<string, string> = {
    review_payment_proof: "Confirm or reject payment proof",
    accept_pay_on_delivery_order: "Accept COD order",
    create_yandex_delivery: "Create Yandex manually",
    prepare_order: "Prepare the order",
    continue_preparing: "Continue preparing",
    mark_picked_up: "Mark picked up",
    mark_on_the_way: "Mark on the way",
    mark_delivered: "Mark delivered",
    confirm_delivery_payment: "Confirm final payment",
    wait_for_delivery_payment: "Wait for buyer payment",
    resolve_delivery_payment_issue: "Resolve payment dispute",
    review_payment_issue: "Resolve payment issue",
    wait_for_payment: "Wait for payment",
    monitor_delivery: "Monitor delivery",
    review_order: "Review order detail",
  };

  return nextAction ? labels[nextAction] ?? nextAction : "No action";
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
