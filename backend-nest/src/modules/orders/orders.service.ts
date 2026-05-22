import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveOrderPaymentPanel } from '../../common/utils/shop-payment.util';
import { computeAddressGeoReadiness } from '../../common/utils/customer-address.util';
import { computeSellerOrderDisplayStatus } from '../../common/utils/order-role-status.util';
import { ListShopOrdersQueryDto } from './dto/list-shop-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SellerFinanceService } from '../seller-finance/seller-finance.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerFinanceService: SellerFinanceService,
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

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy,
        skip,
        take: size,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.toOrderResponse(order)),
      meta: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
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
          status: { in: ['PENDING', 'NEW'] },
          paymentStatus: { in: ['PENDING', 'UNPAID'] },
          paymentProofStatus: 'NOT_SUBMITTED',
        };
      case 'AWAITING_PAYMENT':
        return {
          paymentStatus: {
            in: [
              'PAY_ON_DELIVERY_SELECTED',
              'SELLER_ACCEPTED_PAY_ON_DELIVERY',
              'DELIVERED_AWAITING_PAYMENT',
            ],
          },
        };
      case 'PAYMENT_PROOF':
        return {
          paymentProofStatus: 'BUYER_MARKED_PAID',
          paymentStatus: {
            notIn: ['BUYER_MARKED_DELIVERY_PAID', 'PAID', 'APPROVED'],
          },
        };
      case 'TO_PACK':
        return {
          status: { in: ['NEW', 'PENDING', 'ASSEMBLING'] },
          paymentStatus: {
            in: ['PAID', 'APPROVED', 'SELLER_CONFIRMED_DELIVERY_PAYMENT'],
          },
        };
      case 'READY_FOR_YANDEX':
        return { status: 'READY_TO_CREATE_YANDEX' };
      case 'IN_DELIVERY':
        return {
          OR: [
            { status: { in: ['YANDEX_MANUAL_CREATED', 'SHIPPING'] } },
            {
              deliveryShipments: {
                some: {
                  internalStatus: {
                    in: [
                      'YANDEX_MANUAL_CREATED',
                      'CREATED_MANUALLY',
                      'CREATED',
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
      case 'DELIVERED':
        return {
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
      case 'PAYMENT_ISSUES':
        return {
          OR: [
            {
              paymentStatus: {
                in: ['REJECTED', 'FAILED', 'DELIVERY_PAYMENT_REJECTED'],
              },
            },
            {
              deliveryShipments: {
                some: {
                  internalStatus: 'FAILED',
                },
              },
            },
          ],
        };
      case 'CANCELLED':
        return { status: 'CANCELLED' };
      default:
        return { status };
    }
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
    const sellerDisplay = computeSellerOrderDisplayStatus({
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingMethodName: order.shippingMethodName,
      paymentProofStatus: order.paymentProofStatus,
      deliveryStatus: latestShipment?.internalStatus ?? null,
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
}
