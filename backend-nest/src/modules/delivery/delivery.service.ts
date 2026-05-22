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
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  DELIVERY_CARRIERS,
  DELIVERY_EXCEPTION_STATUSES,
  DELIVERY_PROVIDER,
  DELIVERY_TERMINAL_STATUSES,
} from './delivery.constants';
import { CalculateDeliveryOffersDto } from './dto/calculate-delivery-offers.dto';
import { CancelDeliveryShipmentDto } from './dto/cancel-delivery-shipment.dto';
import { CreateDeliveryShipmentDto } from './dto/create-delivery-shipment.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { ListAdminDeliveriesQueryDto } from './dto/list-admin-deliveries-query.dto';
import {
  AdminUpdateManualDeliveryDto,
  DeliveryCommentDto,
  DeliveryTransitionDto,
  MarkDeliveryExceptionDto,
  UpdateCustomerDeliveryMessageDto,
  UpsertManualDeliveryDto,
} from './dto/manual-delivery.dto';
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
  status: string;
  paymentStatus: string;
  shippingAddress: string;
  shippingLatitude?: Prisma.Decimal | null;
  shippingLongitude?: Prisma.Decimal | null;
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
    courierName: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: Date | null;
    packagePreset: string | null;
    packageWeightGram: number | null;
    packageLengthCm: number | null;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    pickupLatitude: Prisma.Decimal | null;
    pickupLongitude: Prisma.Decimal | null;
    dropoffLatitude: Prisma.Decimal | null;
    dropoffLongitude: Prisma.Decimal | null;
    recipientName: string | null;
    recipientPhone: string | null;
    manualYandexOrderId: string | null;
    yandexClaimId: string | null;
    yandexStatus: string | null;
    yandexPrice: Prisma.Decimal | null;
    yandexTrackingLink: string | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    failureReasonText: string | null;
    failedAt: Date | null;
    customerVisibleMessage: string | null;
    lastAdminNote: string | null;
    lastSellerNote: string | null;
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
      actorUserId: string | null;
      actorRole: string | null;
      action: string | null;
      oldStatus: string | null;
      newStatus: string | null;
      message: string | null;
      createdAt: Date;
    }>;
    comments: Array<{
      id: string;
      actorUserId: string | null;
      actorRole: string;
      visibility: string;
      message: string;
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

    await this.createEvent({
      deliveryShipmentId: shipment.id,
      shopId,
      orderId,
      provider: created.provider,
      eventType: 'SHIPMENT_CREATED',
      providerStatus: created.providerStatus,
      message: 'Delivery shipment created.',
      rawPayload: created.rawProviderPayload,
      oldStatus: 'NOT_CREATED',
      newStatus: created.internalStatus,
    });

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

    await this.createEvent({
      deliveryShipmentId: shipmentId,
      shopId,
      orderId,
      provider: refreshed.provider,
      eventType: 'SHIPMENT_REFRESHED',
      providerStatus: refreshed.providerStatus,
      message: 'Delivery shipment refreshed.',
      rawPayload: refreshed.rawProviderPayload,
      oldStatus: shipment.internalStatus,
      newStatus: refreshed.internalStatus,
    });

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

    await this.createEvent({
      deliveryShipmentId: shipmentId,
      shopId,
      orderId,
      provider: accepted.provider,
      eventType: 'SHIPMENT_ACCEPTED',
      providerStatus: accepted.providerStatus,
      message: 'Delivery shipment accepted.',
      rawPayload: accepted.rawProviderPayload,
      oldStatus: shipment.internalStatus,
      newStatus: accepted.internalStatus,
    });

    return this.toShipmentResponse(updated);
  }

  async cancelShipment(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: CancelDeliveryShipmentDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    if (
      shipment.internalStatus === 'CREATED_MANUALLY' ||
      shipment.provider === 'MANUAL' ||
      this.toPlainObject(shipment.rawProviderPayload)?.source ===
        'seller_manual'
    ) {
      if (shipment.internalStatus === 'DELIVERED') {
        throw new BadRequestException(
          'Delivered shipment cannot be cancelled.',
        );
      }
      return this.transitionLoadedShipment(
        shipment,
        user,
        'CANCELLED',
        'MANUAL_DELIVERY_CANCELLED',
        dto.reason?.trim() || 'Manual delivery cancelled.',
      );
    }
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

    await this.createEvent({
      deliveryShipmentId: shipmentId,
      shopId,
      orderId,
      provider: cancelled.provider,
      eventType: 'SHIPMENT_CANCELLED',
      providerStatus: cancelled.providerStatus,
      message: dto.reason?.trim() || 'Delivery shipment cancelled.',
      rawPayload: cancelled.rawProviderPayload,
      oldStatus: shipment.internalStatus,
      newStatus: cancelled.internalStatus,
    });

    return this.toShipmentResponse(updated);
  }

  async createManualDelivery(
    shopId: string,
    orderId: string,
    user: AuthenticatedUser,
    dto: UpsertManualDeliveryDto,
  ) {
    const order = await this.findOrderOrThrow(shopId, orderId);
    this.assertOrderPaid(order);
    this.assertNoActiveShipment(order);
    this.assertManualProvider(dto.provider);

    const shipment = await this.prisma.deliveryShipment.create({
      data: {
        id: randomUUID(),
        shopId,
        orderId: order.id,
        provider: dto.provider,
        providerShipmentId: this.clean(dto.providerShipmentId),
        providerOrderNumber:
          this.clean(dto.providerOrderNumber) ??
          this.clean(dto.manualYandexOrderId),
        providerStatus:
          dto.provider === 'YANDEX'
            ? 'YANDEX_MANUAL_CREATED'
            : 'CREATED_MANUALLY',
        internalStatus:
          dto.provider === 'YANDEX'
            ? 'YANDEX_MANUAL_CREATED'
            : 'CREATED_MANUALLY',
        priceAmount:
          dto.deliveryPrice !== undefined && dto.deliveryPrice !== null
            ? new Prisma.Decimal(dto.deliveryPrice)
            : null,
        priceCurrency: this.configService.get<string>(
          'MANUAL_DELIVERY_DEFAULT_CURRENCY',
          'RUB',
        ),
        trackingNumber: this.clean(dto.trackingNumber),
        trackingUrl: this.clean(dto.trackingUrl),
        courierName: this.clean(dto.courierName),
        courierPhone: this.clean(dto.courierPhone),
        estimatedDeliveryAt: dto.estimatedDeliveryAt
          ? new Date(dto.estimatedDeliveryAt)
          : null,
        packagePreset: this.clean(dto.packagePreset),
        packageWeightGram: dto.packageWeightGram ?? null,
        packageLengthCm: dto.packageLengthCm ?? null,
        packageWidthCm: dto.packageWidthCm ?? null,
        packageHeightCm: dto.packageHeightCm ?? null,
        deliveryNote: this.clean(dto.deliveryNote),
        pickupAddress:
          this.clean(dto.pickupAddress) ??
          order.shop.deliverySettings?.pickupAddress ??
          'Seller-managed pickup',
        pickupLatitude:
          dto.pickupLatitude !== undefined && dto.pickupLatitude !== null
            ? new Prisma.Decimal(dto.pickupLatitude)
            : (order.shop.deliverySettings?.pickupLatitude ?? null),
        pickupLongitude:
          dto.pickupLongitude !== undefined && dto.pickupLongitude !== null
            ? new Prisma.Decimal(dto.pickupLongitude)
            : (order.shop.deliverySettings?.pickupLongitude ?? null),
        dropoffAddress: order.shippingAddress,
        dropoffLatitude:
          dto.dropoffLatitude !== undefined && dto.dropoffLatitude !== null
            ? new Prisma.Decimal(dto.dropoffLatitude)
            : (order.shippingLatitude ?? null),
        dropoffLongitude:
          dto.dropoffLongitude !== undefined && dto.dropoffLongitude !== null
            ? new Prisma.Decimal(dto.dropoffLongitude)
            : (order.shippingLongitude ?? null),
        recipientName: this.clean(dto.recipientName) ?? order.customerName,
        recipientPhone: this.clean(dto.recipientPhone) ?? order.customerPhone,
        manualYandexOrderId: this.clean(dto.manualYandexOrderId),
        yandexClaimId: this.clean(dto.yandexClaimId),
        yandexStatus:
          this.clean(dto.yandexStatus) ??
          (dto.provider === 'YANDEX' ? 'MANUAL_CREATED' : null),
        yandexPrice:
          dto.deliveryPrice !== undefined && dto.deliveryPrice !== null
            ? new Prisma.Decimal(dto.deliveryPrice)
            : null,
        yandexTrackingLink:
          this.clean(dto.yandexTrackingLink) ?? this.clean(dto.trackingUrl),
        rawProviderPayload: this.toJsonInput({
          source: 'seller_manual',
          note: this.clean(dto.note),
        }),
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status:
          dto.provider === 'YANDEX' ? 'YANDEX_MANUAL_CREATED' : 'ASSEMBLING',
      },
    });

    await this.createEvent({
      deliveryShipmentId: shipment.id,
      shopId,
      orderId,
      provider: shipment.provider,
      eventType: 'MANUAL_DELIVERY_CREATED',
      providerStatus: shipment.providerStatus,
      message: this.clean(dto.note) ?? 'Seller created manual delivery.',
      rawPayload: { source: 'seller_manual' },
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'CREATE_DELIVERY',
      oldStatus: 'NOT_CREATED',
      newStatus: shipment.internalStatus,
    });

    return this.toShipmentResponse(shipment);
  }

  async updateManualDelivery(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: UpsertManualDeliveryDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    this.assertManualProvider(dto.provider);

    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipmentId },
      data: {
        provider: dto.provider,
        providerShipmentId: this.clean(dto.providerShipmentId),
        providerOrderNumber:
          this.clean(dto.providerOrderNumber) ??
          this.clean(dto.manualYandexOrderId),
        trackingNumber: this.clean(dto.trackingNumber),
        trackingUrl: this.clean(dto.trackingUrl),
        courierName: this.clean(dto.courierName),
        courierPhone: this.clean(dto.courierPhone),
        estimatedDeliveryAt: dto.estimatedDeliveryAt
          ? new Date(dto.estimatedDeliveryAt)
          : null,
        packagePreset: this.clean(dto.packagePreset),
        packageWeightGram: dto.packageWeightGram ?? shipment.packageWeightGram,
        packageLengthCm: dto.packageLengthCm ?? shipment.packageLengthCm,
        packageWidthCm: dto.packageWidthCm ?? shipment.packageWidthCm,
        packageHeightCm: dto.packageHeightCm ?? shipment.packageHeightCm,
        deliveryNote: this.clean(dto.deliveryNote),
        pickupAddress: this.clean(dto.pickupAddress) ?? shipment.pickupAddress,
        pickupLatitude:
          dto.pickupLatitude !== undefined
            ? dto.pickupLatitude !== null
              ? new Prisma.Decimal(dto.pickupLatitude)
              : null
            : shipment.pickupLatitude,
        pickupLongitude:
          dto.pickupLongitude !== undefined
            ? dto.pickupLongitude !== null
              ? new Prisma.Decimal(dto.pickupLongitude)
              : null
            : shipment.pickupLongitude,
        dropoffLatitude:
          dto.dropoffLatitude !== undefined
            ? dto.dropoffLatitude !== null
              ? new Prisma.Decimal(dto.dropoffLatitude)
              : null
            : shipment.dropoffLatitude,
        dropoffLongitude:
          dto.dropoffLongitude !== undefined
            ? dto.dropoffLongitude !== null
              ? new Prisma.Decimal(dto.dropoffLongitude)
              : null
            : shipment.dropoffLongitude,
        recipientName: this.clean(dto.recipientName) ?? shipment.recipientName,
        recipientPhone:
          this.clean(dto.recipientPhone) ?? shipment.recipientPhone,
        manualYandexOrderId:
          this.clean(dto.manualYandexOrderId) ?? shipment.manualYandexOrderId,
        yandexClaimId: this.clean(dto.yandexClaimId) ?? shipment.yandexClaimId,
        yandexStatus:
          this.clean(dto.yandexStatus) ??
          shipment.yandexStatus ??
          (dto.provider === 'YANDEX' ? shipment.internalStatus : null),
        yandexPrice:
          dto.deliveryPrice !== undefined && dto.deliveryPrice !== null
            ? new Prisma.Decimal(dto.deliveryPrice)
            : shipment.yandexPrice,
        yandexTrackingLink:
          this.clean(dto.yandexTrackingLink) ??
          this.clean(dto.trackingUrl) ??
          shipment.yandexTrackingLink,
      },
    });

    await this.createEvent({
      deliveryShipmentId: shipmentId,
      shopId,
      orderId,
      provider: updated.provider,
      eventType: 'MANUAL_DELIVERY_UPDATED',
      providerStatus: updated.providerStatus,
      message: this.clean(dto.note) ?? 'Manual delivery details updated.',
      rawPayload: { source: 'seller_manual' },
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'UPDATE_DELIVERY',
      oldStatus: shipment.internalStatus,
      newStatus: updated.internalStatus,
    });

    return this.toShipmentResponse(updated);
  }

  async markManualInTransit(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    return this.transitionManualShipment(
      shopId,
      orderId,
      shipmentId,
      user,
      'ON_THE_WAY',
      'MANUAL_DELIVERY_ON_THE_WAY',
      this.clean(dto.note) ?? 'Manual Yandex delivery is on the way.',
      dto,
    );
  }

  async markManualCourierAssigned(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    return this.transitionManualShipment(
      shopId,
      orderId,
      shipmentId,
      user,
      'COURIER_ASSIGNED',
      'MANUAL_DELIVERY_COURIER_ASSIGNED',
      this.clean(dto.note) ?? 'Courier assigned in Yandex manual workbench.',
      dto,
    );
  }

  async markManualPickedUp(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    return this.transitionManualShipment(
      shopId,
      orderId,
      shipmentId,
      user,
      'PICKED_UP',
      'MANUAL_DELIVERY_PICKED_UP',
      this.clean(dto.note) ?? 'Courier picked up the package.',
      dto,
    );
  }

  async markManualDelivered(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    return this.transitionManualShipment(
      shopId,
      orderId,
      shipmentId,
      user,
      'DELIVERED',
      'MANUAL_DELIVERY_DELIVERED',
      this.clean(dto.note) ?? 'Manual delivery marked delivered.',
    );
  }

  async cancelManualShipment(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    if (shipment.internalStatus === 'DELIVERED') {
      throw new BadRequestException('Delivered shipment cannot be cancelled.');
    }

    return this.transitionLoadedShipment(
      shipment,
      user,
      'CANCELLED',
      'MANUAL_DELIVERY_CANCELLED',
      this.clean(dto.note) ?? 'Manual delivery cancelled.',
    );
  }

  async listAdminDeliveries(query: ListAdminDeliveriesQueryDto) {
    if (
      query.paidWithoutDelivery ||
      query.status === 'READY_TO_CREATE_YANDEX'
    ) {
      const orders = await this.prisma.order.findMany({
        where: this.buildPaidWithoutDeliveryWhere(query),
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: this.adminOrderInclude,
      });
      return {
        items: orders.map((order) => this.toAdminOrderDeliveryRow(order)),
      };
    }

    const shipments = await this.prisma.deliveryShipment.findMany({
      where: this.buildAdminShipmentWhere(query),
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: this.adminShipmentInclude,
    });

    return {
      items: shipments.map((shipment) => this.toAdminShipmentRow(shipment)),
    };
  }

  async getAdminDelivery(deliveryShipmentId: string) {
    const shipment = await this.prisma.deliveryShipment.findUnique({
      where: { id: deliveryShipmentId },
      include: this.adminShipmentInclude,
    });
    if (!shipment) {
      throw new NotFoundException(
        `Delivery shipment ${deliveryShipmentId} was not found.`,
      );
    }
    return this.toAdminShipmentRow(shipment);
  }

  async adminUpdateDelivery(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: AdminUpdateManualDeliveryDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    this.assertManualProvider(dto.provider);

    const nextStatus = dto.internalStatus ?? shipment.internalStatus;
    const updated = await this.prisma.deliveryShipment.update({
      where: { id: deliveryShipmentId },
      data: {
        provider: dto.provider,
        providerShipmentId: this.clean(dto.providerShipmentId),
        providerOrderNumber: this.clean(dto.providerOrderNumber),
        trackingNumber: this.clean(dto.trackingNumber),
        trackingUrl: this.clean(dto.trackingUrl),
        courierPhone: this.clean(dto.courierPhone),
        estimatedDeliveryAt: dto.estimatedDeliveryAt
          ? new Date(dto.estimatedDeliveryAt)
          : null,
        deliveryNote: this.clean(dto.deliveryNote),
        pickupAddress: this.clean(dto.pickupAddress) ?? shipment.pickupAddress,
        providerStatus: nextStatus,
        internalStatus: nextStatus,
        acceptedAt:
          nextStatus === 'IN_TRANSIT' ? new Date() : shipment.acceptedAt,
        deliveredAt:
          nextStatus === 'DELIVERED' ? new Date() : shipment.deliveredAt,
        cancelledAt:
          nextStatus === 'CANCELLED' ? new Date() : shipment.cancelledAt,
      },
      include: this.adminShipmentInclude,
    });

    await this.createEvent({
      deliveryShipmentId,
      shopId: shipment.shopId,
      orderId: shipment.orderId,
      provider: updated.provider,
      eventType: 'ADMIN_DELIVERY_OVERRIDE',
      providerStatus: updated.providerStatus,
      message: this.clean(dto.note) ?? 'Admin updated manual delivery.',
      rawPayload: { source: 'admin_override' },
      actorUserId: admin.userId,
      actorRole: admin.role,
      action: 'ADMIN_OVERRIDE',
      oldStatus: shipment.internalStatus,
      newStatus: updated.internalStatus,
    });

    return this.toAdminShipmentRow(updated);
  }

  async adminMarkInTransit(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const updated = await this.transitionLoadedShipment(
      shipment,
      admin,
      'ON_THE_WAY',
      'ADMIN_DELIVERY_ON_THE_WAY',
      this.clean(dto.note) ?? 'Admin marked manual Yandex delivery on the way.',
      dto,
    );
    return this.getAdminDelivery(updated.id);
  }

  async adminMarkCourierAssigned(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const updated = await this.transitionLoadedShipment(
      shipment,
      admin,
      'COURIER_ASSIGNED',
      'ADMIN_DELIVERY_COURIER_ASSIGNED',
      this.clean(dto.note) ?? 'Admin marked courier assigned.',
      dto,
    );
    return this.getAdminDelivery(updated.id);
  }

  async adminMarkPickedUp(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const updated = await this.transitionLoadedShipment(
      shipment,
      admin,
      'PICKED_UP',
      'ADMIN_DELIVERY_PICKED_UP',
      this.clean(dto.note) ?? 'Admin marked package picked up.',
      dto,
    );
    return this.getAdminDelivery(updated.id);
  }

  async adminMarkDelivered(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const updated = await this.transitionLoadedShipment(
      shipment,
      admin,
      'DELIVERED',
      'ADMIN_DELIVERY_DELIVERED',
      this.clean(dto.note) ?? 'Admin marked delivery delivered.',
    );
    return this.getAdminDelivery(updated.id);
  }

  async adminCancelDelivery(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryTransitionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const updated = await this.transitionLoadedShipment(
      shipment,
      admin,
      'CANCELLED',
      'ADMIN_DELIVERY_CANCELLED',
      this.clean(dto.note) ?? 'Admin cancelled delivery.',
    );
    return this.getAdminDelivery(updated.id);
  }

  async markDeliveryFailed(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: MarkDeliveryExceptionDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    const updated = await this.markLoadedShipmentException(
      shipment,
      user,
      'FAILED',
      'MANUAL_DELIVERY_FAILED',
      dto,
    );
    return this.toShipmentResponse(updated);
  }

  async addDeliveryComment(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    dto: DeliveryCommentDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    return this.createDeliveryComment(shipment, user, dto);
  }

  async adminMarkFailed(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: MarkDeliveryExceptionDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    await this.markLoadedShipmentException(
      shipment,
      admin,
      'FAILED',
      'ADMIN_DELIVERY_FAILED',
      dto,
    );
    return this.getAdminDelivery(deliveryShipmentId);
  }

  async adminAddComment(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: DeliveryCommentDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    await this.createDeliveryComment(shipment, admin, dto);
    return this.getAdminDelivery(deliveryShipmentId);
  }

  async adminUpdateCustomerMessage(
    deliveryShipmentId: string,
    admin: AuthenticatedUser,
    dto: UpdateCustomerDeliveryMessageDto,
  ) {
    const shipment = await this.findAdminShipmentOrThrow(deliveryShipmentId);
    const message = this.clean(dto.customerVisibleMessage);
    if (!message) {
      throw new BadRequestException('customerVisibleMessage is required.');
    }
    await this.prisma.deliveryShipment.update({
      where: { id: deliveryShipmentId },
      data: { customerVisibleMessage: message },
    });
    await this.createEvent({
      deliveryShipmentId,
      shopId: shipment.shopId,
      orderId: shipment.orderId,
      provider: shipment.provider,
      eventType: 'ADMIN_DELIVERY_CUSTOMER_MESSAGE_UPDATED',
      providerStatus: shipment.providerStatus,
      message,
      rawPayload: { source: 'admin', customerVisible: true },
      actorUserId: admin.userId,
      actorRole: admin.role,
      action: 'ADMIN_UPDATE_CUSTOMER_MESSAGE',
      oldStatus: shipment.internalStatus,
      newStatus: shipment.internalStatus,
    });
    return this.getAdminDelivery(deliveryShipmentId);
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
    const comments = order.deliveryShipments
      .flatMap((shipment) => shipment.comments)
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
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        action: event.action,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        providerStatus: event.providerStatus,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
      comments: comments.map((comment) => ({
        id: comment.id,
        actorUserId: comment.actorUserId,
        actorRole: comment.actorRole,
        visibility: comment.visibility,
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
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
            comments: {
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

  private async findAdminShipmentOrThrow(shipmentId: string) {
    const shipment = await this.prisma.deliveryShipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Delivery shipment ${shipmentId} was not found.`,
      );
    }

    return shipment;
  }

  private async transitionManualShipment(
    shopId: string,
    orderId: string,
    shipmentId: string,
    user: AuthenticatedUser,
    nextStatus: string,
    eventType: string,
    message: string,
    dto?: DeliveryTransitionDto,
  ) {
    const shipment = await this.findShipmentOrThrow(
      shopId,
      orderId,
      shipmentId,
    );
    return this.transitionLoadedShipment(
      shipment,
      user,
      nextStatus,
      eventType,
      message,
      dto,
    );
  }

  private async transitionLoadedShipment(
    shipment: {
      id: string;
      shopId: string;
      orderId: string;
      provider: string;
      internalStatus: string;
      providerStatus: string;
      courierName?: string | null;
      courierPhone?: string | null;
      estimatedDeliveryAt?: Date | null;
    },
    user: AuthenticatedUser,
    nextStatus: string,
    eventType: string,
    message: string,
    dto?: DeliveryTransitionDto,
  ) {
    this.assertAllowedStatusTransition(
      shipment.internalStatus,
      nextStatus,
      user,
    );
    const now = new Date();
    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipment.id },
      data: {
        providerStatus: nextStatus,
        internalStatus: nextStatus,
        yandexStatus: shipment.provider === 'YANDEX' ? nextStatus : undefined,
        courierName:
          dto?.courierName !== undefined
            ? this.clean(dto.courierName)
            : undefined,
        courierPhone:
          dto?.courierPhone !== undefined
            ? this.clean(dto.courierPhone)
            : undefined,
        estimatedDeliveryAt:
          dto?.estimatedDeliveryAt !== undefined
            ? dto.estimatedDeliveryAt
              ? new Date(dto.estimatedDeliveryAt)
              : null
            : undefined,
        acceptedAt:
          nextStatus === 'ON_THE_WAY' || nextStatus === 'IN_TRANSIT'
            ? now
            : undefined,
        deliveredAt: nextStatus === 'DELIVERED' ? now : undefined,
        cancelledAt: nextStatus === 'CANCELLED' ? now : undefined,
      },
    });

    await this.prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status:
          nextStatus === 'DELIVERED'
            ? 'DELIVERED'
            : nextStatus === 'ON_THE_WAY' ||
                nextStatus === 'IN_TRANSIT' ||
                nextStatus === 'PICKED_UP'
              ? 'SHIPPING'
              : nextStatus === 'YANDEX_MANUAL_CREATED' ||
                  nextStatus === 'COURIER_ASSIGNED'
                ? 'YANDEX_MANUAL_CREATED'
                : undefined,
      },
    });

    await this.createEvent({
      deliveryShipmentId: shipment.id,
      shopId: shipment.shopId,
      orderId: shipment.orderId,
      provider: shipment.provider,
      eventType,
      providerStatus: nextStatus,
      message,
      rawPayload: { source: user.role === 'ADMIN' ? 'admin' : 'seller' },
      actorUserId: user.userId,
      actorRole: user.role,
      action: eventType,
      oldStatus: shipment.internalStatus,
      newStatus: nextStatus,
    });

    return this.toShipmentResponse(updated);
  }

  private async markLoadedShipmentException(
    shipment: {
      id: string;
      shopId: string;
      orderId: string;
      provider: string;
      internalStatus: string;
      providerStatus: string;
    },
    user: AuthenticatedUser,
    nextStatus: 'FAILED' | 'CANCELLED',
    eventType: string,
    dto: MarkDeliveryExceptionDto,
  ) {
    if (shipment.internalStatus === 'DELIVERED') {
      throw new BadRequestException(
        'Delivered shipment cannot be marked failed or cancelled.',
      );
    }
    if (!this.clean(dto.reasonCode)) {
      throw new BadRequestException('reasonCode is required.');
    }
    const now = new Date();
    const customerVisibleMessage = this.clean(dto.customerVisibleMessage);
    const reasonText = this.clean(dto.reasonText);
    const updated = await this.prisma.deliveryShipment.update({
      where: { id: shipment.id },
      data: {
        providerStatus: nextStatus,
        internalStatus: nextStatus,
        yandexStatus: shipment.provider === 'YANDEX' ? nextStatus : undefined,
        failureReasonCode: dto.reasonCode,
        failureReasonText: reasonText,
        customerVisibleMessage,
        failedAt: nextStatus === 'FAILED' ? now : undefined,
        cancelledAt: nextStatus === 'CANCELLED' ? now : undefined,
        lastAdminNote: user.role === 'ADMIN' ? reasonText : undefined,
        lastSellerNote: user.role !== 'ADMIN' ? reasonText : undefined,
      },
    });

    await this.prisma.order.update({
      where: { id: shipment.orderId },
      data: {
        status:
          shipment.provider === 'YANDEX' ? 'READY_TO_CREATE_YANDEX' : undefined,
      },
    });

    await this.createEvent({
      deliveryShipmentId: shipment.id,
      shopId: shipment.shopId,
      orderId: shipment.orderId,
      provider: shipment.provider,
      eventType,
      providerStatus: nextStatus,
      message: reasonText ?? `Delivery marked ${nextStatus.toLowerCase()}.`,
      rawPayload: {
        source: user.role === 'ADMIN' ? 'admin' : 'seller',
        reasonCode: dto.reasonCode,
        customerVisibleMessage,
      },
      actorUserId: user.userId,
      actorRole: user.role,
      action: eventType,
      oldStatus: shipment.internalStatus,
      newStatus: nextStatus,
    });

    return updated;
  }

  private async createDeliveryComment(
    shipment: {
      id: string;
      shopId: string;
      orderId: string;
      provider: string;
      internalStatus: string;
      providerStatus: string;
    },
    user: AuthenticatedUser,
    dto: DeliveryCommentDto,
  ) {
    const message = this.clean(dto.message);
    if (!message) {
      throw new BadRequestException('message is required.');
    }
    if (dto.visibility === 'CUSTOMER_VISIBLE' && !message) {
      throw new BadRequestException(
        'Customer-visible comments must include a message.',
      );
    }
    const comment = await this.prisma.deliveryComment.create({
      data: {
        id: randomUUID(),
        deliveryShipmentId: shipment.id,
        orderId: shipment.orderId,
        actorUserId: user.userId,
        actorRole: user.role,
        visibility: dto.visibility,
        message,
      },
    });
    await this.prisma.deliveryShipment.update({
      where: { id: shipment.id },
      data: {
        customerVisibleMessage:
          dto.visibility === 'CUSTOMER_VISIBLE' ? message : undefined,
        lastAdminNote:
          user.role === 'ADMIN' && dto.visibility === 'INTERNAL'
            ? message
            : undefined,
        lastSellerNote:
          user.role !== 'ADMIN' && dto.visibility === 'INTERNAL'
            ? message
            : undefined,
      },
    });
    await this.createEvent({
      deliveryShipmentId: shipment.id,
      shopId: shipment.shopId,
      orderId: shipment.orderId,
      provider: shipment.provider,
      eventType: 'DELIVERY_COMMENT_ADDED',
      providerStatus: shipment.providerStatus,
      message:
        dto.visibility === 'CUSTOMER_VISIBLE'
          ? 'Customer-visible delivery comment added.'
          : 'Internal delivery comment added.',
      rawPayload: { visibility: dto.visibility },
      actorUserId: user.userId,
      actorRole: user.role,
      action: 'ADD_DELIVERY_COMMENT',
      oldStatus: shipment.internalStatus,
      newStatus: shipment.internalStatus,
    });
    return {
      id: comment.id,
      deliveryShipmentId: comment.deliveryShipmentId,
      orderId: comment.orderId,
      actorUserId: comment.actorUserId,
      actorRole: comment.actorRole,
      visibility: comment.visibility,
      message: comment.message,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  private assertAllowedStatusTransition(
    currentStatus: string,
    nextStatus: string,
    user: AuthenticatedUser,
  ) {
    if (
      currentStatus === 'DELIVERED' &&
      DELIVERY_EXCEPTION_STATUSES.includes(
        nextStatus as (typeof DELIVERY_EXCEPTION_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        'Delivered shipment cannot be marked failed or cancelled.',
      );
    }
    if (
      user.role !== 'ADMIN' &&
      DELIVERY_EXCEPTION_STATUSES.includes(
        currentStatus as (typeof DELIVERY_EXCEPTION_STATUSES)[number],
      ) &&
      nextStatus === 'DELIVERED'
    ) {
      throw new BadRequestException(
        'Failed or cancelled shipment cannot be marked delivered without admin override.',
      );
    }
  }

  private buildAdminShipmentWhere(
    query: ListAdminDeliveriesQueryDto,
  ): Prisma.DeliveryShipmentWhereInput {
    const where: Prisma.DeliveryShipmentWhereInput = {};
    if (
      query.status &&
      query.status !== 'OVERDUE' &&
      query.status !== 'READY_TO_CREATE_YANDEX'
    ) {
      where.internalStatus = query.status;
    }
    if (query.status === 'OVERDUE') {
      where.internalStatus = {
        in: [
          'YANDEX_MANUAL_CREATED',
          'COURIER_ASSIGNED',
          'PICKED_UP',
          'ON_THE_WAY',
          'IN_TRANSIT',
        ],
      };
      where.estimatedDeliveryAt = { lt: new Date() };
    }
    if (query.exceptionOnly) {
      where.internalStatus = { in: [...DELIVERY_EXCEPTION_STATUSES] };
    }
    if (query.provider) where.provider = query.provider;
    if (query.shopId) where.shopId = query.shopId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      };
    }
    if (query.sellerId || query.search?.trim()) {
      const search = query.search?.trim();
      where.order = {
        shop: {
          sellerProfile: {
            userId: query.sellerId,
          },
        },
        OR: search
          ? [
              { orderNumber: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      };
    }
    return where;
  }

  private buildPaidWithoutDeliveryWhere(
    query: ListAdminDeliveriesQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      paymentStatus: 'PAID',
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
      deliveryShipments: {
        none: {
          internalStatus: { notIn: [...DELIVERY_TERMINAL_STATUSES] },
        },
      },
    };
    if (query.status === 'READY_TO_CREATE_YANDEX') {
      where.status = 'READY_TO_CREATE_YANDEX';
    }
    if (query.shopId) where.shopId = query.shopId;
    if (query.sellerId) {
      where.shop = { sellerProfile: { userId: query.sellerId } };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo ? new Date(query.dateTo) : undefined,
      };
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
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

  private async createEvent(input: {
    deliveryShipmentId: string;
    shopId: string;
    orderId: string;
    provider: string;
    eventType: string;
    providerStatus: string;
    message: string;
    rawPayload: Record<string, unknown> | null;
    actorUserId?: string | null;
    actorRole?: string | null;
    action?: string | null;
    oldStatus?: string | null;
    newStatus?: string | null;
  }) {
    await this.prisma.deliveryEvent.create({
      data: {
        id: randomUUID(),
        deliveryShipmentId: input.deliveryShipmentId,
        shopId: input.shopId,
        orderId: input.orderId,
        provider: input.provider,
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action ?? input.eventType,
        oldStatus: input.oldStatus ?? null,
        newStatus: input.newStatus ?? null,
        providerStatus: input.providerStatus,
        message: input.message,
        rawPayload: this.toJsonInput(input.rawPayload),
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
    courierName: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: Date | null;
    packagePreset: string | null;
    packageWeightGram: number | null;
    packageLengthCm: number | null;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    failureReasonText: string | null;
    failedAt: Date | null;
    customerVisibleMessage: string | null;
    lastAdminNote: string | null;
    lastSellerNote: string | null;
    pickupAddress: string;
    pickupLatitude: Prisma.Decimal | null;
    pickupLongitude: Prisma.Decimal | null;
    dropoffAddress: string;
    dropoffLatitude: Prisma.Decimal | null;
    dropoffLongitude: Prisma.Decimal | null;
    recipientName: string | null;
    recipientPhone: string | null;
    manualYandexOrderId: string | null;
    yandexClaimId: string | null;
    yandexStatus: string | null;
    yandexPrice: Prisma.Decimal | null;
    yandexTrackingLink: string | null;
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
      courierName: shipment.courierName,
      courierPhone: shipment.courierPhone,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString() ?? null,
      packagePreset: shipment.packagePreset,
      packageWeightGram: shipment.packageWeightGram,
      packageLengthCm: shipment.packageLengthCm,
      packageWidthCm: shipment.packageWidthCm,
      packageHeightCm: shipment.packageHeightCm,
      deliveryNote: shipment.deliveryNote,
      failureReasonCode: shipment.failureReasonCode,
      failureReasonText: shipment.failureReasonText,
      failedAt: shipment.failedAt?.toISOString() ?? null,
      customerVisibleMessage: shipment.customerVisibleMessage,
      lastAdminNote: shipment.lastAdminNote,
      lastSellerNote: shipment.lastSellerNote,
      pickupAddress: shipment.pickupAddress,
      pickupLatitude: shipment.pickupLatitude?.toString() ?? null,
      pickupLongitude: shipment.pickupLongitude?.toString() ?? null,
      dropoffAddress: shipment.dropoffAddress,
      dropoffLatitude: shipment.dropoffLatitude?.toString() ?? null,
      dropoffLongitude: shipment.dropoffLongitude?.toString() ?? null,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      manualYandexOrderId: shipment.manualYandexOrderId,
      yandexClaimId: shipment.yandexClaimId,
      yandexStatus: shipment.yandexStatus,
      yandexPrice: shipment.yandexPrice?.toString() ?? null,
      yandexTrackingLink: shipment.yandexTrackingLink,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      acceptedAt: shipment.acceptedAt?.toISOString() ?? null,
      cancelledAt: shipment.cancelledAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    };
  }

  private toAdminShipmentRow(shipment: {
    id: string;
    shopId: string;
    orderId: string;
    provider: string;
    providerShipmentId: string | null;
    providerOrderNumber: string | null;
    providerStatus: string;
    internalStatus: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    courierName: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: Date | null;
    packagePreset: string | null;
    packageWeightGram: number | null;
    packageLengthCm: number | null;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    failureReasonText: string | null;
    failedAt: Date | null;
    customerVisibleMessage: string | null;
    lastAdminNote: string | null;
    lastSellerNote: string | null;
    pickupAddress: string;
    pickupLatitude: Prisma.Decimal | null;
    pickupLongitude: Prisma.Decimal | null;
    dropoffLatitude: Prisma.Decimal | null;
    dropoffLongitude: Prisma.Decimal | null;
    recipientName: string | null;
    recipientPhone: string | null;
    manualYandexOrderId: string | null;
    yandexClaimId: string | null;
    yandexStatus: string | null;
    yandexPrice: Prisma.Decimal | null;
    yandexTrackingLink: string | null;
    createdAt: Date;
    updatedAt: Date;
    acceptedAt: Date | null;
    cancelledAt: Date | null;
    deliveredAt: Date | null;
    order: {
      orderNumber: string;
      status: string;
      paymentStatus: string;
      totalAmount: Prisma.Decimal;
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      shippingAddress: string;
      createdAt: Date;
      shop: {
        id: string;
        name: string;
        sellerProfile: {
          userId: string;
          user: { email: string; fullName: string | null };
        };
      };
    };
    events: Array<{
      id: string;
      eventType: string;
      actorUserId: string | null;
      actorRole: string | null;
      action: string | null;
      oldStatus: string | null;
      newStatus: string | null;
      providerStatus: string | null;
      message: string | null;
      createdAt: Date;
    }>;
    comments: Array<{
      id: string;
      actorUserId: string | null;
      actorRole: string;
      visibility: string;
      message: string;
      createdAt: Date;
    }>;
  }) {
    return {
      kind: 'SHIPMENT',
      id: shipment.id,
      deliveryShipmentId: shipment.id,
      orderId: shipment.orderId,
      orderNumber: shipment.order.orderNumber,
      shopId: shipment.shopId,
      shopName: shipment.order.shop.name,
      sellerId: shipment.order.shop.sellerProfile.userId,
      sellerEmail: shipment.order.shop.sellerProfile.user.email,
      sellerName: shipment.order.shop.sellerProfile.user.fullName,
      orderStatus: shipment.order.status,
      paymentStatus: shipment.order.paymentStatus,
      totalAmount: shipment.order.totalAmount.toString(),
      customer: {
        name: shipment.order.customerName,
        phone: shipment.order.customerPhone,
        email: shipment.order.customerEmail,
        address: shipment.order.shippingAddress,
      },
      provider: shipment.provider,
      providerShipmentId: shipment.providerShipmentId,
      providerOrderNumber: shipment.providerOrderNumber,
      providerStatus: shipment.providerStatus,
      internalStatus: shipment.internalStatus,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      courierName: shipment.courierName,
      courierPhone: shipment.courierPhone,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString() ?? null,
      packagePreset: shipment.packagePreset,
      packageWeightGram: shipment.packageWeightGram,
      packageLengthCm: shipment.packageLengthCm,
      packageWidthCm: shipment.packageWidthCm,
      packageHeightCm: shipment.packageHeightCm,
      deliveryNote: shipment.deliveryNote,
      failureReasonCode: shipment.failureReasonCode,
      failureReasonText: shipment.failureReasonText,
      failedAt: shipment.failedAt?.toISOString() ?? null,
      customerVisibleMessage: shipment.customerVisibleMessage,
      lastAdminNote: shipment.lastAdminNote,
      lastSellerNote: shipment.lastSellerNote,
      pickupAddress: shipment.pickupAddress,
      pickupLatitude: shipment.pickupLatitude?.toString() ?? null,
      pickupLongitude: shipment.pickupLongitude?.toString() ?? null,
      dropoffLatitude: shipment.dropoffLatitude?.toString() ?? null,
      dropoffLongitude: shipment.dropoffLongitude?.toString() ?? null,
      recipientName: shipment.recipientName,
      recipientPhone: shipment.recipientPhone,
      manualYandexOrderId: shipment.manualYandexOrderId,
      yandexClaimId: shipment.yandexClaimId,
      yandexStatus: shipment.yandexStatus,
      yandexPrice: shipment.yandexPrice?.toString() ?? null,
      yandexTrackingLink: shipment.yandexTrackingLink,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      acceptedAt: shipment.acceptedAt?.toISOString() ?? null,
      cancelledAt: shipment.cancelledAt?.toISOString() ?? null,
      deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
      events: shipment.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        actorRole: event.actorRole,
        action: event.action,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
        providerStatus: event.providerStatus,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
      comments: shipment.comments.map((comment) => ({
        id: comment.id,
        actorUserId: comment.actorUserId,
        actorRole: comment.actorRole,
        visibility: comment.visibility,
        message: comment.message,
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }

  private toAdminOrderDeliveryRow(order: {
    id: string;
    shopId: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalAmount: Prisma.Decimal;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    shippingAddress: string;
    createdAt: Date;
    shop: {
      id: string;
      name: string;
      sellerProfile: {
        userId: string;
        user: { email: string; fullName: string | null };
      };
    };
  }) {
    return {
      kind: 'PAID_WITHOUT_DELIVERY',
      id: `order-${order.id}`,
      deliveryShipmentId: null,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shopId,
      shopName: order.shop.name,
      sellerId: order.shop.sellerProfile.userId,
      sellerEmail: order.shop.sellerProfile.user.email,
      sellerName: order.shop.sellerProfile.user.fullName,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        address: order.shippingAddress,
      },
      provider: null,
      providerShipmentId: null,
      providerOrderNumber: null,
      providerStatus: 'NOT_CREATED',
      internalStatus:
        order.status === 'READY_TO_CREATE_YANDEX'
          ? 'READY_TO_CREATE_YANDEX'
          : 'NOT_CREATED',
      trackingNumber: null,
      trackingUrl: null,
      courierName: null,
      courierPhone: null,
      estimatedDeliveryAt: null,
      packagePreset: null,
      packageWeightGram: null,
      packageLengthCm: null,
      packageWidthCm: null,
      packageHeightCm: null,
      deliveryNote: null,
      failureReasonCode: null,
      failureReasonText: null,
      failedAt: null,
      customerVisibleMessage: null,
      lastAdminNote: null,
      lastSellerNote: null,
      pickupAddress: null,
      pickupLatitude: null,
      pickupLongitude: null,
      dropoffLatitude: null,
      dropoffLongitude: null,
      recipientName: order.customerName,
      recipientPhone: order.customerPhone,
      manualYandexOrderId: null,
      yandexClaimId: null,
      yandexStatus: null,
      yandexPrice: null,
      yandexTrackingLink: null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.createdAt.toISOString(),
      acceptedAt: null,
      cancelledAt: null,
      deliveredAt: null,
      events: [],
      comments: [],
    };
  }

  private assertManualProvider(provider: string) {
    if (!DELIVERY_CARRIERS.includes(provider as never)) {
      throw new BadRequestException(
        `Unsupported delivery provider ${provider}.`,
      );
    }
  }

  private clean(value?: string | null) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
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

  private get adminShipmentInclude() {
    return {
      order: {
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          shippingAddress: true,
          createdAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              sellerProfile: {
                select: {
                  userId: true,
                  user: {
                    select: {
                      email: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' as const },
      },
      comments: {
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private get adminOrderInclude() {
    return {
      shop: {
        select: {
          id: true,
          name: true,
          sellerProfile: {
            select: {
              userId: true,
              user: {
                select: {
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    };
  }
}
