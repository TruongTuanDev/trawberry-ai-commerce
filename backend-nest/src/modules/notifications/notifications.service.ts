import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

export interface CreateNotificationInput {
  recipientUserId: string;
  recipientRole: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  shopId?: string | null;
  orderId?: string | null;
  checkoutId?: string | null;
  returnRefundCaseId?: string | null;
  invoiceId?: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'URGENT';
  dedupeKey?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<unknown> {
    if (input.dedupeKey) {
      return this.createOrUpdateByDedupeKey(input);
    }

    if (!this.prisma.notification) {
      return {
        id: 'dummy-notif-id',
        recipientUserId: input.recipientUserId,
        recipientRole: input.recipientRole,
        shopId: input.shopId ?? null,
        orderId: input.orderId ?? null,
        checkoutId: input.checkoutId ?? null,
        returnRefundCaseId: input.returnRefundCaseId ?? null,
        invoiceId: input.invoiceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
        severity: input.severity,
        status: 'UNREAD',
        dedupeKey: input.dedupeKey ?? null,
        createdAt: new Date(),
        readAt: null,
        archivedAt: null,
      };
    }

    return this.prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        recipientRole: input.recipientRole,
        shopId: input.shopId ?? null,
        orderId: input.orderId ?? null,
        checkoutId: input.checkoutId ?? null,
        returnRefundCaseId: input.returnRefundCaseId ?? null,
        invoiceId: input.invoiceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
        severity: input.severity,
        status: 'UNREAD',
      },
    });
  }

  async createOrUpdateByDedupeKey(
    input: CreateNotificationInput,
  ): Promise<unknown> {
    if (!input.dedupeKey) {
      return this.createNotification(input);
    }

    if (!this.prisma.notification) {
      return {
        id: 'dummy-notif-id',
        recipientUserId: input.recipientUserId,
        recipientRole: input.recipientRole,
        shopId: input.shopId ?? null,
        orderId: input.orderId ?? null,
        checkoutId: input.checkoutId ?? null,
        returnRefundCaseId: input.returnRefundCaseId ?? null,
        invoiceId: input.invoiceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
        severity: input.severity,
        status: 'UNREAD',
        dedupeKey: input.dedupeKey ?? null,
        createdAt: new Date(),
        readAt: null,
        archivedAt: null,
      };
    }

    const existing = await this.prisma.notification.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });

    if (existing) {
      return this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          status: 'UNREAD',
          createdAt: new Date(),
          readAt: null,
          archivedAt: null,
          title: input.title,
          message: input.message,
          severity: input.severity,
          actionUrl: input.actionUrl ?? existing.actionUrl,
        },
      });
    }

    return this.prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        recipientRole: input.recipientRole,
        shopId: input.shopId ?? null,
        orderId: input.orderId ?? null,
        checkoutId: input.checkoutId ?? null,
        returnRefundCaseId: input.returnRefundCaseId ?? null,
        invoiceId: input.invoiceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
        severity: input.severity,
        status: 'UNREAD',
        dedupeKey: input.dedupeKey,
      },
    });
  }

  async listForCurrentUser(
    user: AuthenticatedUser,
    query: {
      status?: string;
      type?: string;
      severity?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;

    if (!this.prisma.notification) {
      return {
        items: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: user.userId,
      recipientRole: user.role,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    } else if (!query.status) {
      where.status = { in: ['UNREAD', 'READ'] };
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async unreadCount(user: AuthenticatedUser) {
    if (!this.prisma.notification) {
      return { count: 0 };
    }

    const count = await this.prisma.notification.count({
      where: {
        recipientUserId: user.userId,
        recipientRole: user.role,
        status: 'UNREAD',
      },
    });
    return { count };
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    if (!this.prisma.notification) {
      return { success: true };
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientUserId: user.userId,
        recipientRole: user.role,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async markAllRead(user: AuthenticatedUser) {
    if (!this.prisma.notification) {
      return { success: true };
    }

    await this.prisma.notification.updateMany({
      where: {
        recipientUserId: user.userId,
        recipientRole: user.role,
        status: 'UNREAD',
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return { success: true };
  }

  async archive(user: AuthenticatedUser, notificationId: string) {
    if (!this.prisma.notification) {
      return { success: true };
    }

    const existing = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientUserId: user.userId,
        recipientRole: user.role,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    return { success: true };
  }

  async checkAndNotifyOverdueOrders() {
    const newOrAssemblyMinutes = Number(
      this.configService.get<string>('MANUAL_YANDEX_OVERDUE_MINUTES', '120'),
    );
    const inTransitMinutes = Number(
      this.configService.get<string>(
        'ADMIN_IN_TRANSIT_OVERDUE_MINUTES',
        '2880',
      ),
    );

    const newOrAssemblyCutoff = new Date(
      Date.now() - newOrAssemblyMinutes * 60 * 1000,
    );
    const inTransitCutoff = new Date(Date.now() - inTransitMinutes * 60 * 1000);

    const overdueOrders = await this.prisma.order.findMany({
      where: {
        OR: [
          {
            status: {
              in: ['NEW', 'PENDING', 'READY_TO_CREATE_YANDEX', 'ASSEMBLING'],
            },
            updatedAt: { lt: newOrAssemblyCutoff },
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
                updatedAt: { lt: inTransitCutoff },
              },
            },
          },
        ],
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            sellerProfile: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    for (const order of overdueOrders) {
      if (!order.shop?.sellerProfile?.userId) continue;
      const recipientUserId = order.shop.sellerProfile.userId;
      const dedupeKey = `overdue:${order.id}`;

      await this.createOrUpdateByDedupeKey({
        recipientUserId,
        recipientRole: 'SELLER',
        shopId: order.shopId,
        orderId: order.id,
        type: 'ORDER_FULFILLMENT_OVERDUE',
        title: 'Đơn hàng quá hạn xử lý',
        message: `Đơn hàng ${order.orderNumber} của bạn đã quá hạn xử lý. Vui lòng cập nhật trạng thái.`,
        actionUrl: `/seller/orders/${order.id}`,
        severity: 'URGENT',
        dedupeKey,
      });
    }
  }

  // Helper helper to broadcast to admins
  async broadcastToAdmins(
    input: Omit<CreateNotificationInput, 'recipientUserId' | 'recipientRole'>,
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      const dedupeKey = input.dedupeKey
        ? `${input.dedupeKey}:${admin.id}`
        : null;
      await this.createOrUpdateByDedupeKey({
        ...input,
        recipientUserId: admin.id,
        recipientRole: 'ADMIN',
        dedupeKey,
      });
    }
  }
}
