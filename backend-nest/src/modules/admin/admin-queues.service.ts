import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminQueueTasksService } from './admin-queue-tasks.service';
import {
  AdminDeliveryQueueQueryDto,
  AdminInventoryQueueQueryDto,
  AdminPaymentQueueQueryDto,
  AdminQueueBaseQueryDto,
  AdminSellerQueueQueryDto,
} from './dto/admin-queues-query.dto';

type SlaStatus = 'OK' | 'WARNING' | 'BREACHED';

const ACTIVE_DELIVERY_STATUSES = [
  'CREATED',
  'CREATED_MANUALLY',
  'ACCEPTED',
  'IN_TRANSIT',
] as const;
const DELIVERY_EXCEPTION_STATUSES = ['FAILED', 'CANCELLED'] as const;

const SLA_HOURS = {
  sellerApproval: { warning: 24, breached: 72 },
  paymentReview: { warning: 4, breached: 24 },
  paidWithoutDelivery: { warning: 12, breached: 24 },
  deliveryException: { warning: 0, breached: 24 },
} as const;

@Injectable()
export class AdminQueuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: AdminQueueTasksService,
  ) {}

  async listSellers(query: AdminSellerQueueQueryDto) {
    const page = this.page(query);
    const limit = this.limit(query);
    const where: Prisma.SellerProfileWhereInput = {
      approvalStatus: query.status ?? 'PENDING',
      ...(query.q
        ? {
            OR: [
              { legalName: { contains: query.q, mode: 'insensitive' } },
              { contactEmail: { contains: query.q, mode: 'insensitive' } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
              {
                user: { fullName: { contains: query.q, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const [total, rows, summary] = await Promise.all([
      this.prisma.sellerProfile.count({ where }),
      this.prisma.sellerProfile.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          approvalStatus: true,
          legalName: true,
          contactName: true,
          contactEmail: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { email: true, fullName: true } },
          shops: { select: { id: true, name: true }, take: 1 },
        },
      }),
      this.sellerSummary(),
    ]);
    const items = await this.withTaskFields(
      rows
        .map((seller) => {
          const age = this.age(seller.createdAt);
          const slaStatus = this.sla(age.ageHours, SLA_HOURS.sellerApproval);
          const shop = seller.shops[0] ?? null;
          return {
            id: seller.userId,
            shopId: shop?.id ?? null,
            shopName: shop?.name ?? null,
            sellerId: seller.userId,
            sellerEmail: seller.user.email,
            sellerName: seller.user.fullName ?? seller.contactName,
            status: seller.approvalStatus,
            title:
              seller.legalName ?? seller.user.fullName ?? seller.user.email,
            createdAt: seller.createdAt.toISOString(),
            updatedAt: seller.updatedAt.toISOString(),
            ...age,
            slaStatus,
            actionUrl: `/admin/sellers/${seller.userId}`,
            entityType: 'SELLER',
            entityId: seller.userId,
          };
        })
        .filter((item) =>
          this.matchesAgeBucket(item.slaStatus, query.ageBucket),
        ),
    );

    return this.response(items, total, page, limit, query, summary);
  }

  async listPayments(query: AdminPaymentQueueQueryDto) {
    const page = this.page(query);
    const limit = this.limit(query);
    const where: Prisma.OrderWhereInput = {
      paymentStatus: query.status ?? 'PENDING',
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const [total, rows, summary] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          status: true,
          totalAmount: true,
          customerName: true,
          createdAt: true,
          updatedAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              sellerProfile: {
                select: { userId: true, user: { select: { email: true } } },
              },
            },
          },
        },
      }),
      this.paymentSummary(query),
    ]);
    const items = await this.withTaskFields(
      rows
        .map((order) => {
          const age = this.age(order.updatedAt);
          const slaStatus = this.sla(age.ageHours, SLA_HOURS.paymentReview);
          return {
            id: order.id,
            shopId: order.shop.id,
            shopName: order.shop.name,
            sellerId: order.shop.sellerProfile.userId,
            sellerEmail: order.shop.sellerProfile.user.email,
            orderCode: order.orderNumber,
            customerName: order.customerName,
            status: order.paymentStatus,
            orderStatus: order.status,
            totalAmount: order.totalAmount.toString(),
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            ...age,
            slaStatus,
            actionUrl: `/seller/payments/${order.id}`,
            entityType: 'PAYMENT',
            entityId: order.id,
          };
        })
        .filter((item) =>
          this.matchesAgeBucket(item.slaStatus, query.ageBucket),
        ),
    );

    return this.response(items, total, page, limit, query, summary);
  }

  async listDeliveries(query: AdminDeliveryQueueQueryDto) {
    const queueType = query.queueType ?? 'PAID_WITHOUT_DELIVERY';
    if (queueType === 'PAID_WITHOUT_DELIVERY') {
      return this.listPaidWithoutDelivery(query);
    }
    return this.listShipmentQueue(query, queueType);
  }

  async listInventory(query: AdminInventoryQueueQueryDto) {
    const page = this.page(query);
    const limit = this.limit(query);
    const baseWhere: Prisma.ProductVariantWhereInput = {
      trackInventory: true,
      product: {
        ...(query.shopId ? { shopId: query.shopId } : {}),
        ...(query.sellerId
          ? { shop: { sellerProfile: { userId: query.sellerId } } }
          : {}),
      },
    };
    const status = query.stockStatus ?? 'LOW_STOCK';
    const where: Prisma.ProductVariantWhereInput =
      status === 'OUT_OF_STOCK'
        ? { ...baseWhere, stockQuantity: 0 }
        : {
            ...baseWhere,
            stockQuantity: { gt: 0 },
            AND: [
              {
                stockQuantity: {
                  lte: this.prisma.productVariant.fields.lowStockThreshold,
                },
              },
            ],
          };
    const [total, rows, summary] = await Promise.all([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        orderBy: [{ stockQuantity: 'asc' }, { updatedAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          productId: true,
          stockQuantity: true,
          lowStockThreshold: true,
          createdAt: true,
          updatedAt: true,
          product: {
            select: {
              localTitle: true,
              wbTitle: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  sellerProfile: {
                    select: {
                      userId: true,
                      user: { select: { email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.inventorySummary(query),
    ]);
    const items = await this.withTaskFields(
      rows.map((variant) => {
        const age = this.age(variant.updatedAt);
        const stockStatus =
          variant.stockQuantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK';
        return {
          id: variant.id,
          productId: variant.productId,
          productName: variant.product.localTitle ?? variant.product.wbTitle,
          shopId: variant.product.shop.id,
          shopName: variant.product.shop.name,
          sellerId: variant.product.shop.sellerProfile.userId,
          sellerEmail: variant.product.shop.sellerProfile.user.email,
          status: stockStatus,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          createdAt: variant.createdAt.toISOString(),
          updatedAt: variant.updatedAt.toISOString(),
          ...age,
          slaStatus: stockStatus === 'OUT_OF_STOCK' ? 'BREACHED' : 'WARNING',
          actionUrl: `/seller/products/${variant.productId}`,
          entityType: 'INVENTORY',
          entityId: variant.id,
        };
      }),
    );

    return this.response(items, total, page, limit, query, summary);
  }

  private async listPaidWithoutDelivery(query: AdminDeliveryQueueQueryDto) {
    const page = this.page(query);
    const limit = this.limit(query);
    const where: Prisma.OrderWhereInput = {
      paymentStatus: 'PAID',
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
      deliveryShipments: {
        none: { internalStatus: { in: [...ACTIVE_DELIVERY_STATUSES] } },
      },
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const [total, rows, summary] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          customerName: true,
          createdAt: true,
          updatedAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              sellerProfile: {
                select: { userId: true, user: { select: { email: true } } },
              },
            },
          },
        },
      }),
      this.deliverySummary(query),
    ]);
    const items = await this.withTaskFields(
      rows
        .map((order) => {
          const age = this.age(order.updatedAt);
          return {
            id: order.id,
            shopId: order.shop.id,
            shopName: order.shop.name,
            sellerId: order.shop.sellerProfile.userId,
            sellerEmail: order.shop.sellerProfile.user.email,
            orderCode: order.orderNumber,
            customerName: order.customerName,
            status: 'PAID_WITHOUT_DELIVERY',
            orderStatus: order.status,
            deliveryStatus: 'NOT_CREATED',
            provider: null,
            createdAt: order.createdAt.toISOString(),
            updatedAt: order.updatedAt.toISOString(),
            ...age,
            slaStatus: this.sla(age.ageHours, SLA_HOURS.paidWithoutDelivery),
            actionUrl: `/admin/deliveries?paidWithoutDelivery=true`,
            entityType: 'ORDER',
            entityId: order.id,
          };
        })
        .filter((item) =>
          this.matchesAgeBucket(item.slaStatus, query.ageBucket),
        ),
    );

    return this.response(items, total, page, limit, query, summary);
  }

  private async listShipmentQueue(
    query: AdminDeliveryQueueQueryDto,
    queueType: 'EXCEPTION' | 'IN_TRANSIT' | 'DELIVERED',
  ) {
    const page = this.page(query);
    const limit = this.limit(query);
    const statusWhere =
      queueType === 'EXCEPTION'
        ? { in: [...DELIVERY_EXCEPTION_STATUSES] }
        : queueType;
    const where: Prisma.DeliveryShipmentWhereInput = {
      internalStatus: statusWhere,
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const [total, rows, summary] = await Promise.all([
      this.prisma.deliveryShipment.count({ where }),
      this.prisma.deliveryShipment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderId: true,
          provider: true,
          internalStatus: true,
          failureReasonCode: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  sellerProfile: {
                    select: {
                      userId: true,
                      user: { select: { email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.deliverySummary(query),
    ]);
    const items = await this.withTaskFields(
      rows
        .map((shipment) => {
          const age = this.age(shipment.updatedAt);
          const slaStatus =
            queueType === 'EXCEPTION'
              ? this.sla(age.ageHours, SLA_HOURS.deliveryException)
              : ('OK' as SlaStatus);
          return {
            id: shipment.id,
            shopId: shipment.order.shop.id,
            shopName: shipment.order.shop.name,
            sellerId: shipment.order.shop.sellerProfile.userId,
            sellerEmail: shipment.order.shop.sellerProfile.user.email,
            orderCode: shipment.order.orderNumber,
            customerName: shipment.order.customerName,
            status: shipment.internalStatus,
            provider: shipment.provider,
            reasonCode: shipment.failureReasonCode,
            createdAt: shipment.createdAt.toISOString(),
            updatedAt: shipment.updatedAt.toISOString(),
            ...age,
            slaStatus,
            actionUrl: `/admin/deliveries?status=${shipment.internalStatus}`,
            entityType: 'DELIVERY',
            entityId: shipment.id,
          };
        })
        .filter((item) =>
          this.matchesAgeBucket(item.slaStatus, query.ageBucket),
        ),
    );

    return this.response(items, total, page, limit, query, summary);
  }

  private async sellerSummary() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.sellerProfile.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.sellerProfile.count({
        where: { approvalStatus: 'APPROVED' },
      }),
      this.prisma.sellerProfile.count({
        where: { approvalStatus: 'REJECTED' },
      }),
    ]);
    return { pending, approved, rejected };
  }

  private async paymentSummary(query: AdminPaymentQueueQueryDto) {
    const base = {
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const [pending, paid, rejected] = await Promise.all([
      this.prisma.order.count({ where: { ...base, paymentStatus: 'PENDING' } }),
      this.prisma.order.count({ where: { ...base, paymentStatus: 'PAID' } }),
      this.prisma.order.count({
        where: { ...base, paymentStatus: { in: ['REJECTED', 'FAILED'] } },
      }),
    ]);
    return { pending, paid, rejected };
  }

  private async deliverySummary(query: AdminDeliveryQueueQueryDto) {
    const orderBase = {
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const shipmentBase = {
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
    const [paidWithoutDelivery, exceptions, inTransit, delivered] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            ...orderBase,
            paymentStatus: 'PAID',
            status: { notIn: ['DELIVERED', 'CANCELLED'] },
            deliveryShipments: {
              none: { internalStatus: { in: [...ACTIVE_DELIVERY_STATUSES] } },
            },
          },
        }),
        this.prisma.deliveryShipment.count({
          where: {
            ...shipmentBase,
            internalStatus: { in: [...DELIVERY_EXCEPTION_STATUSES] },
          },
        }),
        this.prisma.deliveryShipment.count({
          where: { ...shipmentBase, internalStatus: 'IN_TRANSIT' },
        }),
        this.prisma.deliveryShipment.count({
          where: { ...shipmentBase, internalStatus: 'DELIVERED' },
        }),
      ]);
    return { paidWithoutDelivery, exceptions, inTransit, delivered };
  }

  private async inventorySummary(query: AdminInventoryQueueQueryDto) {
    const base: Prisma.ProductVariantWhereInput = {
      trackInventory: true,
      product: {
        ...(query.shopId ? { shopId: query.shopId } : {}),
        ...(query.sellerId
          ? { shop: { sellerProfile: { userId: query.sellerId } } }
          : {}),
      },
    };
    const [outOfStock, lowStock] = await Promise.all([
      this.prisma.productVariant.count({
        where: { ...base, stockQuantity: 0 },
      }),
      this.prisma.productVariant.count({
        where: {
          ...base,
          stockQuantity: { gt: 0 },
          AND: [
            {
              stockQuantity: {
                lte: this.prisma.productVariant.fields.lowStockThreshold,
              },
            },
          ],
        },
      }),
    ]);
    return { outOfStock, lowStock };
  }

  private response<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    filters: object,
    summary: Record<string, number>,
  ) {
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      total,
      filters,
      summary,
    };
  }

  private async withTaskFields<
    T extends { entityType: string; entityId: string },
  >(items: T[]) {
    const tasks = await this.tasksService.findTasksForEntities(
      items.map((item) => ({
        entityType: item.entityType,
        entityId: item.entityId,
      })),
    );
    return items
      .map((item) => {
        const task = tasks.get(`${item.entityType}:${item.entityId}`);
        return {
          ...item,
          taskId: task?.id ?? null,
          taskStatus: task?.status ?? null,
          taskPriority: task?.priority ?? null,
          assignedToUserId: task?.assignedToUserId ?? null,
          assignedToEmail: task?.assignedToEmail ?? null,
          assignedToName: task?.assignedToName ?? null,
          assignedAt: task?.assignedAt ?? null,
          escalatedAt: task?.escalatedAt ?? null,
          resolvedAt: task?.resolvedAt ?? null,
        };
      })
      .filter((item) => item.taskStatus !== 'RESOLVED');
  }

  private age(date: Date) {
    const ageMinutes = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 60000),
    );
    return { ageMinutes, ageHours: Math.floor(ageMinutes / 60) };
  }

  private sla(
    ageHours: number,
    thresholds: { warning: number; breached?: number },
  ): SlaStatus {
    if (thresholds.breached !== undefined && ageHours >= thresholds.breached) {
      return 'BREACHED';
    }
    if (ageHours >= thresholds.warning) return 'WARNING';
    return 'OK';
  }

  private matchesAgeBucket(status: SlaStatus, bucket?: string) {
    return !bucket || status === bucket;
  }

  private page(query: AdminQueueBaseQueryDto) {
    return query.page ?? 1;
  }

  private limit(query: AdminQueueBaseQueryDto) {
    return query.limit ?? 20;
  }
}
