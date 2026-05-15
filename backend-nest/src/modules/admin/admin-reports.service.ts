import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AdminDeliveryExceptionsReportQueryDto,
  AdminOpsSummaryReportQueryDto,
  AdminPagedReportQueryDto,
  AdminPaymentAgingReportQueryDto,
  AdminSlaBreachesReportQueryDto,
  AdminWorkloadReportQueryDto,
} from './dto/admin-reports-query.dto';

const ACTIVE_DELIVERY_STATUSES = [
  'CREATED',
  'CREATED_MANUALLY',
  'ACCEPTED',
  'IN_TRANSIT',
] as const;
const DELIVERY_EXCEPTION_STATUSES = ['FAILED', 'CANCELLED'] as const;
const CSV_LIMIT = 5000;

type CsvValue = string | number | boolean | null | undefined;

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async opsSummary(query: AdminOpsSummaryReportQueryDto) {
    const taskWhere = this.taskWhere(query);
    const orderWhere = this.orderWhere(query);
    const shipmentWhere = this.shipmentWhere(query);
    const productWhere = this.productVariantWhere(query);
    const paidWithoutDeliveryWhere = this.paidWithoutDeliveryWhere(query);
    const [
      totalTasks,
      openTasks,
      inProgressTasks,
      escalatedTasks,
      resolvedTasks,
      breachedTasks,
      resolvedRows,
      pendingPayments,
      paidWithoutDelivery,
      deliveryExceptions,
      lowStockProducts,
      outOfStockProducts,
    ] = await Promise.all([
      this.prisma.adminQueueTask.count({ where: taskWhere }),
      this.prisma.adminQueueTask.count({
        where: { ...taskWhere, status: 'OPEN' },
      }),
      this.prisma.adminQueueTask.count({
        where: { ...taskWhere, status: 'IN_PROGRESS' },
      }),
      this.prisma.adminQueueTask.count({
        where: { ...taskWhere, status: 'ESCALATED' },
      }),
      this.prisma.adminQueueTask.count({
        where: { ...taskWhere, status: 'RESOLVED' },
      }),
      this.prisma.adminQueueTask.count({
        where: { ...taskWhere, slaStatus: 'BREACHED' },
      }),
      this.prisma.adminQueueTask.findMany({
        where: {
          ...taskWhere,
          status: 'RESOLVED',
          resolvedAt: { not: null },
        },
        select: { createdAt: true, resolvedAt: true },
        take: CSV_LIMIT,
      }),
      this.prisma.order.count({
        where: { ...orderWhere, paymentStatus: 'PENDING' },
      }),
      this.prisma.order.count({ where: paidWithoutDeliveryWhere }),
      this.prisma.deliveryShipment.count({
        where: {
          ...shipmentWhere,
          internalStatus: { in: [...DELIVERY_EXCEPTION_STATUSES] },
        },
      }),
      this.prisma.productVariant.count({
        where: {
          ...productWhere,
          trackInventory: true,
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
      this.prisma.productVariant.count({
        where: { ...productWhere, trackInventory: true, stockQuantity: 0 },
      }),
    ]);
    return {
      filters: this.filters(query),
      totalTasks,
      openTasks,
      inProgressTasks,
      escalatedTasks,
      resolvedTasks,
      breachedTasks,
      averageResolutionHours: this.averageResolutionHours(resolvedRows),
      pendingPayments,
      paidWithoutDelivery,
      deliveryExceptions,
      lowStockProducts,
      outOfStockProducts,
    };
  }

  async slaBreaches(query: AdminSlaBreachesReportQueryDto, exportCsv = false) {
    const page = this.page(query);
    const limit = exportCsv ? CSV_LIMIT : this.limit(query);
    const where: Prisma.AdminQueueTaskWhereInput = {
      ...this.taskWhere(query),
      slaStatus: 'BREACHED',
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.assignedToUserId
        ? { assignedToUserId: query.assignedToUserId }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.adminQueueTask.count({ where }),
      this.prisma.adminQueueTask.findMany({
        where,
        orderBy: [{ escalatedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: exportCsv ? 0 : (page - 1) * limit,
        take: limit,
        include: {
          assignedTo: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);
    const items = rows.map((task) => this.mapTaskReport(task));
    return this.reportResponse(items, total, page, limit, query);
  }

  async workload(query: AdminWorkloadReportQueryDto) {
    const rows = await this.prisma.adminQueueTask.findMany({
      where: {
        ...this.taskWhere(query),
        assignedToUserId: { not: null },
      },
      take: CSV_LIMIT,
      include: {
        assignedTo: { select: { id: true, email: true, fullName: true } },
      },
    });
    const grouped = new Map<
      string,
      {
        adminUserId: string;
        adminEmail: string;
        adminName: string | null;
        assignedTasks: number;
        openTasks: number;
        inProgressTasks: number;
        escalatedTasks: number;
        resolvedTasks: number;
        resolutionHours: number[];
      }
    >();
    rows.forEach((task) => {
      if (!task.assignedToUserId || !task.assignedTo) return;
      const row = grouped.get(task.assignedToUserId) ?? {
        adminUserId: task.assignedToUserId,
        adminEmail: task.assignedTo.email,
        adminName: task.assignedTo.fullName,
        assignedTasks: 0,
        openTasks: 0,
        inProgressTasks: 0,
        escalatedTasks: 0,
        resolvedTasks: 0,
        resolutionHours: [],
      };
      row.assignedTasks += 1;
      if (task.status === 'OPEN') row.openTasks += 1;
      if (task.status === 'IN_PROGRESS') row.inProgressTasks += 1;
      if (task.status === 'ESCALATED') row.escalatedTasks += 1;
      if (task.status === 'RESOLVED') row.resolvedTasks += 1;
      if (task.resolvedAt) {
        row.resolutionHours.push(
          (task.resolvedAt.getTime() - task.createdAt.getTime()) / 3600000,
        );
      }
      grouped.set(task.assignedToUserId, row);
    });
    return {
      filters: this.filters(query),
      items: [...grouped.values()]
        .map((row) => ({
          adminUserId: row.adminUserId,
          adminEmail: row.adminEmail,
          adminName: row.adminName,
          assignedTasks: row.assignedTasks,
          openTasks: row.openTasks,
          inProgressTasks: row.inProgressTasks,
          escalatedTasks: row.escalatedTasks,
          resolvedTasks: row.resolvedTasks,
          averageResolutionHours: this.average(row.resolutionHours),
        }))
        .sort((a, b) => b.assignedTasks - a.assignedTasks),
    };
  }

  async deliveryExceptions(
    query: AdminDeliveryExceptionsReportQueryDto,
    exportCsv = false,
  ) {
    const page = this.page(query);
    const limit = exportCsv ? CSV_LIMIT : this.limit(query);
    const where: Prisma.DeliveryShipmentWhereInput = {
      ...this.shipmentWhere(query),
      internalStatus: { in: [...DELIVERY_EXCEPTION_STATUSES] },
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.reasonCode ? { failureReasonCode: query.reasonCode } : {}),
      ...(query.shopId ? { shopId: query.shopId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.deliveryShipment.count({ where }),
      this.prisma.deliveryShipment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: exportCsv ? 0 : (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderId: true,
          provider: true,
          internalStatus: true,
          failureReasonCode: true,
          failureReasonText: true,
          customerVisibleMessage: true,
          failedAt: true,
          cancelledAt: true,
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
                      user: { select: { email: true, fullName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const items = rows.map((shipment) => ({
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: shipment.order.orderNumber,
      customerName: shipment.order.customerName,
      shopId: shipment.order.shop.id,
      shopName: shipment.order.shop.name,
      sellerId: shipment.order.shop.sellerProfile.userId,
      sellerEmail: shipment.order.shop.sellerProfile.user.email,
      sellerName: shipment.order.shop.sellerProfile.user.fullName,
      provider: shipment.provider,
      status: shipment.internalStatus,
      reasonCode: shipment.failureReasonCode,
      reasonText: shipment.failureReasonText,
      customerVisibleMessage: shipment.customerVisibleMessage,
      exceptionAt:
        shipment.failedAt?.toISOString() ??
        shipment.cancelledAt?.toISOString() ??
        shipment.updatedAt.toISOString(),
      ageHours: this.ageHours(
        shipment.failedAt ?? shipment.cancelledAt ?? shipment.updatedAt,
      ),
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      actionUrl: `/admin/deliveries?status=${shipment.internalStatus}`,
    }));
    return this.reportResponse(items, total, page, limit, query);
  }

  async paymentAging(
    query: AdminPaymentAgingReportQueryDto,
    exportCsv = false,
  ) {
    const page = this.page(query);
    const limit = exportCsv ? CSV_LIMIT : this.limit(query);
    const where: Prisma.OrderWhereInput = {
      ...this.orderWhere(query),
      paymentStatus: 'PENDING',
      ...(query.shopId ? { shopId: query.shopId } : {}),
    };
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
      take: exportCsv ? CSV_LIMIT : 1000,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        customerName: true,
        createdAt: true,
        updatedAt: true,
        shop: {
          select: {
            id: true,
            name: true,
            sellerProfile: {
              select: {
                userId: true,
                user: { select: { email: true, fullName: true } },
              },
            },
          },
        },
      },
    });
    const filtered = rows
      .map((order) => {
        const ageHours = this.ageHours(order.updatedAt);
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount.toString(),
          customerName: order.customerName,
          shopId: order.shop.id,
          shopName: order.shop.name,
          sellerId: order.shop.sellerProfile.userId,
          sellerEmail: order.shop.sellerProfile.user.email,
          sellerName: order.shop.sellerProfile.user.fullName,
          ageHours,
          ageBucket: this.paymentAgeBucket(ageHours),
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          actionUrl: `/seller/payments/${order.id}`,
        };
      })
      .filter((item) => !query.ageBucket || item.ageBucket === query.ageBucket);
    const items = exportCsv
      ? filtered
      : filtered.slice((page - 1) * limit, page * limit);
    return this.reportResponse(items, filtered.length, page, limit, query);
  }

  toCsv(rows: Record<string, CsvValue>[], columns: string[]) {
    const header = columns.join(',');
    const body = rows.map((row) =>
      columns.map((column) => this.csvEscape(row[column])).join(','),
    );
    return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
  }

  private mapTaskReport(
    task: Prisma.AdminQueueTaskGetPayload<{
      include: {
        assignedTo: { select: { id: true; email: true; fullName: true } };
      };
    }>,
  ) {
    return {
      id: task.id,
      entityType: task.entityType,
      entityId: task.entityId,
      shopId: task.shopId,
      sellerId: task.sellerId,
      title: task.title,
      status: task.status,
      priority: task.priority,
      slaStatus: task.slaStatus,
      assignedToUserId: task.assignedToUserId,
      assignedToEmail: task.assignedTo?.email ?? null,
      assignedToName: task.assignedTo?.fullName ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      assignedAt: task.assignedAt?.toISOString() ?? null,
      escalatedAt: task.escalatedAt?.toISOString() ?? null,
      resolvedAt: task.resolvedAt?.toISOString() ?? null,
      ageHours: this.ageHours(task.createdAt),
      actionUrl: `/admin/queues`,
    };
  }

  private taskWhere(
    query:
      | AdminOpsSummaryReportQueryDto
      | AdminSlaBreachesReportQueryDto
      | AdminWorkloadReportQueryDto,
  ): Prisma.AdminQueueTaskWhereInput {
    return {
      ...(this.dateRange(query) ? { createdAt: this.dateRange(query) } : {}),
      ...('assignedToUserId' in query && query.assignedToUserId
        ? { assignedToUserId: query.assignedToUserId }
        : {}),
      ...('shopId' in query && query.shopId ? { shopId: query.shopId } : {}),
      ...('sellerId' in query && query.sellerId
        ? { sellerId: query.sellerId }
        : {}),
    };
  }

  private orderWhere(
    query:
      | AdminOpsSummaryReportQueryDto
      | AdminPaymentAgingReportQueryDto
      | {
          dateFrom?: string;
          dateTo?: string;
          shopId?: string;
          sellerId?: string;
        },
  ): Prisma.OrderWhereInput {
    return {
      ...(this.dateRange(query) ? { createdAt: this.dateRange(query) } : {}),
      ...('shopId' in query && query.shopId ? { shopId: query.shopId } : {}),
      ...('sellerId' in query && query.sellerId
        ? { shop: { sellerProfile: { userId: query.sellerId } } }
        : {}),
    };
  }

  private shipmentWhere(
    query:
      | AdminOpsSummaryReportQueryDto
      | AdminDeliveryExceptionsReportQueryDto
      | {
          dateFrom?: string;
          dateTo?: string;
          shopId?: string;
          sellerId?: string;
        },
  ): Prisma.DeliveryShipmentWhereInput {
    return {
      ...(this.dateRange(query) ? { createdAt: this.dateRange(query) } : {}),
      ...('shopId' in query && query.shopId ? { shopId: query.shopId } : {}),
      ...('sellerId' in query && query.sellerId
        ? { order: { shop: { sellerProfile: { userId: query.sellerId } } } }
        : {}),
    };
  }

  private productVariantWhere(
    query: AdminOpsSummaryReportQueryDto,
  ): Prisma.ProductVariantWhereInput {
    return {
      ...('shopId' in query && query.shopId
        ? { product: { shopId: query.shopId } }
        : {}),
      ...('sellerId' in query && query.sellerId
        ? { product: { shop: { sellerProfile: { userId: query.sellerId } } } }
        : {}),
    };
  }

  private paidWithoutDeliveryWhere(
    query: AdminOpsSummaryReportQueryDto,
  ): Prisma.OrderWhereInput {
    return {
      ...this.orderWhere(query),
      paymentStatus: 'PAID',
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
      deliveryShipments: {
        none: { internalStatus: { in: [...ACTIVE_DELIVERY_STATUSES] } },
      },
    };
  }

  private dateRange(query: { dateFrom?: string; dateTo?: string }) {
    if (!query.dateFrom && !query.dateTo) return undefined;
    return {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    };
  }

  private reportResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    filters: object,
  ) {
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      total,
      filters,
    };
  }

  private filters(query: { dateFrom?: string; dateTo?: string }) {
    return {
      ...query,
      defaultRange: query.dateFrom || query.dateTo ? 'CUSTOM' : 'ALL_TIME',
    };
  }

  private averageResolutionHours(
    rows: Array<{ createdAt: Date; resolvedAt: Date | null }>,
  ) {
    return this.average(
      rows
        .filter((row) => row.resolvedAt)
        .map(
          (row) =>
            (row.resolvedAt!.getTime() - row.createdAt.getTime()) / 3600000,
        ),
    );
  }

  private average(values: number[]) {
    if (values.length === 0) return 0;
    const sum = values.reduce((total, value) => total + value, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  private ageHours(date: Date) {
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
  }

  private paymentAgeBucket(ageHours: number) {
    if (ageHours < 4) return '0-4h';
    if (ageHours < 24) return '4-24h';
    if (ageHours < 72) return '24-72h';
    return '72h+';
  }

  private page(query: AdminPagedReportQueryDto) {
    return query.page ?? 1;
  }

  private limit(query: AdminPagedReportQueryDto) {
    return query.limit ?? 20;
  }

  private csvEscape(value: CsvValue) {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }
}
