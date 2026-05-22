/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { SellerFinanceService } from '../src/modules/seller-finance/seller-finance.service';
import { readBody } from './test-helpers';

type DecimalLike = Prisma.Decimal;

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: Date;
  sellerProfile?: {
    id: string;
    userId: string;
    approvalStatus: string;
    currentShopId: string | null;
  } | null;
};

type StoredShop = {
  id: string;
  sellerProfileId: string;
  name: string;
  slug: string;
  status: string;
  sellerProfile: { userId: string; user?: StoredUser };
};

type StoredOrder = {
  id: string;
  shopId: string;
  customerId: string;
  marketplaceCheckoutId: string | null;
  orderNumber: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentProofStatus: string;
  paymentFlowStage: string | null;
  totalAmount: DecimalLike;
  shippingCost: DecimalLike;
  shippingAddress: string;
  shippingMethodName: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  sellerConfirmedPaidAt: Date | null;
  buyerMarkedPaidAt: Date | null;
  sellerRejectedPaidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredShopCommissionSetting = {
  id: string;
  shopId: string;
  commissionPercent: DecimalLike;
  activeFrom: Date;
  activeTo: Date | null;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredPlatformCommissionSetting = {
  id: string;
  defaultCommissionPercent: DecimalLike;
  activeFrom: Date;
  activeTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredSellerFeeLedgerEntry = {
  id: string;
  sellerId: string;
  shopId: string;
  orderId: string;
  checkoutId: string | null;
  invoiceId: string | null;
  billingPeriod: string;
  productRevenueAmount: DecimalLike;
  deliveryFeeAmount: DecimalLike | null;
  commissionPercent: DecimalLike;
  commissionAmount: DecimalLike;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredSellerMonthlyInvoice = {
  id: string;
  sellerId: string;
  shopId: string;
  billingPeriod: string;
  totalRevenue: DecimalLike;
  totalCommission: DecimalLike;
  status: string;
  dueDate: Date | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredPaymentReviewLog = {
  id: string;
  shopId: string;
  orderId: string;
  reviewerUserId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: Date;
  reviewer: {
    id: string;
    fullName: string | null;
  };
};

describe('SellerFinance (e2e)', () => {
  let app: INestApplication<App>;
  let sellerFinanceService: SellerFinanceService;
  let users: StoredUser[];
  let shops: StoredShop[];
  let orders: StoredOrder[];
  let shopCommissionSettings: StoredShopCommissionSetting[];
  let platformCommissionSettings: StoredPlatformCommissionSetting[];
  let sellerFeeLedgerEntries: StoredSellerFeeLedgerEntry[];
  let sellerMonthlyInvoices: StoredSellerMonthlyInvoice[];
  let paymentReviewLogs: StoredPaymentReviewLog[];

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn(), findMany: jest.fn() },
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    sellerFeeLedgerEntry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
    },
    shopCommissionSetting: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    platformCommissionSetting: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    sellerMonthlyInvoice: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const now = new Date('2026-05-22T10:00:00Z');

    users = [
      {
        id: 'admin-user-1',
        email: 'demo-admin@trawberry.local',
        passwordHash: bcrypt.hashSync('DemoAdmin123!', 10),
        fullName: 'Demo Admin',
        phone: '+79990000001',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: now,
        sellerProfile: null,
      },
      {
        id: 'seller-user-1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: '+79990000011',
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: now,
        sellerProfile: {
          id: 'sp-1',
          userId: 'seller-user-1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'seller-user-2',
        email: 'seller2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        phone: '+79990000022',
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: now,
        sellerProfile: {
          id: 'sp-2',
          userId: 'seller-user-2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'sp-1',
        name: 'Seller One Atelier',
        slug: 'seller-one-atelier',
        status: 'ACTIVE',
        sellerProfile: { userId: 'seller-user-1' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp-2',
        name: 'Seller Two Studio',
        slug: 'seller-two-studio',
        status: 'ACTIVE',
        sellerProfile: { userId: 'seller-user-2' },
      },
    ];

    orders = [
      {
        id: 'order-prepaid-1',
        shopId: 'shop-1',
        customerId: 'customer-1',
        marketplaceCheckoutId: 'checkout-1',
        orderNumber: 'ORD-FIN-1001',
        status: 'PAYMENT_CONFIRMED',
        paymentMethod: 'PREPAID_SELLER_QR',
        paymentStatus: 'PAID',
        paymentProofStatus: 'SELLER_CONFIRMED',
        paymentFlowStage: null,
        totalAmount: money('200'),
        shippingCost: money('30'),
        shippingAddress: 'Tverskaya 1, Moscow',
        shippingMethodName: 'PREPAID_SELLER_QR',
        customerName: 'Buyer One',
        customerPhone: '+79991110001',
        customerEmail: 'buyer1@example.com',
        customerNote: null,
        sellerConfirmedPaidAt: new Date('2026-05-21T12:00:00Z'),
        buyerMarkedPaidAt: new Date('2026-05-21T11:00:00Z'),
        createdAt: new Date('2026-05-21T10:00:00Z'),
        updatedAt: new Date('2026-05-21T12:00:00Z'),
      },
      {
        id: 'order-cod-1',
        shopId: 'shop-1',
        customerId: 'customer-2',
        marketplaceCheckoutId: 'checkout-2',
        orderNumber: 'ORD-FIN-1002',
        status: 'DELIVERED',
        paymentMethod: 'PAY_ON_DELIVERY_SELLER_QR',
        paymentStatus: 'SELLER_CONFIRMED_DELIVERY_PAYMENT',
        paymentProofStatus: 'SELLER_CONFIRMED',
        paymentFlowStage: null,
        totalAmount: money('350'),
        shippingCost: money('50'),
        shippingAddress: 'Arbat 5, Moscow',
        shippingMethodName: 'PAY_ON_DELIVERY_SELLER_QR',
        customerName: 'Buyer Two',
        customerPhone: '+79991110002',
        customerEmail: 'buyer2@example.com',
        customerNote: null,
        sellerConfirmedPaidAt: new Date('2026-05-22T08:00:00Z'),
        buyerMarkedPaidAt: new Date('2026-05-22T07:30:00Z'),
        createdAt: new Date('2026-05-22T06:00:00Z'),
        updatedAt: new Date('2026-05-22T08:00:00Z'),
      },
      {
        id: 'order-other-shop',
        shopId: 'shop-2',
        customerId: 'customer-3',
        marketplaceCheckoutId: 'checkout-3',
        orderNumber: 'ORD-FIN-2001',
        status: 'PAYMENT_CONFIRMED',
        paymentMethod: 'PREPAID_SELLER_QR',
        paymentStatus: 'PAID',
        paymentProofStatus: 'SELLER_CONFIRMED',
        paymentFlowStage: null,
        totalAmount: money('150'),
        shippingCost: money('20'),
        shippingAddress: 'Nevsky 9, Saint Petersburg',
        shippingMethodName: 'PREPAID_SELLER_QR',
        customerName: 'Buyer Three',
        customerPhone: '+79991110003',
        customerEmail: 'buyer3@example.com',
        customerNote: null,
        sellerConfirmedPaidAt: new Date('2026-05-21T15:00:00Z'),
        buyerMarkedPaidAt: new Date('2026-05-21T14:45:00Z'),
        createdAt: new Date('2026-05-21T14:00:00Z'),
        updatedAt: new Date('2026-05-21T15:00:00Z'),
      },
    ];

    shopCommissionSettings = [
      {
        id: 'commission-1',
        shopId: 'shop-1',
        commissionPercent: money('3'),
        activeFrom: new Date('2026-05-01T00:00:00Z'),
        activeTo: null,
        createdByAdminId: 'admin-user-1',
        createdAt: now,
        updatedAt: now,
      },
    ];
    platformCommissionSettings = [
      {
        id: 'platform-1',
        defaultCommissionPercent: money('5'),
        activeFrom: new Date('2026-01-01T00:00:00Z'),
        activeTo: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    sellerFeeLedgerEntries = [];
    sellerMonthlyInvoices = [];
    paymentReviewLogs = [];
    shopsForHelpers = shops;
    paymentReviewLogsForHelpers = paymentReviewLogs;

    prismaMock.user.findUnique.mockImplementation(({ where, include }) => {
      const found = users.find((user) =>
        where.email
          ? user.email === String(where.email).toLowerCase()
          : user.id === where.id,
      );
      if (!found) return Promise.resolve(null);
      if (include?.sellerProfile) {
        return Promise.resolve({
          ...found,
          sellerProfile: found.sellerProfile ?? null,
        });
      }
      return Promise.resolve(found);
    });

    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      const shop = shops.find((entry) => entry.id === where.id) ?? null;
      if (!shop) return Promise.resolve(null);

      if (select?.sellerProfile) {
        return Promise.resolve({
          id: shop.id,
          sellerProfile: { userId: shop.sellerProfile.userId },
        });
      }

      return Promise.resolve({
        ...shop,
        sellerProfile: {
          userId: shop.sellerProfile.userId,
          user: users.find((user) => user.id === shop.sellerProfile.userId),
        },
      });
    });

    prismaMock.shop.findMany.mockImplementation(({ orderBy, select }) => {
      const rows = [...shops].sort((a, b) =>
        orderBy?.name === 'asc' ? a.name.localeCompare(b.name) : 0,
      );

      if (select) {
        return Promise.resolve(
          rows.map((shop) => ({
            id: shop.id,
            name: shop.name,
            sellerProfile: {
              user: users.find((user) => user.id === shop.sellerProfile.userId),
            },
          })),
        );
      }

      return Promise.resolve(rows);
    });

    prismaMock.order.findUnique.mockImplementation(
      ({ where, include, select }) => {
        const order = orders.find((entry) => entry.id === where.id) ?? null;
        if (!order) return Promise.resolve(null);
        if (select) {
          return Promise.resolve({
            id: order.id,
            paymentMethod: order.paymentMethod,
            shippingMethodName: order.shippingMethodName,
          });
        }

        if (include?.shop) {
          const shop = shops.find((entry) => entry.id === order.shopId);
          return Promise.resolve({
            ...order,
            shop: {
              id: shop?.id,
              sellerProfile: {
                userId: shop?.sellerProfile.userId,
              },
            },
          });
        }

        return Promise.resolve(order);
      },
    );

    prismaMock.order.findFirst.mockImplementation(({ where, include }) => {
      const order = filterOrders(orders, where)[0] ?? null;
      if (!order) return Promise.resolve(null);
      if (include) {
        return Promise.resolve(buildPaymentOrderRecord(order));
      }
      return Promise.resolve(order);
    });

    prismaMock.order.findMany.mockImplementation(({ where, select }) => {
      const rows = filterOrders(orders, where);
      if (select?.totalAmount) {
        return Promise.resolve(
          rows.map((order) => ({ totalAmount: order.totalAmount })),
        );
      }
      return Promise.resolve(rows);
    });

    prismaMock.order.count.mockImplementation(({ where }) => {
      return Promise.resolve(filterOrders(orders, where).length);
    });

    prismaMock.order.groupBy.mockImplementation(
      ({ by, where, _count, _sum }) => {
        if (!Array.isArray(by) || !by.includes('shopId')) {
          throw new Error('Unsupported groupBy');
        }
        const rows = filterOrders(orders, where);
        const groups = new Map<string, StoredOrder[]>();
        for (const order of rows) {
          const list = groups.get(order.shopId) ?? [];
          list.push(order);
          groups.set(order.shopId, list);
        }
        return Promise.resolve(
          [...groups.entries()].map(([shopId, items]) => ({
            shopId,
            _count: _count ? { _all: items.length } : undefined,
            _sum: _sum
              ? {
                  totalAmount: items.reduce(
                    (sum, item) => sum.plus(item.totalAmount),
                    money('0'),
                  ),
                }
              : undefined,
          })),
        );
      },
    );

    prismaMock.order.update.mockImplementation(({ where, data }) => {
      const target = orders.find((order) => order.id === where.id);
      if (!target) throw new Error('Order not found');

      if (data.paymentStatus !== undefined) {
        target.paymentStatus = data.paymentStatus;
      }
      if (data.paymentProofStatus !== undefined) {
        target.paymentProofStatus = data.paymentProofStatus;
      }
      if (data.status !== undefined) {
        target.status = data.status;
      }
      if (data.paymentFlowStage !== undefined) {
        target.paymentFlowStage = data.paymentFlowStage;
      }
      if (data.sellerConfirmedPaidAt !== undefined) {
        target.sellerConfirmedPaidAt = data.sellerConfirmedPaidAt;
      }
      if (data.sellerRejectedPaidAt !== undefined) {
        target.sellerRejectedPaidAt = data.sellerRejectedPaidAt;
      }
      target.updatedAt = new Date();

      if (data.paymentReviewLogs?.create) {
        const reviewerId = data.paymentReviewLogs.create.reviewer.connect.id;
        const reviewer = users.find((user) => user.id === reviewerId);
        paymentReviewLogs.unshift({
          id: data.paymentReviewLogs.create.id,
          shopId: target.shopId,
          orderId: target.id,
          reviewerUserId: reviewerId,
          action: data.paymentReviewLogs.create.action,
          fromStatus: data.paymentReviewLogs.create.fromStatus,
          toStatus: data.paymentReviewLogs.create.toStatus,
          note: data.paymentReviewLogs.create.note,
          createdAt: new Date(),
          reviewer: {
            id: reviewerId,
            fullName: reviewer?.fullName ?? null,
          },
        });
      }

      return Promise.resolve(buildPaymentOrderRecord(target));
    });

    prismaMock.sellerFeeLedgerEntry.findFirst.mockImplementation(
      ({ where }) => {
        return Promise.resolve(
          sellerFeeLedgerEntries.find((entry) =>
            matchLedgerEntry(entry, where),
          ) ?? null,
        );
      },
    );

    prismaMock.sellerFeeLedgerEntry.findMany.mockImplementation(
      ({ where, include, orderBy }) => {
        let rows = sellerFeeLedgerEntries.filter((entry) =>
          matchLedgerEntry(entry, where),
        );
        if (orderBy) {
          rows = [...rows].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        }
        if (include?.order) {
          return Promise.resolve(
            rows.map((entry) => ({
              ...entry,
              order: {
                orderNumber:
                  orders.find((order) => order.id === entry.orderId)
                    ?.orderNumber ?? 'UNKNOWN',
              },
            })),
          );
        }
        return Promise.resolve(rows);
      },
    );

    prismaMock.sellerFeeLedgerEntry.create.mockImplementation(({ data }) => {
      const order = orders.find((entry) => entry.id === data.orderId);
      const createdAt =
        order?.sellerConfirmedPaidAt ??
        order?.buyerMarkedPaidAt ??
        order?.updatedAt ??
        new Date();
      const entry: StoredSellerFeeLedgerEntry = {
        id: data.id,
        sellerId: data.sellerId,
        shopId: data.shopId,
        orderId: data.orderId,
        checkoutId: data.checkoutId ?? null,
        invoiceId: data.invoiceId ?? null,
        billingPeriod: data.billingPeriod,
        productRevenueAmount: castDecimal(data.productRevenueAmount),
        deliveryFeeAmount: data.deliveryFeeAmount
          ? castDecimal(data.deliveryFeeAmount)
          : null,
        commissionPercent: castDecimal(data.commissionPercent),
        commissionAmount: castDecimal(data.commissionAmount),
        status: data.status,
        source: data.source,
        createdAt,
        updatedAt: createdAt,
      };
      sellerFeeLedgerEntries.push(entry);
      return Promise.resolve(entry);
    });

    prismaMock.sellerFeeLedgerEntry.groupBy.mockImplementation(
      ({ where, _sum }) => {
        const rows = sellerFeeLedgerEntries.filter((entry) =>
          matchLedgerEntry(entry, where),
        );
        const groups = new Map<string, StoredSellerFeeLedgerEntry[]>();
        for (const entry of rows) {
          const key = `${entry.shopId}:${entry.status}`;
          const list = groups.get(key) ?? [];
          list.push(entry);
          groups.set(key, list);
        }

        return Promise.resolve(
          [...groups.entries()].map(([key, items]) => {
            const [shopId, status] = key.split(':');
            return {
              shopId,
              status,
              _sum: _sum
                ? {
                    productRevenueAmount: items.reduce(
                      (sum, item) => sum.plus(item.productRevenueAmount),
                      money('0'),
                    ),
                    commissionAmount: items.reduce(
                      (sum, item) => sum.plus(item.commissionAmount),
                      money('0'),
                    ),
                  }
                : undefined,
            };
          }),
        );
      },
    );

    prismaMock.sellerFeeLedgerEntry.updateMany.mockImplementation(
      ({ where, data }) => {
        let count = 0;
        for (const entry of sellerFeeLedgerEntries) {
          if (!matchLedgerEntry(entry, where)) continue;
          if (data.invoiceId !== undefined) {
            entry.invoiceId = data.invoiceId;
          }
          if (data.status !== undefined) {
            entry.status = data.status;
          }
          entry.updatedAt = new Date();
          count += 1;
        }
        return Promise.resolve({ count });
      },
    );

    prismaMock.shopCommissionSetting.findFirst.mockImplementation(
      ({ where, orderBy }) => {
        const at = where.activeFrom?.lte ?? new Date();
        const rows = shopCommissionSettings
          .filter((entry) => entry.shopId === where.shopId)
          .filter((entry) => entry.activeFrom <= at)
          .filter((entry) => entry.activeTo === null || entry.activeTo > at)
          .sort((a, b) =>
            orderBy?.activeFrom === 'desc'
              ? b.activeFrom.getTime() - a.activeFrom.getTime()
              : a.activeFrom.getTime() - b.activeFrom.getTime(),
          );
        return Promise.resolve(rows[0] ?? null);
      },
    );

    prismaMock.shopCommissionSetting.updateMany.mockImplementation(
      ({ where, data }) => {
        let count = 0;
        for (const entry of shopCommissionSettings) {
          if (entry.shopId !== where.shopId) continue;
          if (where.activeTo === null && entry.activeTo !== null) continue;
          entry.activeTo = data.activeTo ?? entry.activeTo;
          entry.updatedAt = new Date();
          count += 1;
        }
        return Promise.resolve({ count });
      },
    );

    prismaMock.shopCommissionSetting.create.mockImplementation(({ data }) => {
      const nowDate = new Date();
      const entry: StoredShopCommissionSetting = {
        id: data.id,
        shopId: data.shopId,
        commissionPercent: castDecimal(data.commissionPercent),
        activeFrom: data.activeFrom,
        activeTo: null,
        createdByAdminId: data.createdByAdminId,
        createdAt: nowDate,
        updatedAt: nowDate,
      };
      shopCommissionSettings.push(entry);
      return Promise.resolve(entry);
    });

    prismaMock.platformCommissionSetting.findFirst.mockImplementation(
      ({ where, orderBy }) => {
        const at = where.activeFrom?.lte ?? new Date();
        const rows = platformCommissionSettings
          .filter((entry) => entry.activeFrom <= at)
          .filter((entry) => entry.activeTo === null || entry.activeTo > at)
          .sort((a, b) =>
            orderBy?.activeFrom === 'desc'
              ? b.activeFrom.getTime() - a.activeFrom.getTime()
              : a.activeFrom.getTime() - b.activeFrom.getTime(),
          );
        return Promise.resolve(rows[0] ?? null);
      },
    );

    prismaMock.platformCommissionSetting.create.mockImplementation(
      ({ data }) => {
        const nowDate = new Date();
        const entry: StoredPlatformCommissionSetting = {
          id: data.id,
          defaultCommissionPercent: castDecimal(data.defaultCommissionPercent),
          activeFrom: data.activeFrom,
          activeTo: null,
          createdAt: nowDate,
          updatedAt: nowDate,
        };
        platformCommissionSettings.push(entry);
        return Promise.resolve(entry);
      },
    );

    prismaMock.sellerMonthlyInvoice.findUnique.mockImplementation(
      ({ where }) => {
        if (where.id) {
          return Promise.resolve(
            sellerMonthlyInvoices.find((invoice) => invoice.id === where.id) ??
              null,
          );
        }
        return Promise.resolve(
          sellerMonthlyInvoices.find(
            (invoice) =>
              invoice.shopId === where.shopId_billingPeriod.shopId &&
              invoice.billingPeriod ===
                where.shopId_billingPeriod.billingPeriod,
          ) ?? null,
        );
      },
    );

    prismaMock.sellerMonthlyInvoice.findMany.mockImplementation(
      ({ where, include, orderBy }) => {
        let rows = sellerMonthlyInvoices.filter((invoice) => {
          if (
            where?.billingPeriod &&
            invoice.billingPeriod !== where.billingPeriod
          ) {
            return false;
          }
          if (where?.shopId && invoice.shopId !== where.shopId) {
            return false;
          }
          return true;
        });

        rows = [...rows].sort((a, b) => {
          for (const order of orderBy ?? []) {
            if (order.billingPeriod) {
              const direction = order.billingPeriod === 'desc' ? -1 : 1;
              const value =
                a.billingPeriod.localeCompare(b.billingPeriod) * direction;
              if (value !== 0) return value;
            }
            if (order.createdAt) {
              const direction = order.createdAt === 'desc' ? -1 : 1;
              const value =
                (a.createdAt.getTime() - b.createdAt.getTime()) * direction;
              if (value !== 0) return value;
            }
          }
          return 0;
        });

        if (include?.shop || include?.seller) {
          return Promise.resolve(
            rows.map((invoice) => ({
              ...invoice,
              shop: {
                name:
                  shops.find((shop) => shop.id === invoice.shopId)?.name ??
                  'Unknown',
              },
              seller: users.find((user) => user.id === invoice.sellerId) ?? {
                fullName: null,
                email: null,
                phone: null,
              },
            })),
          );
        }

        return Promise.resolve(rows);
      },
    );

    prismaMock.sellerMonthlyInvoice.create.mockImplementation(({ data }) => {
      const nowDate = new Date();
      const invoice: StoredSellerMonthlyInvoice = {
        id: data.id,
        sellerId: data.sellerId,
        shopId: data.shopId,
        billingPeriod: data.billingPeriod,
        totalRevenue: castDecimal(data.totalRevenue),
        totalCommission: castDecimal(data.totalCommission),
        status: data.status,
        dueDate: data.dueDate ?? null,
        issuedAt: data.issuedAt ?? null,
        paidAt: data.paidAt ?? null,
        createdAt: nowDate,
        updatedAt: nowDate,
      };
      sellerMonthlyInvoices.push(invoice);
      return Promise.resolve(invoice);
    });

    prismaMock.sellerMonthlyInvoice.update.mockImplementation(
      ({ where, data }) => {
        const invoice = sellerMonthlyInvoices.find(
          (entry) => entry.id === where.id,
        );
        if (!invoice) throw new Error('Invoice not found');
        if (data.totalRevenue !== undefined) {
          invoice.totalRevenue = castDecimal(data.totalRevenue);
        }
        if (data.totalCommission !== undefined) {
          invoice.totalCommission = castDecimal(data.totalCommission);
        }
        if (data.status !== undefined) {
          invoice.status = data.status;
        }
        if (data.issuedAt !== undefined) {
          invoice.issuedAt = data.issuedAt;
        }
        if (data.dueDate !== undefined) {
          invoice.dueDate = data.dueDate;
        }
        if (data.paidAt !== undefined) {
          invoice.paidAt = data.paidAt;
        }
        invoice.updatedAt = new Date();
        return Promise.resolve(invoice);
      },
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    sellerFinanceService = moduleFixture.get(SellerFinanceService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('creates one ledger entry for a final confirmed order and stays idempotent', async () => {
    const first = await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-1',
    );
    const second = await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-1',
    );

    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id);
    expect(sellerFeeLedgerEntries).toHaveLength(1);
    expect(sellerFeeLedgerEntries[0].productRevenueAmount.toString()).toBe(
      '170',
    );
    expect(sellerFeeLedgerEntries[0].commissionAmount.toString()).toBe('5.1');
  });

  it('preserves commission snapshot for existing ledger and applies new commission to later orders', async () => {
    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-1',
    );

    const adminToken = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    await request(app.getHttpServer())
      .patch('/api/admin/finance/shops/shop-1/commission')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commissionPercent: 6 })
      .expect(200);

    const nextConfirmedAt = new Date(Date.now() + 60_000);

    orders.push({
      id: 'order-prepaid-2',
      shopId: 'shop-1',
      customerId: 'customer-4',
      marketplaceCheckoutId: 'checkout-4',
      orderNumber: 'ORD-FIN-1003',
      status: 'PAYMENT_CONFIRMED',
      paymentMethod: 'PREPAID_SELLER_QR',
      paymentStatus: 'PAID',
      paymentProofStatus: 'SELLER_CONFIRMED',
      paymentFlowStage: null,
      totalAmount: money('400'),
      shippingCost: money('40'),
      shippingAddress: 'Kutuzovsky 1, Moscow',
      shippingMethodName: 'PREPAID_SELLER_QR',
      customerName: 'Buyer Four',
      customerPhone: '+79991110004',
      customerEmail: 'buyer4@example.com',
      customerNote: null,
      sellerConfirmedPaidAt: nextConfirmedAt,
      buyerMarkedPaidAt: new Date(nextConfirmedAt.getTime() - 15 * 60 * 1000),
      createdAt: new Date(nextConfirmedAt.getTime() - 30 * 60 * 1000),
      updatedAt: nextConfirmedAt,
    });

    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-2',
    );

    const first = sellerFeeLedgerEntries.find(
      (entry) => entry.orderId === 'order-prepaid-1',
    );
    const second = sellerFeeLedgerEntries.find(
      (entry) => entry.orderId === 'order-prepaid-2',
    );

    expect(first?.commissionPercent.toString()).toBe('3');
    expect(second?.commissionPercent.toString()).toBe('6');
    expect(second?.commissionAmount.toString()).toBe('21.6');
  });

  it('lists admin seller fee rows and seller dashboard metrics with confirmed revenue only', async () => {
    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-1',
    );
    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-cod-1',
    );

    const adminToken = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    const sellerToken = await loginAndGetToken(app, 'seller1@example.com');

    const adminResponse = await request(app.getHttpServer())
      .get('/api/admin/finance/seller-fees')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const adminRows = readBody<
      Array<{
        shopId: string;
        confirmedRevenueThisMonth: string;
        platformFeeDue: string;
        commissionPercent: string;
      }>
    >(adminResponse);
    const shopRow = adminRows.find((row) => row.shopId === 'shop-1');
    expect(shopRow).toEqual(
      expect.objectContaining({
        confirmedRevenueThisMonth: '470',
        platformFeeDue: '14.1',
        commissionPercent: '3',
      }),
    );

    const sellerResponse = await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/dashboard-metrics')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    const metrics = readBody<{
      ordersToday: number;
      revenueToday: string;
      confirmedRevenueToday: string;
      confirmedRevenueThisMonth: string;
      estimatedPlatformFeeThisMonth: string;
    }>(sellerResponse);

    expect(metrics.ordersToday).toBe(1);
    expect(metrics.revenueToday).toBe('350');
    expect(metrics.confirmedRevenueToday).toBe('300');
    expect(metrics.confirmedRevenueThisMonth).toBe('470');
    expect(metrics.estimatedPlatformFeeThisMonth).toBe('14.1');
  });

  it('generates invoice, marks it paid, and exposes paid invoice to seller', async () => {
    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-prepaid-1',
    );
    await sellerFinanceService.syncConfirmedOrderLedger(
      prismaMock as never,
      'order-cod-1',
    );

    const adminToken = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    const sellerToken = await loginAndGetToken(app, 'seller1@example.com');

    const generateResponse = await request(app.getHttpServer())
      .post('/api/admin/finance/shops/shop-1/invoices/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ billingPeriod: '2026-05' })
      .expect(200);

    const invoice = readBody<{
      id: string;
      status: string;
      totalCommission: string;
    }>(generateResponse);
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.totalCommission).toBe('14.1');
    expect(
      sellerFeeLedgerEntries.every((entry) => entry.status === 'INVOICED'),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/admin/finance/invoices/${invoice.id}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      sellerFeeLedgerEntries.every((entry) => entry.status === 'PAID'),
    ).toBe(true);

    const sellerInvoices = await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/invoices')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    const invoices =
      readBody<Array<{ status: string; totalCommission: string }>>(
        sellerInvoices,
      );
    expect(invoices[0]).toEqual(
      expect.objectContaining({
        status: 'PAID',
        totalCommission: '14.1',
      }),
    );
  });

  it('forbids seller from editing commission and from viewing another shop finance', async () => {
    const sellerToken = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .patch('/api/admin/finance/shops/shop-1/commission')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ commissionPercent: 7 })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/seller/shops/shop-2/finance-ledger')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(403);
  });
});

async function loginAndGetToken(
  app: INestApplication<App>,
  email: string,
  password = 'password123',
) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}

function buildPaymentOrderRecord(order: StoredOrder) {
  const shop = shopsForHelpers.find((entry) => entry.id === order.shopId);
  return {
    ...order,
    shop: {
      id: shop?.id ?? order.shopId,
      name: shop?.name ?? 'Unknown shop',
      paymentInstructions: null,
      bankName: null,
      accountHolderName: null,
      accountNumber: null,
      recipientPhone: null,
      sbpPhone: null,
      staticQrImageUrl: null,
      paymentMode: 'STATIC_QR',
      paymentConfigStatus: 'READY',
      sellerProfile: {
        userId: shop?.sellerProfile.userId ?? 'seller-user-1',
      },
    },
    items: [],
    paymentReviewLogs: paymentReviewLogsForHelpers
      .filter((log) => log.orderId === order.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}

let shopsForHelpers: StoredShop[] = [];
let paymentReviewLogsForHelpers: StoredPaymentReviewLog[] = [];

function filterOrders(orders: StoredOrder[], where?: Record<string, unknown>) {
  if (!where) return orders;

  return orders.filter((order) => {
    if (typeof where.id === 'string' && order.id !== where.id) {
      return false;
    }
    if (typeof where.shopId === 'string' && order.shopId !== where.shopId) {
      return false;
    }
    if (
      where.status &&
      typeof where.status === 'object' &&
      'not' in where.status
    ) {
      if (order.status === where.status.not) {
        return false;
      }
    } else if (
      typeof where.status === 'string' &&
      order.status !== where.status
    ) {
      return false;
    }
    if (where.paymentStatus && typeof where.paymentStatus === 'object') {
      const paymentStatus = where.paymentStatus as { in?: string[] };
      if (paymentStatus.in && !paymentStatus.in.includes(order.paymentStatus)) {
        return false;
      }
    } else if (
      typeof where.paymentStatus === 'string' &&
      order.paymentStatus !== where.paymentStatus
    ) {
      return false;
    }
    if (
      typeof where.paymentProofStatus === 'string' &&
      order.paymentProofStatus !== where.paymentProofStatus
    ) {
      return false;
    }
    if (where.createdAt && typeof where.createdAt === 'object') {
      const createdAt = where.createdAt as { gte?: Date; lt?: Date };
      if (createdAt.gte && order.createdAt < createdAt.gte) {
        return false;
      }
      if (createdAt.lt && order.createdAt >= createdAt.lt) {
        return false;
      }
    }
    return true;
  });
}

function matchLedgerEntry(
  entry: StoredSellerFeeLedgerEntry,
  where?: Record<string, unknown>,
) {
  if (!where) return true;
  if (typeof where.orderId === 'string' && entry.orderId !== where.orderId) {
    return false;
  }
  if (typeof where.shopId === 'string' && entry.shopId !== where.shopId) {
    return false;
  }
  if (
    typeof where.billingPeriod === 'string' &&
    entry.billingPeriod !== where.billingPeriod
  ) {
    return false;
  }
  if (
    typeof where.invoiceId === 'string' &&
    entry.invoiceId !== where.invoiceId
  ) {
    return false;
  }
  if (where.invoiceId === null && entry.invoiceId !== null) {
    return false;
  }
  if (typeof where.source === 'string' && entry.source !== where.source) {
    return false;
  }
  if (
    where.source &&
    typeof where.source === 'object' &&
    'in' in where.source
  ) {
    if (!(where.source.in as string[]).includes(entry.source)) {
      return false;
    }
  }
  if (typeof where.status === 'string' && entry.status !== where.status) {
    return false;
  }
  if (
    where.status &&
    typeof where.status === 'object' &&
    'in' in where.status
  ) {
    if (!(where.status.in as string[]).includes(entry.status)) {
      return false;
    }
  }
  if (where.createdAt && typeof where.createdAt === 'object') {
    const createdAt = where.createdAt as { gte?: Date; lt?: Date };
    if (createdAt.gte && entry.createdAt < createdAt.gte) {
      return false;
    }
    if (createdAt.lt && entry.createdAt >= createdAt.lt) {
      return false;
    }
  }
  return true;
}

function money(value: string) {
  return new Prisma.Decimal(value);
}

function castDecimal(value: Prisma.Decimal | string | number) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}
