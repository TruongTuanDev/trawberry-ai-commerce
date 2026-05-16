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
    const orders = checkout.orders.map((order) => ({
      orderId: order.id,
      orderCode: order.orderNumber,
      shopId: order.shop.id,
      shopName: order.shop.name,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      paymentInstructions: order.shop.paymentInstructions,
      trackingPath: `/orders/${order.id}`,
      deliveryStatus: order.deliveryShipments[0]?.internalStatus ?? null,
      itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: (item.unitPrice ?? item.priceAtPurchase).toString(),
        lineTotal: (
          item.lineTotal ??
          new Prisma.Decimal(item.priceAtPurchase.toString()).mul(item.quantity)
        ).toString(),
        productTitleSnapshot: item.productTitleSnapshot,
        productImageSnapshot: item.productImageSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
      })),
    }));

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
    const paidStatuses = new Set(['PAID', 'APPROVED']);
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
            },
          },
          items: {
            orderBy: { productTitleSnapshot: 'asc' as const },
          },
          deliveryShipments: {
            take: 1,
            orderBy: { createdAt: 'desc' as const },
            select: {
              internalStatus: true,
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
