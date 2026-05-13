import { BadRequestException } from '@nestjs/common';
import { YandexDeliveryProvider } from '../src/modules/delivery/providers/yandex-delivery.provider';
import { YandexDeliveryClient } from '../src/modules/delivery/yandex-delivery.client';
import type {
  DeliveryOrderContext,
  DeliveryShipmentContext,
} from '../src/modules/delivery/delivery.types';

describe('YandexDeliveryProvider', () => {
  it('creates shipment using Yandex claim id', async () => {
    const client = createClientMock();
    client.createClaim.mockResolvedValue({
      id: 'claim-123',
      status: 'ready_for_approval',
      version: 1,
      pricing: { offer: { price: '299.00' }, currency: 'RUB' },
    });
    const provider = new YandexDeliveryProvider(
      client as unknown as YandexDeliveryClient,
    );

    const result = await provider.createShipment({
      ...orderContext(),
      provider: 'YANDEX',
      selectedOffer: null,
    });

    expect(result.providerShipmentId).toBe('claim-123');
    expect(result.priceAmount).toBe('299.00');
    expect(client.createClaim).toHaveBeenCalledTimes(1);
  });

  it('accepts shipment and maps status', async () => {
    const client = createClientMock();
    client.acceptClaim.mockResolvedValue({
      id: 'claim-123',
      status: 'accepted',
      version: 2,
    });
    const provider = new YandexDeliveryProvider(
      client as unknown as YandexDeliveryClient,
    );

    const result = await provider.acceptShipment(shipmentContext());

    expect(result.internalStatus).toBe('SEARCHING_COURIER');
    expect(result.acceptedAt).toBeInstanceOf(Date);
    expect(client.acceptClaim).toHaveBeenCalledWith('claim-123', 1);
  });

  it('refreshes shipment and keeps tracking link', async () => {
    const client = createClientMock();
    client.getClaimInfo.mockResolvedValue({
      id: 'claim-123',
      status: 'pickuped',
      version: 3,
    });
    client.getTrackingLinks.mockResolvedValue({
      tracking_link: 'https://yandex.example/track/claim-123',
    });
    const provider = new YandexDeliveryProvider(
      client as unknown as YandexDeliveryClient,
    );

    const result = await provider.refreshShipment(shipmentContext());

    expect(result.internalStatus).toBe('IN_TRANSIT');
    expect(result.trackingUrl).toBe('https://yandex.example/track/claim-123');
  });

  it('cancels shipment after cancel-info check', async () => {
    const client = createClientMock();
    client.getCancelInfo.mockResolvedValue({ free: true });
    client.cancelClaim.mockResolvedValue({
      id: 'claim-123',
      status: 'cancelled',
      version: 4,
    });
    const provider = new YandexDeliveryProvider(
      client as unknown as YandexDeliveryClient,
    );

    const result = await provider.cancelShipment({
      ...shipmentContext(),
      reason: 'Customer changed mind',
    });

    expect(result.internalStatus).toBe('CANCELLED');
    expect(result.cancelledAt).toBeInstanceOf(Date);
    expect(client.getCancelInfo).toHaveBeenCalledWith('claim-123');
  });

  it('rejects Yandex if customer city is missing', async () => {
    const provider = new YandexDeliveryProvider(
      createClientMock() as unknown as YandexDeliveryClient,
    );

    await expect(
      provider.createShipment({
        ...orderContext(),
        customerCity: null,
        provider: 'YANDEX',
        selectedOffer: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function createClientMock() {
  return {
    createClaim: jest.fn(),
    acceptClaim: jest.fn(),
    getClaimInfo: jest.fn(),
    getTrackingLinks: jest.fn(),
    getCancelInfo: jest.fn(),
    cancelClaim: jest.fn(),
  };
}

function orderContext(): DeliveryOrderContext {
  return {
    shopId: 'shop-1',
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    customerName: 'Customer',
    customerPhone: '+79990000002',
    customerAddress: 'Lenina 10, Moscow',
    customerCity: 'Moscow',
    pickupAddress: 'Tverskaya 1, Moscow',
    pickupCity: 'Moscow',
    pickupPostalCode: '101000',
    pickupContactPhone: '+79990000001',
    pickupContactName: 'Seller',
    enabledCarriers: ['YANDEX', 'CDEK'],
    defaultCarrier: 'YANDEX',
    sameCityPreferredCarrier: 'YANDEX',
    interCityPreferredCarrier: 'CDEK',
    fallbackCarrier: 'CDEK',
    isSameCity: true,
    packageInfo: {
      weightGram: 1000,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    },
    currency: 'RUB',
  };
}

function shipmentContext(): DeliveryShipmentContext {
  return {
    shipmentId: 'shipment-1',
    provider: 'YANDEX',
    providerShipmentId: 'claim-123',
    providerOrderNumber: null,
    providerStatus: 'ready_for_approval',
    internalStatus: 'ESTIMATED',
    trackingNumber: 'claim-123',
    trackingUrl: null,
    priceAmount: '299.00',
    priceCurrency: 'RUB',
    pickupAddress: 'Tverskaya 1, Moscow',
    dropoffAddress: 'Lenina 10, Moscow',
    rawProviderPayload: { version: 1 },
  };
}
