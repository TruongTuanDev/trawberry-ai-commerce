import { BadRequestException, Injectable } from '@nestjs/common';
import {
  YandexDeliveryClient,
  YandexDeliveryRequestError,
} from '../yandex-delivery.client';
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

  async calculateOffers(
    context: DeliveryOrderContext,
  ): Promise<DeliveryOfferResult[]> {
    this.assertYandexAllowed(context);
    const payload = this.buildClaimPayload(context);

    try {
      const response = await this.client.calculateOffers(payload);
      const price = this.extractPrice(response) ?? '0';
      const eta = this.extractEta(response);
      return [
        {
          provider: 'YANDEX',
          offerType: 'YANDEX_EXPRESS',
          priceAmount: price,
          priceCurrency: this.extractCurrency(response) ?? context.currency,
          estimatedMinMinutes: eta,
          estimatedMaxMinutes: eta ? eta + 30 : null,
          estimatedMinDays: 0,
          estimatedMaxDays: 0,
          pickupPointId: null,
          isRecommended: context.isSameCity,
          rawProviderPayload: response,
          expiresAt: this.extractOfferValidUntil(response),
        },
      ];
    } catch (error) {
      throw this.mapYandexError(error, 'calculate Yandex delivery offers');
    }
  }

  async createShipment(
    context: DeliveryOrderContext & {
      provider: 'CDEK' | 'YANDEX';
      selectedOffer?: DeliveryOfferResult | null;
    },
  ): Promise<DeliveryShipmentResult> {
    this.assertYandexAllowed(context);
    const payload = this.buildClaimPayload(context);

    try {
      const claim = await this.client.createClaim(payload);
      const claimId = this.extractString(claim.id);
      if (!claimId) {
        throw new BadRequestException(
          'Yandex Delivery did not return a claim id.',
        );
      }

      return this.toShipmentResult(claim, {
        fallbackStatus: 'CREATED',
        fallbackInternalStatus: 'ESTIMATED',
        fallbackPrice: context.selectedOffer?.priceAmount ?? null,
        fallbackCurrency:
          context.selectedOffer?.priceCurrency ?? context.currency,
        trackingUrl: null,
      });
    } catch (error) {
      throw this.mapYandexError(error, 'create Yandex delivery claim');
    }
  }

  async acceptShipment(
    shipment: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult> {
    const claimId = this.requireClaimId(shipment);
    const version = this.extractVersion(shipment.rawProviderPayload);
    try {
      const accepted = await this.client.acceptClaim(claimId, version);
      return this.toShipmentResult(accepted, {
        fallbackStatus: 'accepted',
        fallbackInternalStatus: 'ACCEPTED',
        fallbackPrice: shipment.priceAmount,
        fallbackCurrency: shipment.priceCurrency,
        trackingUrl: shipment.trackingUrl,
        acceptedAt: new Date(),
      });
    } catch (error) {
      throw this.mapYandexError(error, 'accept Yandex delivery claim');
    }
  }

  async refreshShipment(
    shipment: DeliveryShipmentContext,
  ): Promise<DeliveryShipmentResult> {
    const claimId = this.requireClaimId(shipment);
    try {
      const [info, tracking] = await Promise.all([
        this.client.getClaimInfo(claimId),
        this.client.getTrackingLinks(claimId).catch(() => null),
      ]);
      return this.toShipmentResult(info, {
        fallbackStatus: shipment.providerStatus,
        fallbackInternalStatus: shipment.internalStatus,
        fallbackPrice: shipment.priceAmount,
        fallbackCurrency: shipment.priceCurrency,
        trackingUrl: this.extractTrackingUrl(tracking) ?? shipment.trackingUrl,
      });
    } catch (error) {
      throw this.mapYandexError(error, 'refresh Yandex delivery claim');
    }
  }

  async cancelShipment(
    shipment: DeliveryShipmentContext & { reason?: string | null },
  ): Promise<DeliveryShipmentResult> {
    const claimId = this.requireClaimId(shipment);
    const version = this.extractVersion(shipment.rawProviderPayload);
    try {
      const cancelInfo = await this.client.getCancelInfo(claimId);
      const cancelled = await this.client.cancelClaim(claimId, version);
      return this.toShipmentResult(
        {
          ...cancelled,
          cancel_info: cancelInfo,
          cancel_reason: shipment.reason ?? null,
        },
        {
          fallbackStatus: 'cancelled',
          fallbackInternalStatus: 'CANCELLED',
          fallbackPrice: shipment.priceAmount,
          fallbackCurrency: shipment.priceCurrency,
          trackingUrl: shipment.trackingUrl,
          cancelledAt: new Date(),
        },
      );
    } catch (error) {
      throw this.mapYandexError(error, 'cancel Yandex delivery claim');
    }
  }

  private buildClaimPayload(context: DeliveryOrderContext) {
    const size = {
      length: this.cmToMeters(context.packageInfo.lengthCm),
      width: this.cmToMeters(context.packageInfo.widthCm),
      height: this.cmToMeters(context.packageInfo.heightCm),
    };
    return {
      client_requirements: {
        taxi_class: 'express',
      },
      items: [
        {
          extra_id: context.orderNumber,
          title: `Order ${context.orderNumber}`,
          pickup_point: 1,
          dropoff_point: 2,
          cost_value: '0.00',
          cost_currency: context.currency,
          quantity: 1,
          size,
          weight: Math.max(0.1, context.packageInfo.weightGram / 1000),
        },
      ],
      optional_return: false,
      route_points: [
        {
          point_id: 1,
          type: 'source',
          visit_order: 1,
          contact: {
            name: context.pickupContactName,
            phone: context.pickupContactPhone,
          },
          address: {
            fullname: context.pickupAddress,
            country: 'Россия',
            city: context.pickupCity,
          },
          skip_confirmation: true,
        },
        {
          point_id: 2,
          type: 'destination',
          visit_order: 2,
          contact: {
            name: context.customerName,
            phone: context.customerPhone,
          },
          address: {
            fullname: context.customerAddress,
            country: 'Россия',
            city: context.customerCity ?? context.pickupCity,
          },
          external_order_id: context.orderNumber,
          skip_confirmation: true,
        },
      ],
    };
  }

  private toShipmentResult(
    response: Record<string, unknown>,
    fallback: {
      fallbackStatus: string;
      fallbackInternalStatus: string;
      fallbackPrice: string | null;
      fallbackCurrency: string;
      trackingUrl: string | null;
      acceptedAt?: Date | null;
      cancelledAt?: Date | null;
    },
  ): DeliveryShipmentResult {
    const providerStatus =
      this.extractString(response.status) ?? fallback.fallbackStatus;
    return {
      provider: 'YANDEX',
      providerShipmentId: this.extractString(response.id),
      providerOrderNumber: this.extractString(response.user_request_revision),
      providerStatus,
      internalStatus:
        this.mapInternalStatus(providerStatus) ??
        fallback.fallbackInternalStatus,
      priceAmount: this.extractPrice(response) ?? fallback.fallbackPrice,
      priceCurrency:
        this.extractCurrency(response) ?? fallback.fallbackCurrency,
      trackingNumber: this.extractString(response.id),
      trackingUrl: fallback.trackingUrl,
      rawProviderPayload: response,
      acceptedAt:
        fallback.acceptedAt ??
        (providerStatus === 'accepted' ? new Date() : null),
      cancelledAt:
        fallback.cancelledAt ??
        (providerStatus.startsWith('cancelled') ? new Date() : null),
      deliveredAt: providerStatus.startsWith('delivered') ? new Date() : null,
    };
  }

  private assertYandexAllowed(context: DeliveryOrderContext) {
    if (!context.enabledCarriers.includes('YANDEX')) {
      throw new BadRequestException('Yandex Delivery is not enabled for shop.');
    }
    if (!context.customerCity) {
      throw new BadRequestException(
        'Yandex Delivery requires customer city in the shipping address.',
      );
    }
    const explicitProvider = (context as { provider?: string }).provider;
    if (!context.isSameCity && explicitProvider !== 'YANDEX') {
      throw new BadRequestException(
        'Yandex Delivery real mode is intended for same-city delivery unless the seller explicitly chooses Yandex.',
      );
    }
  }

  private requireClaimId(shipment: DeliveryShipmentContext) {
    if (!shipment.providerShipmentId) {
      throw new BadRequestException(
        'Yandex Delivery claim id is missing for this shipment.',
      );
    }
    return shipment.providerShipmentId;
  }

  private mapInternalStatus(status: string) {
    const normalized = status.toLowerCase();
    if (['new', 'estimating', 'ready_for_approval'].includes(normalized)) {
      return 'ESTIMATED';
    }
    if (
      ['accepted', 'performer_lookup', 'performer_draft'].includes(normalized)
    ) {
      return 'SEARCHING_COURIER';
    }
    if (
      [
        'performer_found',
        'pickup_arrived',
        'ready_for_pickup_confirmation',
      ].includes(normalized)
    ) {
      return 'ACCEPTED';
    }
    if (['pickuped', 'delivery_arrived'].includes(normalized)) {
      return 'IN_TRANSIT';
    }
    if (normalized.startsWith('delivered')) return 'DELIVERED';
    if (normalized.startsWith('cancelled')) return 'CANCELLED';
    if (normalized === 'failed' || normalized === 'performer_not_found') {
      return 'FAILED';
    }
    return null;
  }

  private mapYandexError(error: unknown, action: string) {
    if (error instanceof YandexDeliveryRequestError) {
      return new BadRequestException(`Unable to ${action}: ${error.message}`);
    }
    if (error instanceof BadRequestException) return error;
    return new BadRequestException(`Unable to ${action}.`);
  }

  private extractVersion(payload: Record<string, unknown> | null) {
    const version = payload?.version;
    return typeof version === 'number' ? version : 1;
  }

  private extractPrice(payload: Record<string, unknown>) {
    const pricing = this.asRecord(payload.pricing);
    const offer = this.asRecord(pricing?.offer);
    return (
      this.extractString(offer?.price) ??
      this.extractString(pricing?.final_price) ??
      this.extractString(payload.price)
    );
  }

  private extractCurrency(payload: Record<string, unknown>) {
    const pricing = this.asRecord(payload.pricing);
    return this.extractString(pricing?.currency);
  }

  private extractEta(payload: Record<string, unknown>) {
    return typeof payload.eta === 'number' ? payload.eta : null;
  }

  private extractOfferValidUntil(payload: Record<string, unknown>) {
    const pricing = this.asRecord(payload.pricing);
    const offer = this.asRecord(pricing?.offer);
    const value = this.extractString(offer?.valid_until);
    return value ? new Date(value) : null;
  }

  private extractTrackingUrl(payload: Record<string, unknown> | null) {
    if (!payload) return null;
    const direct = this.extractString(payload.tracking_link);
    if (direct) return direct;
    const links = Array.isArray(payload.links) ? payload.links : [];
    const first = this.asRecord(links[0]);
    return (
      this.extractString(first?.url) ??
      this.extractString(first?.tracking_link) ??
      null
    );
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private extractString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private cmToMeters(value: number) {
    return Math.max(0.01, Number((value / 100).toFixed(2)));
  }
}
