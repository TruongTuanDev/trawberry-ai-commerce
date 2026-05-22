import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;
type FinancePrismaExecutor = PrismaExecutor & {
  sellerFeeLedgerEntry: PrismaService['sellerFeeLedgerEntry'];
  sellerMonthlyInvoice: PrismaService['sellerMonthlyInvoice'];
  shopCommissionSetting: PrismaService['shopCommissionSetting'];
  platformCommissionSetting: PrismaService['platformCommissionSetting'];
};

const FINAL_LEDGER_SOURCES = [
  'PREPAID_CONFIRMED',
  'DELIVERY_PAYMENT_CONFIRMED',
  'FINAL_PAYMENT_CONFIRMED',
] as const;

const DELIVERY_IN_PROGRESS_STATUSES = new Set([
  'READY_TO_CREATE_YANDEX',
  'YANDEX_MANUAL_CREATED',
  'ASSEMBLING',
  'SHIPPING',
]);

const PENDING_PAYMENT_STATUSES = new Set([
  'PENDING',
  'UNPAID',
  'PAY_ON_DELIVERY_SELECTED',
  'SELLER_ACCEPTED_PAY_ON_DELIVERY',
  'DELIVERED_AWAITING_PAYMENT',
  'BUYER_MARKED_DELIVERY_PAID',
  'YANDEX_PAYMENT_ON_DELIVERY_PENDING',
]);

@Injectable()
export class SellerFinanceService {
  private readonly platformDefaultCommissionPercent = new Prisma.Decimal(5);

  constructor(private readonly prisma: PrismaService) {}

  private asFinanceExecutor(prisma: PrismaExecutor): FinancePrismaExecutor {
    return prisma;
  }

  async syncConfirmedOrderLedger(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const financeTx = this.asFinanceExecutor(tx);
    const order = await tx.order.findFirst({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            id: true,
            sellerProfile: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }

    if (order.status === 'CANCELLED') {
      return null;
    }

    const source = this.resolveLedgerSource(
      order.paymentMethod,
      order.paymentStatus,
    );
    if (!source) {
      return null;
    }

    const existing = await financeTx.sellerFeeLedgerEntry.findFirst({
      where: {
        orderId,
        source,
      },
    });

    if (existing) {
      return existing;
    }

    const confirmedAt =
      order.sellerConfirmedPaidAt ??
      order.buyerMarkedPaidAt ??
      order.updatedAt ??
      new Date();
    const billingPeriod = this.getBillingPeriod(confirmedAt);
    const productRevenueAmount = this.resolveProductRevenue(
      order.totalAmount,
      order.shippingCost,
    );

    if (productRevenueAmount.lte(0)) {
      return null;
    }

    const commissionPercent = await this.resolveCommissionPercent(
      tx,
      order.shopId,
      confirmedAt,
    );
    const commissionAmount = this.roundMoney(
      productRevenueAmount.mul(commissionPercent).div(100),
    );

    return financeTx.sellerFeeLedgerEntry.create({
      data: {
        id: randomUUID(),
        sellerId: order.shop.sellerProfile.userId,
        shopId: order.shopId,
        orderId: order.id,
        checkoutId: order.marketplaceCheckoutId,
        billingPeriod,
        productRevenueAmount,
        deliveryFeeAmount: order.shippingCost,
        commissionPercent,
        commissionAmount,
        status: 'PENDING',
        source,
      },
    });
  }

  async syncCancellationAdjustment(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const financeTx = this.asFinanceExecutor(tx);
    const existingEntries = await financeTx.sellerFeeLedgerEntry.findMany({
      where: {
        orderId,
        source: {
          in: [...FINAL_LEDGER_SOURCES],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (existingEntries.length < 1) {
      return null;
    }

    const existingAdjustment = await financeTx.sellerFeeLedgerEntry.findFirst({
      where: {
        orderId,
        source: 'ADMIN_ADJUSTMENT',
      },
    });

    if (existingAdjustment) {
      return existingAdjustment;
    }

    const reference = existingEntries[existingEntries.length - 1];
    return financeTx.sellerFeeLedgerEntry.create({
      data: {
        id: randomUUID(),
        sellerId: reference.sellerId,
        shopId: reference.shopId,
        orderId: reference.orderId,
        checkoutId: reference.checkoutId,
        billingPeriod: reference.billingPeriod,
        productRevenueAmount: reference.productRevenueAmount.negated(),
        deliveryFeeAmount: reference.deliveryFeeAmount
          ? reference.deliveryFeeAmount.negated()
          : null,
        commissionPercent: reference.commissionPercent,
        commissionAmount: reference.commissionAmount.negated(),
        status: 'CANCELLED',
        source: 'ADMIN_ADJUSTMENT',
      },
    });
  }

  async syncReturnRefundAdjustment(
    tx: Prisma.TransactionClient,
    caseId: string,
  ) {
    const financeTx = this.asFinanceExecutor(tx);
    const returnCase = await tx.returnRefundCase.findUnique({
      where: { id: caseId },
      include: {
        order: {
          select: {
            id: true,
            marketplaceCheckoutId: true,
          },
        },
      },
    });

    if (!returnCase) {
      throw new NotFoundException(
        `Return/refund case ${caseId} was not found.`,
      );
    }

    if (
      !['REFUND_CONFIRMED', 'CLOSED'].includes(returnCase.status) ||
      !returnCase.refundConfirmedAt
    ) {
      return null;
    }

    const existingAdjustment = await financeTx.sellerFeeLedgerEntry.findFirst({
      where: {
        referenceCaseId: caseId,
        source: 'RETURN_REFUND_CONFIRMED',
      },
    });
    if (existingAdjustment) {
      return existingAdjustment;
    }

    const reference = await financeTx.sellerFeeLedgerEntry.findFirst({
      where: {
        orderId: returnCase.orderId,
        source: {
          in: [...FINAL_LEDGER_SOURCES],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (!reference) {
      return null;
    }

    const approvedAmount =
      returnCase.approvedAmount ?? returnCase.requestedAmount;
    if (approvedAmount.lte(0)) {
      return null;
    }

    const refundableProductAmount = Prisma.Decimal.min(
      approvedAmount,
      reference.productRevenueAmount.abs(),
    );
    const adjustmentCommission = this.roundMoney(
      refundableProductAmount.mul(reference.commissionPercent).div(100),
    ).negated();

    const adjustment = await financeTx.sellerFeeLedgerEntry.create({
      data: {
        id: randomUUID(),
        sellerId: reference.sellerId,
        shopId: reference.shopId,
        orderId: reference.orderId,
        checkoutId:
          reference.checkoutId ?? returnCase.order.marketplaceCheckoutId,
        billingPeriod: this.getBillingPeriod(
          returnCase.refundConfirmedAt ?? new Date(),
        ),
        productRevenueAmount: refundableProductAmount.negated(),
        deliveryFeeAmount: returnCase.deliveryFeeRefundAmount.gt(0)
          ? returnCase.deliveryFeeRefundAmount.negated()
          : null,
        commissionPercent: reference.commissionPercent,
        commissionAmount: adjustmentCommission,
        status: 'PENDING',
        source: 'RETURN_REFUND_CONFIRMED',
        referenceCaseId: caseId,
      },
    });

    await tx.returnRefundCase.update({
      where: { id: caseId },
      data: {
        platformFeeAdjustmentAmount: adjustmentCommission,
      },
    });

    return adjustment;
  }

  async listAdminSellerFees() {
    const financePrisma = this.asFinanceExecutor(this.prisma);
    const now = new Date();
    const billingPeriod = this.getBillingPeriod(now);
    const monthRange = this.getBillingPeriodRange(billingPeriod);
    const todayRange = this.getDayRange(now);

    const [shops, todayOrders, monthOrders, monthLedger, currentInvoices] =
      await Promise.all([
        this.prisma.shop.findMany({
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sellerProfile: {
              select: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.order.groupBy({
          by: ['shopId'],
          where: {
            status: {
              not: 'CANCELLED',
            },
            createdAt: {
              gte: todayRange.start,
              lt: todayRange.end,
            },
          },
          _count: {
            _all: true,
          },
          _sum: {
            totalAmount: true,
          },
        }),
        this.prisma.order.groupBy({
          by: ['shopId'],
          where: {
            status: {
              not: 'CANCELLED',
            },
            createdAt: {
              gte: monthRange.start,
              lt: monthRange.end,
            },
          },
          _count: {
            _all: true,
          },
          _sum: {
            totalAmount: true,
          },
        }),
        financePrisma.sellerFeeLedgerEntry.groupBy({
          by: ['shopId', 'status'],
          where: {
            billingPeriod,
          },
          _sum: {
            productRevenueAmount: true,
            commissionAmount: true,
          },
        }),
        financePrisma.sellerMonthlyInvoice.findMany({
          where: {
            billingPeriod,
          },
          select: {
            shopId: true,
            status: true,
          },
        }),
      ]);

    const currentCommissions = await Promise.all(
      shops.map(async (shop) => ({
        shopId: shop.id,
        commissionPercent: await this.resolveCommissionPercent(
          this.prisma,
          shop.id,
          now,
        ),
      })),
    );

    const todayByShop = new Map<
      string,
      { orders: number; revenue: Prisma.Decimal }
    >(
      todayOrders.map((item) => [
        item.shopId,
        {
          orders: item._count._all,
          revenue: item._sum.totalAmount ?? new Prisma.Decimal(0),
        },
      ]),
    );
    const monthByShop = new Map<
      string,
      { orders: number; revenue: Prisma.Decimal }
    >(
      monthOrders.map((item) => [
        item.shopId,
        {
          orders: item._count._all,
          revenue: item._sum.totalAmount ?? new Prisma.Decimal(0),
        },
      ]),
    );
    const commissionByShop = new Map(
      currentCommissions.map((item) => [item.shopId, item.commissionPercent]),
    );
    const invoiceByShop = new Map(
      currentInvoices.map((item) => [item.shopId, item.status]),
    );
    const ledgerByShop = new Map<
      string,
      { confirmedRevenue: Prisma.Decimal; dueCommission: Prisma.Decimal }
    >();

    for (const item of monthLedger) {
      const current = ledgerByShop.get(item.shopId) ?? {
        confirmedRevenue: new Prisma.Decimal(0),
        dueCommission: new Prisma.Decimal(0),
      };

      if (item.status !== 'CANCELLED') {
        current.confirmedRevenue = current.confirmedRevenue.plus(
          item._sum.productRevenueAmount ?? new Prisma.Decimal(0),
        );
      }

      if (item.status === 'PENDING' || item.status === 'INVOICED') {
        current.dueCommission = current.dueCommission.plus(
          item._sum.commissionAmount ?? new Prisma.Decimal(0),
        );
      }

      ledgerByShop.set(item.shopId, current);
    }

    return shops.map((shop) => {
      const today = todayByShop.get(shop.id);
      const month = monthByShop.get(shop.id);
      const ledger = ledgerByShop.get(shop.id);
      const commissionPercent =
        commissionByShop.get(shop.id) ?? this.platformDefaultCommissionPercent;

      return {
        shopId: shop.id,
        shopName: shop.name,
        sellerName: shop.sellerProfile.user.fullName,
        sellerEmail: shop.sellerProfile.user.email,
        sellerPhone: shop.sellerProfile.user.phone,
        ordersToday: today?.orders ?? 0,
        revenueToday: this.formatDecimal(today?.revenue),
        ordersThisMonth: month?.orders ?? 0,
        revenueThisMonth: this.formatDecimal(month?.revenue),
        confirmedRevenueThisMonth: this.formatDecimal(ledger?.confirmedRevenue),
        commissionPercent: this.formatDecimal(commissionPercent),
        platformFeeDue: this.formatDecimal(ledger?.dueCommission),
        billingPeriod,
        daysLeftInMonth: this.getDaysLeftInMonth(now),
        invoiceStatus: invoiceByShop.get(shop.id) ?? null,
      };
    });
  }

  async updateShopCommission(
    shopId: string,
    adminUserId: string,
    commissionPercent: number,
  ) {
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
      throw new BadRequestException(
        'Commission percent must be a positive number.',
      );
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const financeTx = this.asFinanceExecutor(tx);
      await financeTx.shopCommissionSetting.updateMany({
        where: {
          shopId,
          activeTo: null,
        },
        data: {
          activeTo: now,
        },
      });

      await financeTx.shopCommissionSetting.create({
        data: {
          id: randomUUID(),
          shopId,
          commissionPercent: new Prisma.Decimal(commissionPercent),
          activeFrom: now,
          createdByAdminId: adminUserId,
        },
      });
    });

    const currentCommission = await this.resolveCommissionPercent(
      this.prisma,
      shopId,
      now,
    );

    return {
      shopId,
      shopName: shop.name,
      commissionPercent: this.formatDecimal(currentCommission),
      activeFrom: now.toISOString(),
    };
  }

  async generateInvoice(shopId: string, billingPeriod: string) {
    this.assertBillingPeriod(billingPeriod);

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        name: true,
        sellerProfile: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const financeTx = this.asFinanceExecutor(tx);
      const pendingEntries = await financeTx.sellerFeeLedgerEntry.findMany({
        where: {
          shopId,
          billingPeriod,
          status: 'PENDING',
        },
      });

      let invoice = await financeTx.sellerMonthlyInvoice.findUnique({
        where: {
          shopId_billingPeriod: {
            shopId,
            billingPeriod,
          },
        },
      });

      const linkedEntries = invoice
        ? await financeTx.sellerFeeLedgerEntry.findMany({
            where: {
              invoiceId: invoice.id,
            },
          })
        : [];

      const allEntries = [...linkedEntries, ...pendingEntries];
      if (allEntries.length < 1) {
        throw new BadRequestException(
          `No seller fee ledger entries found for ${billingPeriod}.`,
        );
      }

      const totalRevenue = allEntries.reduce(
        (sum, entry) => sum.plus(entry.productRevenueAmount),
        new Prisma.Decimal(0),
      );
      const totalCommission = allEntries.reduce(
        (sum, entry) => sum.plus(entry.commissionAmount),
        new Prisma.Decimal(0),
      );

      if (!invoice) {
        invoice = await financeTx.sellerMonthlyInvoice.create({
          data: {
            id: randomUUID(),
            sellerId: shop.sellerProfile.userId,
            shopId,
            billingPeriod,
            totalRevenue,
            totalCommission,
            status: 'ISSUED',
            issuedAt: now,
            dueDate: this.buildInvoiceDueDate(billingPeriod),
          },
        });
      } else {
        invoice = await financeTx.sellerMonthlyInvoice.update({
          where: { id: invoice.id },
          data: {
            totalRevenue,
            totalCommission,
            status: invoice.status === 'PAID' ? invoice.status : 'ISSUED',
            issuedAt: invoice.issuedAt ?? now,
            dueDate: invoice.dueDate ?? this.buildInvoiceDueDate(billingPeriod),
          },
        });
      }

      if (pendingEntries.length > 0) {
        await financeTx.sellerFeeLedgerEntry.updateMany({
          where: {
            id: {
              in: pendingEntries.map((entry) => entry.id),
            },
          },
          data: {
            invoiceId: invoice.id,
            status: 'INVOICED',
          },
        });
      }

      return this.mapInvoiceResponse(invoice);
    });
  }

  async markInvoicePaid(invoiceId: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const financeTx = this.asFinanceExecutor(tx);
      const invoice = await financeTx.sellerMonthlyInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
      }

      const updated = await financeTx.sellerMonthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      await financeTx.sellerFeeLedgerEntry.updateMany({
        where: {
          invoiceId,
          status: {
            in: ['PENDING', 'INVOICED'],
          },
        },
        data: {
          status: 'PAID',
        },
      });

      return this.mapInvoiceResponse(updated);
    });
  }

  async listInvoicesForAdmin() {
    const financePrisma = this.asFinanceExecutor(this.prisma);
    const invoices = await financePrisma.sellerMonthlyInvoice.findMany({
      include: {
        shop: {
          select: {
            name: true,
          },
        },
        seller: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ billingPeriod: 'desc' }, { createdAt: 'desc' }],
    });

    return invoices.map((invoice) => ({
      ...this.mapInvoiceResponse(invoice),
      shopName: invoice.shop.name,
      sellerName: invoice.seller.fullName,
      sellerEmail: invoice.seller.email,
      sellerPhone: invoice.seller.phone,
    }));
  }

  async getSellerDashboardMetrics(shopId: string) {
    const financePrisma = this.asFinanceExecutor(this.prisma);
    const now = new Date();
    const billingPeriod = this.getBillingPeriod(now);
    const todayRange = this.getDayRange(now);
    const monthRange = this.getBillingPeriodRange(billingPeriod);
    const commissionPercent = await this.resolveCommissionPercent(
      this.prisma,
      shopId,
      now,
    );

    const [
      todayOrders,
      monthOrders,
      todayLedger,
      monthLedger,
      pendingPaymentOrders,
      deliveryInProgressOrders,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          shopId,
          status: {
            not: 'CANCELLED',
          },
          createdAt: {
            gte: todayRange.start,
            lt: todayRange.end,
          },
        },
        select: {
          totalAmount: true,
        },
      }),
      this.prisma.order.findMany({
        where: {
          shopId,
          status: {
            not: 'CANCELLED',
          },
          createdAt: {
            gte: monthRange.start,
            lt: monthRange.end,
          },
        },
        select: {
          totalAmount: true,
        },
      }),
      financePrisma.sellerFeeLedgerEntry.findMany({
        where: {
          shopId,
          status: {
            not: 'CANCELLED',
          },
          createdAt: {
            gte: todayRange.start,
            lt: todayRange.end,
          },
        },
        select: {
          productRevenueAmount: true,
        },
      }),
      financePrisma.sellerFeeLedgerEntry.findMany({
        where: {
          shopId,
          billingPeriod,
          status: {
            not: 'CANCELLED',
          },
        },
        select: {
          productRevenueAmount: true,
          commissionAmount: true,
        },
      }),
      this.prisma.order.count({
        where: {
          shopId,
          paymentStatus: {
            in: [...PENDING_PAYMENT_STATUSES],
          },
          status: {
            not: 'CANCELLED',
          },
        },
      }),
      this.prisma.order.count({
        where: {
          shopId,
          status: {
            in: [...DELIVERY_IN_PROGRESS_STATUSES],
          },
        },
      }),
    ]);

    const revenueToday = todayOrders.reduce(
      (sum, order) => sum.plus(order.totalAmount),
      new Prisma.Decimal(0),
    );
    const revenueThisMonth = monthOrders.reduce(
      (sum, order) => sum.plus(order.totalAmount),
      new Prisma.Decimal(0),
    );
    const confirmedRevenueToday = todayLedger.reduce(
      (sum, entry) => sum.plus(entry.productRevenueAmount),
      new Prisma.Decimal(0),
    );
    const confirmedRevenueThisMonth = monthLedger.reduce(
      (sum, entry) => sum.plus(entry.productRevenueAmount),
      new Prisma.Decimal(0),
    );
    const estimatedPlatformFeeThisMonth = monthLedger.reduce(
      (sum, entry) => sum.plus(entry.commissionAmount),
      new Prisma.Decimal(0),
    );

    return {
      ordersToday: todayOrders.length,
      revenueToday: this.formatDecimal(revenueToday),
      confirmedRevenueToday: this.formatDecimal(confirmedRevenueToday),
      ordersThisMonth: monthOrders.length,
      revenueThisMonth: this.formatDecimal(revenueThisMonth),
      confirmedRevenueThisMonth: this.formatDecimal(confirmedRevenueThisMonth),
      pendingPaymentOrders,
      deliveryInProgressOrders,
      commissionPercent: this.formatDecimal(commissionPercent),
      estimatedPlatformFeeThisMonth: this.formatDecimal(
        estimatedPlatformFeeThisMonth,
      ),
      billingPeriod,
      daysLeftInMonth: this.getDaysLeftInMonth(now),
    };
  }

  async listSellerLedger(shopId: string) {
    const financePrisma = this.asFinanceExecutor(this.prisma);
    const entries = await financePrisma.sellerFeeLedgerEntry.findMany({
      where: { shopId },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return entries.map((entry) => ({
      id: entry.id,
      orderId: entry.orderId,
      orderCode: entry.order.orderNumber,
      billingPeriod: entry.billingPeriod,
      productRevenueAmount: this.formatDecimal(entry.productRevenueAmount),
      deliveryFeeAmount: this.formatDecimal(entry.deliveryFeeAmount),
      commissionPercent: this.formatDecimal(entry.commissionPercent),
      commissionAmount: this.formatDecimal(entry.commissionAmount),
      status: entry.status,
      source: entry.source,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      invoiceId: entry.invoiceId,
      referenceCaseId: entry.referenceCaseId,
    }));
  }

  async listSellerInvoices(shopId: string) {
    const financePrisma = this.asFinanceExecutor(this.prisma);
    const invoices = await financePrisma.sellerMonthlyInvoice.findMany({
      where: { shopId },
      orderBy: [{ billingPeriod: 'desc' }, { createdAt: 'desc' }],
    });

    return invoices.map((invoice) => this.mapInvoiceResponse(invoice));
  }

  private resolveLedgerSource(
    paymentMethod: string | null,
    paymentStatus: string,
  ) {
    if (paymentMethod === 'PREPAID_SELLER_QR' && paymentStatus === 'PAID') {
      return 'PREPAID_CONFIRMED';
    }

    if (
      paymentMethod === 'PAY_ON_DELIVERY_SELLER_QR' &&
      paymentStatus === 'SELLER_CONFIRMED_DELIVERY_PAYMENT'
    ) {
      return 'DELIVERY_PAYMENT_CONFIRMED';
    }

    if (
      paymentMethod === 'DEPOSIT_THEN_DELIVERY_PAYMENT' &&
      paymentStatus === 'PAID'
    ) {
      return 'FINAL_PAYMENT_CONFIRMED';
    }

    return null;
  }

  private async resolveCommissionPercent(
    prisma: PrismaExecutor,
    shopId: string,
    at: Date,
  ) {
    const financePrisma = this.asFinanceExecutor(prisma);
    const activeShopSetting =
      await financePrisma.shopCommissionSetting.findFirst({
        where: {
          shopId,
          activeFrom: {
            lte: at,
          },
          OR: [
            { activeTo: null },
            {
              activeTo: {
                gt: at,
              },
            },
          ],
        },
        orderBy: {
          activeFrom: 'desc',
        },
      });

    if (activeShopSetting) {
      return activeShopSetting.commissionPercent;
    }

    const platformSetting = await this.getOrCreatePlatformSetting(prisma, at);
    return platformSetting.defaultCommissionPercent;
  }

  private async getOrCreatePlatformSetting(prisma: PrismaExecutor, at: Date) {
    const financePrisma = this.asFinanceExecutor(prisma);
    const existing = await financePrisma.platformCommissionSetting.findFirst({
      where: {
        activeFrom: {
          lte: at,
        },
        OR: [
          { activeTo: null },
          {
            activeTo: {
              gt: at,
            },
          },
        ],
      },
      orderBy: {
        activeFrom: 'desc',
      },
    });

    if (existing) {
      return existing;
    }

    return financePrisma.platformCommissionSetting.create({
      data: {
        id: randomUUID(),
        defaultCommissionPercent: this.platformDefaultCommissionPercent,
        activeFrom: at,
      },
    });
  }

  private resolveProductRevenue(
    total: Prisma.Decimal,
    shipping: Prisma.Decimal,
  ) {
    const revenue = total.minus(shipping ?? new Prisma.Decimal(0));
    return revenue.greaterThan(0) ? revenue : new Prisma.Decimal(0);
  }

  private getBillingPeriod(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private getBillingPeriodRange(billingPeriod: string) {
    const [year, month] = billingPeriod.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { start, end };
  }

  private getDayRange(date: Date) {
    const start = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private getDaysLeftInMonth(date: Date) {
    const endOfMonth = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 0, 0, 0, 0),
    );
    return Math.max(0, endOfMonth.getUTCDate() - date.getUTCDate());
  }

  private buildInvoiceDueDate(billingPeriod: string) {
    const { end } = this.getBillingPeriodRange(billingPeriod);
    const dueDate = new Date(end);
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);
    return dueDate;
  }

  private assertBillingPeriod(billingPeriod: string) {
    if (!/^\d{4}-\d{2}$/.test(billingPeriod)) {
      throw new BadRequestException('Billing period must use YYYY-MM format.');
    }
  }

  private mapInvoiceResponse(invoice: {
    id: string;
    sellerId: string;
    shopId: string;
    billingPeriod: string;
    totalRevenue: Prisma.Decimal;
    totalCommission: Prisma.Decimal;
    status: string;
    dueDate: Date | null;
    issuedAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: invoice.id,
      sellerId: invoice.sellerId,
      shopId: invoice.shopId,
      billingPeriod: invoice.billingPeriod,
      totalRevenue: this.formatDecimal(invoice.totalRevenue),
      totalCommission: this.formatDecimal(invoice.totalCommission),
      status: invoice.status,
      dueDate: invoice.dueDate?.toISOString() ?? null,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  private roundMoney(value: Prisma.Decimal) {
    return new Prisma.Decimal(value.toDecimalPlaces(2).toString());
  }

  private formatDecimal(value?: Prisma.Decimal | null) {
    return (value ?? new Prisma.Decimal(0)).toString();
  }
}
