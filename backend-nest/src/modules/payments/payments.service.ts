import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { resolveOrderPaymentPanel } from '../../common/utils/shop-payment.util';
import {
  PAYMENT_METHOD_LABELS,
  isPayOnDeliverySellerQrMethod,
} from '../../common/constants/payment-methods.constant';
import { AddPaymentNoteDto } from './dto/add-payment-note.dto';
import { ListShopPaymentsQueryDto } from './dto/list-shop-payments-query.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { SellerFinanceService } from '../seller-finance/seller-finance.service';

const PENDING_PAYMENT_STATUSES = [
  'PENDING',
  'UNPAID',
  'PAY_ON_DELIVERY_SELECTED',
  'SELLER_ACCEPTED_PAY_ON_DELIVERY',
  'DELIVERED_AWAITING_PAYMENT',
  'BUYER_MARKED_DELIVERY_PAID',
  'YANDEX_PAYMENT_ON_DELIVERY_PENDING',
] as const;
const PAID_PAYMENT_STATUSES = [
  'PAID',
  'APPROVED',
  'SELLER_CONFIRMED_DELIVERY_PAYMENT',
  'YANDEX_PAYMENT_ON_DELIVERY_PAID',
] as const;
const REJECTED_PAYMENT_STATUSES = ['REJECTED', 'FAILED', 'CANCELLED'] as const;

type PaymentOrderRecord = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  shippingAddress: string;
  shippingMethodName: string | null;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  paymentFlowStage: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  paymentModeSnapshot: string | null;
  paymentBankNameSnapshot: string | null;
  paymentRecipientNameSnapshot: string | null;
  paymentRecipientPhoneSnapshot: string | null;
  paymentRecipientAccountSnapshot: string | null;
  paymentSbpPhoneSnapshot: string | null;
  paymentQrImageUrlSnapshot: string | null;
  paymentInstructionSnapshot: string | null;
  paymentProofUrl: string | null;
  paymentProofOriginalName: string | null;
  paymentProofMimeType: string | null;
  paymentProofSize: number | null;
  paymentProofUploadedAt: Date | null;
  paymentProofStatus: string;
  paymentProofBuyerNote: string | null;
  sellerConfirmedPaidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
    deliverySettings?: {
      defaultCarrier: string;
      sameCityPreferredCarrier: string;
      enabledCarriers: Prisma.JsonValue;
    } | null;
  };
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerFinanceService: SellerFinanceService,
  ) {}

  async listByShop(shopId: string, query: ListShopPaymentsQueryDto) {
    const page = Number(query.page ?? 1);
    const size = Number(query.size ?? 20);
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

  async listForAdmin(query: ListShopPaymentsQueryDto & { shopId?: string }) {
    const page = Number(query.page ?? 1);
    const size = Number(query.size ?? 20);
    const skip = (page - 1) * size;
    const where: Prisma.OrderWhereInput = {
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.status
        ? { paymentStatus: query.status }
        : { paymentStatus: { in: [...PENDING_PAYMENT_STATUSES] } }),
      ...(query.proofStatus ? { paymentProofStatus: query.proofStatus } : {}),
    };

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

  async findOneForAdmin(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.paymentInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

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

    const isPayOnDelivery = isPayOnDeliverySellerQrMethod(
      order.paymentMethod ?? order.shippingMethodName,
    );
    const isSellerAcceptingCod =
      isPayOnDelivery && order.paymentStatus === 'PAY_ON_DELIVERY_SELECTED';
    const nextPaymentStatus = isSellerAcceptingCod
      ? 'SELLER_ACCEPTED_PAY_ON_DELIVERY'
      : isPayOnDelivery
        ? 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
        : 'PAID';

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: nextPaymentStatus,
          status: isSellerAcceptingCod
            ? this.nextPaidOrderStatus(order)
            : this.nextFinalPaidOrderStatus(order),
          paymentProofStatus: isSellerAcceptingCod
            ? order.paymentProofStatus
            : 'SELLER_CONFIRMED',
          sellerConfirmedPaidAt: isSellerAcceptingCod
            ? (order.sellerConfirmedPaidAt ?? null)
            : new Date(),
          paymentFlowStage: isSellerAcceptingCod
            ? 'READY_TO_CREATE_YANDEX'
            : 'PAYMENT_CONFIRMED',
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action: isSellerAcceptingCod
                ? 'pay_on_delivery_selected'
                : isPayOnDelivery
                  ? 'seller_confirmed_delivery_payment'
                  : 'SELLER_CONFIRMED',
              fromStatus: order.paymentStatus,
              toStatus: nextPaymentStatus,
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

      if (!isSellerAcceptingCod) {
        await this.sellerFinanceService.syncConfirmedOrderLedger(tx, orderId);
      }

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
      throw new BadRequestException('Paid payments cannot be rejected.');
    }

    if (order.paymentStatus === 'REJECTED') {
      throw new BadRequestException('Payment is already rejected.');
    }

    const isPayOnDelivery = isPayOnDeliverySellerQrMethod(
      order.paymentMethod ?? order.shippingMethodName,
    );

    if (
      (order.status === 'SHIPPING' || order.status === 'DELIVERED') &&
      !isPayOnDelivery
    ) {
      throw new BadRequestException(
        'Cannot reject payment for shipped or delivered orders.',
      );
    }

    const nextOrderStatus =
      order.status === 'PENDING' || order.status === 'NEW'
        ? 'CANCELLED'
        : order.status;

    const nextPaymentStatus = isPayOnDelivery
      ? 'DELIVERY_PAYMENT_REJECTED'
      : 'REJECTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: nextPaymentStatus,
          status: nextOrderStatus,
          paymentProofStatus: 'SELLER_REJECTED',
          sellerRejectedPaidAt: new Date(),
          paymentFlowStage: isPayOnDelivery
            ? 'DELIVERY_PAYMENT_REJECTED'
            : order.paymentFlowStage,
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action: isPayOnDelivery
                ? 'seller_rejected_delivery_payment'
                : 'SELLER_REJECTED',
              fromStatus: order.paymentStatus,
              toStatus: nextPaymentStatus,
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

  async adminConfirm(
    orderId: string,
    user: AuthenticatedUser,
    dto: MarkPaymentPaidDto,
  ) {
    const order = await this.findPaymentOrderForAdminOrThrow(orderId);
    return this.transitionAdminPayment(
      order,
      user,
      isPayOnDeliverySellerQrMethod(
        order.paymentMethod ?? order.shippingMethodName,
      )
        ? 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
        : 'PAID',
      'SELLER_CONFIRMED',
      'ADMIN_CONFIRMED',
      dto.note?.trim() || null,
    );
  }

  async adminReject(
    orderId: string,
    user: AuthenticatedUser,
    dto: RejectPaymentDto,
  ) {
    const order = await this.findPaymentOrderForAdminOrThrow(orderId);
    return this.transitionAdminPayment(
      order,
      user,
      isPayOnDeliverySellerQrMethod(
        order.paymentMethod ?? order.shippingMethodName,
      )
        ? 'DELIVERY_PAYMENT_REJECTED'
        : 'REJECTED',
      'SELLER_REJECTED',
      'ADMIN_REJECTED',
      dto.note?.trim() || null,
    );
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
        { paymentMethod: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.proofStatus) {
      where.paymentProofStatus = query.proofStatus;
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

  private async findPaymentOrderForAdminOrThrow(orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.paymentInclude,
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    return order;
  }

  private async transitionAdminPayment(
    order: PaymentOrderRecord,
    user: AuthenticatedUser,
    paymentStatus: string,
    proofStatus: 'SELLER_CONFIRMED' | 'SELLER_REJECTED',
    action: string,
    note: string | null,
  ) {
    if (
      paymentStatus === 'PAID' ||
      paymentStatus === 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
    ) {
      if (PAID_PAYMENT_STATUSES.includes(order.paymentStatus as 'PAID')) {
        throw new BadRequestException('Payment is already marked as paid.');
      }
    } else if (
      paymentStatus === 'REJECTED' ||
      paymentStatus === 'DELIVERY_PAYMENT_REJECTED'
    ) {
      if (order.status === 'SHIPPING' || order.status === 'DELIVERED') {
        throw new BadRequestException(
          'Cannot reject payment for shipped or delivered orders.',
        );
      }
    }

    const nextOrderStatus =
      (paymentStatus === 'REJECTED' ||
        paymentStatus === 'DELIVERY_PAYMENT_REJECTED') &&
      (order.status === 'PENDING' || order.status === 'NEW')
        ? 'CANCELLED'
        : paymentStatus === 'PAID' ||
            paymentStatus === 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
          ? this.nextPaidOrderStatus(order)
          : order.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus,
          status: nextOrderStatus,
          paymentProofStatus: proofStatus,
          ...(paymentStatus === 'PAID' ||
          paymentStatus === 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
            ? { sellerConfirmedPaidAt: new Date() }
            : { sellerRejectedPaidAt: new Date() }),
          paymentReviewLogs: {
            create: {
              id: randomUUID(),
              action,
              fromStatus: order.paymentStatus,
              toStatus: paymentStatus,
              note,
              shop: {
                connect: { id: order.shop.id },
              },
              reviewer: {
                connect: { id: user.userId },
              },
            },
          },
        },
      });

      if (
        paymentStatus === 'PAID' ||
        paymentStatus === 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
      ) {
        await this.sellerFinanceService.syncConfirmedOrderLedger(tx, order.id);
      }

      return tx.order.findFirst({
        where: { id: order.id },
        include: this.paymentInclude,
      });
    });

    if (!updated) {
      throw new NotFoundException(`Order ${order.id} was not found.`);
    }

    return this.toPaymentResponse(updated);
  }

  private toPaymentResponse(order: PaymentOrderRecord) {
    const paymentDetails = resolveOrderPaymentPanel(order, order.shop);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? order.shippingMethodName,
      paymentMethodLabel:
        order.paymentMethodLabel ??
        (order.paymentMethod && order.paymentMethod in PAYMENT_METHOD_LABELS
          ? PAYMENT_METHOD_LABELS[
              order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
            ]
          : null),
      paymentInstructions: paymentDetails.paymentInstruction,
      paymentDetails,
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
      paymentProof: order.paymentProofUrl
        ? {
            url: order.paymentProofUrl,
            originalName: order.paymentProofOriginalName,
            mimeType: order.paymentProofMimeType,
            size: order.paymentProofSize,
            uploadedAt: order.paymentProofUploadedAt?.toISOString() ?? null,
          }
        : null,
      paymentProofStatus: order.paymentProofStatus,
      buyerPaymentNote: order.paymentProofBuyerNote,
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
          deliverySettings: {
            select: {
              defaultCarrier: true,
              sameCityPreferredCarrier: true,
              enabledCarriers: true,
            },
          },
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

  private nextPaidOrderStatus(order: PaymentOrderRecord) {
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return order.status;
    }

    const deliverySettings = order.shop.deliverySettings;
    const enabledCarriers = Array.isArray(deliverySettings?.enabledCarriers)
      ? deliverySettings.enabledCarriers.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    const prefersYandex =
      deliverySettings?.defaultCarrier === 'YANDEX' ||
      deliverySettings?.sameCityPreferredCarrier === 'YANDEX' ||
      enabledCarriers.includes('YANDEX');

    if (prefersYandex) {
      return 'READY_TO_CREATE_YANDEX';
    }

    return order.status === 'PENDING' ? 'NEW' : order.status;
  }

  private nextFinalPaidOrderStatus(order: PaymentOrderRecord) {
    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      return order.status;
    }

    return this.nextPaidOrderStatus(order);
  }
}
