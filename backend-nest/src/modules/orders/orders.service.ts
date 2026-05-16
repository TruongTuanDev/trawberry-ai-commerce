import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListShopOrdersQueryDto } from './dto/list-shop-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listByShop(shopId: string, query: ListShopOrdersQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;
    const where = this.buildWhere(shopId, query);

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          shop: {
            select: { id: true, name: true },
          },
          deliveryShipments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              provider: true,
              internalStatus: true,
              providerShipmentId: true,
              trackingNumber: true,
              trackingUrl: true,
            },
          },
          items: {
            orderBy: { productTitleSnapshot: 'asc' },
          },
          supportCases: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              issueType: true,
              status: true,
              subject: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
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
      include: {
        shop: {
          select: { id: true, name: true },
        },
        deliveryShipments: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            provider: true,
            internalStatus: true,
            providerShipmentId: true,
            trackingNumber: true,
            trackingUrl: true,
          },
        },
        items: {
          orderBy: { productTitleSnapshot: 'asc' },
        },
        supportCases: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            issueType: true,
            status: true,
            subject: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return this.toOrderResponse(order);
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
      include: {
        shop: {
          select: { id: true, name: true },
        },
        items: true,
      },
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

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: dto.status,
        },
        include: {
          shop: {
            select: { id: true, name: true },
          },
          deliveryShipments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              provider: true,
              internalStatus: true,
              providerShipmentId: true,
              trackingNumber: true,
              trackingUrl: true,
            },
          },
          items: {
            orderBy: { productTitleSnapshot: 'asc' },
          },
          supportCases: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              issueType: true,
              status: true,
              subject: true,
              createdAt: true,
            },
          },
        },
      });
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
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
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
    totalAmount: Prisma.Decimal;
    shippingCost: Prisma.Decimal;
    shippingMethodName: string | null;
    shippingAddress: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    customerNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    customerCompletedAt: Date | null;
    shop: { id: string; name: string };
    deliveryShipments?: Array<{
      provider: string;
      internalStatus: string;
      providerShipmentId: string | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
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
  }) {
    const latestShipment = order.deliveryShipments?.[0] ?? null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      shippingCost: order.shippingCost.toString(),
      shippingMethodName: order.shippingMethodName,
      shippingAddress: order.shippingAddress,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
      },
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customerCompletedAt: order.customerCompletedAt?.toISOString() ?? null,
      delivery: latestShipment
        ? {
            provider: latestShipment.provider,
            status: latestShipment.internalStatus,
            providerShipmentId: latestShipment.providerShipmentId,
            trackingNumber: latestShipment.trackingNumber,
            trackingUrl: latestShipment.trackingUrl,
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
    };
  }
}
