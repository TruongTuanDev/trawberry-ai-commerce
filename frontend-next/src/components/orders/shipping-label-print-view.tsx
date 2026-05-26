"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import JsBarcode from "jsbarcode";
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
  barcodeHeightPx: number;
  compact: boolean;
  itemPreviewCount: number;
  footerNote: boolean;
};

export const SHIPPING_LABEL_SIZE_META: Record<
  ShippingLabelSize,
  ShippingLabelSizeMeta
> = {
  "75x120": {
    widthMm: 75,
    heightMm: 120,
    paddingMm: 3.6,
    fontSizePx: 9,
    qrSizePx: 76,
    barcodeHeightPx: 26,
    compact: true,
    itemPreviewCount: 2,
    footerNote: false,
  },
  "100x150": {
    widthMm: 100,
    heightMm: 150,
    paddingMm: 4.5,
    fontSizePx: 10,
    qrSizePx: 94,
    barcodeHeightPx: 34,
    compact: false,
    itemPreviewCount: 3,
    footerNote: true,
  },
  a6: {
    widthMm: 105,
    heightMm: 148,
    paddingMm: 4.5,
    fontSizePx: 10,
    qrSizePx: 94,
    barcodeHeightPx: 34,
    compact: false,
    itemPreviewCount: 3,
    footerNote: true,
  },
};

function formatOptionalLine(label: string, value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return `${label}: ${value}`;
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" | ");
}

function isPaymentConfirmed(paymentStatus: string) {
  return [
    "PAID",
    "APPROVED",
    "SELLER_CONFIRMED_DELIVERY_PAYMENT",
    "YANDEX_PAYMENT_ON_DELIVERY_PAID",
  ].includes(paymentStatus);
}

function formatStatusToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replaceAll("_", " ");
}

export function ShippingLabelPrintView({
  order,
  delivery,
  deliverySettings,
  trackingLookupUrl,
  size,
}: ShippingLabelPrintViewProps) {
  const { t } = useI18n("seller");
  const barcodeRef = useRef<SVGSVGElement | null>(null);
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
  const shipmentStatus =
    formatStatusToken(activeShipment?.internalStatus) ??
    formatStatusToken(order.delivery?.status) ??
    formatStatusToken(order.status) ??
    fallbackValue;
  const pickupCoords =
    deliverySettings?.pickupLatitude && deliverySettings?.pickupLongitude
      ? `${deliverySettings.pickupLatitude}, ${deliverySettings.pickupLongitude}`
      : null;
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
  const recipientAccess = compactJoin([
    order.dropoffNoEntrance
      ? `${t("seller.shippingLabel.fields.entrance")}: ${t(
          "seller.shippingLabel.noEntrance",
        )}`
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
      ? `${t("seller.shippingLabel.fields.apartment")}: ${t(
          "seller.shippingLabel.noApartment",
        )}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.apartment"),
          order.dropoffApartment ?? activeShipment?.dropoffApartment,
        ),
  ]);
  const senderName = order.shopName;
  const senderPhone = deliverySettings?.pickupContactPhone || null;
  const pickupAddress =
    deliverySettings?.pickupAddress ?? activeShipment?.pickupAddress ?? fallbackValue;
  const courierNote = order.dropoffComment ?? activeShipment?.customerVisibleMessage;
  const internalNote =
    activeShipment?.deliveryNote ?? activeShipment?.lastSellerNote ?? order.customerNote;
  const packageDetails = compactJoin([
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
  ]);
  const itemPreview = order.items
    .slice(0, meta.itemPreviewCount)
    .map((item) => `${item.productTitleSnapshot} x ${item.quantity}`)
    .join(" / ");
  const trackingCode =
    activeShipment?.trackingNumber ??
    activeShipment?.manualYandexOrderId ??
    order.orderNumber;
  const warehouseCode = `${order.shopId.slice(0, 4).toUpperCase()}-${order.id
    .slice(0, 6)
    .toUpperCase()}`;
  const barcodeValue = trackingCode;
  const qrValue = trackingLookupUrl ?? barcodeValue;
  const headerTitle = useMemo(() => {
    if (trackingCode.length <= 22) {
      return trackingCode;
    }

    return `${trackingCode.slice(0, 22)}...`;
  }, [trackingCode]);
  const labelStyle = {
    "--label-width": `${meta.widthMm}mm`,
    "--label-height": `${meta.heightMm}mm`,
    "--label-padding": `${meta.paddingMm}mm`,
    "--label-font-size": `${meta.fontSizePx}px`,
    "--qr-size": `${meta.qrSizePx}px`,
    "--barcode-height": `${meta.barcodeHeightPx}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!barcodeRef.current) {
      return;
    }

    JsBarcode(barcodeRef.current, barcodeValue, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      lineColor: "#000000",
      background: "#ffffff",
      width: meta.compact ? 1.08 : 1.22,
      height: meta.barcodeHeightPx,
    });
  }, [barcodeValue, meta.barcodeHeightPx, meta.compact]);

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
              <p className="label-brand">Trawberry Marketplace</p>
              <p className="label-kicker">{t("seller.shippingLabel.title")}</p>
              <p className="label-tracking-number" data-testid="shipping-label-tracking-code">
                {headerTitle}
              </p>
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

          <section className="label-barcode-band">
            <div className="label-barcode-wrap">
              <svg ref={barcodeRef} data-testid="shipping-label-barcode" />
            </div>
            <p className="label-barcode-text">{barcodeValue}</p>
          </section>

          <section className="label-section label-summary-grid">
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.delivery")}</p>
              <p className="label-chip">{providerLabel}</p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.paymentStatus")}</p>
              <p
                className="label-chip"
                data-testid="shipping-label-payment-status"
                data-status={order.paymentStatus}
              >
                {order.paymentStatus}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.shipmentStatus")}</p>
              <p className="label-value" data-testid="shipping-label-shipment-status">
                {shipmentStatus}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.trackingCode")}</p>
              <p className="label-value">{trackingCode}</p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.yandexId")}</p>
              <p className="label-value" data-testid="shipping-label-yandex-id">
                {yandexReference}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.claimId")}</p>
              <p className="label-value">{activeShipment?.yandexClaimId ?? fallbackValue}</p>
            </div>
          </section>

          <section className="label-section">
            <p className="label-kicker">{t("seller.shippingLabel.recipient")}</p>
            <p
              className="label-name"
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

          <section className="label-dual-grid">
            <div className="label-section">
              <p className="label-kicker">{t("seller.shippingLabel.sender")}</p>
              <p className="label-name" data-testid="shipping-label-sender-name">
                {senderName}
              </p>
              {senderPhone ? <p className="label-value">{senderPhone}</p> : null}
              <p className="label-value" data-testid="shipping-label-pickup-address">
                {pickupAddress}
              </p>
              {pickupCoords ? <p className="label-muted label-clamp-2">{pickupCoords}</p> : null}
            </div>

            <div className="label-section">
              <p className="label-kicker">{t("seller.shippingLabel.package")}</p>
              <p className="label-value">{packageDetails}</p>
              {itemPreview ? <p className="label-muted label-clamp-2">{itemPreview}</p> : null}
            </div>
          </section>

          <section className="label-section label-summary-footer">
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.payment")}</p>
              <p className="label-value">
                {t("seller.shippingLabel.paymentMethod")}: {paymentMethodLabel}
              </p>
              <p className="label-muted label-clamp-2">
                {codSellerQr
                  ? t("seller.shippingLabel.codSellerQrNotice")
                  : isPaymentConfirmed(order.paymentStatus)
                    ? t("seller.shippingLabel.paymentConfirmedNotice")
                    : t("seller.shippingLabel.paymentPendingNotice")}
              </p>
            </div>
            <div>
              <p className="label-kicker">{t("seller.shippingLabel.warehouseCode")}</p>
              <p className="label-sort-code" data-testid="shipping-label-sorting-code">
                {warehouseCode}
              </p>
              <p className="label-muted">
                {t("seller.shippingLabel.createdAt")}:{" "}
                {new Date(order.createdAt).toLocaleString()}
              </p>
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
            {meta.footerNote ? <p>{t("seller.shippingLabel.internalNotice")}</p> : null}
            <p>{t("seller.shippingLabel.notOfficialYandex")}</p>
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
          display: grid;
          grid-template-rows: auto auto auto auto auto auto auto;
          gap: 1.7mm;
          box-sizing: border-box;
          padding: var(--label-padding);
          overflow: hidden;
          border: 1px solid #111827;
          background: #ffffff;
          color: #000000;
          font-size: var(--label-font-size);
          line-height: 1.22;
          page-break-inside: avoid;
          break-inside: avoid;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .label-header,
        .label-section,
        .label-barcode-band,
        .label-footer {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .label-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 2.6mm;
          align-items: start;
          padding-bottom: 1.8mm;
          border-bottom: 1px solid #111827;
        }

        .label-brand,
        .label-kicker,
        .label-tracking-number,
        .label-order-line,
        .label-value,
        .label-muted,
        .label-qr-caption,
        .label-barcode-text,
        .label-footer p,
        .label-chip,
        .label-sort-code,
        .label-name {
          margin: 0;
        }

        .label-brand {
          font-size: 0.72em;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .label-kicker {
          font-size: 0.68em;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #4b5563;
        }

        .label-tracking-number {
          margin-top: 0.8mm;
          font-size: 1.78em;
          font-weight: 800;
          letter-spacing: 0.04em;
          line-height: 0.98;
        }

        .label-order-line {
          margin-top: 1.2mm;
          font-size: 0.92em;
          font-weight: 700;
        }

        .label-qr-block {
          display: grid;
          justify-items: center;
          gap: 0.9mm;
          text-align: center;
        }

        .label-qr-block svg {
          display: block;
          width: var(--qr-size);
          height: var(--qr-size);
          padding: 4px;
          border: 1px solid #111827;
          background: #ffffff;
        }

        .label-qr-caption {
          font-size: 0.68em;
          color: #4b5563;
        }

        .label-barcode-band {
          display: grid;
          gap: 0.9mm;
          padding: 1.4mm 1.6mm 1.2mm;
          border: 1px solid #111827;
        }

        .label-barcode-wrap {
          min-height: var(--barcode-height);
          padding: 1.2mm 1.6mm 0;
          background: #ffffff;
        }

        .label-barcode-wrap svg {
          display: block;
          width: 100%;
          height: var(--barcode-height);
        }

        .label-barcode-text {
          font-size: 0.78em;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-align: center;
        }

        .label-section {
          padding: 1.8mm 2mm;
          border: 1px solid #111827;
          overflow: hidden;
        }

        .label-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.4mm 1.8mm;
        }

        .label-dual-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.6mm;
        }

        .label-summary-footer {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.8mm;
        }

        .label-name {
          margin-top: 0.5mm;
          margin-bottom: 0.5mm;
          font-size: 1.14em;
          font-weight: 800;
          line-height: 1.04;
        }

        .label-value {
          margin-top: 0.4mm;
          color: #000000;
        }

        .label-muted {
          margin-top: 0.55mm;
          color: #4b5563;
          font-size: 0.82em;
        }

        .label-chip {
          display: inline-block;
          margin-top: 0.5mm;
          padding: 0.5mm 1.4mm;
          border: 1px solid #111827;
          font-size: 0.82em;
          font-weight: 700;
        }

        .label-sort-code {
          margin-top: 0.6mm;
          font-size: 1.02em;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .label-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .label-footer {
          align-self: end;
          padding-top: 1.4mm;
          border-top: 1px solid #111827;
          font-size: 0.7em;
          color: #4b5563;
          display: grid;
          gap: 0.3mm;
        }

        .shipping-label-card.is-compact {
          gap: 1.35mm;
        }

        .shipping-label-card.is-compact .label-tracking-number {
          font-size: 1.46em;
        }

        .shipping-label-card.is-compact .label-section {
          padding: 1.4mm 1.5mm;
        }

        .shipping-label-card.is-compact .label-summary-grid,
        .shipping-label-card.is-compact .label-dual-grid,
        .shipping-label-card.is-compact .label-summary-footer {
          gap: 1.15mm;
        }

        .shipping-label-card.is-compact .label-name {
          font-size: 1.02em;
        }

        .shipping-label-card.is-compact .label-muted {
          font-size: 0.76em;
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
