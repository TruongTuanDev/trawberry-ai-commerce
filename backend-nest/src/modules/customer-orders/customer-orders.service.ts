import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { resolveOrderPaymentPanel } from '../../common/utils/shop-payment.util';
import { SupportCasesService } from '../support-cases/support-cases.service';

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supportCasesService: SupportCasesService,
  ) {}

  async listForCustomer(user: AuthenticatedUser) {
    this.assertCustomer(user);

    const checkouts = await this.prisma.marketplaceCheckout.findMany({
      where: { customerUserId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: this.checkoutInclude,
    });

    return {
      items: checkouts.map((checkout) => this.toReceiptResponse(checkout)),
    };
  }

  async getForCustomer(checkoutCode: string, user: AuthenticatedUser) {
    this.assertCustomer(user);

    const checkout = await this.prisma.marketplaceCheckout.findFirst({
      where: {
        checkoutCode: checkoutCode.trim(),
        customerUserId: user.userId,
      },
      include: this.checkoutInclude,
    });

    if (!checkout) {
      throw new NotFoundException('Checkout receipt was not found.');
    }

    return this.toReceiptResponse(checkout);
  }

  async getPublicReceipt(checkoutCode: string, phone: string) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('phone is required.');
    }

    const checkout = await this.prisma.marketplaceCheckout.findFirst({
      where: {
        checkoutCode: checkoutCode.trim(),
        customerPhone: normalizedPhone,
      },
      include: this.checkoutInclude,
    });

    if (!checkout) {
      throw new NotFoundException('Checkout receipt was not found.');
    }

    return this.toReceiptResponse(checkout);
  }

  private assertCustomer(user: AuthenticatedUser) {
    if (user.role !== USER_ROLES.CUSTOMER) {
      throw new ForbiddenException('Customer account is required.');
    }
  }

  private toReceiptResponse(checkout: CheckoutWithOrders) {
    const orders = checkout.orders.map((order) => {
      const paymentDetails = resolveOrderPaymentPanel(order, order.shop);

      return {
        orderId: order.id,
        orderCode: order.orderNumber,
        shopId: order.shop.id,
        shopName: order.shop.name,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount.toString(),
        paymentInstructions: paymentDetails.paymentInstruction,
        paymentDetails,
        trackingPath: `/orders/${order.id}`,
        deliveryStatus: order.deliveryShipments[0]?.internalStatus ?? null,
        customerCompletedAt: order.customerCompletedAt?.toISOString() ?? null,
        itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: (item.unitPrice ?? item.priceAtPurchase).toString(),
          lineTotal: (
            item.lineTotal ??
            new Prisma.Decimal(item.priceAtPurchase.toString()).mul(
              item.quantity,
            )
          ).toString(),
          productTitleSnapshot: item.productTitleSnapshot,
          productImageSnapshot: item.productImageSnapshot,
          variantNameSnapshot: item.variantNameSnapshot,
          review: item.productReview
            ? {
                id: item.productReview.id,
                rating: item.productReview.rating,
                comment: item.productReview.comment,
                fitFeedback: item.productReview.fitFeedback,
                status: item.productReview.status,
                sellerReply: item.productReview.sellerReply,
                sellerRepliedAt:
                  item.productReview.sellerRepliedAt?.toISOString() ?? null,
                createdAt: item.productReview.createdAt.toISOString(),
                updatedAt: item.productReview.updatedAt.toISOString(),
              }
            : null,
        })),
        returnRefundCases: (order.returnRefundCases ?? []).map((entry) => ({
          id: entry.id,
          type: entry.type,
          reason: entry.reason,
          status: entry.status,
          requestedAmount: entry.requestedAmount.toString(),
          approvedAmount: entry.approvedAmount?.toString() ?? null,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    });

    return {
      checkoutId: checkout.id,
      checkoutCode: checkout.checkoutCode,
      status: this.aggregateStatus(checkout.orders),
      customer: {
        name: checkout.customerName,
        phone: checkout.customerPhone,
        email: checkout.customerEmail,
      },
      grandTotal: checkout.grandTotal.toString(),
      createdAt: checkout.createdAt.toISOString(),
      updatedAt: checkout.updatedAt.toISOString(),
      orders,
      orderCodes: orders.map((order) => order.orderCode),
      supportCases: (checkout.supportCases ?? []).map((supportCase) =>
        this.supportCasesService.buildSummary(supportCase),
      ),
    };
  }

  private aggregateStatus(orders: CheckoutWithOrders['orders']) {
    if (!orders.length) return 'PENDING';
    if (orders.every((order) => order.status === 'CANCELLED')) {
      return 'CANCELLED';
    }
    if (orders.every((order) => order.status === 'DELIVERED')) {
      return 'COMPLETED';
    }
    const paidStatuses = new Set([
      'PAID',
      'APPROVED',
      'SELLER_CONFIRMED_DELIVERY_PAYMENT',
      'YANDEX_PAYMENT_ON_DELIVERY_PAID',
    ]);
    const paidCount = orders.filter((order) =>
      paidStatuses.has(order.paymentStatus),
    ).length;
    if (paidCount === orders.length) return 'PAID';
    if (paidCount > 0) return 'PARTIALLY_PAID';
    return 'PENDING';
  }

  private get checkoutInclude() {
    return {
      orders: {
        orderBy: { createdAt: 'asc' as const },
        include: {
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
            },
          },
          items: {
            orderBy: { productTitleSnapshot: 'asc' as const },
            include: {
              productReview: true,
            },
          },
          deliveryShipments: {
            take: 1,
            orderBy: { createdAt: 'desc' as const },
            select: {
              internalStatus: true,
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
        },
      },
      supportCases: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          issueType: true,
          status: true,
          subject: true,
          orderId: true,
          createdAt: true,
        },
      },
    };
  }
}

type CheckoutWithOrders = Prisma.MarketplaceCheckoutGetPayload<{
  include: CustomerOrdersService['checkoutInclude'];
}>;
