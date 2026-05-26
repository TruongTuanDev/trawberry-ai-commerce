import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveOrderPaymentPanel } from '../../common/utils/shop-payment.util';
import { computeAddressGeoReadiness } from '../../common/utils/customer-address.util';
import {
  computeSellerFulfillmentState,
  type SellerFulfillmentBucket,
} from '../../common/utils/order-role-status.util';
import { ListAdminFulfillmentOrdersQueryDto } from './dto/list-admin-fulfillment-orders-query.dto';
import { ListShopOrdersQueryDto } from './dto/list-shop-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SellerFinanceService } from '../seller-finance/seller-finance.service';

type AdminFulfillmentAction = 'VIEW' | 'REMIND_SELLER';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerFinanceService: SellerFinanceService,
    private readonly configService: ConfigService,
  ) {}

  async listByShop(shopId: string, query: ListShopOrdersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;
    const where = this.buildWhere(shopId, query);
    const orderBy =
      query.sort === 'createdAt_asc'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

    const [items, total, summaryRows] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy,
        skip,
        take: size,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: {
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          shippingMethodName: true,
          sellerArchivedAt: true,
          deliveryShipments: {
            take: 1,
            orderBy: { createdAt: 'desc' as const },
            select: {
              internalStatus: true,
            },
          },
        },
      }),
    ]);

    const summary = {
      ALL: total,
      NEW: 0,
      ASSEMBLING: 0,
      IN_TRANSIT: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      ARCHIVED: 0,
    } satisfies Record<'ALL' | SellerFulfillmentBucket, number>;

    for (const row of summaryRows) {
      const bucket = computeSellerFulfillmentState({
        status: row.status,
        paymentStatus: row.paymentStatus,
        paymentMethod: row.paymentMethod,
        shippingMethodName: row.shippingMethodName,
        deliveryStatus: row.deliveryShipments?.[0]?.internalStatus ?? null,
        sellerArchivedAt: row.sellerArchivedAt,
      }).bucket;
      summary[bucket] += 1;
    }

    return {
      items: items.map((order) => this.toOrderResponse(order)),
      meta: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
      summary,
    };
  }

  async findOneByShop(shopId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    const response = this.toOrderResponse(order);
    const latestYandexReminder =
      typeof this.prisma.adminAuditLog?.findFirst === 'function'
        ? await this.prisma.adminAuditLog.findFirst({
            where: {
              entityType: 'DELIVERY_REMINDER',
              entityId: order.id,
              action: 'REMIND_CREATE_YANDEX_MANUAL',
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              reason: true,
              createdAt: true,
              actor: {
                select: {
                  fullName: true,
                  email: true,
                },
              },
            },
          })
        : null;

    return {
      ...response,
      latestYandexReminder: latestYandexReminder
        ? {
            id: latestYandexReminder.id,
            message:
              latestYandexReminder.reason ??
              'Admin reminded the seller to create Yandex delivery.',
            createdAt: latestYandexReminder.createdAt.toISOString(),
            adminName:
              latestYandexReminder.actor.fullName ??
              latestYandexReminder.actor.email,
          }
        : null,
    };
  }

  async updateStatus(
    shopId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    if (order.status === dto.status) {
      return this.toOrderResponse(order);
    }

    this.assertStatusTransition(order.status, dto.status, order.paymentStatus);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'DELIVERED') {
        for (const item of order.items) {
          if (!item.variantId) continue;
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });
          if (!variant) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              reservedStock: Math.max(0, variant.reservedStock - item.quantity),
            },
          });
        }
      }

      if (dto.status === 'CANCELLED') {
        for (const item of order.items) {
          if (!item.variantId) continue;
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });
          if (!variant) continue;
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              reservedStock: Math.max(0, variant.reservedStock - item.quantity),
              stockQuantity: variant.stockQuantity + item.quantity,
            },
          });
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: dto.status,
        },
        include: this.orderInclude,
      });

      if (dto.status === 'CANCELLED') {
        await this.sellerFinanceService.syncCancellationAdjustment(
          tx,
          order.id,
        );
      }

      return updatedOrder;
    });

    return this.toOrderResponse(updated);
  }

  async archive(shopId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    const fulfillment = computeSellerFulfillmentState({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingMethodName: order.shippingMethodName,
      paymentProofStatus: order.paymentProofStatus,
      deliveryStatus: order.deliveryShipments?.[0]?.internalStatus ?? null,
      sellerArchivedAt: order.sellerArchivedAt,
    });

    if (fulfillment.bucket === 'ARCHIVED') {
      return this.toOrderResponse(order);
    }

    if (
      fulfillment.bucket !== 'COMPLETED' &&
      fulfillment.bucket !== 'CANCELLED'
    ) {
      throw new BadRequestException(
        'Only completed or cancelled orders can be archived.',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        sellerArchivedAt: new Date(),
        sellerArchiveSourceStatus: order.status,
      },
      include: this.orderInclude,
    });

    return this.toOrderResponse(updated);
  }

  async adminArchive(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    return this.archive(order.shopId, orderId);
  }

  async adminMoveToAssembling(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    if (order.status === 'ASSEMBLING') {
      return this.toOrderResponse(order);
    }

    if (order.status !== 'NEW' && order.status !== 'PENDING') {
      throw new BadRequestException(
        'Only new orders can be moved into assembling.',
      );
    }

    if (
      !['PAID', 'APPROVED', 'SELLER_CONFIRMED_DELIVERY_PAYMENT'].includes(
        order.paymentStatus,
      )
    ) {
      throw new BadRequestException(
        'Payment must be confirmed before moving into assembling.',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'ASSEMBLING' },
      include: this.orderInclude,
    });

    return this.toOrderResponse(updated);
  }

  async listAdminFulfillment(query: ListAdminFulfillmentOrdersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;
    const baseWhere = this.buildAdminFulfillmentWhere(query);
    const orders = await this.prisma.order.findMany({
      where: baseWhere,
      include: this.adminFulfillmentInclude,
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const reminderMap = await this.loadLatestReminderMap(
      orders.map((order) => order.id),
    );
    const rows = orders.map((order) =>
      this.toAdminFulfillmentRow(order, reminderMap.get(order.id) ?? null),
    );
    const filteredRows = query.bucket
      ? rows.filter((row) => row.fulfillmentBucket === query.bucket)
      : rows;

    const summary = {
      ALL: rows.length,
      NEW: 0,
      ASSEMBLING: 0,
      IN_TRANSIT: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      ARCHIVED: 0,
    } satisfies Record<'ALL' | SellerFulfillmentBucket, number>;

    for (const row of rows) {
      summary[row.fulfillmentBucket] += 1;
    }

    return {
      items: filteredRows.slice(skip, skip + size),
      meta: {
        page,
        size,
        total: filteredRows.length,
        totalPages: Math.max(1, Math.ceil(filteredRows.length / size)),
      },
      summary,
    };
  }

  private buildWhere(
    shopId: string,
    query: ListShopOrdersQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      shopId,
    };

    if (query.status) {
      Object.assign(where, this.resolveSellerStatusWhere(query.status));
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.deliveryStatus) {
      where.deliveryShipments = {
        some: {
          internalStatus: query.deliveryStatus,
        },
      };
    }

    const search = query.q?.trim() || query.search?.trim();
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        {
          shop: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          items: {
            some: {
              productTitleSnapshot: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const dateFrom = query.from ?? query.dateFrom;
    const dateTo = query.to ?? query.dateTo;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const inclusiveEnd = new Date(dateTo);
        inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
        where.createdAt.lt = inclusiveEnd;
      }
    }

    return where;
  }

  private resolveSellerStatusWhere(status: string): Prisma.OrderWhereInput {
    switch (status) {
      case 'NEW':
        return {
          sellerArchivedAt: null,
          paymentStatus: {
            in: ['PAID', 'APPROVED', 'SELLER_CONFIRMED_DELIVERY_PAYMENT'],
          },
          status: { in: ['NEW', 'PENDING'] },
          deliveryShipments: {
            none: {
              internalStatus: { notIn: ['FAILED', 'CANCELLED', 'DELIVERED'] },
            },
          },
        };
      case 'ASSEMBLING':
        return {
          sellerArchivedAt: null,
          OR: [
            { status: { in: ['READY_TO_CREATE_YANDEX', 'ASSEMBLING'] } },
            {
              deliveryShipments: {
                some: {
                  internalStatus: {
                    in: [
                      'YANDEX_MANUAL_CREATED',
                      'CREATED_MANUALLY',
                      'CREATED',
                    ],
                  },
                },
              },
            },
          ],
        };
      case 'IN_TRANSIT':
        return {
          sellerArchivedAt: null,
          OR: [
            { status: 'SHIPPING' },
            {
              deliveryShipments: {
                some: {
                  internalStatus: {
                    in: [
                      'COURIER_ASSIGNED',
                      'PICKED_UP',
                      'ON_THE_WAY',
                      'IN_TRANSIT',
                    ],
                  },
                },
              },
            },
          ],
        };
      case 'COMPLETED':
        return {
          sellerArchivedAt: null,
          OR: [
            { status: 'DELIVERED' },
            {
              deliveryShipments: {
                some: {
                  internalStatus: 'DELIVERED',
                },
              },
            },
          ],
        };
      case 'CANCELLED':
        return {
          sellerArchivedAt: null,
          OR: [
            { status: 'CANCELLED' },
            {
              deliveryShipments: {
                some: {
                  internalStatus: { in: ['FAILED', 'CANCELLED'] },
                },
              },
            },
          ],
        };
      case 'ARCHIVED':
        return {
          sellerArchivedAt: { not: null },
        };
      default:
        return { status };
    }
  }

  private buildAdminFulfillmentWhere(
    query: ListAdminFulfillmentOrdersQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};

    if (query.shopId) {
      where.shopId = query.shopId;
    }

    if (query.sellerId) {
      where.shop = {
        sellerProfile: {
          userId: query.sellerId,
        },
      };
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.deliveryStatus) {
      where.deliveryShipments = {
        some: {
          internalStatus: query.deliveryStatus,
        },
      };
    }

    if (query.provider) {
      where.deliveryShipments = {
        ...(where.deliveryShipments ?? {}),
        some: {
          ...(typeof where.deliveryShipments === 'object' &&
          'some' in where.deliveryShipments
            ? where.deliveryShipments.some
            : {}),
          provider: query.provider,
        },
      };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        {
          shop: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          shop: {
            sellerProfile: {
              user: {
                fullName: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
        {
          shop: {
            sellerProfile: {
              user: {
                email: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
        {
          shop: {
            sellerProfile: {
              user: {
                phone: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
        {
          items: {
            some: {
              productTitleSnapshot: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const inclusiveEnd = new Date(query.dateTo);
        inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
        where.createdAt.lt = inclusiveEnd;
      }
    }

    if (query.overdueOnly) {
      where.OR = [
        {
          status: {
            in: ['NEW', 'PENDING', 'READY_TO_CREATE_YANDEX', 'ASSEMBLING'],
          },
          updatedAt: { lt: this.getNewOrAssemblyOverdueCutoff() },
        },
        {
          deliveryShipments: {
            some: {
              internalStatus: {
                in: [
                  'COURIER_ASSIGNED',
                  'PICKED_UP',
                  'ON_THE_WAY',
                  'IN_TRANSIT',
                ],
              },
              OR: [
                { updatedAt: { lt: this.getInTransitOverdueCutoff() } },
                { estimatedDeliveryAt: { lt: new Date() } },
              ],
            },
          },
        },
      ];
    }

    return where;
  }

  private assertStatusTransition(
    currentStatus: string,
    newStatus: string,
    paymentStatus: string,
  ) {
    if (newStatus === 'ASSEMBLING') {
      if (currentStatus !== 'NEW' && currentStatus !== 'PENDING') {
        throw new BadRequestException(
          'Can only transition to ASSEMBLING from PENDING or NEW.',
        );
      }
      if (paymentStatus !== 'APPROVED' && paymentStatus !== 'PAID') {
        throw new BadRequestException(
          'Cannot assemble order until payment is APPROVED or PAID.',
        );
      }
      return;
    }

    if (newStatus === 'SHIPPING') {
      if (currentStatus !== 'ASSEMBLING') {
        throw new BadRequestException(
          'Can only transition to SHIPPING from ASSEMBLING.',
        );
      }
      return;
    }

    if (newStatus === 'DELIVERED') {
      if (currentStatus !== 'SHIPPING') {
        throw new BadRequestException(
          'Can only transition to DELIVERED from SHIPPING.',
        );
      }
      return;
    }

    if (newStatus === 'CANCELLED') {
      if (currentStatus === 'SHIPPING' || currentStatus === 'DELIVERED') {
        throw new BadRequestException(
          'Cannot cancel orders that are already shipped or delivered.',
        );
      }
      return;
    }

    throw new BadRequestException(
      `Invalid status transition from ${currentStatus} to ${newStatus}.`,
    );
  }

  private toOrderResponse(order: {
    id: string;
    orderNumber: string;
    shopId: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    paymentMethodLabel: string | null;
    paymentProofStatus: string;
    paymentFlowStage: string | null;
    totalAmount: Prisma.Decimal;
    shippingCost: Prisma.Decimal;
    shippingMethodName: string | null;
    shippingAddress: string;
    dropoffAddressFullName?: string | null;
    dropoffCity?: string | null;
    dropoffPostalCode?: string | null;
    dropoffStreet?: string | null;
    dropoffBuilding?: string | null;
    dropoffEntrance?: string | null;
    dropoffNoEntrance?: boolean;
    dropoffIntercom?: string | null;
    dropoffFloor?: string | null;
    dropoffNoFloor?: boolean;
    dropoffApartment?: string | null;
    dropoffNoApartment?: boolean;
    dropoffLatitude?: Prisma.Decimal | null;
    dropoffLongitude?: Prisma.Decimal | null;
    dropoffGeoPrecision?: string | null;
    dropoffComment?: string | null;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    customerNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    customerCompletedAt: Date | null;
    sellerArchivedAt: Date | null;
    sellerArchiveSourceStatus: string | null;
    shop: {
      id: string;
      name: string;
      paymentInstructions: string | null;
      bankName: string | null;
      accountHolderName: string | null;
      accountNumber: string | null;
      recipientPhone: string | null;
      sbpPhone: string | null;
      staticQrImageUrl: string | null;
      paymentMode: string | null;
      paymentConfigStatus: string;
      allowPrepaidQr: boolean;
      allowPayOnDeliverySellerQr: boolean;
      allowDepositPayment: boolean;
      depositPercent: number | null;
      depositRequiredAboveAmount: Prisma.Decimal | null;
      codMaxOrderAmount: Prisma.Decimal | null;
      yandexCardOnDeliveryStatus: string;
      cashCourierCollectionStatus: string;
    };
    deliveryShipments?: Array<{
      provider: string;
      internalStatus: string;
      providerShipmentId: string | null;
      providerOrderNumber: string | null;
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
      manualYandexOrderId: string | null;
      yandexClaimId: string | null;
      yandexTrackingLink: string | null;
      deliveryNote: string | null;
    }>;
    sellerFeeLedgerEntries?: Array<{
      status: string;
      commissionAmount: Prisma.Decimal;
      invoice: {
        status: string;
      } | null;
    }>;
    items: Array<{
      id: string;
      productId: string | null;
      variantId: string | null;
      quantity: number;
      priceAtPurchase: Prisma.Decimal;
      unitPrice: Prisma.Decimal | null;
      lineTotal: Prisma.Decimal | null;
      productTitleSnapshot: string;
      productSlugSnapshot: string;
      productImageSnapshot: string | null;
      variantNameSnapshot: string | null;
    }>;
    supportCases?: Array<{
      id: string;
      issueType: string;
      status: string;
      subject: string;
      createdAt: Date;
    }>;
    returnRefundCases?: Array<{
      id: string;
      type: string;
      reason: string;
      status: string;
      requestedAmount: Prisma.Decimal;
      approvedAmount: Prisma.Decimal | null;
      createdAt: Date;
    }>;
  }) {
    const latestShipment = order.deliveryShipments?.[0] ?? null;
    const paymentDetails = resolveOrderPaymentPanel(order, order.shop);
    const dropoffGeoReadiness = computeAddressGeoReadiness({
      city: order.dropoffCity ?? '',
      street: order.dropoffStreet ?? '',
      building: order.dropoffBuilding ?? '',
      entrance: order.dropoffEntrance ?? null,
      noEntrance: order.dropoffNoEntrance ?? false,
      intercom: order.dropoffIntercom ?? null,
      floor: order.dropoffFloor ?? null,
      noFloor: order.dropoffNoFloor ?? false,
      apartment: order.dropoffApartment ?? null,
      noApartment: order.dropoffNoApartment ?? false,
      comment: order.dropoffComment ?? null,
      latitude: order.dropoffLatitude ?? null,
      longitude: order.dropoffLongitude ?? null,
      geoPrecision: order.dropoffGeoPrecision ?? null,
      country: 'Russia',
      phone: order.customerPhone,
    });
    const sellerDisplay = computeSellerFulfillmentState({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingMethodName: order.shippingMethodName,
      paymentProofStatus: order.paymentProofStatus,
      deliveryStatus: latestShipment?.internalStatus ?? null,
      sellerArchivedAt: order.sellerArchivedAt,
    });
    const latestLedger = order.sellerFeeLedgerEntries?.[0] ?? null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? order.shippingMethodName,
      paymentMethodLabel: order.paymentMethodLabel,
      totalAmount: order.totalAmount.toString(),
      shippingCost: order.shippingCost.toString(),
      shippingMethodName: order.shippingMethodName,
      shippingAddress: order.shippingAddress,
      dropoffAddressFullName:
        order.dropoffAddressFullName ?? order.shippingAddress,
      dropoffCity: order.dropoffCity ?? null,
      dropoffPostalCode: order.dropoffPostalCode ?? null,
      dropoffStreet: order.dropoffStreet ?? null,
      dropoffBuilding: order.dropoffBuilding ?? null,
      dropoffEntrance: order.dropoffEntrance ?? null,
      dropoffNoEntrance: order.dropoffNoEntrance ?? false,
      dropoffIntercom: order.dropoffIntercom ?? null,
      dropoffFloor: order.dropoffFloor ?? null,
      dropoffNoFloor: order.dropoffNoFloor ?? false,
      dropoffApartment: order.dropoffApartment ?? null,
      dropoffNoApartment: order.dropoffNoApartment ?? false,
      dropoffLatitude: order.dropoffLatitude?.toString() ?? null,
      dropoffLongitude: order.dropoffLongitude?.toString() ?? null,
      dropoffGeoPrecision: order.dropoffGeoPrecision ?? null,
      dropoffComment: order.dropoffComment ?? null,
      dropoffGeoReadiness,
      yandexManualReady: dropoffGeoReadiness.isYandexManualReady,
      yandexApiReady: dropoffGeoReadiness.isYandexApiReady,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
      },
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customerCompletedAt: order.customerCompletedAt?.toISOString() ?? null,
      itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      sellerDisplayStatus: sellerDisplay.code,
      sellerDisplayLabel: sellerDisplay.label,
      sellerStatusBucket: sellerDisplay.bucket,
      nextAction: sellerDisplay.nextAction,
      sellerArchivedAt: order.sellerArchivedAt?.toISOString() ?? null,
      sellerArchiveSourceStatus: order.sellerArchiveSourceStatus ?? null,
      delivery: latestShipment
        ? {
            provider: latestShipment.provider,
            status: latestShipment.internalStatus,
            providerShipmentId: latestShipment.providerShipmentId,
            providerOrderNumber: latestShipment.providerOrderNumber,
            trackingNumber: latestShipment.trackingNumber,
            trackingUrl: latestShipment.trackingUrl,
            courierName: latestShipment.courierName,
            courierPhone: latestShipment.courierPhone,
            estimatedDeliveryAt:
              latestShipment.estimatedDeliveryAt?.toISOString() ?? null,
            packagePreset: latestShipment.packagePreset,
            packageWeightGram: latestShipment.packageWeightGram,
            packageLengthCm: latestShipment.packageLengthCm,
            packageWidthCm: latestShipment.packageWidthCm,
            packageHeightCm: latestShipment.packageHeightCm,
            manualYandexOrderId: latestShipment.manualYandexOrderId,
            yandexClaimId: latestShipment.yandexClaimId,
            yandexTrackingLink: latestShipment.yandexTrackingLink,
            deliveryNote: latestShipment.deliveryNote,
          }
        : null,
      paymentDetails,
      finance: latestLedger
        ? {
            ledgerStatus: latestLedger.status,
            commissionAmount: latestLedger.commissionAmount.toString(),
            invoiceStatus: latestLedger.invoice?.status ?? null,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase.toString(),
        unitPrice: (item.unitPrice ?? item.priceAtPurchase).toString(),
        lineTotal: (
          item.lineTotal ??
          new Prisma.Decimal(item.priceAtPurchase.toString()).mul(item.quantity)
        ).toString(),
        productTitleSnapshot: item.productTitleSnapshot,
        productSlugSnapshot: item.productSlugSnapshot,
        productImageSnapshot: item.productImageSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
      })),
      supportCases:
        order.supportCases?.map((supportCase) => ({
          id: supportCase.id,
          issueType: supportCase.issueType,
          status: supportCase.status,
          subject: supportCase.subject,
          createdAt: supportCase.createdAt.toISOString(),
        })) ?? [],
      returnRefundCases:
        order.returnRefundCases?.map((entry) => ({
          id: entry.id,
          type: entry.type,
          reason: entry.reason,
          status: entry.status,
          requestedAmount: entry.requestedAmount.toString(),
          approvedAmount: entry.approvedAmount?.toString() ?? null,
          createdAt: entry.createdAt.toISOString(),
        })) ?? [],
    };
  }

  private toAdminFulfillmentRow(
    order: {
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      paymentMethod: string | null;
      shippingMethodName: string | null;
      customerName: string;
      customerPhone: string;
      createdAt: Date;
      updatedAt: Date;
      sellerArchivedAt: Date | null;
      paymentProofStatus: string;
      shop: {
        id: string;
        name: string;
        sellerProfile: {
          userId: string;
          user: {
            email: string;
            fullName: string | null;
            phone: string | null;
          };
        };
      };
      deliveryShipments: Array<{
        id: string;
        provider: string;
        internalStatus: string;
        updatedAt: Date;
        estimatedDeliveryAt: Date | null;
        manualYandexOrderId: string | null;
        trackingUrl: string | null;
        yandexTrackingLink: string | null;
      }>;
      items: Array<{
        id: string;
        productTitleSnapshot: string;
        quantity: number;
      }>;
    },
    latestReminder: { createdAt: Date } | null,
  ) {
    const latestShipment = order.deliveryShipments[0] ?? null;
    const fulfillment = computeSellerFulfillmentState({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingMethodName: order.shippingMethodName,
      paymentProofStatus: order.paymentProofStatus,
      deliveryStatus: latestShipment?.internalStatus ?? null,
      sellerArchivedAt: order.sellerArchivedAt,
    });
    const ageSource = latestShipment?.updatedAt ?? order.updatedAt;
    const ageMinutes = Math.max(
      0,
      Math.round((Date.now() - ageSource.getTime()) / 60000),
    );
    const isOverdue = this.isFulfillmentOverdue(order, latestShipment);

    return {
      orderId: order.id,
      orderCode: order.orderNumber,
      sellerId: order.shop.sellerProfile.userId,
      sellerName: order.shop.sellerProfile.user.fullName,
      sellerEmail: order.shop.sellerProfile.user.email,
      sellerPhone: order.shop.sellerProfile.user.phone,
      shopId: order.shop.id,
      shopName: order.shop.name,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
      },
      paymentMethod: order.paymentMethod ?? order.shippingMethodName,
      paymentStatus: order.paymentStatus,
      fulfillmentBucket: fulfillment.bucket,
      fulfillmentLabel: fulfillment.label,
      deliveryStatus: latestShipment?.internalStatus ?? null,
      deliveryShipmentId: latestShipment?.id ?? null,
      manualYandexOrderId: latestShipment?.manualYandexOrderId ?? null,
      yandexTrackingUrl:
        latestShipment?.trackingUrl ??
        latestShipment?.yandexTrackingLink ??
        null,
      provider: latestShipment?.provider ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: ageSource.toISOString(),
      sellerArchivedAt: order.sellerArchivedAt?.toISOString() ?? null,
      isOverdue,
      ageMinutes,
      lastReminderAt: latestReminder?.createdAt.toISOString() ?? null,
      nextAdminActions: this.resolveAdminActions(fulfillment.bucket),
      items: order.items.map((item) => ({
        id: item.id,
        productTitleSnapshot: item.productTitleSnapshot,
        quantity: item.quantity,
      })),
    };
  }

  private resolveAdminActions(
    bucket: SellerFulfillmentBucket,
  ): AdminFulfillmentAction[] {
    if (bucket === 'ARCHIVED') {
      return ['VIEW'];
    }

    if (
      bucket === 'NEW' ||
      bucket === 'ASSEMBLING' ||
      bucket === 'IN_TRANSIT'
    ) {
      return ['VIEW', 'REMIND_SELLER'];
    }

    return ['VIEW'];
  }

  private async loadLatestReminderMap(orderIds: string[]) {
    const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))];
    if (!uniqueOrderIds.length) {
      return new Map<string, { createdAt: Date }>();
    }

    if (typeof this.prisma.adminAuditLog?.findMany !== 'function') {
      return new Map<string, { createdAt: Date }>();
    }

    const logs = await this.prisma.adminAuditLog.findMany({
      where: {
        entityType: 'DELIVERY_REMINDER',
        action: 'REMIND_CREATE_YANDEX_MANUAL',
        entityId: { in: uniqueOrderIds },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        entityId: true,
        createdAt: true,
      },
    });

    const map = new Map<string, { createdAt: Date }>();
    for (const log of logs) {
      if (log.entityId && !map.has(log.entityId)) {
        map.set(log.entityId, {
          createdAt: log.createdAt,
        });
      }
    }
    return map;
  }

  private isFulfillmentOverdue(
    order: {
      status: string;
      paymentStatus: string;
      paymentMethod: string | null;
      shippingMethodName: string | null;
      paymentProofStatus: string;
      sellerArchivedAt: Date | null;
      updatedAt: Date;
    },
    latestShipment: {
      internalStatus: string;
      updatedAt: Date;
      estimatedDeliveryAt: Date | null;
    } | null,
  ) {
    const fulfillment = computeSellerFulfillmentState({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingMethodName: order.shippingMethodName,
      paymentProofStatus: order.paymentProofStatus,
      deliveryStatus: latestShipment?.internalStatus ?? null,
      sellerArchivedAt: order.sellerArchivedAt,
    });

    if (fulfillment.bucket === 'NEW' || fulfillment.bucket === 'ASSEMBLING') {
      const source = latestShipment?.updatedAt ?? order.updatedAt;
      return source < this.getNewOrAssemblyOverdueCutoff();
    }

    if (fulfillment.bucket === 'IN_TRANSIT') {
      if (latestShipment?.estimatedDeliveryAt) {
        return latestShipment.estimatedDeliveryAt < new Date();
      }
      return (
        (latestShipment?.updatedAt ?? order.updatedAt) <
        this.getInTransitOverdueCutoff()
      );
    }

    return false;
  }

  private getNewOrAssemblyOverdueCutoff() {
    const minutes = Number(
      this.configService.get<string>('MANUAL_YANDEX_OVERDUE_MINUTES', '120'),
    );
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  private getInTransitOverdueCutoff() {
    const minutes = Number(
      this.configService.get<string>(
        'ADMIN_IN_TRANSIT_OVERDUE_MINUTES',
        '2880',
      ),
    );
    return new Date(Date.now() - minutes * 60 * 1000);
  }

  private get orderInclude() {
    return {
      shop: {
        select: {
          id: true,
          name: true,
          paymentInstructions: true,
          bankName: true,
          accountHolderName: true,
          accountNumber: true,
          recipientPhone: true,
          sbpPhone: true,
          staticQrImageUrl: true,
          paymentMode: true,
          paymentConfigStatus: true,
          allowPrepaidQr: true,
          allowPayOnDeliverySellerQr: true,
          allowDepositPayment: true,
          depositPercent: true,
          depositRequiredAboveAmount: true,
          codMaxOrderAmount: true,
          yandexCardOnDeliveryStatus: true,
          cashCourierCollectionStatus: true,
        },
      },
      deliveryShipments: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          provider: true,
          internalStatus: true,
          providerShipmentId: true,
          providerOrderNumber: true,
          trackingNumber: true,
          trackingUrl: true,
          courierName: true,
          courierPhone: true,
          estimatedDeliveryAt: true,
          packagePreset: true,
          packageWeightGram: true,
          packageLengthCm: true,
          packageWidthCm: true,
          packageHeightCm: true,
          manualYandexOrderId: true,
          yandexClaimId: true,
          yandexTrackingLink: true,
          deliveryNote: true,
          dropoffPostalCode: true,
        },
      },
      sellerFeeLedgerEntries: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          status: true,
          commissionAmount: true,
          invoice: {
            select: {
              status: true,
            },
          },
        },
      },
      items: {
        orderBy: { productTitleSnapshot: 'asc' as const },
      },
      supportCases: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          issueType: true,
          status: true,
          subject: true,
          createdAt: true,
        },
      },
      returnRefundCases: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          type: true,
          reason: true,
          status: true,
          requestedAmount: true,
          approvedAmount: true,
          createdAt: true,
        },
      },
    };
  }

  private get adminFulfillmentInclude() {
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
                  phone: true,
                },
              },
            },
          },
        },
      },
      deliveryShipments: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          provider: true,
          internalStatus: true,
          updatedAt: true,
          estimatedDeliveryAt: true,
          manualYandexOrderId: true,
          trackingUrl: true,
          yandexTrackingLink: true,
        },
      },
      items: {
        take: 3,
        orderBy: { productTitleSnapshot: 'asc' as const },
        select: {
          id: true,
          productTitleSnapshot: true,
          quantity: true,
        },
      },
    };
  }
}
