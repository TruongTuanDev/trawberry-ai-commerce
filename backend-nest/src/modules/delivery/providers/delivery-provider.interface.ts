import type {
  DeliveryOfferResult,
  DeliveryOrderContext,
  DeliveryShipmentContext,
  DeliveryShipmentResult,
} from '../delivery.types';

export interface DeliveryProvider {
  calculateOffers(input: DeliveryOrderContext): Promise<DeliveryOfferResult[]>;
  createShipment(
    input: DeliveryOrderContext & {
      provider: 'CDEK' | 'YANDEX';
      selectedOffer?: DeliveryOfferResult | null;
    },
  ): Promise<DeliveryShipmentResult>;
  acceptShipment?(
    input: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult>;
  refreshShipment(
    input: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult>;
  cancelShipment(
    input: DeliveryShipmentContext & { reason?: string | null },
  ): Promise<DeliveryShipmentResult>;
}
