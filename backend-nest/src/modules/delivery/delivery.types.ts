export type DeliveryCarrierCode = 'CDEK' | 'YANDEX';
export type DeliveryProviderMode = 'mock' | 'cdek' | 'yandex';

export type DeliveryPackageInput = {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type DeliverySettingsInput = {
  pickupCountry: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  pickupContactPhone: string;
  pickupContactName: string;
  pickupWorkingHours?: string | null;
  pickupComment?: string | null;
  enabledCarriers: DeliveryCarrierCode[];
  defaultCarrier: DeliveryCarrierCode;
  sameCityPreferredCarrier: DeliveryCarrierCode;
  interCityPreferredCarrier: DeliveryCarrierCode;
  fallbackCarrier: DeliveryCarrierCode;
  defaultWeightGram: number;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
};

export type DeliveryOrderContext = {
  shopId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string | null;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode?: string | null;
  pickupContactPhone: string;
  pickupContactName: string;
  enabledCarriers: DeliveryCarrierCode[];
  defaultCarrier: DeliveryCarrierCode;
  sameCityPreferredCarrier: DeliveryCarrierCode;
  interCityPreferredCarrier: DeliveryCarrierCode;
  fallbackCarrier: DeliveryCarrierCode;
  isSameCity: boolean;
  packageInfo: DeliveryPackageInput;
  currency: string;
};

export type DeliveryOfferResult = {
  provider: DeliveryCarrierCode;
  offerType: string;
  priceAmount: string;
  priceCurrency: string;
  estimatedMinMinutes: number | null;
  estimatedMaxMinutes: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  pickupPointId: string | null;
  isRecommended: boolean;
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

export type DeliveryAcceptShipmentResult = DeliveryShipmentResult;
