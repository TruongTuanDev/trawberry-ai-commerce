import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AddPaymentNoteDto } from './dto/add-payment-note.dto';
import { ListShopPaymentsQueryDto } from './dto/list-shop-payments-query.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';

const PENDING_PAYMENT_STATUSES = ['PENDING', 'UNPAID'] as const;
const PAID_PAYMENT_STATUSES = ['PAID', 'APPROVED'] as const;
const REJECTED_PAYMENT_STATUSES = ['REJECTED', 'FAILED', 'CANCELLED'] as const;

type PaymentOrderRecord = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  shippingAddress: string;
  shippingMethodName: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: Prisma.Decimal;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
  paymentReviewLogs: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    reviewerUserId: string;
    createdAt: Date;
    reviewer: {
      id: string;
      fullName: string | null;
    };
  }>;
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByShop(shopId: string, query: ListShopPaymentsQueryDto) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const skip = (page - 1) * size;
    const where = this.buildWhere(shopId, query);

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.paymentInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.toPaymentResponse(order)),
      meta: {
        page,
        size,
        total,
        totalPages: Math.max(1, Math.ceil(total / size)),
      },
    };
  }

  async findOneByShop(shopId: string, orderId: string) {
    const order = await this.findPaymentOrderOrThrow(shopId, orderId);
    return this.toPaymentResponse(order);
  }

  async markPaid(
    shopId: string,
    orderId: string,
    user: AuthenticatedUser,
    dto: MarkPaymentPaidDto,
  ) {
    const order = await this.findPaymentOrderOrThrow(shopId, orderId);

    if (PAID_PAYMENT_STATUSES.includes(order.paymentStatus as 'PAID')) {
      throw new BadRequestException('Payment is already marked as paid.');
    }

    if (REJECTED_PAYMENT_STATUSES.includes(order.paymentStatus as 'REJECTED')) {
      throw new BadRequestException(
        'Rejected payments cannot be marked as paid directly.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action: 'MARK_PAID',
              fromStatus: order.paymentStatus,
              toStatus: 'PAID',
              note: dto.note?.trim() || null,
              shop: {
                connect: { id: shopId },
              },
              reviewer: {
                connect: { id: user.userId },
              },
            },
          },
        },
      });

      return tx.order.findFirst({
        where: { id: orderId, shopId },
        include: this.paymentInclude,
      });
    });

    if (!updated) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return this.toPaymentResponse(updated);
  }

  async reject(
    shopId: string,
    orderId: string,
    user: AuthenticatedUser,
    dto: RejectPaymentDto,
  ) {
    const order = await this.findPaymentOrderOrThrow(shopId, orderId);

    if (PAID_PAYMENT_STATUSES.includes(order.paymentStatus as 'PAID')) {
      throw new BadRequestException(
        'Paid payments cannot be rejected in this MVP flow.',
      );
    }

    if (order.paymentStatus === 'REJECTED') {
      throw new BadRequestException('Payment is already rejected.');
    }

    if (order.status === 'SHIPPING' || order.status === 'DELIVERED') {
      throw new BadRequestException(
        'Cannot reject payment for shipped or delivered orders.',
      );
    }

    const nextOrderStatus =
      order.status === 'PENDING' || order.status === 'NEW'
        ? 'CANCELLED'
        : order.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'REJECTED',
          status: nextOrderStatus,
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action: 'REJECT_PAYMENT',
              fromStatus: order.paymentStatus,
              toStatus: 'REJECTED',
              note: dto.note?.trim() || null,
              shop: {
                connect: { id: shopId },
              },
              reviewer: {
                connect: { id: user.userId },
              },
            },
          },
        },
      });

      return tx.order.findFirst({
        where: { id: orderId, shopId },
        include: this.paymentInclude,
      });
    });

    if (!updated) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return this.toPaymentResponse(updated);
  }

  async addNote(
    shopId: string,
    orderId: string,
    user: AuthenticatedUser,
    dto: AddPaymentNoteDto,
  ) {
    const order = await this.findPaymentOrderOrThrow(shopId, orderId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action: 'ADD_NOTE',
              fromStatus: order.paymentStatus,
              toStatus: order.paymentStatus,
              note: dto.note.trim(),
              shop: {
                connect: { id: shopId },
              },
              reviewer: {
                connect: { id: user.userId },
              },
            },
          },
        },
      });

      return tx.order.findFirst({
        where: { id: orderId, shopId },
        include: this.paymentInclude,
      });
    });

    if (!updated) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return this.toPaymentResponse(updated);
  }

  private buildWhere(
    shopId: string,
    query: ListShopPaymentsQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      shopId,
      paymentStatus: query.status
        ? query.status
        : {
            in: [...PENDING_PAYMENT_STATUSES],
          },
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { shippingMethodName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async findPaymentOrderOrThrow(shopId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, shopId },
      include: this.paymentInclude,
    });

    if (!order) {
      throw new NotFoundException(
        `Order ${orderId} was not found in shop ${shopId}.`,
      );
    }

    return order;
  }

  private toPaymentResponse(order: PaymentOrderRecord) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.shippingMethodName,
      paymentInstructions: order.shop.paymentInstructions,
      totalAmount: order.totalAmount.toString(),
      shippingAddress: order.shippingAddress,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
      },
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase.toString(),
        productTitleSnapshot: item.productTitleSnapshot,
        productSlugSnapshot: item.productSlugSnapshot,
        productImageSnapshot: item.productImageSnapshot,
      })),
      reviewLogs: order.paymentReviewLogs.map((log) =>
        this.toPaymentLogResponse(log),
      ),
    };
  }

  private toPaymentLogResponse(
    log: PaymentOrderRecord['paymentReviewLogs'][number],
  ) {
    return {
      id: log.id,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      note: log.note,
      reviewerUserId: log.reviewer.id,
      reviewerName: log.reviewer.fullName,
      createdAt: log.createdAt.toISOString(),
    };
  }

  private get paymentInclude() {
    return {
      shop: {
        select: {
          id: true,
          name: true,
          paymentInstructions: true,
        },
      },
      items: {
        orderBy: { productTitleSnapshot: 'asc' as const },
      },
      paymentReviewLogs: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          reviewer: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    };
  }
}
