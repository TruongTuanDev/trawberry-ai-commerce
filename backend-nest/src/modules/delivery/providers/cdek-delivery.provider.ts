import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CdekDeliveryClient } from '../cdek-delivery.client';
import type {
  DeliveryOfferResult,
  DeliveryOrderContext,
  DeliveryShipmentContext,
  DeliveryShipmentResult,
} from '../delivery.types';
import type { DeliveryProvider } from './delivery-provider.interface';

@Injectable()
export class CdekDeliveryProvider implements DeliveryProvider {
  constructor(private readonly client: CdekDeliveryClient) {}

  calculateOffers(input: DeliveryOrderContext): Promise<DeliveryOfferResult[]> {
    this.client.assertConfigured();
    return Promise.resolve([
      {
        provider: 'CDEK',
        offerType: 'CDEK_REAL_PENDING',
        priceAmount: '0',
        priceCurrency: input.currency,
        estimatedMinMinutes: null,
        estimatedMaxMinutes: null,
        estimatedMinDays: null,
        estimatedMaxDays: null,
        pickupPointId: null,
        isRecommended: input.interCityPreferredCarrier === 'CDEK',
        rawProviderPayload: {
          note: 'CDEK real integration skeleton. Implement real API call in a later phase.',
        },
        expiresAt: null,
      },
    ]);
  }

  createShipment(
    input: DeliveryOrderContext & {
      provider: 'CDEK' | 'YANDEX';
      selectedOffer?: DeliveryOfferResult | null;
    },
  ): Promise<DeliveryShipmentResult> {
    this.client.assertConfigured();
    return Promise.resolve({
      provider: 'CDEK',
      providerShipmentId: `cdek-skeleton-${input.orderId}`,
      providerOrderNumber: input.orderNumber,
      providerStatus: 'CREATED',
      internalStatus: 'CREATED',
      priceAmount: input.selectedOffer?.priceAmount ?? '0',
      priceCurrency: input.selectedOffer?.priceCurrency ?? input.currency,
      trackingNumber: `CDEK-${input.orderNumber}`,
      trackingUrl: null,
      rawProviderPayload: {
        note: 'CDEK real shipment skeleton. Implement order creation in a later phase.',
      },
      acceptedAt: null,
      cancelledAt: null,
      deliveredAt: null,
    });
  }

  refreshShipment(
    shipment: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult> {
    void shipment;
    this.client.assertConfigured();
    return Promise.reject(
      new ServiceUnavailableException(
        'CDEK real refresh is not implemented in this MVP skeleton.',
      ),
    );
  }

  cancelShipment(
    shipment: DeliveryShipmentContext & { reason?: string | null },
  ): Promise<DeliveryShipmentResult> {
    void shipment;
    this.client.assertConfigured();
    return Promise.reject(
      new ServiceUnavailableException(
        'CDEK real cancel is not implemented in this MVP skeleton.',
      ),
    );
  }
}
