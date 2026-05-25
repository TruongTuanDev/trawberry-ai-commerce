"use client";

import { QRCodeSVG } from "qrcode.react";
import type {
  DeliveryDetail,
  DeliverySettings,
  SellerOrderListItem,
} from "@/lib/seller-api";
import { useI18n } from "@/i18n/use-i18n";

type ShippingLabelPrintViewProps = {
  order: SellerOrderListItem;
  delivery: DeliveryDetail | null;
  deliverySettings: DeliverySettings | null;
  trackingLookupUrl: string | null;
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
}: ShippingLabelPrintViewProps) {
  const { t } = useI18n("seller");
  const activeShipment = delivery?.activeShipment;
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const fallbackValue = t("common.notProvided");
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
  const addressLines = [
    order.dropoffAddressFullName ?? order.shippingAddress,
    order.dropoffCity,
    formatOptionalLine(t("seller.shippingLabel.fields.street"), order.dropoffStreet),
    formatOptionalLine(
      t("seller.shippingLabel.fields.building"),
      order.dropoffBuilding,
    ),
    order.dropoffNoEntrance
      ? `${t("seller.shippingLabel.fields.entrance")}: ${t("seller.shippingLabel.noEntrance")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.entrance"),
          order.dropoffEntrance,
        ),
    formatOptionalLine(
      t("seller.shippingLabel.fields.intercom"),
      order.dropoffIntercom,
    ),
    order.dropoffNoFloor
      ? `${t("seller.shippingLabel.fields.floor")}: ${t("seller.shippingLabel.noFloor")}`
      : formatOptionalLine(t("seller.shippingLabel.fields.floor"), order.dropoffFloor),
    order.dropoffNoApartment
      ? `${t("seller.shippingLabel.fields.apartment")}: ${t("seller.shippingLabel.noApartment")}`
      : formatOptionalLine(
          t("seller.shippingLabel.fields.apartment"),
          order.dropoffApartment,
        ),
  ].filter(Boolean);
  const pickupCoords =
    deliverySettings?.pickupLatitude && deliverySettings?.pickupLongitude
      ? `${deliverySettings.pickupLatitude}, ${deliverySettings.pickupLongitude}`
      : null;

  return (
    <>
      <div
        className="shipping-label-sheet mx-auto w-full max-w-[420px] rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_56px_rgba(15,23,42,0.12)] sm:p-6"
        data-testid="shipping-label-print-view"
      >
        <article className="shipping-label-card mx-auto flex h-[150mm] w-[100mm] flex-col overflow-hidden border border-slate-300 bg-white text-slate-900">
          <div className="flex items-start justify-between gap-3 border-b border-slate-300 px-[5mm] py-[5mm]">
            <div className="min-w-0">
              <p className="text-[2.5mm] font-semibold uppercase tracking-[0.22em] text-slate-500">
                trawberry
              </p>
              <h1 className="mt-[1.5mm] text-[5.2mm] font-bold leading-none">
                {t("seller.shippingLabel.title")}
              </h1>
              <p className="mt-[2mm] text-[3.2mm] font-semibold">
                {t("seller.shippingLabel.orderCode")}:{" "}
                <span data-testid="shipping-label-order-code">{order.orderNumber}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-[1.5mm]">
              {trackingLookupUrl ? (
                <>
                  <QRCodeSVG
                    value={trackingLookupUrl}
                    size={112}
                    includeMargin={false}
                    data-testid="shipping-label-qr"
                  />
                  <span className="text-center text-[2.4mm] text-slate-600">
                    {t("seller.shippingLabel.scanToTrack")}
                  </span>
                </>
              ) : (
                <div className="flex h-[28mm] w-[28mm] items-center justify-center rounded-lg border border-dashed border-slate-300 px-[2mm] text-center text-[2.3mm] text-slate-500">
                  {t("seller.shippingLabel.qrUnavailable")}
                </div>
              )}
            </div>
          </div>

          <div className="grid flex-1 grid-rows-[auto_auto_auto_auto_1fr_auto] gap-[2.5mm] px-[5mm] py-[4.5mm]">
            <section className="rounded-[3mm] border border-slate-200 px-[3.2mm] py-[2.6mm]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[2.5mm] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {t("seller.shippingLabel.delivery")}
                </p>
                <span className="rounded-full bg-slate-100 px-[2mm] py-[1mm] text-[2.3mm] font-semibold text-slate-700">
                  {providerLabel}
                </span>
              </div>
              <div className="mt-[1.6mm] space-y-[0.7mm] text-[2.9mm]">
                {activeShipment?.manualYandexOrderId ? (
                  <p data-testid="shipping-label-yandex-id">
                    {t("seller.shippingLabel.yandexId")}:{" "}
                    <span className="font-semibold">{activeShipment.manualYandexOrderId}</span>
                  </p>
                ) : null}
                {activeShipment?.trackingUrl || order.delivery?.trackingUrl ? (
                  <p className="break-all text-[2.5mm] text-slate-600">
                    {activeShipment?.trackingUrl ?? order.delivery?.trackingUrl}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-[2mm] rounded-[3mm] border border-slate-200 px-[3.2mm] py-[2.6mm]">
              <p className="text-[2.5mm] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("seller.shippingLabel.recipient")}
              </p>
              <div className="space-y-[0.8mm] text-[2.9mm] leading-[1.35]">
                <p className="text-[3.5mm] font-bold" data-testid="shipping-label-recipient-name">
                  {order.customer.name}
                </p>
                <p data-testid="shipping-label-recipient-phone">{order.customer.phone}</p>
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                {order.dropoffComment ? (
                  <p>
                    {t("seller.shippingLabel.courierInstructions")}: {order.dropoffComment}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-[2mm] rounded-[3mm] border border-slate-200 px-[3.2mm] py-[2.6mm]">
              <p className="text-[2.5mm] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("seller.shippingLabel.sender")}
              </p>
              <div className="space-y-[0.8mm] text-[2.9mm] leading-[1.35]">
                <p className="text-[3.5mm] font-bold" data-testid="shipping-label-sender-name">
                  {order.shopName}
                </p>
                {deliverySettings?.pickupContactPhone ? (
                  <p>{deliverySettings.pickupContactPhone}</p>
                ) : null}
                <p data-testid="shipping-label-pickup-address">
                  {deliverySettings?.pickupAddress ?? activeShipment?.pickupAddress ?? fallbackValue}
                </p>
                {pickupCoords ? (
                  <p className="text-[2.4mm] text-slate-600">
                    {t("seller.shippingLabel.pickupCoordinates")}: {pickupCoords}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-[2mm] rounded-[3mm] border border-slate-200 px-[3.2mm] py-[2.6mm]">
              <p className="text-[2.5mm] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("seller.shippingLabel.package")}
              </p>
              <div className="space-y-[1mm] text-[2.8mm] leading-[1.35]">
                <p>
                  {t("seller.shippingLabel.itemsCount")}: {order.items.length}
                </p>
                <p>
                  {t("seller.shippingLabel.totalQuantity")}: {totalQuantity}
                </p>
                {activeShipment?.packageWeightGram ? (
                  <p>
                    {t("seller.shippingLabel.weight")}: {activeShipment.packageWeightGram} g
                  </p>
                ) : null}
                {activeShipment?.packageLengthCm &&
                activeShipment?.packageWidthCm &&
                activeShipment?.packageHeightCm ? (
                  <p>
                    {t("seller.shippingLabel.dimensions")}: {activeShipment.packageLengthCm} x{" "}
                    {activeShipment.packageWidthCm} x {activeShipment.packageHeightCm} cm
                  </p>
                ) : null}
                <div className="space-y-[0.6mm]">
                  {order.items.slice(0, 4).map((item) => (
                    <p key={item.id} className="truncate">
                      * {item.productTitleSnapshot} x {item.quantity}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-[2mm] rounded-[3mm] border border-slate-200 px-[3.2mm] py-[2.6mm]">
              <p className="text-[2.5mm] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("seller.shippingLabel.payment")}
              </p>
              <div className="space-y-[0.8mm] text-[2.8mm] leading-[1.35]">
                <p>
                  {t("seller.shippingLabel.paymentMethod")}: {paymentMethodLabel}
                </p>
                <p>
                  {t("seller.shippingLabel.paymentStatus")}:{" "}
                  <span data-testid="shipping-label-payment-status" data-status={order.paymentStatus}>
                    {order.paymentStatus}
                  </span>
                </p>
                <p className="text-[2.5mm] text-slate-700">
                  {codSellerQr
                    ? t("seller.shippingLabel.codSellerQrNotice")
                    : isPaymentConfirmed(order.paymentStatus)
                      ? t("seller.shippingLabel.paymentConfirmedNotice")
                      : t("seller.shippingLabel.paymentPendingNotice")}
                </p>
              </div>
            </section>

            <footer className="border-t border-dashed border-slate-300 pt-[2.2mm] text-[2.25mm] leading-[1.35] text-slate-500">
              <p>
                {t("seller.shippingLabel.printedAt")}: {printedAt}
              </p>
              <p>{t("seller.shippingLabel.internalNotice")}</p>
              <p>{t("seller.shippingLabel.notOfficialYandex")}</p>
            </footer>
          </div>
        </article>
      </div>

      <style jsx global>{`
        @page {
          size: 100mm 150mm;
          margin: 0;
        }

        @media print {
          html,
          body {
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
            left: 0;
            top: 0;
            width: 100mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .shipping-label-card {
            width: 100mm !important;
            height: 150mm !important;
            border: none !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
