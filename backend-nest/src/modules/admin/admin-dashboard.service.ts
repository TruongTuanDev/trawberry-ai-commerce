import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';

const ACTIVE_DELIVERY_STATUSES = [
  'CREATED',
  'CREATED_MANUALLY',
  'ACCEPTED',
  'IN_TRANSIT',
] as const;
const DELIVERY_EXCEPTION_STATUSES = ['FAILED', 'CANCELLED'] as const;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: AdminDashboardQueryDto) {
    const orderWhere = this.buildOrderWhere(query);
    const shipmentWhere = this.buildShipmentWhere(query);
    const productWhere = this.buildProductVariantWhere(query);
    const sellerWhere = this.buildSellerWhere(query);
    const dateRange = this.buildDateRange(query);
    const paidWithoutDeliveryWhere = this.buildPaidWithoutDeliveryWhere(query);
    const deliveryExceptionWhere: Prisma.DeliveryShipmentWhereInput = {
      ...shipmentWhere,
      internalStatus: { in: [...DELIVERY_EXCEPTION_STATUSES] },
    };

    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      paidWithoutDelivery,
      inTransitDeliveriesForOrders,
      deliveredDeliveriesForOrders,
      cancelledFailedDeliveriesForOrders,
      pendingPayments,
      paidPayments,
      rejectedPayments,
      notCreatedDeliveries,
      createdDeliveries,
      inTransitDeliveries,
      deliveredDeliveries,
      failedDeliveries,
      cancelledDeliveries,
      deliveredToday,
      deliveredThisWeek,
      outOfStock,
      lowStock,
      pendingSellers,
      approvedSellers,
      rejectedSellers,
      sellersWithPaidOrdersWithoutDelivery,
      recentOrders,
      recentPaymentReviews,
      recentDeliveryExceptions,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.count({
        where: { ...orderWhere, status: { in: ['NEW', 'PENDING'] } },
      }),
      this.prisma.order.count({
        where: { ...orderWhere, paymentStatus: 'PAID' },
      }),
      this.prisma.order.count({ where: paidWithoutDeliveryWhere }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'IN_TRANSIT' },
      }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'DELIVERED' },
      }),
      this.prisma.deliveryShipment.count({ where: deliveryExceptionWhere }),
      this.prisma.order.count({
        where: { ...orderWhere, paymentStatus: 'PENDING' },
      }),
      this.prisma.order.count({
        where: { ...orderWhere, paymentStatus: 'PAID' },
      }),
      this.prisma.order.count({
        where: { ...orderWhere, paymentStatus: { in: ['REJECTED', 'FAILED'] } },
      }),
      this.prisma.order.count({ where: paidWithoutDeliveryWhere }),
      this.prisma.deliveryShipment.count({
        where: {
          ...shipmentWhere,
          internalStatus: { in: ['CREATED', 'CREATED_MANUALLY', 'ACCEPTED'] },
        },
      }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'IN_TRANSIT' },
      }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'DELIVERED' },
      }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'FAILED' },
      }),
      this.prisma.deliveryShipment.count({
        where: { ...shipmentWhere, internalStatus: 'CANCELLED' },
      }),
      this.prisma.deliveryShipment.count({
        where: {
          ...shipmentWhere,
          internalStatus: 'DELIVERED',
          deliveredAt: { gte: this.startOfToday() },
        },
      }),
      this.prisma.deliveryShipment.count({
        where: {
          ...shipmentWhere,
          internalStatus: 'DELIVERED',
          deliveredAt: { gte: this.startOfWeek() },
        },
      }),
      this.prisma.productVariant.count({
        where: { ...productWhere, trackInventory: true, stockQuantity: 0 },
      }),
      this.prisma.productVariant.count({
        where: {
          ...productWhere,
          trackInventory: true,
          stockQuantity: { gt: 0 },
          AND: [
            ...(Array.isArray(productWhere.AND) ? productWhere.AND : []),
            {
              stockQuantity: {
                lte: this.prisma.productVariant.fields.lowStockThreshold,
              },
            },
          ],
        },
      }),
      this.prisma.sellerProfile.count({
        where: { ...sellerWhere, approvalStatus: 'PENDING' },
      }),
      this.prisma.sellerProfile.count({
        where: { ...sellerWhere, approvalStatus: 'APPROVED' },
      }),
      this.prisma.sellerProfile.count({
        where: { ...sellerWhere, approvalStatus: 'REJECTED' },
      }),
      this.countSellersWithPaidOrdersWithoutDelivery(paidWithoutDeliveryWhere),
      this.prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          customerName: true,
          createdAt: true,
          shop: { select: { id: true, name: true } },
        },
      }),
      this.prisma.paymentReviewLog.findMany({
        where: {
          ...(dateRange ? { createdAt: dateRange } : {}),
          ...(query.shopId ? { shopId: query.shopId } : {}),
          ...(query.sellerId
            ? { shop: { sellerProfile: { userId: query.sellerId } } }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true } },
          shop: { select: { id: true, name: true } },
        },
      }),
      this.prisma.deliveryShipment.findMany({
        where: deliveryExceptionWhere,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderId: true,
          internalStatus: true,
          failureReasonCode: true,
          customerVisibleMessage: true,
          updatedAt: true,
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              shop: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.adminAuditLog.findMany({
        where: dateRange ? { createdAt: dateRange } : {},
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          actorUserId: true,
          targetUserId: true,
          action: true,
          entityType: true,
          entityId: true,
          reason: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        shopId: query.shopId ?? null,
        sellerId: query.sellerId ?? null,
        defaultRange: query.dateFrom || query.dateTo ? 'CUSTOM' : 'ALL_TIME',
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        paidWithoutDelivery,
        inTransit: inTransitDeliveriesForOrders,
        delivered: deliveredDeliveriesForOrders,
        cancelled: cancelledFailedDeliveriesForOrders,
      },
      payments: {
        pending: pendingPayments,
        paid: paidPayments,
        rejected: rejectedPayments,
      },
      deliveries: {
        notCreated: notCreatedDeliveries,
        created: createdDeliveries,
        inTransit: inTransitDeliveries,
        delivered: deliveredDeliveries,
        deliveredToday,
        deliveredThisWeek,
        failed: failedDeliveries,
        cancelled: cancelledDeliveries,
        exceptions: failedDeliveries + cancelledDeliveries,
      },
      inventory: {
        outOfStock,
        lowStock,
      },
      sellers: {
        pending: pendingSellers,
        approved: approvedSellers,
        rejected: rejectedSellers,
        withPaidOrdersWithoutDelivery: sellersWithPaidOrdersWithoutDelivery,
      },
      recent: {
        orders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount.toString(),
          customerName: order.customerName,
          shopId: order.shop.id,
          shopName: order.shop.name,
          createdAt: order.createdAt.toISOString(),
        })),
        paymentReviews: recentPaymentReviews.map((log) => ({
          id: log.id,
          action: log.action,
          fromStatus: log.fromStatus,
          toStatus: log.toStatus,
          note: log.note,
          orderId: log.order.id,
          orderNumber: log.order.orderNumber,
          shopId: log.shop.id,
          shopName: log.shop.name,
          createdAt: log.createdAt.toISOString(),
        })),
        deliveryExceptions: recentDeliveryExceptions.map((shipment) => ({
          id: shipment.id,
          orderId: shipment.orderId,
          orderNumber: shipment.order.orderNumber,
          customerName: shipment.order.customerName,
          shopId: shipment.order.shop.id,
          shopName: shipment.order.shop.name,
          status: shipment.internalStatus,
          reasonCode: shipment.failureReasonCode,
          customerVisibleMessage: shipment.customerVisibleMessage,
          updatedAt: shipment.updatedAt.toISOString(),
        })),
        auditLogs: recentAuditLogs.map((log) => ({
          id: log.id,
          actorUserId: log.actorUserId,
          targetUserId: log.targetUserId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          reason: log.reason,
          createdAt: log.createdAt.toISOString(),
        })),
      },
    };
  }

  private buildOrderWhere(
    query: AdminDashboardQueryDto,
  ): Prisma.OrderWhereInput {
    return {
      ...(this.buildDateRange(query)
        ? { createdAt: this.buildDateRange(query) }
        : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
  }

  private buildShipmentWhere(
    query: AdminDashboardQueryDto,
  ): Prisma.DeliveryShipmentWhereInput {
    return {
      ...(this.buildDateRange(query)
        ? { createdAt: this.buildDateRange(query) }
        : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.sellerId
        ? { order: { shop: { sellerProfile: { userId: query.sellerId } } } }
        : {}),
    };
  }

  private buildPaidWithoutDeliveryWhere(
    query: AdminDashboardQueryDto,
  ): Prisma.OrderWhereInput {
    return {
      ...this.buildOrderWhere(query),
      paymentStatus: 'PAID',
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
      deliveryShipments: {
        none: { internalStatus: { in: [...ACTIVE_DELIVERY_STATUSES] } },
      },
    };
  }

  private buildProductVariantWhere(
    query: AdminDashboardQueryDto,
  ): Prisma.ProductVariantWhereInput {
    return {
      ...(query.shopId ? { product: { shopId: query.shopId } } : {}),
      ...(query.sellerId
        ? { product: { shop: { sellerProfile: { userId: query.sellerId } } } }
        : {}),
    };
  }

  private buildSellerWhere(
    query: AdminDashboardQueryDto,
  ): Prisma.SellerProfileWhereInput {
    return {
      ...(query.sellerId ? { userId: query.sellerId } : {}),
      ...(query.shopId ? { shops: { some: { id: query.shopId } } } : {}),
    };
  }

  private buildDateRange(query: AdminDashboardQueryDto) {
    if (!query.dateFrom && !query.dateTo) return undefined;
    return {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    };
  }

  private async countSellersWithPaidOrdersWithoutDelivery(
    where: Prisma.OrderWhereInput,
  ) {
    const rows = await this.prisma.order.findMany({
      where,
      distinct: ['shopId'],
      select: { shopId: true },
      take: 10000,
    });
    return rows.length;
  }

  private startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private startOfWeek() {
    const date = this.startOfToday();
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diff);
    return date;
  }
}
