import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DELIVERY_PROVIDER,
  DELIVERY_TERMINAL_STATUSES,
} from './delivery.constants';
import { CalculateDeliveryOffersDto } from './dto/calculate-delivery-offers.dto';
import { CancelDeliveryShipmentDto } from './dto/cancel-delivery-shipment.dto';
import { CreateDeliveryShipmentDto } from './dto/create-delivery-shipment.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import type {
  DeliveryCarrierCode,
  DeliveryOrderContext,
  DeliveryShipmentContext,
  DeliverySettingsInput,
} from './delivery.types';
import type { DeliveryProvider } from './providers/delivery-provider.interface';

type OrderRecord = {
  id: string;
  shopId: string;
  orderNumber: string;
  paymentStatus: string;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  shop: {
    id: string;
    deliverySettings: {
      id: string;
      pickupCountry: string;
      pickupAddress: string;
      pickupCity: string;
      pickupPostalCode: string | null;
      pickupLatitude: Prisma.Decimal | null;
      pickupLongitude: Prisma.Decimal | null;
      pickupContactPhone: string;
      pickupContactName: string;
      pickupWorkingHours: string | null;
      pickupComment: string | null;
      enabledCarriers: Prisma.JsonValue;
      defaultCarrier: string;
      sameCityPreferredCarrier: string;
      interCityPreferredCarrier: string;
      fallbackCarrier: string;
      defaultWeightGram: number;
      defaultLengthCm: number;
      defaultWidthCm: number;
      defaultHeightCm: number;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  };
  deliveryOffers: Array<{
    id: string;
    provider: string;
    offerType: string;
    priceAmount: Prisma.Decimal;
    priceCurrency: string;
    estimatedMinDays: number | null;
    estimatedMaxDays: number | null;
    estimatedMinMinutes?: number | null;
    estimatedMaxMinutes?: number | null;
    pickupPointId: string | null;
    isRecommended?: boolean;
    expiresAt: Date | null;
    createdAt: Date;
  }>;
  deliveryShipments: Array<{
    id: string;
    provider: string;
    providerShipmentId: string | null;
    providerOrderNumber: string | null;
    providerStatus: string;
    internalStatus: string;
    priceAmount: Prisma.Decimal | null;
    priceCurrency: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    pickupAddress: string;
    dropoffAddress: string;
    rawProviderPayload: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    acceptedAt: Date | null;
    cancelledAt: Date | null;
    deliveredAt: Date | null;
    events: Array<{
      id: string;
      provider: string;
      eventType: string;
      providerStatus: string | null;
      message: string | null;
      createdAt: Date;
    }>;
  }>;
};

const PAID_STATUSES = new Set(['PAID']);

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(DELIVERY_PROVIDER) private readonly provider: DeliveryProvider,
  ) {}

  async getSettings(shopId: string) {
    const setting = await this.prisma.shopDeliverySetting.findUnique({
      where: { shopId },
    });

    if (!setting) {
      throw new NotFoundException(
        `Delivery settings were not found for shop ${shopId}.`,
      );
    }

    return this.toSettingsResponse(setting);
  }

  async updateSettings(shopId: string, dto: UpdateDeliverySettingsDto) {
    if (!dto.enabledCarriers.length) {
      throw new BadRequestException(
        'At least one enabled carrier is required.',
      );
    }

    if (!dto.enabledCarriers.includes(dto.defaultCarrier)) {
      throw new BadRequestException(
        'defaultCarrier must be one of enabledCarriers.',
      );
    }
    for (const field of [
      ['sameCityPreferredCarrier', dto.sameCityPreferredCarrier],
      ['interCityPreferredCarrier', dto.interCityPreferredCarrier],
      ['fallbackCarrier', dto.fallbackCarrier],
    ] as const) {
      if (!dto.enabledCarriers.includes(field[1])) {
        throw new BadRequestException(
          `${field[0]} must be one of enabledCarriers.`,
        );
      }
    }

    const setting = await this.prisma.shopDeliverySetting.upsert({
      where: { shopId },
      update: this.toSettingsData(dto),
      create: {
        id: randomUUID(),
        shopId,
        ...this.toSettingsData(dto),
      },
    });

    return this.toSettingsResponse(setting);
  }

  async calculateOffers(
    shopId: string,
    orderId: string,
    dto: CalculateDeliveryOffersDto,
  ) {
    const order = await this.findOrderOrThrow(shopId, orderId);
    const context = this.buildOrderContext(
      order,
      dto.pickupAddress,
      dto.packageInfo,
    );

    const offers = await this.provider.calculateOffers({
      ...context,
      enabledCarriers: dto.carriers?.length
        ? dto.carriers
        : context.enabledCarriers,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryOffer.deleteMany({
        where: { orderId: order.id },
      });
      for (const offer of offers) {
        await tx.deliveryOffer.create({
          data: {
            id: randomUUID(),
            shopId,
            orderId: order.id,
            provider: offer.provider,
            offerType: offer.offerType,
            priceAmount: new Prisma.Decimal(offer.priceAmount),
            priceCurrency: offer.priceCurrency,
            estimatedMinMinutes: offer.estimatedMinMinutes,
            estimatedMaxMinutes: offer.estimatedMaxMinutes,
            estimatedMinDays: offer.estimatedMinDays,
            estimatedMaxDays: offer.estimatedMaxDays,
            pickupPointId: offer.pickupPointId,
            isRecommended: offer.isRecommended,
            rawProviderPayload: this.toJsonInput(offer.rawProviderPayload),
            expiresAt: offer.expiresAt,
          },
        });
      }
    });

    const refreshed = await this.findOrderOrThrow(shopId, orderId);
    return {
      offers: refreshed.deliveryOffers.map((offer) =>
        this.toOfferResponse(offer),
      ),
    };
  }

  async createShipment(
    shopId: string,
    orderId: string,
    dto: CreateDeliveryShipmentDto,
  ) {
    const order = await this.findOrderOrThrow(shopId, orderId);
    this.assertOrderPaid(order);
    this.assertNoActiveShipment(order);

    const context = this.buildOrderContext(
      order,
      dto.pickupAddress,
      dto.packageInfo,
    );
    const provider = dto.provider ?? context.defaultCarrier;
    const selectedOffer =
      order.deliveryOffers.find((offer) => offer.id === dto.selectedOfferId) ??
      null;

    const created = await this.provider.createShipment({
      ...context,
      provider,
      selectedOffer: selectedOffer
        ? {
            provider: selectedOffer.provider as DeliveryCarrierCode,
            offerType: selectedOffer.offerType,
            priceAmount: selectedOffer.priceAmount.toString(),
            priceCurrency: selectedOffer.priceCurrency,
            estimatedMinMinutes: selectedOffer.estimatedMinMinutes ?? null,
            estimatedMaxMinutes: selectedOffer.estimatedMaxMinutes ?? null,
            estimatedMinDays: selectedOffer.estimatedMinDays,
            estimatedMaxDays: selectedOffer.estimatedMaxDays,
            pickupPointId: selectedOffer.pickupPointId,
            isRecommended: selectedOffer.isRecommended ?? false,
            rawProviderPayload: null,
            expiresAt: selectedOffer.expiresAt,
          }
        : null,
    });

    const shipment = await this.prisma.deliveryShipment.create({
      data: {
        id: randomUUID(),
        shopId,
        orderId: order.id,
        provider: created.provider,
        providerShipmentId: created.providerShipmentId,
        providerOrderNumber: created.providerOrderNumber,
        providerStatus: created.providerStatus,
        internalStatus: created.internalStatus,
        priceAmount: created.priceAmount
          ? new Prisma.Decimal(created.priceAmount)
          : null,
        priceCurrency: created.priceCurrency,
        trackingNumber: created.trackingNumber,
        trackingUrl: created.trackingUrl,
        pickupAddress: context.pickupAddress,
        dropoffAddress: order.shippingAddress,
        rawProviderPayload: this.toJsonInput(created.rawProviderPayload),
        acceptedAt: created.acceptedAt,
        cancelledAt: created.cancelledAt,
        deliveredAt: created.deliveredAt,
      },
    });

    await this.createEvent(
      shipment.id,
      shopId,
      orderId,
      created.provider,
      'SHIPMENT_CREATED',
      created.providerStatus,
      'Delivery shipment created.',
      created.rawProviderPayload,
    );

    return this.toShipmentResponse({
      ...shipment,
    });
  }

  async refreshShipment(shopId: string, orderId: string, shipmentId: string) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    const refreshed = await this.provider.refreshShipment(
      this.toShipmentContext(shipment),
    );

    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipmentId },
      data: {
        providerStatus: refreshed.providerStatus,
        internalStatus: refreshed.internalStatus,
        priceAmount: refreshed.priceAmount
          ? new Prisma.Decimal(refreshed.priceAmount)
          : shipment.priceAmount,
        priceCurrency: refreshed.priceCurrency,
        trackingNumber: refreshed.trackingNumber,
        trackingUrl: refreshed.trackingUrl,
        rawProviderPayload: this.toJsonInput(refreshed.rawProviderPayload),
        acceptedAt: refreshed.acceptedAt,
        cancelledAt: refreshed.cancelledAt,
        deliveredAt: refreshed.deliveredAt,
      },
    });

    await this.createEvent(
      shipmentId,
      shopId,
      orderId,
      refreshed.provider,
      'SHIPMENT_REFRESHED',
      refreshed.providerStatus,
      'Delivery shipment refreshed.',
      refreshed.rawProviderPayload,
    );

    return this.toShipmentResponse(updated);
  }

  async acceptShipment(shopId: string, orderId: string, shipmentId: string) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    if (!this.provider.acceptShipment) {
      throw new BadRequestException(
        'The active delivery provider does not support shipment acceptance.',
      );
    }

    const accepted = await this.provider.acceptShipment(
      this.toShipmentContext(shipment),
    );

    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipmentId },
      data: {
        providerStatus: accepted.providerStatus,
        internalStatus: accepted.internalStatus,
        priceAmount: accepted.priceAmount
          ? new Prisma.Decimal(accepted.priceAmount)
          : shipment.priceAmount,
        priceCurrency: accepted.priceCurrency,
        trackingNumber: accepted.trackingNumber,
        trackingUrl: accepted.trackingUrl,
        rawProviderPayload: this.toJsonInput(accepted.rawProviderPayload),
        acceptedAt: accepted.acceptedAt ?? new Date(),
        cancelledAt: accepted.cancelledAt,
        deliveredAt: accepted.deliveredAt,
      },
    });

    await this.createEvent(
      shipmentId,
      shopId,
      orderId,
      accepted.provider,
      'SHIPMENT_ACCEPTED',
      accepted.providerStatus,
      'Delivery shipment accepted.',
      accepted.rawProviderPayload,
    );

    return this.toShipmentResponse(updated);
  }

  async cancelShipment(
    shopId: string,
    orderId: string,
    shipmentId: string,
    dto: CancelDeliveryShipmentDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    const cancelled = await this.provider.cancelShipment({
      ...this.toShipmentContext(shipment),
      reason: dto.reason?.trim() || null,
    });

    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipmentId },
      data: {
        providerStatus: cancelled.providerStatus,
        internalStatus: cancelled.internalStatus,
        trackingNumber: cancelled.trackingNumber,
        trackingUrl: cancelled.trackingUrl,
        rawProviderPayload: this.toJsonInput(cancelled.rawProviderPayload),
        cancelledAt: cancelled.cancelledAt ?? new Date(),
      },
    });

    await this.createEvent(
      shipmentId,
      shopId,
      orderId,
      cancelled.provider,
      'SHIPMENT_CANCELLED',
      cancelled.providerStatus,
      dto.reason?.trim() || 'Delivery shipment cancelled.',
      cancelled.rawProviderPayload,
    );

    return this.toShipmentResponse(updated);
  }

  async getDelivery(shopId: string, orderId: string) {
    const order = await this.findOrderOrThrow(shopId, orderId);
    const activeShipment =
      order.deliveryShipments.find(
        (shipment) =>
          !DELIVERY_TERMINAL_STATUSES.includes(
            shipment.internalStatus as (typeof DELIVERY_TERMINAL_STATUSES)[number],
          ),
      ) ??
      order.deliveryShipments[0] ??
      null;

    const events = order.deliveryShipments
      .flatMap((shipment) => shipment.events)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      orderId: order.id,
      shopId,
      activeShipment: activeShipment
        ? this.toShipmentResponse(activeShipment)
        : null,
      offers: order.deliveryOffers.map((offer) => this.toOfferResponse(offer)),
      events: events.map((event) => ({
        id: event.id,
        provider: event.provider,
        eventType: event.eventType,
        providerStatus: event.providerStatus,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  private async findOrderOrThrow(shopId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, shopId },
      include: {
        shop: {
          select: {
            id: true,
            deliverySettings: true,
          },
        },
        deliveryOffers: {
          orderBy: { createdAt: 'desc' },
        },
        deliveryShipments: {
          orderBy: { createdAt: 'desc' },
          include: {
            events: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return order as unknown as OrderRecord;
  }

  private async findShipmentOrThrow(
    shopId: string,
    orderId: string,
    shipmentId: string,
  ) {
    const shipment = await this.prisma.deliveryShipment.findFirst({
      where: {
        id: shipmentId,
        shopId,
        orderId,
      },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Delivery shipment ${shipmentId} was not found for order ${orderId}.`,
      );
    }

    return shipment;
  }

  private buildOrderContext(
    order: OrderRecord,
    pickupAddressOverride?: string,
    packageInfoOverride?: {
      weightGram: number;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    },
  ): DeliveryOrderContext {
    const settings = order.shop.deliverySettings;
    if (!settings) {
      throw new BadRequestException(
        'Shop delivery settings must be configured before calculating offers or creating shipments.',
      );
    }
    if (
      !settings.pickupAddress.trim() ||
      !settings.pickupCity.trim() ||
      !settings.pickupContactPhone.trim() ||
      !settings.pickupContactName.trim()
    ) {
      throw new BadRequestException(
        'Shop delivery settings must include pickup address, city, contact name, and contact phone.',
      );
    }

    if (!order.customerPhone.trim() || !order.shippingAddress.trim()) {
      throw new BadRequestException(
        'Order must contain customer phone and shipping address.',
      );
    }
    const customerCity = this.inferCustomerCity(order.shippingAddress);

    return {
      shopId: order.shopId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.shippingAddress,
      customerCity,
      pickupAddress: pickupAddressOverride?.trim() || settings.pickupAddress,
      pickupCity: settings.pickupCity,
      pickupPostalCode: settings.pickupPostalCode,
      pickupContactPhone: settings.pickupContactPhone,
      pickupContactName: settings.pickupContactName,
      enabledCarriers: this.readCarrierList(settings.enabledCarriers),
      defaultCarrier: settings.defaultCarrier as DeliveryCarrierCode,
      sameCityPreferredCarrier:
        settings.sameCityPreferredCarrier as DeliveryCarrierCode,
      interCityPreferredCarrier:
        settings.interCityPreferredCarrier as DeliveryCarrierCode,
      fallbackCarrier: settings.fallbackCarrier as DeliveryCarrierCode,
      isSameCity:
        this.normalizeCity(settings.pickupCity) ===
        this.normalizeCity(customerCity),
      packageInfo: {
        weightGram:
          packageInfoOverride?.weightGram ?? settings.defaultWeightGram,
        lengthCm: packageInfoOverride?.lengthCm ?? settings.defaultLengthCm,
        widthCm: packageInfoOverride?.widthCm ?? settings.defaultWidthCm,
        heightCm: packageInfoOverride?.heightCm ?? settings.defaultHeightCm,
      },
      currency: this.configService.get<string>(
        'CDEK_DEFAULT_CURRENCY',
        this.configService.get<string>(
          'YANDEX_DELIVERY_DEFAULT_CURRENCY',
          'RUB',
        ),
      ),
    };
  }

  private assertOrderPaid(order: OrderRecord) {
    if (!PAID_STATUSES.has(order.paymentStatus)) {
      throw new BadRequestException(
        'Delivery shipment can only be created for PAID orders.',
      );
    }
  }

  private assertNoActiveShipment(order: OrderRecord) {
    const activeShipment = order.deliveryShipments.find(
      (shipment) =>
        !DELIVERY_TERMINAL_STATUSES.includes(
          shipment.internalStatus as (typeof DELIVERY_TERMINAL_STATUSES)[number],
        ),
    );
    if (activeShipment) {
      throw new BadRequestException(
        'This order already has an active delivery shipment.',
      );
    }
  }

  private toShipmentContext(shipment: {
    id: string;
    provider: string;
    providerShipmentId: string | null;
    providerOrderNumber: string | null;
    providerStatus: string;
    internalStatus: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    priceAmount: Prisma.Decimal | null;
    priceCurrency: string;
    pickupAddress: string;
    dropoffAddress: string;
    rawProviderPayload: Prisma.JsonValue | null;
  }): DeliveryShipmentContext {
    return {
      shipmentId: shipment.id,
      provider: shipment.provider as DeliveryCarrierCode,
      providerShipmentId: shipment.providerShipmentId,
      providerOrderNumber: shipment.providerOrderNumber,
      providerStatus: shipment.providerStatus,
      internalStatus: shipment.internalStatus,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      priceAmount: shipment.priceAmount?.toString() ?? null,
      priceCurrency: shipment.priceCurrency,
      pickupAddress: shipment.pickupAddress,
      dropoffAddress: shipment.dropoffAddress,
      rawProviderPayload: this.toPlainObject(shipment.rawProviderPayload),
    };
  }

  private async createEvent(
    deliveryShipmentId: string,
    shopId: string,
    orderId: string,
    provider: string,
    eventType: string,
    providerStatus: string,
    message: string,
    rawPayload: Record<string, unknown> | null,
  ) {
    await this.prisma.deliveryEvent.create({
      data: {
        id: randomUUID(),
        deliveryShipmentId,
        shopId,
        orderId,
        provider,
        eventType,
        providerStatus,
        message,
        rawPayload: this.toJsonInput(rawPayload),
      },
    });
  }

  private toSettingsData(
    dto: UpdateDeliverySettingsDto,
  ): DeliverySettingsInput {
    return {
      pickupCountry: dto.pickupCountry?.trim() || 'RU',
      pickupAddress: dto.pickupAddress.trim(),
      pickupCity: dto.pickupCity.trim(),
      pickupPostalCode: dto.pickupPostalCode?.trim() || null,
      pickupLatitude: dto.pickupLatitude ?? null,
      pickupLongitude: dto.pickupLongitude ?? null,
      pickupContactPhone: dto.pickupContactPhone.trim(),
      pickupContactName: dto.pickupContactName.trim(),
      pickupWorkingHours: dto.pickupWorkingHours?.trim() || null,
      pickupComment: dto.pickupComment?.trim() || null,
      enabledCarriers: dto.enabledCarriers,
      defaultCarrier: dto.defaultCarrier,
      sameCityPreferredCarrier: dto.sameCityPreferredCarrier,
      interCityPreferredCarrier: dto.interCityPreferredCarrier,
      fallbackCarrier: dto.fallbackCarrier,
      defaultWeightGram: dto.defaultWeightGram,
      defaultLengthCm: dto.defaultLengthCm,
      defaultWidthCm: dto.defaultWidthCm,
      defaultHeightCm: dto.defaultHeightCm,
    };
  }

  private toSettingsResponse(setting: {
    shopId: string;
    pickupCountry: string;
    pickupAddress: string;
    pickupCity: string;
    pickupPostalCode: string | null;
    pickupLatitude: Prisma.Decimal | null;
    pickupLongitude: Prisma.Decimal | null;
    pickupContactPhone: string;
    pickupContactName: string;
    pickupWorkingHours: string | null;
    pickupComment: string | null;
    enabledCarriers: Prisma.JsonValue;
    defaultCarrier: string;
    sameCityPreferredCarrier: string;
    interCityPreferredCarrier: string;
    fallbackCarrier: string;
    defaultWeightGram: number;
    defaultLengthCm: number;
    defaultWidthCm: number;
    defaultHeightCm: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      shopId: setting.shopId,
      pickupCountry: setting.pickupCountry,
      pickupAddress: setting.pickupAddress,
      pickupCity: setting.pickupCity,
      pickupPostalCode: setting.pickupPostalCode,
      pickupLatitude: setting.pickupLatitude?.toString() ?? null,
      pickupLongitude: setting.pickupLongitude?.toString() ?? null,
      pickupContactPhone: setting.pickupContactPhone,
      pickupContactName: setting.pickupContactName,
      pickupWorkingHours: setting.pickupWorkingHours,
      pickupComment: setting.pickupComment,
      enabledCarriers: this.readCarrierList(setting.enabledCarriers),
      defaultCarrier: setting.defaultCarrier,
      sameCityPreferredCarrier: setting.sameCityPreferredCarrier,
      interCityPreferredCarrier: setting.interCityPreferredCarrier,
      fallbackCarrier: setting.fallbackCarrier,
      defaultWeightGram: setting.defaultWeightGram,
      defaultLengthCm: setting.defaultLengthCm,
      defaultWidthCm: setting.defaultWidthCm,
      defaultHeightCm: setting.defaultHeightCm,
      createdAt: setting.createdAt.toISOString(),
      updatedAt: setting.updatedAt.toISOString(),
    };
  }

  private toOfferResponse(offer: {
    id: string;
    provider: string;
    offerType: string;
    priceAmount: Prisma.Decimal;
    priceCurrency: string;
    estimatedMinMinutes?: number | null;
    estimatedMaxMinutes?: number | null;
    estimatedMinDays: number | null;
    estimatedMaxDays: number | null;
    pickupPointId: string | null;
    isRecommended?: boolean;
    expiresAt: Date | null;
  }) {
    return {
      id: offer.id,
      provider: offer.provider,
      offerType: offer.offerType,
      priceAmount: offer.priceAmount.toString(),
      priceCurrency: offer.priceCurrency,
      estimatedMinMinutes: offer.estimatedMinMinutes ?? null,
      estimatedMaxMinutes: offer.estimatedMaxMinutes ?? null,
      estimatedMinDays: offer.estimatedMinDays,
      estimatedMaxDays: offer.estimatedMaxDays,
      pickupPointId: offer.pickupPointId,
      isRecommended: offer.isRecommended ?? false,
      expiresAt: offer.expiresAt?.toISOString() ?? null,
    };
  }

  private toShipmentResponse(shipment: {
    id: string;
    provider: string;
    providerShipmentId: string | null;
    providerOrderNumber: string | null;
    providerStatus: string;
    internalStatus: string;
    priceAmount: Prisma.Decimal | null;
    priceCurrency: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    pickupAddress: string;
    dropoffAddress: string;
    createdAt: Date;
    updatedAt: Date;
    acceptedAt: Date | null;
    cancelledAt: Date | null;
    deliveredAt: Date | null;
  }) {
    return {
      id: shipment.id,
      provider: shipment.provider,
      providerShipmentId: shipment.providerShipmentId,
      providerOrderNumber: shipment.providerOrderNumber,
      providerStatus: shipment.providerStatus,
      internalStatus: shipment.internalStatus,
      priceAmount: shipment.priceAmount?.toString() ?? null,
      priceCurrency: shipment.priceCurrency,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      pickupAddress: shipment.pickupAddress,
      dropoffAddress: shipment.dropoffAddress,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      acceptedAt: shipment.acceptedAt?.toISOString() ?? null,
      cancelledAt: shipment.cancelledAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    };
  }

  private readCarrierList(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) {
      return ['CDEK'] as DeliveryCarrierCode[];
    }
    return value.filter(
      (item): item is DeliveryCarrierCode =>
        item === 'CDEK' || item === 'YANDEX',
    );
  }

  private inferCustomerCity(address: string) {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }

  private normalizeCity(city: string | null) {
    return (
      city
        ?.trim()
        .toLocaleLowerCase('ru-RU')
        .replace(/^г\.?\s+/u, '')
        .replace(/\s+/g, ' ') ?? ''
    );
  }

  private toJsonInput(value: Record<string, unknown> | null) {
    return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
  }

  private toPlainObject(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
