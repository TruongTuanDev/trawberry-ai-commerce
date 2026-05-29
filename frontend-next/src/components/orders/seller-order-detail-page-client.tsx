"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { labelForReturnStatus, labelForReturnType } from "@/components/returns/return-refund-utils";
import { SectionCard } from "@/components/seller/section-card";
import { useI18n } from "@/i18n/use-i18n";
import {
  DEFAULT_SHIPPING_LABEL_SIZE,
  calculateDeliveryOffers,
  acceptDeliveryShipment,
  addDeliveryComment,
  cancelDeliveryShipment,
  confirmPayment,
  createDeliveryShipment,
  createManualDelivery,
  getDeliverySettings,
  getOrderDelivery,
  getSellerOrderById,
  getShopOrderById,
  markManualDeliveryCourierAssigned,
  markManualDeliveryDelivered,
  markManualDeliveryFailed,
  markManualDeliveryInTransit,
  markManualDeliveryPickedUp,
  refreshDeliveryShipment,
  rejectPayment,
  normalizeShippingLabelSize,
  SHIPPING_LABEL_SIZE_OPTIONS,
  SHIPPING_LABEL_SIZE_STORAGE_KEY,
  updateShopOrderStatus,
  updateManualDelivery,
  type DeliveryDetail,
  type DeliveryOffer,
  type DeliveryProviderName,
  type DeliveryExceptionReasonCode,
  type SellerOrderListItem,
  type ShippingLabelSize,
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
const knownPaymentMethodKeys: Record<string, string> = {
  PREPAID_SELLER_QR: "seller.orderDetail.directSellerPayment",
  PAY_ON_DELIVERY_SELLER_QR: "seller.orderDetail.payOnDeliverySellerQr",
};

export function SellerOrderDetailPageClient({ orderId }: { orderId: string }) {
  const { t } = useI18n("seller");
  const user = useAuthStore((state) => state.sellerUser);
  const hydrated = useSellerWorkspaceStore((state) => state.hydrated);
  const hydrateWorkspace = useSellerWorkspaceStore((state) => state.hydrate);
  const currentShopId = useSellerWorkspaceStore((state) => state.currentShopId);
  const selectShop = useSellerWorkspaceStore((state) => state.selectShop);
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
  const [deliveryActionStatus, setDeliveryActionStatus] = useState<string | null>(null);
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
  const [shippingLabelSize, setShippingLabelSize] = useState<ShippingLabelSize>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SHIPPING_LABEL_SIZE;
    }

    return normalizeShippingLabelSize(
      window.localStorage.getItem(SHIPPING_LABEL_SIZE_STORAGE_KEY),
    );
  });
  const isPayOnDeliverySellerQr =
    order?.shippingMethodName === "PAY_ON_DELIVERY_SELLER_QR";

  useEffect(() => {
    hydrateWorkspace();
  }, [hydrateWorkspace]);

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
      if (!user || !hydrated) {
        return;
      }

      try {
        let orderResult: SellerOrderListItem;
        if (currentShopId) {
          try {
            orderResult = await getShopOrderById(currentShopId, orderId, "");
          } catch {
            orderResult = await getSellerOrderById(orderId, "");
          }
        } else {
          orderResult = await getSellerOrderById(orderId, "");
        }
        const shopId = orderResult.shopId;
        const deliveryResult = await getOrderDelivery(shopId, orderId, "").catch(
          () => null,
        );
        if (!mounted) return;
        setOrder(orderResult);
        if (shopId && shopId !== useSellerWorkspaceStore.getState().currentShopId) {
          selectShop(shopId);
        }
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
          const settings = await getDeliverySettings(shopId, "");
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
            err instanceof Error ? err.message : t("seller.orderDetail.errorDescription"),
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
  }, [currentShopId, hydrated, orderId, selectShop, t, user]);

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
      successMessage: t("seller.orderDetail.messages.orderStatusUpdated"),
      errorMessage: t("seller.orderDetail.messages.orderStatusUpdateFailed"),
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
      if (!window.confirm(t("seller.orderDetail.messages.confirmRejectDeliveryPayment"))) return;
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
          ? t("seller.orderDetail.messages.paymentConfirmed")
          : t("seller.orderDetail.messages.paymentDisputed"),
      errorMessage: t("seller.orderDetail.messages.paymentUpdateFailed"),
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
      setError(t("seller.orderDetail.messages.pickupAddressRequired"));
      return;
    }

    if (action === "cancel" && !delivery?.activeShipment) {
      setError(t("seller.orderDetail.messages.noActiveShipmentToCancel"));
      return;
    }

    if (action === "cancel") {
      if (!window.confirm(t("seller.orderDetail.messages.confirmCancelBatch"))) return;
    }

    setError(null);
    setDeliveryMessage(null);
    setDeliveryActionStatus(null);

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
          setDeliveryMessage(
            t("seller.orderDetail.messages.loadedOffers", { count: result.offers.length }),
          );
          setDeliveryActionStatus("calculated");
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
          setDeliveryMessage(
            t("seller.orderDetail.messages.deliveryShipmentCreated"),
          );
          setDeliveryActionStatus("created");
        } else if (action === "accept") {
          if (!delivery?.activeShipment) {
            throw new Error(t("seller.orderDetail.messages.noActiveShipmentToAccept"));
          }
          await acceptDeliveryShipment(
            currentShopId,
            order.id,
            delivery.activeShipment.id,
            "",
          );
          setDeliveryMessage(
            t("seller.orderDetail.messages.deliveryShipmentAccepted"),
          );
          setDeliveryActionStatus("accepted");
        } else if (action === "refresh") {
          if (!delivery?.activeShipment) {
            throw new Error(t("seller.orderDetail.messages.noActiveShipmentToRefresh"));
          }
          await refreshDeliveryShipment(
            currentShopId,
            order.id,
            delivery.activeShipment.id,
            "",
          );
          setDeliveryMessage(
            t("seller.orderDetail.messages.deliveryShipmentRefreshed"),
          );
          setDeliveryActionStatus("refreshed");
        } else {
          await cancelDeliveryShipment(
            currentShopId,
            order.id,
            delivery!.activeShipment!.id,
            { reason: "Seller cancelled shipment from the order detail page." },
            "",
          );
          setDeliveryMessage(
            t("seller.orderDetail.messages.deliveryShipmentCancelled"),
          );
          setDeliveryActionStatus("cancelled");
        }
        await refreshDeliverySnapshot();
      },
      successMessage: action === "calculate" ? undefined : t("seller.orderDetail.messages.deliveryUpdated"),
      errorMessage: t("seller.orderDetail.messages.deliveryActionFailed"),
    }).catch(() => {});
  };

  const handleManualDeliveryAction = async (
    action: "save" | "courier-assigned" | "picked-up" | "in-transit" | "delivered" | "cancel",
  ) => {
    if (!currentShopId || !order) return;
    if (action === "delivered") {
      if (!window.confirm(t("seller.orderDetail.messages.confirmDeliverySuccess"))) return;
    }
    if (action === "cancel") {
      if (!window.confirm(t("seller.orderDetail.messages.confirmCancelManualDelivery"))) return;
    }
    setError(null);
    setDeliveryMessage(null);
    setDeliveryActionStatus(null);
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
            setDeliveryMessage(
              t("seller.orderDetail.messages.deliverySaved") || "Manual delivery updated.",
            );
            setDeliveryActionStatus("updated");
          } else {
            await createManualDelivery(
              currentShopId,
              order.id,
              buildManualPayload(),
              "",
            );
            setDeliveryMessage(
              t("seller.orderDetail.messages.deliverySaved") || "Manual delivery saved.",
            );
            setDeliveryActionStatus("saved");
          }
        } else {
          if (!activeShipment) throw new Error(t("seller.orderDetail.messages.noManualDeliveryYet"));
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
            setDeliveryMessage(
              t("seller.orderDetail.messages.manualDeliveryOnTheWay"),
            );
            setDeliveryActionStatus("transit");
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
            setDeliveryMessage(
              t("seller.orderDetail.messages.manualDeliveryCourierAssigned"),
            );
            setDeliveryActionStatus("courier-assigned");
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
            setDeliveryMessage(
              t("seller.orderDetail.messages.manualDeliveryPickedUp"),
            );
            setDeliveryActionStatus("picked-up");
          } else if (action === "delivered") {
            await markManualDeliveryDelivered(
              currentShopId,
              order.id,
              activeShipment.id,
              { note: "Seller marked manual delivery delivered." },
              "",
            );
            setDeliveryMessage(
              t("seller.orderDetail.messages.manualDeliveryDelivered"),
            );
            setDeliveryActionStatus("delivered");
          } else {
            await cancelDeliveryShipment(
              currentShopId,
              order.id,
              activeShipment.id,
              { reason: "Seller cancelled manual delivery." },
              "",
            );
            setDeliveryMessage(
              t("seller.orderDetail.messages.manualDeliveryCancelled"),
            );
            setDeliveryActionStatus("cancelled");
          }
        }
        await refreshDeliverySnapshot();
      },
      successMessage: action === "save" ? t("seller.orderDetail.messages.deliverySaved") : t("seller.orderDetail.messages.deliveryUpdated"),
      errorMessage: t("seller.orderDetail.messages.manualDeliveryFailed"),
    }).catch(() => {});
  };

  const handleReportProblem = async () => {
    if (!currentShopId || !order || !activeShipment) return;
    setError(null);
    setDeliveryMessage(null);
    setDeliveryActionStatus(null);
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
        setDeliveryMessage(
          t("seller.orderDetail.messages.deliveryProblemReported") || "Delivery problem reported.",
        );
        setDeliveryActionStatus("problem-reported");
        await refreshDeliverySnapshot();
      },
      successMessage: t("seller.orderDetail.messages.deliveryProblemReported"),
      errorMessage: t("seller.orderDetail.messages.deliveryProblemFailed"),
    }).catch(() => {});
  };

  const handleAddInternalComment = async () => {
    if (!currentShopId || !order || !activeShipment || !internalComment.trim())
      return;
    setError(null);
    setDeliveryMessage(null);
    setDeliveryActionStatus(null);
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
        setDeliveryMessage(
          t("seller.orderDetail.messages.internalNoteAdded") || "Internal delivery comment added.",
        );
        setDeliveryActionStatus("comment-added");
        await refreshDeliverySnapshot();
      },
      successMessage: t("seller.orderDetail.messages.internalNoteAdded"),
      errorMessage: t("seller.orderDetail.messages.internalNoteFailed"),
    }).catch(() => {});
  };

  if (loading) {
    return (
      <SectionCard
        eyebrow={t("seller.orderDetail.eyebrow")}
        title={t("seller.orderDetail.loadingTitle")}
        description={t("seller.orderDetail.loadingDescription")}
      >
        <p className="text-sm text-[var(--muted)]">{t("seller.results.loading")}</p>
      </SectionCard>
    );
  }

  if (error || !order) {
    return (
      <SectionCard
        eyebrow={t("seller.orderDetail.eyebrow")}
        title={t("seller.orderDetail.errorTitle")}
        description={t("seller.orderDetail.errorDescription")}
      >
        <p className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {error ?? t("seller.orderDetail.notFound")}
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
    (order.dropoffNoEntrance ? t("seller.orderDetail.noPrivateEntrance") : null);
  const intercomValue = activeShipment?.dropoffIntercom ?? order.dropoffIntercom ?? null;
  const floorValue =
    activeShipment?.dropoffFloor ??
    order.dropoffFloor ??
    (order.dropoffNoFloor ? t("seller.orderDetail.noFloorUnknown") : null);
  const apartmentValue =
    activeShipment?.dropoffApartment ??
    order.dropoffApartment ??
    (order.dropoffNoApartment ? t("seller.orderDetail.noApartment") : null);
  const dropoffComment = [
    entranceValue ? t("seller.orderDetail.entranceLine", { value: entranceValue }) : null,
    intercomValue ? t("seller.orderDetail.intercomLine", { value: intercomValue }) : null,
    floorValue ? t("seller.orderDetail.floorLine", { value: floorValue }) : null,
    apartmentValue ? t("seller.orderDetail.apartmentLine", { value: apartmentValue }) : null,
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
    t("seller.orderDetail.senderSummary.pickup", {
      value: activeShipment?.pickupAddressFullName ?? pickupAddress,
    }),
    pickupLat !== null && pickupLng !== null
      ? t("seller.orderDetail.senderSummary.gps", { value: `${pickupLat}, ${pickupLng}` })
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const recipientText = [
    t("seller.orderDetail.recipientSummary.recipient", {
      value: `${order.customer.name}, ${order.customer.phone}`,
    }),
    t("seller.orderDetail.recipientSummary.address", { value: dropoffAddressFullName }),
    entranceValue ? t("seller.orderDetail.recipientSummary.entrance", { value: entranceValue }) : null,
    intercomValue ? t("seller.orderDetail.recipientSummary.doorCode", { value: intercomValue }) : null,
    floorValue ? t("seller.orderDetail.recipientSummary.floor", { value: floorValue }) : null,
    apartmentValue ? t("seller.orderDetail.recipientSummary.apartment", { value: apartmentValue }) : null,
    dropoffCommentNote ? t("seller.orderDetail.recipientSummary.comment", { value: dropoffCommentNote }) : null,
    dropoffLat !== null && dropoffLng !== null
      ? t("seller.orderDetail.recipientSummary.coordinates", { value: `${dropoffLat}, ${dropoffLng}` })
      : null,
  ].filter(Boolean).join("\n");
  const packageText = [
    t("seller.orderDetail.packageSummary.package", {
      preset: formatPackagePreset(packagePreset, t),
      weight: weightGram,
      length: lengthCm,
      width: widthCm,
      height: heightCm,
    }),
    t("seller.orderDetail.packageSummary.declaredValue", { value: order.totalAmount }),
    t("seller.orderDetail.packageSummary.items", { count: order.itemsCount }),
  ].join("\n");
  const fullYandexBlock = [
    `ORDER: ${order.orderNumber}`,
    t("seller.orderDetail.recipientSummary.recipient", {
      value: `${order.customer.name}, ${order.customer.phone}`,
    }),
    t("seller.orderDetail.recipientSummary.address", { value: dropoffAddressFullName }),
    t("seller.orderDetail.recipientSummary.entrance", { value: entranceValue ?? "-" }),
    t("seller.orderDetail.recipientSummary.doorCode", { value: intercomValue ?? "-" }),
    t("seller.orderDetail.recipientSummary.floor", { value: floorValue ?? "-" }),
    t("seller.orderDetail.recipientSummary.apartment", { value: apartmentValue ?? "-" }),
    t("seller.orderDetail.recipientSummary.comment", { value: dropoffCommentNote ?? "-" }),
    t("seller.orderDetail.recipientSummary.coordinates", {
      value: dropoffLat !== null && dropoffLng !== null ? `${dropoffLat}, ${dropoffLng}` : "-",
    }),
    t("seller.orderDetail.packageSummary.package", {
      preset: formatPackagePreset(packagePreset, t),
      weight: weightGram,
      length: lengthCm,
      width: widthCm,
      height: heightCm,
    }),
    t("seller.orderDetail.packageSummary.declaredValue", { value: order.totalAmount }),
  ].join("\n");
  const canCreateDelivery =
    order.paymentStatus === "PAID" ||
    order.paymentStatus === "SELLER_ACCEPTED_PAY_ON_DELIVERY";
  const copyToClipboard = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setDeliveryMessage(t("seller.orderDetail.messages.copied", { label }));
    setDeliveryActionStatus("copied");
  };
  const paymentMethodCode = order.paymentMethod ?? order.shippingMethodName;
  const paymentMethodValue =
    paymentMethodCode && knownPaymentMethodKeys[paymentMethodCode]
      ? t(knownPaymentMethodKeys[paymentMethodCode])
      : order.paymentMethodLabel ?? paymentMethodCode ?? t("common.notProvided");

  const openShippingLabel = (mode: "preview" | "print") => {
    const params = new URLSearchParams();
    params.set("size", shippingLabelSize);
    if (mode === "print") {
      params.set("print", "1");
    }
    const url = `/seller/orders/${orderId}/shipping-label?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleShippingLabelSizeChange = (nextSize: ShippingLabelSize) => {
    setShippingLabelSize(nextSize);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SHIPPING_LABEL_SIZE_STORAGE_KEY, nextSize);
    }
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
          {t("seller.orderDetail.backToOrders")}
        </Link>
        <Link
          href={`/seller/payments/${orderId}`}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          {t("seller.orderDetail.reviewPayment")}
        </Link>
        <Link
          href="/seller/settings"
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
        >
          {t("seller.orderDetail.deliverySettings")}
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          eyebrow={t("seller.orderDetail.eyebrow")}
          title={order.orderNumber}
          description={t("seller.orderDetail.orderDescription")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label={t("seller.orderDetail.customer")} value={order.customer.name} />
            <Metric label={t("seller.payments.columns.buyer")} value={order.customer.phone} />
            <Metric label={t("seller.payments.columns.products")} value={order.customer.email ?? t("sellerOrders.noEmail")} />
            <Metric label={t("seller.paymentDetail.total")} value={order.totalAmount} />
            <Metric
              label={t("seller.orderDetail.financeStatus")}
              value={order.sellerDisplayLabel}
              testId="seller-order-display-status"
              dataRawStatus={order.sellerDisplayStatus}
              dataBucket={order.sellerStatusBucket}
            />
            <Metric
              label={t("seller.orderDetail.nextAction")}
              value={formatNextAction(order.nextAction, t)}
              testId="seller-order-next-action"
              dataRawStatus={order.nextAction ?? undefined}
            />
            <Metric
              label={t("seller.paymentDetail.created")}
              value={new Date(order.createdAt).toLocaleString()}
            />
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("seller.orderDetail.status")}
              </p>
              <div className="mt-3" data-testid="seller-order-status">
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {t("seller.paymentDetail.payment")}
              </p>
              <div className="mt-3">
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
            <Metric
              label={t("seller.orderDetail.paymentMethod")}
              value={paymentMethodValue}
            />
            <Metric
              label={t("seller.orderDetail.finance")}
              value={
                order.finance?.ledgerStatus
                  ? `${order.finance.ledgerStatus} · ${t("seller.orderDetail.fee", { value: order.finance.commissionAmount ?? "0" })}`
                  : t("seller.orderDetail.ledgerPending")
              }
            />
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t("seller.orderDetail.shippingAddress")}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {dropoffAddressFullName}
            </p>
            {dropoffComment ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{dropoffComment}</p>
            ) : null}
            <p className="mt-3 text-xs text-[var(--muted)]">
              {t("seller.orderDetail.geoStatus", {
                value: activeShipment?.dropoffGeoPrecision ?? order.dropoffGeoPrecision ?? "UNKNOWN",
              })}
              {dropoffLat !== null && dropoffLng !== null ? ` · ${dropoffLat}, ${dropoffLng}` : ""}
            </p>
            {order.customerNote ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                {t("seller.orderDetail.customerNote", { value: order.customerNote })}
              </p>
            ) : null}
          </div>
          {order.paymentDetails ? (
            <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-white p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t("seller.orderDetail.paymentDestination")}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {paymentMethodValue}
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
                {t("seller.orderDetail.payOnDeliverySellerQr")}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {t("seller.orderDetail.payOnDeliveryDescription")}
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
                    {saving ? t("seller.orderDetail.actions.accepting") : t("seller.orderDetail.actions.acceptPayOnDelivery")}
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
                      {saving ? t("seller.orderDetail.actions.accepting") : t("seller.orderDetail.actions.paymentReceived")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeliveryPaymentDecision("reject")}
                      disabled={saving}
                      className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      data-testid="seller-reject-delivery-payment"
                    >
                      {saving ? t("seller.orderDetail.actions.rejecting") : t("seller.orderDetail.actions.paymentNotReceived")}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          eyebrow={t("seller.orderDetail.actionsEyebrow")}
          title={t("seller.orderDetail.fulfillmentStatus")}
          description={t("seller.orderDetail.fulfillmentDescription")}
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
                  {t(`common.status.order.${status}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleUpdateStatus()}
              disabled={saving}
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? t("seller.orderDetail.actions.updating") : t("seller.orderDetail.actions.updateStatus")}
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
        eyebrow={t("seller.orderDetail.deliveryEyebrow")}
        title={t("seller.orderDetail.yandexHandoffTitle")}
        description={t("seller.orderDetail.yandexHandoffDescription")}
      >
        <div data-testid="seller-order-delivery-section">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              {order.latestYandexReminder ? (
                <div
                  className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  data-testid="seller-yandex-reminder-banner"
                >
                  {t("seller.orderDetail.adminReminder")}
                  <span className="ml-2 text-xs text-amber-700">
                    {new Date(order.latestYandexReminder.createdAt).toLocaleString()}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("seller.orderDetail.manualProvider")}>
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
                    <option value="YANDEX">{t("seller.orderDetail.providers.YANDEX")}</option>
                    <option value="CDEK">{t("seller.orderDetail.providers.CDEK")}</option>
                    <option value="MANUAL">{t("seller.orderDetail.providers.MANUAL")}</option>
                  </select>
                </Field>
                <Field label={t("seller.orderDetail.actions.yandexWaybill")}>
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
                <Field label={t("seller.orderDetail.yandexClaimId")}>
                  <input
                    value={manualYandexClaimId}
                    onChange={(event) =>
                      setManualYandexClaimId(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-yandex-claim-id"
                  />
                </Field>
                <Field label={t("seller.orderDetail.trackingNumber")}>
                  <input
                    value={manualTrackingNumber}
                    onChange={(event) =>
                      setManualTrackingNumber(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-tracking-number"
                  />
                </Field>
                <Field label={t("seller.orderDetail.trackingUrl")}>
                  <input
                    value={manualTrackingUrl}
                    onChange={(event) =>
                      setManualTrackingUrl(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-tracking-url"
                  />
                </Field>
                <Field label={t("seller.orderDetail.courierName")}>
                  <input
                    value={manualCourierName}
                    onChange={(event) =>
                      setManualCourierName(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-courier-name"
                  />
                </Field>
                <Field label={t("seller.orderDetail.courierPhone")}>
                  <input
                    value={manualCourierPhone}
                    onChange={(event) =>
                      setManualCourierPhone(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-courier-phone"
                  />
                </Field>
                <Field label={t("seller.orderDetail.deliveryPrice")}>
                  <input
                    value={manualDeliveryPrice}
                    onChange={(event) =>
                      setManualDeliveryPrice(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-price"
                  />
                </Field>
                <Field label={t("seller.orderDetail.estimatedDelivery")}>
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
                <Field label={t("seller.orderDetail.deliveryNote")}>
                  <input
                    value={manualDeliveryNote}
                    onChange={(event) =>
                      setManualDeliveryNote(event.target.value)
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="manual-delivery-note"
                  />
                </Field>
                <Field label={t("seller.orderDetail.pickupAddress")}>
                  <input
                    value={pickupAddress}
                    onChange={(event) => setPickupAddress(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-pickup-address"
                  />
                </Field>
                <Field label={t("seller.orderDetail.packagePreset")}>
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
                    {Object.entries(fashionPackagePresets).map(([value]) => (
                      <option key={value} value={value}>
                        {formatPackagePreset(value as keyof typeof fashionPackagePresets, t)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("seller.orderDetail.weightGram")}>
                  <input
                    value={weightGram}
                    onChange={(event) => setWeightGram(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-weight-gram"
                  />
                </Field>
                <Field label={t("seller.orderDetail.lengthCm")}>
                  <input
                    value={lengthCm}
                    onChange={(event) => setLengthCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-length-cm"
                  />
                </Field>
                <Field label={t("seller.orderDetail.widthCm")}>
                  <input
                    value={widthCm}
                    onChange={(event) => setWidthCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-width-cm"
                  />
                </Field>
                <Field label={t("seller.orderDetail.heightCm")}>
                  <input
                    value={heightCm}
                    onChange={(event) => setHeightCm(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-order-height-cm"
                  />
                </Field>
                <Field label={t("seller.orderDetail.selectedOffer")}>
                  <select
                    value={selectedOfferId}
                    onChange={(event) => setSelectedOfferId(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="delivery-offer-select"
                  >
                    <option value="">{t("seller.orderDetail.useDefaultCarrier")}</option>
                    {deliveryOffers.map((offer) => (
                      <option key={offer.id} value={offer.id}>
                        {offer.isRecommended ? `${t("seller.orderDetail.recommended")} · ` : ""}
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
                    {pickupReady ? t("seller.orderDetail.pickupReady") : t("seller.orderDetail.missingPickupCoordinates")}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${dropoffReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {dropoffReady ? t("seller.orderDetail.dropoffReady") : t("seller.orderDetail.missingDropoffCoordinates")}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${yandexApiReady ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>
                    {yandexApiReady ? t("seller.orderDetail.apiReady") : yandexManualReady ? t("seller.orderDetail.manualOnly") : t("seller.orderDetail.needsAddressFixes")}
                  </span>
                  {!pickupReady || !dropoffReady ? (
                    <span className="text-xs text-amber-700">
                      {t("seller.orderDetail.verifyCoordinatesWarning")}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                    <span>{t("seller.shippingLabel.labelSize")}</span>
                    <select
                      value={shippingLabelSize}
                      onChange={(event) =>
                        handleShippingLabelSizeChange(
                          normalizeShippingLabelSize(event.target.value),
                        )
                      }
                      className="bg-transparent text-sm outline-none"
                      data-testid="seller-shipping-label-size-select"
                    >
                      {SHIPPING_LABEL_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {t(`seller.shippingLabel.sizes.${option}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => openShippingLabel("print")}
                    className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                    data-testid="seller-print-shipping-label"
                  >
                    {t("seller.shippingLabel.print")}
                  </button>
                  <button
                    type="button"
                    onClick={() => openShippingLabel("preview")}
                    className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold"
                    data-testid="seller-open-shipping-label"
                  >
                    {t("seller.shippingLabel.openPrintableLabel")}
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(senderText, t("seller.orderDetail.sender"))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    {t("seller.orderDetail.copySender")}
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(recipientText, t("seller.orderDetail.recipient"))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    {t("seller.orderDetail.copyRecipient")}
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(dropoffAddressFullName, t("seller.orderDetail.address"))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    {t("seller.orderDetail.copyAddress")}
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(dropoffComment || t("seller.orderDetail.noExtraCourierDetails"), t("seller.orderDetail.courierDetails"))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold">
                    {t("seller.orderDetail.copyCourierDetails")}
                  </button>
                  <button type="button" onClick={() => void copyToClipboard(fullYandexBlock, t("seller.orderDetail.fullYandexBlock"))} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold" data-testid="copy-full-delivery-block">
                    {t("seller.orderDetail.copyFullYandexBlock")}
                  </button>
                  <button type="button" onClick={() => openMaps(pickupLat, pickupLng)} disabled={pickupLat === null || pickupLng === null} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    {t("seller.orderDetail.openPickupMap")}
                  </button>
                  <button type="button" onClick={() => openMaps(dropoffLat, dropoffLng)} disabled={dropoffLat === null || dropoffLng === null} className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    {t("seller.orderDetail.openDropoffMap")}
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
                  {deliveryLoading ? t("seller.orderDetail.actions.saving") : t("seller.orderDetail.actions.saveDelivery")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("courier-assigned")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-courier-assigned"
                >
                  {deliveryLoading ? t("seller.orderDetail.actions.updating") : t("seller.orderDetail.actions.courierAssigned")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("picked-up")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-picked-up"
                >
                  {deliveryLoading ? t("seller.orderDetail.actions.updating") : t("seller.orderDetail.actions.pickedUp")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("in-transit")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-in-transit"
                >
                  {deliveryLoading ? t("seller.orderDetail.actions.updating") : t("seller.orderDetail.actions.onTheWay")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualDeliveryAction("delivered")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="manual-delivery-mark-delivered"
                >
                  {deliveryLoading ? t("seller.orderDetail.actions.updating") : t("seller.orderDetail.actions.markDelivered")}
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
                  {deliveryLoading ? t("seller.orderDetail.actions.cancelling") : t("seller.orderDetail.actions.cancelDelivery")}
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
                  {deliveryLoading ? t("seller.orderDetail.actions.calculating") : t("seller.orderDetail.actions.calculateOffers")}
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
                    ? t("seller.orderDetail.createClaim")
                    : t("seller.orderDetail.createShipment")}
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
                  {t("seller.orderDetail.acceptClaim")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("refresh")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="delivery-refresh-shipment"
                >
                  {t("seller.orderDetail.refreshShipment")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeliveryAction("cancel")}
                  disabled={deliveryLoading || !activeShipment}
                  className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deliveryLoading ? t("seller.orderDetail.actions.cancelling") : t("seller.orderDetail.actions.cancel")}
                </button>
              </div>

              <div
                className="rounded-[1.25rem] border border-[var(--border)] bg-white p-4"
                data-testid="delivery-exception-panel"
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {t("seller.orderDetail.reportProblem")}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label={t("seller.orderDetail.reasonCode")}>
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
                          {formatExceptionReason(reason, t)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("seller.orderDetail.customerMessage")}>
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
                  <Field label={t("seller.orderDetail.reasonNote")}>
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
                  <Field label={t("seller.orderDetail.internalComment")}>
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
                    {deliveryLoading ? t("seller.orderDetail.actions.sending") : t("seller.orderDetail.actions.submitProblem")}
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
                    {deliveryLoading ? t("seller.orderDetail.actions.sending") : t("seller.orderDetail.actions.addInternalComment")}
                  </button>
                </div>
              </div>

              {deliveryMessage ? (
                <div
                  className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                  data-testid="delivery-action-message"
                  data-status={deliveryActionStatus ?? undefined}
                  data-raw-status={deliveryActionStatus ?? undefined}
                >
                  {deliveryMessage}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t("seller.orderDetail.currentShipment")}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Metric
                  label={t("seller.orderDetail.provider")}
                  value={
                    formatDeliveryProvider(activeShipment?.provider ?? order.delivery?.provider ?? null, t)
                  }
                  testId="seller-delivery-provider"
                />
                <Metric
                  label={t("seller.orderDetail.status")}
                  value={
                    formatDeliveryStatus(activeShipment?.internalStatus ?? order.delivery?.status ?? null, t)
                  }
                  testId="seller-delivery-status"
                  dataRawStatus={activeShipment?.internalStatus ?? order.delivery?.status ?? undefined}
                />
                <Metric
                  label={t("seller.orderDetail.shipmentId")}
                  value={
                    activeShipment?.providerShipmentId ??
                    order.delivery?.providerShipmentId ??
                    t("seller.orderDetail.notAssigned")
                  }
                />
                <Metric
                  label={t("seller.orderDetail.tracking")}
                  value={
                    activeShipment?.trackingNumber ??
                    order.delivery?.trackingNumber ??
                    t("seller.orderDetail.notAssigned")
                  }
                />
                <Metric
                  label={t("seller.orderDetail.courier")}
                  value={
                    activeShipment?.courierPhone ??
                    order.delivery?.courierPhone ??
                    t("seller.orderDetail.notAssigned")
                  }
                />
                <Metric
                  label={t("seller.orderDetail.eta")}
                  value={
                    activeShipment?.estimatedDeliveryAt
                      ? new Date(
                          activeShipment.estimatedDeliveryAt,
                        ).toLocaleString()
                      : t("seller.orderDetail.notAssigned")
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
                      t("seller.orderDetail.noCustomerMessage")}
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
                  {t("seller.orderDetail.openTrackingLink")}
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
                            {t("seller.orderDetail.provider")}: {formatDeliveryProvider(offer.provider, t)}
                          </p>
                          {offer.isRecommended ? (
                            <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {t("seller.orderDetail.recommended")}
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
                              ? t("seller.orderDetail.offerEtaDays", { min: offer.estimatedMinDays, max: offer.estimatedMaxDays })
                              : t("seller.orderDetail.etaUnavailable")}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    {t("seller.orderDetail.noDeliveryOffers")}
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
                        {event.message ?? event.providerStatus ?? t("seller.orderDetail.noMessage")}
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
                          {formatCommentVisibility(comment.visibility, t)}
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
        eyebrow={t("seller.orderDetail.itemsEyebrow")}
        title={t("seller.orderDetail.itemsTitle")}
        description={t("seller.orderDetail.itemsDescription")}
      >
        {order.returnRefundCases?.length ? (
          <div className="mb-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-5" data-testid="seller-order-active-return-cases">
            <p className="text-sm font-semibold text-[var(--foreground)]">{t("seller.orderDetail.activeReturnCases")}</p>
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
                    {t("seller.orderDetail.variant", { value: item.variantNameSnapshot })}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {t("seller.orderDetail.slug", { value: item.productSlugSnapshot })}
                </p>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {t("sellerOrders.sku")}: <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.sellerSku || t("sellerOrders.skuNotSet")}</span>
                </p>
              </div>
              <div className="text-sm text-[var(--muted)] md:text-right">
                <p>{t("seller.orderDetail.qty", { value: item.quantity })}</p>
                <p className="mt-1">
                  {t("seller.orderDetail.unit", { value: item.unitPrice ?? item.priceAtPurchase })}
                </p>
                <p className="mt-1">{t("seller.orderDetail.line", { value: item.lineTotal })}</p>
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
  dataBucket,
  dataRawStatus,
}: {
  label: string;
  value: string;
  testId?: string;
  dataBucket?: string;
  dataRawStatus?: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 text-sm font-semibold text-[var(--foreground)]"
        data-testid={testId}
        data-bucket={dataBucket}
        data-raw-status={dataRawStatus}
      >
        {value}
      </p>
    </div>
  );
}

function formatNextAction(nextAction: string | null, t: (key: string) => string) {
  if (!nextAction) return t("seller.orderDetail.noAction");
  const key = `seller.orderDetail.nextActions.${nextAction}`;
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }
  return nextAction;
}

function formatPackagePreset(
  preset: keyof typeof fashionPackagePresets,
  t: (key: string) => string,
) {
  const key = `seller.orderDetail.packagePresets.${preset}`;
  const translated = t(key);
  return translated !== key ? translated : fashionPackagePresets[preset].label;
}

function formatExceptionReason(
  reason: DeliveryExceptionReasonCode,
  t: (key: string) => string,
) {
  const key = `seller.orderDetail.exceptionReasons.${reason}`;
  const translated = t(key);
  return translated !== key ? translated : reason;
}

function formatDeliveryProvider(provider: string | null, t: (key: string) => string) {
  if (!provider) return t("seller.orderDetail.notCreated");
  const key = `seller.orderDetail.providers.${provider}`;
  const translated = t(key);
  return translated !== key ? translated : provider;
}

function formatDeliveryStatus(status: string | null, t: (key: string) => string) {
  if (!status) return t("seller.orderDetail.notCreated");
  const key = `seller.orderDetail.deliveryStatuses.${status}`;
  const translated = t(key);
  return translated !== key ? translated : status;
}

function formatCommentVisibility(visibility: string, t: (key: string) => string) {
  const key = `seller.orderDetail.commentVisibility.${visibility}`;
  const translated = t(key);
  return translated !== key ? translated : visibility;
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
