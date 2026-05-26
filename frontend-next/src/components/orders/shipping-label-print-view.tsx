"use client";

import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  trackingLookupUrl: string | null;
  size: ShippingLabelSize;
};

type ShippingLabelSizeMeta = {
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  fontSizePx: number;
  qrSizePx: number;
  compact: boolean;
  showExtendedFooter: boolean;
};

export const SHIPPING_LABEL_SIZE_META: Record<
  ShippingLabelSize,
  ShippingLabelSizeMeta
> = {
  "75x120": {
    widthMm: 75,
    heightMm: 120,
    paddingMm: 4,
    fontSizePx: 10,
    qrSizePx: 86,
    compact: true,
    showExtendedFooter: false,
  },
  "100x150": {
    widthMm: 100,
    heightMm: 150,
    paddingMm: 5,
    fontSizePx: 11,
    qrSizePx: 106,
    compact: false,
    showExtendedFooter: true,
  },
  a6: {
    widthMm: 105,
    heightMm: 148,
    paddingMm: 5,
    fontSizePx: 11,
    qrSizePx: 106,
    compact: false,
    showExtendedFooter: true,
  },
};

function formatOptionalLine(label: string, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return `${label}: ${value}`;
}

function isPaymentConfirmed(paymentStatus: string) {
  return [
    "PAID",
    "APPROVED",
    "SELLER_CONFIRMED_DELIVERY_PAYMENT",
    "YANDEX_PAYMENT_ON_DELIVERY_PAID",
  ].includes(paymentStatus);
}

export function ShippingLabelPrintView({
  order,
  delivery,
  deliverySettings,
  trackingLookupUrl,
  size,
}: ShippingLabelPrintViewProps) {
  const { t } = useI18n("seller");
  const activeShipment = delivery?.activeShipment;
  const meta = SHIPPING_LABEL_SIZE_META[size];
  const fallbackValue = t("common.notProvided");
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const paymentMethodLabel =
    order.paymentMethodLabel ?? order.paymentMethod ?? t("common.unknown");
  const providerLabel =
    activeShipment?.provider === "YANDEX" || activeShipment?.manualYandexOrderId
      ? t("seller.shippingLabel.providerManualYandex")
      : activeShipment?.provider ?? t("seller.shippingLabel.providerManual");
  const printedAt = new Date().toLocaleString();
  const codSellerQr =
    order.shippingMethodName === "PAY_ON_DELIVERY_SELLER_QR" ||
    order.paymentMethod === "PAY_ON_DELIVERY_SELLER_QR";
  const yandexReference =
    activeShipment?.manualYandexOrderId ??
    activeShipment?.providerOrderNumber ??
    fallbackValue;
  const pickupCoords =
    deliverySettings?.pickupLatitude && deliverySettings?.pickupLongitude
      ? `${deliverySettings.pickupLatitude}, ${deliverySettings.pickupLongitude}`
      : null;
  const recipientAddress = [
    activeShipment?.dropoffAddressFullName ??
      order.dropoffAddressFullName ??
      order.shippingAddress,
    order.dropoffCity ?? activeShipment?.dropoffCity,
  ]
    .filter(Boolean)
    .join(", ");
  const recipientAddressExtra = [
    formatOptionalLine(
      t("seller.shippingLabel.fields.street"),
      order.dropoffStreet ?? activeShipment?.dropoffStreet,
    ),
    formatOptionalLine(
      t("seller.shippingLabel.fields.building"),
      order.dropoffBuilding ?? activeShipment?.dropoffBuilding,
    ),
  ]
    .filter(Boolean)
    .join(" · ");
  const recipientAccess = [
    order.dropoffNoEntrance
      ? `${t("seller.shippingLabel.fields.entrance")}: ${t("seller.shippingLabel.noEntrance")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.entrance"),
          order.dropoffEntrance ?? activeShipment?.dropoffEntrance,
        ),
    formatOptionalLine(
      t("seller.shippingLabel.fields.intercom"),
      order.dropoffIntercom ?? activeShipment?.dropoffIntercom,
    ),
    order.dropoffNoFloor
      ? `${t("seller.shippingLabel.fields.floor")}: ${t("seller.shippingLabel.noFloor")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.floor"),
          order.dropoffFloor ?? activeShipment?.dropoffFloor,
        ),
    order.dropoffNoApartment
      ? `${t("seller.shippingLabel.fields.apartment")}: ${t("seller.shippingLabel.noApartment")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.apartment"),
          order.dropoffApartment ?? activeShipment?.dropoffApartment,
        ),
  ]
    .filter(Boolean)
    .join(" · ");
  const senderName = order.shopName;
  const senderContact = deliverySettings?.pickupContactName || null;
  const senderPhone = deliverySettings?.pickupContactPhone || null;
  const pickupAddress =
    deliverySettings?.pickupAddress ?? activeShipment?.pickupAddress ?? fallbackValue;
  const courierNote = order.dropoffComment ?? activeShipment?.customerVisibleMessage;
  const internalNote =
    activeShipment?.deliveryNote ?? activeShipment?.lastSellerNote ?? order.customerNote;
  const packageDetails = [
    `${t("seller.shippingLabel.itemsCount")}: ${order.items.length}`,
    `${t("seller.shippingLabel.totalQuantity")}: ${totalQuantity}`,
    activeShipment?.packageWeightGram
      ? `${t("seller.shippingLabel.weight")}: ${activeShipment.packageWeightGram} g`
      : null,
    activeShipment?.packageLengthCm &&
    activeShipment?.packageWidthCm &&
    activeShipment?.packageHeightCm
      ? `${t("seller.shippingLabel.dimensions")}: ${activeShipment.packageLengthCm} x ${activeShipment.packageWidthCm} x ${activeShipment.packageHeightCm} cm`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const productSummary = order.items
    .slice(0, meta.compact ? 2 : 3)
    .map((item) => `${item.productTitleSnapshot} x ${item.quantity}`)
    .join(" • ");
  const qrValue =
    trackingLookupUrl ??
    activeShipment?.trackingNumber ??
    activeShipment?.manualYandexOrderId ??
    order.orderNumber;
  const labelStyle = {
    "--label-width": `${meta.widthMm}mm`,
    "--label-height": `${meta.heightMm}mm`,
    "--label-padding": `${meta.paddingMm}mm`,
    "--label-font-size": `${meta.fontSizePx}px`,
    "--page-size": `${meta.widthMm}mm ${meta.heightMm}mm`,
    "--qr-size": `${meta.qrSizePx}px`,
  } as CSSProperties;

  return (
    <>
      <div
        className="shipping-label-sheet"
        data-testid="shipping-label-print-view"
        data-label-size={size}
        style={labelStyle}
      >
        <article className={`shipping-label-card ${meta.compact ? "is-compact" : ""}`}>
          <header className="label-header">
            <div className="label-brand-block">
              <p className="label-brand">trawberry</p>
              <h1 className="label-title">{t("seller.shippingLabel.title")}</h1>
              <p className="label-order-line">
                {t("seller.shippingLabel.orderCode")}:{" "}
                <span data-testid="shipping-label-order-code">{order.orderNumber}</span>
              </p>
            </div>
            <div className="label-qr-block">
              <QRCodeSVG
                value={qrValue}
                size={meta.qrSizePx}
                includeMargin={false}
                data-testid="shipping-label-qr"
              />
              <span className="label-qr-caption">{t("seller.shippingLabel.scanToTrack")}</span>
            </div>
          </header>

          <section className="label-section label-meta-grid">
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.delivery")}</p>
              <p className="label-emphasis">{providerLabel}</p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.yandexId")}</p>
              <p className="label-emphasis" data-testid="shipping-label-yandex-id">
                {yandexReference}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.claimId")}</p>
              <p className="label-value">{activeShipment?.yandexClaimId ?? fallbackValue}</p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.trackingCode")}</p>
              <p className="label-value">{activeShipment?.trackingNumber ?? order.orderNumber}</p>
            </div>
          </section>

          <section className="label-section">
            <p className="label-kicker">{t("seller.shippingLabel.recipient")}</p>
            <p
              className="label-emphasis label-name"
              data-testid="shipping-label-recipient-name"
            >
              {activeShipment?.recipientName ?? order.customer.name}
            </p>
            <p className="label-value" data-testid="shipping-label-recipient-phone">
              {activeShipment?.recipientPhone ?? order.customer.phone}
            </p>
            <p className="label-value">{recipientAddress}</p>
            {recipientAddressExtra ? (
              <p className="label-muted label-clamp-2">{recipientAddressExtra}</p>
            ) : null}
            {recipientAccess ? (
              <p className="label-muted label-clamp-2">{recipientAccess}</p>
            ) : null}
            {courierNote ? (
              <p className="label-muted label-clamp-2">
                {t("seller.shippingLabel.courierInstructions")}: {courierNote}
              </p>
            ) : null}
          </section>

          <section className="label-section">
            <p className="label-kicker">{t("seller.shippingLabel.sender")}</p>
            <p className="label-emphasis label-name" data-testid="shipping-label-sender-name">
              {senderName}
            </p>
            {senderContact ? <p className="label-value">{senderContact}</p> : null}
            {senderPhone ? <p className="label-value">{senderPhone}</p> : null}
            <p className="label-value" data-testid="shipping-label-pickup-address">
              {pickupAddress}
            </p>
            {pickupCoords ? <p className="label-muted">{pickupCoords}</p> : null}
          </section>

          <section className="label-section label-two-column">
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.payment")}</p>
              <p className="label-value">
                {t("seller.shippingLabel.paymentMethod")}: {paymentMethodLabel}
              </p>
              <p className="label-value">
                {t("seller.shippingLabel.paymentStatus")}:{" "}
                <span
                  data-testid="shipping-label-payment-status"
                  data-status={order.paymentStatus}
                >
                  {order.paymentStatus}
                </span>
              </p>
              <p className="label-muted">
                {codSellerQr
                  ? t("seller.shippingLabel.codSellerQrNotice")
                  : isPaymentConfirmed(order.paymentStatus)
                    ? t("seller.shippingLabel.paymentConfirmedNotice")
                    : t("seller.shippingLabel.paymentPendingNotice")}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.package")}</p>
              <p className="label-value label-clamp-2">{packageDetails}</p>
              {productSummary ? (
                <p className="label-muted label-clamp-2">{productSummary}</p>
              ) : null}
              {internalNote && !meta.compact ? (
                <p className="label-muted label-clamp-2">
                  {t("seller.shippingLabel.internalNote")}: {internalNote}
                </p>
              ) : null}
            </div>
          </section>

          <footer className="label-footer">
            <p>
              {t("seller.shippingLabel.printedAt")}: {printedAt}
            </p>
            <p>{t("seller.shippingLabel.internalNotice")}</p>
            {meta.showExtendedFooter ? (
              <p>{t("seller.shippingLabel.notOfficialYandex")}</p>
            ) : null}
          </footer>
        </article>
      </div>

      <style jsx global>{`
        @page {
          size: ${meta.widthMm}mm ${meta.heightMm}mm;
          margin: 0;
        }

        .shipping-label-sheet {
          width: calc(var(--label-width) + 20px);
          max-width: 100%;
          margin: 0 auto;
          padding: 10px;
          border-radius: 24px;
          background: #f8fafc;
          box-sizing: border-box;
        }

        .shipping-label-card {
          width: var(--label-width);
          height: var(--label-height);
          box-sizing: border-box;
          overflow: hidden;
          border: 1px solid #0f172a;
          background: #fff;
          color: #0f172a;
          padding: var(--label-padding);
          font-size: var(--label-font-size);
          line-height: 1.25;
          display: grid;
          grid-template-rows: auto auto auto auto auto;
          gap: 2.2mm;
          break-inside: avoid;
          page-break-inside: avoid;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .label-header,
        .label-section,
        .label-footer {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .label-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 3mm;
          align-items: start;
          padding-bottom: 2.2mm;
          border-bottom: 1px solid #cbd5e1;
        }

        .label-brand {
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 0.72em;
          font-weight: 700;
          color: #64748b;
        }

        .label-title,
        .label-order-line,
        .label-kicker,
        .label-emphasis,
        .label-value,
        .label-muted,
        .label-footer p,
        .label-qr-caption {
          margin: 0;
        }

        .label-title {
          margin-top: 1.2mm;
          font-size: 1.55em;
          line-height: 1;
        }

        .label-order-line {
          margin-top: 1.8mm;
          font-size: 0.98em;
          font-weight: 700;
        }

        .label-qr-block {
          display: grid;
          gap: 1mm;
          justify-items: center;
          text-align: center;
        }

        .label-qr-block svg {
          display: block;
          width: var(--qr-size);
          height: var(--qr-size);
        }

        .label-qr-caption {
          font-size: 0.72em;
          color: #64748b;
        }

        .label-section {
          border: 1px solid #cbd5e1;
          border-radius: 3mm;
          padding: 2.1mm 2.4mm;
          overflow: hidden;
        }

        .label-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.6mm 2.2mm;
        }

        .label-two-column {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 2.2mm;
        }

        .label-kicker {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.72em;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 0.9mm;
        }

        .label-emphasis {
          font-weight: 700;
          font-size: 1em;
        }

        .label-name {
          font-size: 1.14em;
          margin-bottom: 0.6mm;
        }

        .label-value {
          color: #0f172a;
        }

        .label-muted {
          color: #475569;
          font-size: 0.88em;
          margin-top: 0.7mm;
        }

        .label-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .label-footer {
          align-self: end;
          border-top: 1px dashed #cbd5e1;
          padding-top: 1.8mm;
          font-size: 0.72em;
          color: #64748b;
          display: grid;
          gap: 0.4mm;
        }

        .shipping-label-card.is-compact {
          gap: 1.8mm;
        }

        .shipping-label-card.is-compact .label-section {
          padding: 1.8mm 2mm;
        }

        .shipping-label-card.is-compact .label-title {
          font-size: 1.38em;
        }

        .shipping-label-card.is-compact .label-name {
          font-size: 1.05em;
        }

        .shipping-label-card.is-compact .label-meta-grid,
        .shipping-label-card.is-compact .label-two-column {
          gap: 1.3mm 1.8mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
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
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          .shipping-label-card {
            width: ${meta.widthMm}mm !important;
            height: ${meta.heightMm}mm !important;
            margin: 0 !important;
            border-radius: 0 !important;
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
