import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { YandexDeliveryClient } from '../yandex-delivery.client';
import type {
  DeliveryOfferResult,
  DeliveryOrderContext,
  DeliveryShipmentContext,
  DeliveryShipmentResult,
} from '../delivery.types';
import type { DeliveryProvider } from './delivery-provider.interface';

@Injectable()
export class YandexDeliveryProvider implements DeliveryProvider {
  constructor(private readonly client: YandexDeliveryClient) {}

  calculateOffers(
    context: DeliveryOrderContext,
  ): Promise<DeliveryOfferResult[]> {
    void context;
    this.client.assertConfigured();
    return Promise.reject(
      new ServiceUnavailableException(
        'Yandex real delivery is reserved for a later phase. Use DELIVERY_PROVIDER_MODE=mock for tests.',
      ),
    );
  }

  createShipment(
    context: DeliveryOrderContext & {
      provider: 'CDEK' | 'YANDEX';
      selectedOffer?: DeliveryOfferResult | null;
    },
  ): Promise<DeliveryShipmentResult> {
    void context;
    this.client.assertConfigured();
    return Promise.reject(
      new ServiceUnavailableException(
        'Yandex real shipment creation is reserved for a later phase.',
      ),
    );
  }

  refreshShipment(
    shipment: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult> {
    void shipment;
    this.client.assertConfigured();
    return Promise.reject(
      new ServiceUnavailableException(
        'Yandex real shipment refresh is reserved for a later phase.',
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
        'Yandex real shipment cancellation is reserved for a later phase.',
      ),
    );
  }
}
