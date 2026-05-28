"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import type { Locale } from "@/i18n/config";
import {
  normalizeShippingLabelPickupAddress,
  parseShippingLabelSystemNote,
} from "@/lib/shipping-label";

import type {
  DeliveryDetail,
  DeliverySettings,
  SellerOrderListItem,
  ShippingLabelSize,
} from "@/lib/seller-api";
import { useI18n } from "@/i18n/use-i18n";

type ShippingLabelPrintViewProps = {
  order: SellerOrderListItem;
  delivery: DeliveryDetail | null;
  deliverySettings: DeliverySettings | null;
  sellerContactPhone: string | null;
  trackingLookupUrl: string | null;
  size: ShippingLabelSize;
};

type ShippingLabelSizeMeta = {
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  fontSizePx: number;
  trackingFontPx: number;
  qrSizePx: number;
  barcodeHeightPx: number;
  gapMm: number;
  noteLines: number;
  itemLines: number;
  addressLines: number;
  compact: boolean;
};

export const SHIPPING_LABEL_SIZE_META: Record<
  ShippingLabelSize,
  ShippingLabelSizeMeta
> = {
  "75x120": {
    widthMm: 75,
    heightMm: 120,
    paddingMm: 3.4,
    fontSizePx: 7,
    trackingFontPx: 18.5,
    qrSizePx: 62,
    barcodeHeightPx: 23,
    gapMm: 1.05,
    noteLines: 1,
    itemLines: 1,
    addressLines: 1,
    compact: true,
  },
  "100x150": {
    widthMm: 100,
    heightMm: 150,
    paddingMm: 3.8,
    fontSizePx: 8.1,
    trackingFontPx: 26,
    qrSizePx: 84,
    barcodeHeightPx: 33,
    gapMm: 1.15,
    noteLines: 1,
    itemLines: 1,
    addressLines: 2,
    compact: false,
  },
  a6: {
    widthMm: 105,
    heightMm: 148,
    paddingMm: 3.9,
    fontSizePx: 8.2,
    trackingFontPx: 27,
    qrSizePx: 86,
    barcodeHeightPx: 34,
    gapMm: 1.15,
    noteLines: 1,
    itemLines: 1,
    addressLines: 2,
    compact: false,
  },
};

const knownPaymentMethodKeys: Record<string, string> = {
  PREPAID_SELLER_QR: "seller.orderDetail.directSellerPayment",
  PAY_ON_DELIVERY_SELLER_QR: "seller.orderDetail.payOnDeliverySellerQr",
};

function formatOptionalLine(label: string, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return `${label}: ${value}`;
}

function compactJoin(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" | ");
}

function getIntlLocale(locale: Locale) {
  switch (locale) {
    case "ru":
      return "ru-RU";
    case "vi":
      return "vi-VN";
    case "en":
    default:
      return "en-US";
  }
}

function mapLabelShipmentStatus(
  value: string | null | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  const normalized = value?.toUpperCase();

  switch (normalized) {
    case "FAILED":
      return t("seller.shippingLabel.statuses.failed");
    case "PENDING":
    case "NEW":
    case "NOT_CREATED":
      return t("seller.shippingLabel.statuses.created");
    case "READY_TO_CREATE_YANDEX":
    case "CREATED_WITH_YANDEX_ID":
    case "YANDEX_MANUAL_CREATED":
    case "CREATED":
    case "CREATED_MANUALLY":
    case "ACCEPTED":
    case "ASSEMBLING":
      return t("seller.shippingLabel.statuses.readyToShip");
    case "READY_FOR_HANDOFF":
      return t("seller.shippingLabel.statuses.readyForHandoff");
    case "COURIER_ASSIGNED":
    case "PICKED_UP":
    case "ON_THE_WAY":
    case "SHIPPING":
    case "IN_DELIVERY":
    case "IN_TRANSIT":
      return t("seller.shippingLabel.statuses.inTransit");
    case "DELIVERED":
      return t("seller.shippingLabel.statuses.delivered");
    case "CANCELLED":
      return t("seller.shippingLabel.statuses.cancelled");
    default:
      return t("common.unknown");
  }
}

function mapLabelPaymentStatus(
  value: string | null | undefined,
  t: ReturnType<typeof useI18n>["t"],
) {
  const normalized = value?.toUpperCase();

  switch (normalized) {
    case "PAID":
    case "SELLER_CONFIRMED_DELIVERY_PAYMENT":
    case "YANDEX_PAYMENT_ON_DELIVERY_PAID":
      return t("seller.shippingLabel.paymentStatuses.paid");
    case "APPROVED":
      return t("seller.shippingLabel.paymentStatuses.approved");
    case "PENDING":
    case "PAY_ON_DELIVERY_SELECTED":
    case "BUYER_MARKED_DELIVERY_PAID":
    case "ADMIN_REVIEW":
    case "PROOF_UPLOADED":
      return t("seller.shippingLabel.paymentStatuses.pending");
    case "UNPAID":
    case "REJECTED":
    case "SELLER_REJECTED":
      return t("seller.shippingLabel.paymentStatuses.unpaid");
    case "CANCELLED":
      return t("seller.shippingLabel.paymentStatuses.cancelled");
    default:
      return t("common.unknown");
  }
}

function isLabelPaymentConfirmed(paymentStatus: string) {
  return [
    "PAID",
    "APPROVED",
    "SELLER_CONFIRMED_DELIVERY_PAYMENT",
    "YANDEX_PAYMENT_ON_DELIVERY_PAID",
  ].includes(paymentStatus) || isPaymentConfirmed(paymentStatus);
}

function formatLabelDate(locale: Locale, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString(getIntlLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPaymentConfirmed(paymentStatus: string) {
  return [
    "ОПЛАЧЕНО",
    "ОДОБРЕНО",
    "ПРОДАВЕЦ ПОДТВЕРЖДИЛ ОПЛАТУ ДОСТАВКИ",
    "ОПЛАТА YANDEX ПРИ ДОСТАВКЕ ОПЛАЧЕНА",
  ].includes(paymentStatus);
}

function mapLabelProvider(
  value: string | null | undefined,
  hasYandexReference: boolean,
  t: ReturnType<typeof useI18n>["t"],
) {
  const normalized = value?.toUpperCase();

  if (hasYandexReference || normalized === "YANDEX") {
    return t("seller.shippingLabel.providerYandexDelivery");
  }

  if (!normalized || normalized === "MANUAL") {
    return t("seller.shippingLabel.providerManual");
  }

  return t("common.unknown");
}

export function ShippingLabelPrintView({
  order,
  delivery,
  deliverySettings,
  sellerContactPhone,
  trackingLookupUrl,
  size,
}: ShippingLabelPrintViewProps) {
  const { locale, t } = useI18n("seller");
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const activeShipment = delivery?.activeShipment;
  const meta = SHIPPING_LABEL_SIZE_META[size];
  const fallbackValue = t("common.notProvided");
  const localizedSellerManagedPickup = t(
    "seller.shippingLabel.pickupModes.sellerManaged",
  );
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const trackingCode =
    activeShipment?.trackingNumber ??
    activeShipment?.manualYandexOrderId ??
    order.orderNumber;
  const shipmentReference =
    activeShipment?.manualYandexOrderId ??
    activeShipment?.providerOrderNumber ??
    fallbackValue;
  const shipmentStatus = mapLabelShipmentStatus(
    activeShipment?.internalStatus ?? order.delivery?.status ?? order.status,
    t,
  );
  const providerLabel = mapLabelProvider(
    activeShipment?.provider,
    Boolean(activeShipment?.manualYandexOrderId),
    t,
  );
  const deliveryTypeLabel = t("seller.shippingLabel.deliveryTypes.express");
  const paymentMethodCode = order.paymentMethod ?? order.shippingMethodName ?? null;
  const paymentMethodLabel =
    paymentMethodCode && knownPaymentMethodKeys[paymentMethodCode]
      ? t(knownPaymentMethodKeys[paymentMethodCode])
      : order.paymentMethodLabel ?? t("common.unknown");
  const paymentStatusLabel = mapLabelPaymentStatus(order.paymentStatus, t);
  const paymentConfirmed = isLabelPaymentConfirmed(order.paymentStatus);
  const parsedSystemNote = parseShippingLabelSystemNote(
    activeShipment?.dropoffComment ??
      order.dropoffComment ??
      activeShipment?.customerVisibleMessage,
  );

  const noEntrance = activeShipment?.dropoffNoEntrance ?? order.dropoffNoEntrance;
  const noFloor = activeShipment?.dropoffNoFloor ?? order.dropoffNoFloor;
  const noApartment = activeShipment?.dropoffNoApartment ?? order.dropoffNoApartment;
  const codSellerQr =
    order.shippingMethodName === "PAY_ON_DELIVERY_SELLER_QR" ||
    order.paymentMethod === "PAY_ON_DELIVERY_SELLER_QR";
  const recipientAddress = compactJoin([
    activeShipment?.dropoffAddressFullName ??
      order.dropoffAddressFullName ??
      order.shippingAddress,
    order.dropoffCity ?? activeShipment?.dropoffCity,
  ]);
  const recipientAddressExtra = compactJoin([
    formatOptionalLine(
      t("seller.shippingLabel.fields.street"),
      order.dropoffStreet ?? activeShipment?.dropoffStreet,
    ),
    formatOptionalLine(
      t("seller.shippingLabel.fields.building"),
      order.dropoffBuilding ?? activeShipment?.dropoffBuilding,
    ),
  ]);
  const recipientPostalCode =
    activeShipment?.dropoffPostalCode ?? order.dropoffPostalCode ?? null;
  const recipientAccess = compactJoin([
    noEntrance || parsedSystemNote.noEntrance
      ? `${t("seller.shippingLabel.fields.entrance")}: ${t("seller.shippingLabel.noEntrance")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.entrance"),
          activeShipment?.dropoffEntrance ??
            order.dropoffEntrance ??
            parsedSystemNote.entrance,
        ),
    formatOptionalLine(
      t("seller.shippingLabel.fields.intercom"),
      activeShipment?.dropoffIntercom ??
        order.dropoffIntercom ??
        parsedSystemNote.intercom,
    ),
    noFloor || parsedSystemNote.noFloor
      ? `${t("seller.shippingLabel.fields.floor")}: ${t("seller.shippingLabel.noFloor")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.floor"),
          activeShipment?.dropoffFloor ??
            order.dropoffFloor ??
            parsedSystemNote.floor,
        ),
    noApartment || parsedSystemNote.noApartment
      ? `${t("seller.shippingLabel.fields.apartment")}: ${t("seller.shippingLabel.noApartment")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.apartment"),
          activeShipment?.dropoffApartment ??
            order.dropoffApartment ??
            parsedSystemNote.apartment,
        ),
  ]);
  const courierNote = parsedSystemNote.systemGenerated
    ? parsedSystemNote.remainderNote
    : activeShipment?.dropoffComment ??
      order.dropoffComment ??
      activeShipment?.customerVisibleMessage;
  const senderName = order.shopName;
  const senderPhone =
    deliverySettings?.pickupContactPhone ??
    sellerContactPhone ??
    null;
  const senderContactName = deliverySettings?.pickupContactName ?? null;
  const pickupAddress =
    normalizeShippingLabelPickupAddress(
      deliverySettings?.pickupAddress ?? activeShipment?.pickupAddress,
      localizedSellerManagedPickup,
    ) ?? fallbackValue;
  const pickupLocation = compactJoin([
    deliverySettings?.pickupCity,
    deliverySettings?.pickupPostalCode,
  ]);
  const pickupComment = deliverySettings?.pickupComment ?? null;
  const packageSummary = compactJoin([
    `${t("seller.shippingLabel.itemsCount")}: ${order.items.length}`,
    `${t("seller.shippingLabel.totalQuantity")}: ${totalQuantity}`,
  ]);
  const packageMetrics = compactJoin([
    activeShipment?.packageWeightGram
      ? `${t("seller.shippingLabel.weight")}: ${activeShipment.packageWeightGram} g`
      : null,
    activeShipment?.packageLengthCm &&
    activeShipment?.packageWidthCm &&
    activeShipment?.packageHeightCm
      ? `${t("seller.shippingLabel.dimensions")}: ${activeShipment.packageLengthCm} x ${activeShipment.packageWidthCm} x ${activeShipment.packageHeightCm} cm`
      : null,
  ]);
  const itemsPreview = order.items
    .slice(0, meta.compact ? 2 : 3)
    .map((item) => `${item.productTitleSnapshot} x ${item.quantity}`)
    .join(" / ");
  const internalNote =
    activeShipment?.deliveryNote ?? activeShipment?.lastSellerNote ?? order.customerNote;
  const sortingCode = `${order.shopId.slice(0, 4).toUpperCase()}-${order.id
    .slice(0, 6)
    .toUpperCase()}`;
  const printedAt = new Date().toLocaleString(getIntlLocale(locale));
  const qrValue = trackingLookupUrl ?? trackingCode;
  const labelCreatedAtValue =
    formatLabelDate(locale, activeShipment?.createdAt) ??
    formatLabelDate(locale, order.createdAt) ??
    printedAt;
  const compactCreatedAt = `${t("seller.shippingLabel.createdAt")}: ${labelCreatedAtValue}`;
  const deliveryReferenceLine = compactJoin([
    `${t("seller.shippingLabel.yandexId")}: ${shipmentReference}`,
    activeShipment?.yandexClaimId
      ? `${t("seller.shippingLabel.claimId")}: ${activeShipment.yandexClaimId}`
      : null,
  ]);
  const paymentSupportLine = compactJoin([
    `${t("seller.shippingLabel.paymentStatus")}: ${paymentStatusLabel}`,
    `${t("seller.shippingLabel.delivery")}: ${providerLabel}`,
  ]);
  const senderPhoneLabel = senderPhone ?? "—";
  const labelStyle = {
    "--label-width": `${meta.widthMm}mm`,
    "--label-height": `${meta.heightMm}mm`,
    "--label-padding": `${meta.paddingMm}mm`,
    "--label-font-size": `${meta.fontSizePx}px`,
    "--tracking-font-size": `${meta.trackingFontPx}px`,
    "--qr-size": `${meta.qrSizePx}px`,
    "--barcode-height": `${meta.barcodeHeightPx}px`,
    "--section-gap": `${meta.gapMm}mm`,
    "--note-lines": String(meta.noteLines),
    "--item-lines": String(meta.itemLines),
    "--address-lines": String(meta.addressLines),
  } as CSSProperties;

  useEffect(() => {
    if (!barcodeRef.current) {
      return;
    }

    JsBarcode(barcodeRef.current, trackingCode, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      lineColor: "#000000",
      background: "#ffffff",
      width: meta.compact ? 1.08 : 1.22,
      height: meta.barcodeHeightPx,
    });
  }, [meta.barcodeHeightPx, meta.compact, trackingCode]);

  return (
    <>
      <div
        className={`shipping-label-sheet label-size-${size}`}
        data-testid="shipping-label-print-view"
        data-label-size={size}
        style={labelStyle}
      >
        <article className="shipping-label-card">
          <header className="label-header" data-testid="shipping-label-header">
            <div className="label-header-copy">
              <p className="label-brand">Trawberry Marketplace</p>
              <p className="label-kicker">{t("seller.shippingLabel.title")}</p>
              <div data-testid="shipping-label-tracking-number">
                <p className="label-tracking-number label-clamp-2">{trackingCode}</p>
                <p className="label-tracking-subline" data-testid="shipping-label-tracking-code">
                  {deliveryReferenceLine || shipmentReference}
                </p>
              </div>
              <p className="label-order-line">
                {t("seller.shippingLabel.orderCode")}:{" "}
                <span data-testid="shipping-label-order-code">{order.orderNumber}</span>
              </p>
            </div>
            <div className="label-qr-block">
              <div className="label-qr-frame">
                <QRCodeSVG
                  value={qrValue}
                  size={meta.qrSizePx}
                  includeMargin={false}
                  data-testid="shipping-label-qr"
                />
              </div>
              <span className="label-qr-caption">{t("seller.shippingLabel.scanToTrack")}</span>
            </div>
          </header>

          <section className="label-barcode" data-testid="shipping-label-barcode">
            <div className="label-barcode-frame">
              <svg ref={barcodeRef} />
            </div>
            <p className="label-barcode-text">{trackingCode}</p>
          </section>

          <main className="label-body">
            <section className="label-section label-delivery-grid" data-testid="shipping-label-delivery">
              <div className="label-meta-cell">
                <p className="label-kicker">{t("seller.shippingLabel.delivery")}</p>
                <p className="label-token label-clamp-1" data-testid="shipping-label-provider">
                  {providerLabel}
                </p>
              </div>
              <div className="label-meta-cell">
                <p className="label-kicker">{t("seller.shippingLabel.deliveryType")}</p>
                <p className="label-token" data-testid="shipping-label-delivery-type">
                  {deliveryTypeLabel}
                </p>
              </div>
              <div className="label-meta-cell">
                <p className="label-kicker">{t("seller.shippingLabel.shipmentStatus")}</p>
                <p className="label-value label-clamp-1" data-testid="shipping-label-shipment-status">
                  {shipmentStatus}
                </p>
              </div>
              <div className="label-meta-cell">
                <p className="label-kicker">{t("seller.shippingLabel.paymentStatus")}</p>
                <p
                  className="label-token"
                  data-testid="shipping-label-payment-status"
                  data-status={order.paymentStatus}
                >
                  {paymentStatusLabel}
                </p>
              </div>
              <div className="label-meta-cell">
                <p className="label-kicker">{t("seller.shippingLabel.createdAt")}</p>
                <p className="label-value label-clamp-1" data-testid="shipping-label-created-at">
                  {labelCreatedAtValue}
                </p>
              </div>
              <div className="label-meta-strip">
                <p className="label-kicker">{t("seller.shippingLabel.yandexId")}</p>
                <p className="label-value label-clamp-1" data-testid="shipping-label-yandex-id">
                  {deliveryReferenceLine || shipmentReference}
                </p>
              </div>
            </section>

            <section className="label-section label-recipient" data-testid="shipping-label-recipient">
              <p className="label-kicker">{t("seller.shippingLabel.recipient")}</p>
              <p className="label-name" data-testid="shipping-label-recipient-name">
                {activeShipment?.recipientName ?? order.customer.name}
              </p>
              <p className="label-value" data-testid="shipping-label-recipient-phone">
                {activeShipment?.recipientPhone ?? order.customer.phone}
              </p>
              <p className="label-value label-address-clamp">{recipientAddress}</p>
              <p className="label-value label-clamp-1" data-testid="shipping-label-postal-code">
                {t("seller.shippingLabel.postalCode")}: {recipientPostalCode ?? "—"}
              </p>
              {recipientAddressExtra ? (
                <p className="label-muted label-clamp-1">{recipientAddressExtra}</p>
              ) : null}
              {recipientAccess ? (
                <p className="label-muted label-clamp-1">{recipientAccess}</p>
              ) : null}
              {courierNote ? (
                <p className="label-muted label-note-clamp">
                  {t("seller.shippingLabel.courierInstructions")}: {courierNote}
                </p>
              ) : null}
            </section>

            <div className="label-sender-items-grid">
              <section className="label-section label-sender" data-testid="shipping-label-sender">
                <p className="label-kicker">{t("seller.shippingLabel.sender")}</p>
                <p className="label-name" data-testid="shipping-label-sender-name">
                  {senderName}
                </p>
                <p className="label-value label-clamp-1" data-testid="shipping-label-sender-phone">
                  {t("seller.shippingLabel.senderPhone")}: {senderPhoneLabel}
                </p>
                {senderContactName ? (
                  <p className="label-muted label-clamp-1">{senderContactName}</p>
                ) : null}
                <p
                  className="label-value label-clamp-2"
                  data-testid="shipping-label-pickup-address"
                >
                  {pickupAddress}
                </p>
                {pickupLocation ? (
                  <p className="label-muted label-clamp-1">{pickupLocation}</p>
                ) : null}
                {!meta.compact && pickupComment ? (
                  <p className="label-muted label-clamp-1">{pickupComment}</p>
                ) : null}
              </section>

              <section className="label-section label-items" data-testid="shipping-label-items">
                <p className="label-kicker">{t("seller.shippingLabel.package")}</p>
                <p className="label-value label-clamp-1">{packageSummary}</p>
                {packageMetrics ? (
                  <p className="label-muted label-clamp-1">{packageMetrics}</p>
                ) : null}
                {itemsPreview ? (
                  <p className="label-muted label-items-clamp">{itemsPreview}</p>
                ) : null}
              </section>
            </div>

            <div className="label-payment-sorting-grid">
              <section className="label-section label-payment" data-testid="shipping-label-payment">
                <p className="label-kicker">{t("seller.shippingLabel.payment")}</p>
                <p className="label-value label-clamp-1">
                  {t("seller.shippingLabel.paymentMethod")}: {paymentMethodLabel}
                </p>
                {!meta.compact ? (
                  <p className="label-muted label-clamp-1">{paymentSupportLine}</p>
                ) : null}
                <p className="label-muted label-note-clamp">
                  {codSellerQr
                    ? t("seller.shippingLabel.codSellerQrNotice")
                    : paymentConfirmed
                      ? t("seller.shippingLabel.paymentConfirmedNotice")
                      : t("seller.shippingLabel.paymentPendingNotice")}
                </p>
              </section>

              <section className="label-section label-sorting" data-testid="shipping-label-sorting">
                <p className="label-kicker">{t("seller.shippingLabel.warehouseCode")}</p>
                <p className="label-sort-code" data-testid="shipping-label-sorting-code">
                  {sortingCode}
                </p>
                <p className="label-muted label-clamp-1">{deliveryReferenceLine || shipmentReference}</p>
                <p className="label-muted label-clamp-1">{compactCreatedAt}</p>
                {!meta.compact && internalNote ? (
                  <p className="label-muted label-clamp-1">
                    {t("seller.shippingLabel.internalNote")}: {internalNote}
                  </p>
                ) : null}
              </section>
            </div>
          </main>

          <footer className="label-footer" data-testid="shipping-label-footer">
            <p>
              {t("seller.shippingLabel.printedAt")}: {printedAt}
            </p>
            <p className="label-clamp-1">{t("seller.shippingLabel.notOfficialYandex")}</p>
          </footer>
        </article>
      </div>

      <style jsx global>{`
        @page {
          size: ${meta.widthMm}mm ${meta.heightMm}mm;
          margin: 0;
        }

        .shipping-label-sheet {
          width: calc(var(--label-width) + 16px);
          max-width: 100%;
          margin: 0 auto;
          padding: 8px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .shipping-label-card {
          width: var(--label-width);
          height: var(--label-height);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: var(--section-gap);
          padding: var(--label-padding);
          border: 1px solid #111827;
          background: #ffffff;
          color: #000000;
          font-size: var(--label-font-size);
          line-height: 1.24;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .label-header,
        .label-barcode,
        .label-section,
        .label-footer {
          min-height: 0;
          box-sizing: border-box;
        }

        .label-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: calc(var(--section-gap) * 1.15);
          align-items: start;
          padding-bottom: var(--section-gap);
          border-bottom: 1px solid #111827;
        }

        .label-header-copy,
        .label-body,
        .label-meta-cell,
        .label-qr-block {
          min-height: 0;
        }

        .label-brand,
        .label-kicker,
        .label-tracking-number,
        .label-order-line,
        .label-value,
        .label-muted,
        .label-name,
        .label-token,
        .label-sort-code,
        .label-qr-caption,
        .label-barcode-text,
        .label-footer p {
          margin: 0;
        }

        .label-brand {
          font-size: 0.67em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .label-kicker {
          font-size: 0.73em;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.11em;
          color: #4b5563;
        }

        .label-tracking-number {
          margin-top: 0.45mm;
          font-size: var(--tracking-font-size);
          font-weight: 800;
          line-height: 0.98;
          letter-spacing: 0.05em;
          overflow-wrap: anywhere;
        }

        .label-tracking-subline {
          margin: 0.55mm 0 0;
          font-size: 0.86em;
          font-weight: 700;
          line-height: 1.16;
        }

        .label-order-line {
          margin-top: 0.75mm;
          font-size: 0.93em;
          font-weight: 700;
          line-height: 1.16;
        }

        .label-qr-block {
          display: grid;
          justify-items: center;
          gap: 0.55mm;
          text-align: center;
        }

        .label-qr-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          width: calc(var(--qr-size) + 8px);
          height: calc(var(--qr-size) + 8px);
          padding: 3px;
          border: 1px solid #111827;
          background: #ffffff;
          box-sizing: border-box;
        }

        .label-qr-frame svg {
          display: block;
          width: var(--qr-size);
          height: var(--qr-size);
        }

        .label-qr-caption {
          font-size: 0.68em;
          color: #4b5563;
          line-height: 1.18;
        }

        .label-barcode {
          display: grid;
          gap: 0.4mm;
          padding: 1mm 1.3mm 0.9mm;
          border: 1px solid #111827;
        }

        .label-barcode-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: var(--barcode-height);
          padding: 0.6mm 1.2mm 0;
          background: #ffffff;
          box-sizing: border-box;
          overflow: hidden;
        }

        .label-barcode-frame svg {
          display: block;
          width: 100%;
          height: var(--barcode-height);
        }

        .label-barcode-text {
          text-align: center;
          font-size: 0.78em;
          font-weight: 700;
          letter-spacing: 0.1em;
          line-height: 1.16;
        }

        .label-body {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1.42fr) auto auto;
          gap: var(--section-gap);
        }

        .label-section {
          padding: 1.3mm 1.6mm;
          border: 1px solid #111827;
          overflow: hidden;
        }

        .label-delivery-grid,
        .label-sender-items-grid,
        .label-payment-sorting-grid {
          min-height: 0;
        }

        .label-delivery-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8mm 1.3mm;
          align-content: start;
        }

        .label-meta-cell {
          min-height: 0;
        }

        .label-meta-strip {
          grid-column: 1 / -1;
          min-width: 0;
          padding-top: 0.35mm;
          border-top: 1px dashed #9ca3af;
        }

        .label-name {
          margin-top: 0.38mm;
          margin-bottom: 0.32mm;
          font-size: 1.17em;
          font-weight: 800;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .label-value {
          margin-top: 0.18mm;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .label-muted {
          margin-top: 0.22mm;
          color: #4b5563;
          line-height: 1.17;
          overflow-wrap: anywhere;
        }

        .label-token {
          display: inline-block;
          margin-top: 0.34mm;
          padding: 0.28mm 1mm;
          border: 1px solid #111827;
          font-weight: 700;
          line-height: 1.15;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .label-sender-items-grid,
        .label-payment-sorting-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--section-gap);
          align-items: stretch;
        }

        .label-sort-code {
          margin-top: 0.35mm;
          font-size: 0.98em;
          font-weight: 800;
          letter-spacing: 0.1em;
          line-height: 1.16;
          overflow-wrap: anywhere;
        }

        .label-footer {
          padding-top: 0.8mm;
          border-top: 1px solid #111827;
          font-size: 0.68em;
          color: #4b5563;
          display: grid;
          gap: 0.25mm;
          line-height: 1.18;
        }

        .label-clamp-1,
        .label-clamp-2,
        .label-note-clamp,
        .label-items-clamp,
        .label-address-clamp {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .label-clamp-1 {
          -webkit-line-clamp: 1;
        }

        .label-clamp-2 {
          -webkit-line-clamp: 2;
        }

        .label-note-clamp {
          -webkit-line-clamp: var(--note-lines);
        }

        .label-items-clamp {
          -webkit-line-clamp: var(--item-lines);
        }

        .label-address-clamp {
          -webkit-line-clamp: var(--address-lines);
        }

        .label-payment .label-value,
        .label-payment .label-muted,
        .label-recipient .label-muted,
        .label-sorting .label-muted,
        .label-sender [data-testid="shipping-label-sender-phone"] {
          font-size: 1.04em;
          line-height: 1.22;
        }

        .label-size-75x120 .label-body {
          grid-template-rows: auto minmax(0, 1.54fr) auto auto;
        }

        .label-size-75x120 .label-section {
          padding: 1mm 1.2mm;
        }

        .label-size-75x120 .label-name {
          font-size: 1.08em;
        }

        .label-size-75x120 .label-tracking-subline {
          font-size: 0.8em;
        }

        .label-size-75x120 .label-delivery-grid {
          gap: 0.6mm 0.9mm;
        }

        .label-size-75x120 .label-sender-items-grid,
        .label-size-75x120 .label-payment-sorting-grid {
          gap: 0.8mm;
        }

        .label-size-a6 .label-body,
        .label-size-100x150 .label-body {
          grid-template-rows: auto minmax(0, 1.45fr) auto auto;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          .shipping-label-sheet,
          .shipping-label-sheet * {
            visibility: visible;
          }

          .shipping-label-sheet {
            position: absolute;
            inset: 0;
            width: ${meta.widthMm}mm !important;
            height: ${meta.heightMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            overflow: hidden !important;
          }

          .shipping-label-card {
            width: ${meta.widthMm}mm !important;
            height: ${meta.heightMm}mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .no-print,
          [data-print-toolbar="true"] {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
