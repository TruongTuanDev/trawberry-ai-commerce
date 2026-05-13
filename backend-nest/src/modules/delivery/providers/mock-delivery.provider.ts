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
    const roundedWeight = Math.max(1, Math.ceil(input.packageInfo.weightKg));

    if (input.enabledCarriers.includes('CDEK')) {
      offers.push({
        provider: 'CDEK',
        offerType: 'CDEK_PICKUP',
        priceAmount: String(320 + roundedWeight * 25),
        priceCurrency: input.currency,
        estimatedMinDays: 2,
        estimatedMaxDays: 4,
        pickupPointId: 'mock-cdek-pickup-001',
        rawProviderPayload: { mode: 'pickup', provider: 'cdek' },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      offers.push({
        provider: 'CDEK',
        offerType: 'CDEK_COURIER',
        priceAmount: String(430 + roundedWeight * 30),
        priceCurrency: input.currency,
        estimatedMinDays: 1,
        estimatedMaxDays: 3,
        pickupPointId: null,
        rawProviderPayload: { mode: 'courier', provider: 'cdek' },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
    }

    if (input.enabledCarriers.includes('YANDEX')) {
      offers.push({
        provider: 'YANDEX',
        offerType: 'YANDEX_EXPRESS',
        priceAmount: String(550 + roundedWeight * 35),
        priceCurrency: input.currency,
        estimatedMinDays: 0,
        estimatedMaxDays: 1,
        pickupPointId: null,
        rawProviderPayload: { mode: 'express', provider: 'yandex' },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
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
