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
      pickupAddress: string;
      pickupCity: string;
      pickupPostalCode: string | null;
      pickupPhone: string;
      pickupContactName: string;
      enabledCarriers: Prisma.JsonValue;
      defaultCarrier: string;
      defaultWeight: Prisma.Decimal;
      defaultLength: Prisma.Decimal;
      defaultWidth: Prisma.Decimal;
      defaultHeight: Prisma.Decimal;
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
    pickupPointId: string | null;
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
            estimatedMinDays: offer.estimatedMinDays,
            estimatedMaxDays: offer.estimatedMaxDays,
            pickupPointId: offer.pickupPointId,
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
            estimatedMinDays: selectedOffer.estimatedMinDays,
            estimatedMaxDays: selectedOffer.estimatedMaxDays,
            pickupPointId: selectedOffer.pickupPointId,
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
      weightKg: number;
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

    if (!order.customerPhone.trim() || !order.shippingAddress.trim()) {
      throw new BadRequestException(
        'Order must contain customer phone and shipping address.',
      );
    }

    return {
      shopId: order.shopId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.shippingAddress,
      pickupAddress: pickupAddressOverride?.trim() || settings.pickupAddress,
      pickupCity: settings.pickupCity,
      pickupPostalCode: settings.pickupPostalCode,
      pickupPhone: settings.pickupPhone,
      pickupContactName: settings.pickupContactName,
      enabledCarriers: this.readCarrierList(settings.enabledCarriers),
      defaultCarrier: settings.defaultCarrier as DeliveryCarrierCode,
      packageInfo: {
        weightKg:
          packageInfoOverride?.weightKg ??
          Number(settings.defaultWeight.toString()),
        lengthCm:
          packageInfoOverride?.lengthCm ??
          Number(settings.defaultLength.toString()),
        widthCm:
          packageInfoOverride?.widthCm ??
          Number(settings.defaultWidth.toString()),
        heightCm:
          packageInfoOverride?.heightCm ??
          Number(settings.defaultHeight.toString()),
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
      pickupAddress: dto.pickupAddress.trim(),
      pickupCity: dto.pickupCity.trim(),
      pickupPostalCode: dto.pickupPostalCode?.trim() || null,
      pickupPhone: dto.pickupPhone.trim(),
      pickupContactName: dto.pickupContactName.trim(),
      enabledCarriers: dto.enabledCarriers,
      defaultCarrier: dto.defaultCarrier,
      defaultWeight: dto.defaultWeight,
      defaultLength: dto.defaultLength,
      defaultWidth: dto.defaultWidth,
      defaultHeight: dto.defaultHeight,
    };
  }

  private toSettingsResponse(setting: {
    shopId: string;
    pickupAddress: string;
    pickupCity: string;
    pickupPostalCode: string | null;
    pickupPhone: string;
    pickupContactName: string;
    enabledCarriers: Prisma.JsonValue;
    defaultCarrier: string;
    defaultWeight: Prisma.Decimal;
    defaultLength: Prisma.Decimal;
    defaultWidth: Prisma.Decimal;
    defaultHeight: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      shopId: setting.shopId,
      pickupAddress: setting.pickupAddress,
      pickupCity: setting.pickupCity,
      pickupPostalCode: setting.pickupPostalCode,
      pickupPhone: setting.pickupPhone,
      pickupContactName: setting.pickupContactName,
      enabledCarriers: this.readCarrierList(setting.enabledCarriers),
      defaultCarrier: setting.defaultCarrier,
      defaultWeight: setting.defaultWeight.toString(),
      defaultLength: setting.defaultLength.toString(),
      defaultWidth: setting.defaultWidth.toString(),
      defaultHeight: setting.defaultHeight.toString(),
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
    estimatedMinDays: number | null;
    estimatedMaxDays: number | null;
    pickupPointId: string | null;
    expiresAt: Date | null;
  }) {
    return {
      id: offer.id,
      provider: offer.provider,
      offerType: offer.offerType,
      priceAmount: offer.priceAmount.toString(),
      priceCurrency: offer.priceCurrency,
      estimatedMinDays: offer.estimatedMinDays,
      estimatedMaxDays: offer.estimatedMaxDays,
      pickupPointId: offer.pickupPointId,
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
