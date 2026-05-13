import { Injectable } from '@nestjs/common';
import type {
  DeliveryOfferResult,
  DeliveryOrderContext,
  DeliveryShipmentContext,
  DeliveryShipmentResult,
} from '../delivery.types';
import type { DeliveryProvider } from './delivery-provider.interface';

@Injectable()
export class MockDeliveryProvider implements DeliveryProvider {
  calculateOffers(input: DeliveryOrderContext): Promise<DeliveryOfferResult[]> {
    const offers: DeliveryOfferResult[] = [];
    const roundedKg = Math.max(
      1,
      Math.ceil(input.packageInfo.weightGram / 1000),
    );
    const addOffer = (offer: DeliveryOfferResult) => {
      if (input.enabledCarriers.includes(offer.provider)) {
        offers.push(offer);
      }
    };

    if (input.isSameCity) {
      addOffer({
        provider: 'YANDEX',
        offerType: 'YANDEX_EXPRESS',
        priceAmount: String(550 + roundedKg * 35),
        priceCurrency: input.currency,
        estimatedMinMinutes: 45,
        estimatedMaxMinutes: 120,
        estimatedMinDays: 0,
        estimatedMaxDays: 0,
        pickupPointId: null,
        isRecommended: input.sameCityPreferredCarrier === 'YANDEX',
        rawProviderPayload: {
          mode: 'express',
          provider: 'yandex',
          sameCity: true,
        },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      addOffer({
        provider: 'CDEK',
        offerType: 'CDEK_COURIER',
        priceAmount: String(430 + roundedKg * 30),
        priceCurrency: input.currency,
        estimatedMinMinutes: null,
        estimatedMaxMinutes: null,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        pickupPointId: null,
        isRecommended: input.sameCityPreferredCarrier === 'CDEK',
        rawProviderPayload: {
          mode: 'courier',
          provider: 'cdek',
          fallback: true,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
    } else {
      addOffer({
        provider: 'CDEK',
        offerType: 'CDEK_COURIER',
        priceAmount: String(430 + roundedKg * 30),
        priceCurrency: input.currency,
        estimatedMinMinutes: null,
        estimatedMaxMinutes: null,
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
        pickupPointId: null,
        isRecommended: true,
        rawProviderPayload: {
          mode: 'courier',
          provider: 'cdek',
          interCity: true,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      addOffer({
        provider: 'CDEK',
        offerType: 'CDEK_PICKUP',
        priceAmount: String(320 + roundedKg * 25),
        priceCurrency: input.currency,
        estimatedMinMinutes: null,
        estimatedMaxMinutes: null,
        estimatedMinDays: 2,
        estimatedMaxDays: 6,
        pickupPointId: 'mock-cdek-pickup-001',
        isRecommended: false,
        rawProviderPayload: {
          mode: 'pickup',
          provider: 'cdek',
          optional: true,
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
    }

    return Promise.resolve(offers);
  }

  createShipment(
    input: DeliveryOrderContext & {
      provider: 'CDEK' | 'YANDEX';
      selectedOffer?: DeliveryOfferResult | null;
    },
  ): Promise<DeliveryShipmentResult> {
    const offer = input.selectedOffer;
    const providerPrefix = input.provider.toLowerCase();
    return Promise.resolve({
      provider: input.provider,
      providerShipmentId: `mock-${providerPrefix}-shipment-${input.orderId}`,
      providerOrderNumber: `mock-${providerPrefix}-order-${input.orderNumber}`,
      providerStatus: 'CREATED',
      internalStatus: 'CREATED',
      priceAmount: offer?.priceAmount ?? '490',
      priceCurrency: offer?.priceCurrency ?? input.currency,
      trackingNumber: `MOCK-${input.provider}-${input.orderNumber}`,
      trackingUrl: `https://mock-delivery.local/${providerPrefix}/track/${input.orderId}`,
      rawProviderPayload: {
        provider: input.provider,
        offerType: offer?.offerType ?? null,
        pickupAddress: input.pickupAddress,
      },
      acceptedAt: new Date(),
      cancelledAt: null,
      deliveredAt: null,
    });
  }

  refreshShipment(
    input: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult> {
    return Promise.resolve({
      provider: input.provider,
      providerShipmentId: input.providerShipmentId,
      providerOrderNumber: input.providerOrderNumber,
      providerStatus: 'IN_TRANSIT',
      internalStatus: 'IN_TRANSIT',
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
      rawProviderPayload: {
        provider: input.provider,
        refreshed: true,
      },
      acceptedAt: new Date(),
      cancelledAt: null,
      deliveredAt: null,
    });
  }

  cancelShipment(
    input: DeliveryShipmentContext & { reason?: string | null },
  ): Promise<DeliveryShipmentResult> {
    return Promise.resolve({
      provider: input.provider,
      providerShipmentId: input.providerShipmentId,
      providerOrderNumber: input.providerOrderNumber,
      providerStatus: 'CANCELLED',
      internalStatus: 'CANCELLED',
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
      rawProviderPayload: {
        provider: input.provider,
        cancelled: true,
        reason: input.reason ?? null,
      },
      acceptedAt: null,
      cancelledAt: new Date(),
      deliveredAt: null,
    });
  }
}
