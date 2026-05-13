export type DeliveryCarrierCode = 'CDEK' | 'YANDEX';
export type DeliveryProviderMode = 'mock' | 'cdek' | 'yandex';

export type DeliveryPackageInput = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type DeliverySettingsInput = {
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode?: string | null;
  pickupPhone: string;
  pickupContactName: string;
  enabledCarriers: DeliveryCarrierCode[];
  defaultCarrier: DeliveryCarrierCode;
  defaultWeight: number;
  defaultLength: number;
  defaultWidth: number;
  defaultHeight: number;
};

export type DeliveryOrderContext = {
  shopId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode?: string | null;
  pickupPhone: string;
  pickupContactName: string;
  enabledCarriers: DeliveryCarrierCode[];
  defaultCarrier: DeliveryCarrierCode;
  packageInfo: DeliveryPackageInput;
  currency: string;
};

export type DeliveryOfferResult = {
  provider: DeliveryCarrierCode;
  offerType: string;
  priceAmount: string;
  priceCurrency: string;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  pickupPointId: string | null;
  rawProviderPayload: Record<string, unknown> | null;
  expiresAt: Date | null;
};

export type DeliveryShipmentResult = {
  provider: DeliveryCarrierCode;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
  priceAmount: string | null;
  priceCurrency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  rawProviderPayload: Record<string, unknown> | null;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  deliveredAt: Date | null;
};

export type DeliveryShipmentContext = {
  shipmentId: string;
  provider: DeliveryCarrierCode;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  priceAmount: string | null;
  priceCurrency: string;
  pickupAddress: string;
  dropoffAddress: string;
  rawProviderPayload: Record<string, unknown> | null;
};
