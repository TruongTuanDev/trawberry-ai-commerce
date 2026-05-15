/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

type UserRecord = {
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

type ShopRecord = {
  id: string;
  name: string;
  sellerProfile: { userId: string };
};

type OrderRecord = {
  id: string;
  shopId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  customerName: string;
  createdAt: Date;
  deliveryShipments?: Array<{ internalStatus: string }>;
};

type ShipmentRecord = {
  id: string;
  shopId: string;
  orderId: string;
  internalStatus: string;
  failureReasonCode: string | null;
  customerVisibleMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt: Date | null;
};

type ProductVariantRecord = {
  id: string;
  product: { shopId: string; shop: { sellerProfile: { userId: string } } };
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
};

describe('AdminDashboardController (e2e)', () => {
  let app: INestApplication<App>;
  let users: UserRecord[];
  let shops: ShopRecord[];
  let orders: OrderRecord[];
  let shipments: ShipmentRecord[];
  let variants: ProductVariantRecord[];

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    sellerProfile: { count: jest.fn() },
    order: { count: jest.fn(), findMany: jest.fn() },
    deliveryShipment: { count: jest.fn(), findMany: jest.fn() },
    productVariant: {
      count: jest.fn(),
      fields: { lowStockThreshold: 'lowStockThreshold' },
    },
    paymentReviewLog: { findMany: jest.fn() },
    adminAuditLog: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    users = [
      {
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Admin One',
        phone: null,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: 'seller-1',
        email: 'seller@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'sp-1',
          userId: 'seller-1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'seller-pending',
        email: 'pending@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Pending Seller',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'sp-pending',
          userId: 'seller-pending',
          approvalStatus: 'PENDING',
          currentShopId: null,
        },
      },
      {
        id: 'seller-rejected',
        email: 'rejected@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Rejected Seller',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'sp-rejected',
          userId: 'seller-rejected',
          approvalStatus: 'REJECTED',
          currentShopId: null,
        },
      },
    ];
    shops = [
      { id: 'shop-1', name: 'Shop One', sellerProfile: { userId: 'seller-1' } },
    ];
    orders = [
      {
        id: 'order-paid-no-delivery',
        shopId: 'shop-1',
        orderNumber: 'ORD-DASH-1',
        status: 'PENDING',
        paymentStatus: 'PAID',
        totalAmount: new Prisma.Decimal('100'),
        customerName: 'Alice',
        createdAt: new Date('2026-05-01T10:00:00Z'),
        deliveryShipments: [],
      },
      {
        id: 'order-pending',
        shopId: 'shop-1',
        orderNumber: 'ORD-DASH-2',
        status: 'NEW',
        paymentStatus: 'PENDING',
        totalAmount: new Prisma.Decimal('200'),
        customerName: 'Bob',
        createdAt: new Date('2026-05-02T10:00:00Z'),
        deliveryShipments: [],
      },
      {
        id: 'order-failed',
        shopId: 'shop-1',
        orderNumber: 'ORD-DASH-3',
        status: 'PENDING',
        paymentStatus: 'PAID',
        totalAmount: new Prisma.Decimal('300'),
        customerName: 'Carol',
        createdAt: new Date('2026-05-03T10:00:00Z'),
        deliveryShipments: [{ internalStatus: 'FAILED' }],
      },
    ];
    shipments = [
      {
        id: 'shipment-failed',
        shopId: 'shop-1',
        orderId: 'order-failed',
        internalStatus: 'FAILED',
        failureReasonCode: 'LOST_PACKAGE',
        customerVisibleMessage: 'Delivery issue.',
        createdAt: new Date('2026-05-04T10:00:00Z'),
        updatedAt: new Date('2026-05-04T11:00:00Z'),
        deliveredAt: null,
      },
      {
        id: 'shipment-transit',
        shopId: 'shop-1',
        orderId: 'order-transit',
        internalStatus: 'IN_TRANSIT',
        failureReasonCode: null,
        customerVisibleMessage: null,
        createdAt: new Date('2026-05-04T10:00:00Z'),
        updatedAt: new Date('2026-05-04T11:00:00Z'),
        deliveredAt: null,
      },
    ];
    variants = [
      {
        id: 'variant-out',
        product: {
          shopId: 'shop-1',
          shop: { sellerProfile: { userId: 'seller-1' } },
        },
        trackInventory: true,
        stockQuantity: 0,
        lowStockThreshold: 5,
      },
      {
        id: 'variant-low',
        product: {
          shopId: 'shop-1',
          shop: { sellerProfile: { userId: 'seller-1' } },
        },
        trackInventory: true,
        stockQuantity: 2,
        lowStockThreshold: 5,
      },
    ];

    prismaMock.user.findUnique.mockImplementation(({ where, include }) => {
      const found = users.find((user) =>
        where.email
          ? user.email === where.email.toLowerCase()
          : user.id === where.id,
      );
      if (!found) return Promise.resolve(null);
      return Promise.resolve({
        ...found,
        sellerProfile: include?.sellerProfile
          ? (found.sellerProfile ?? null)
          : undefined,
      });
    });
    prismaMock.shop.findUnique.mockResolvedValue(null);
    prismaMock.sellerProfile.count.mockImplementation(({ where }) => {
      return Promise.resolve(
        users.filter((user) => {
          const profile = user.sellerProfile;
          if (!profile) return false;
          return (
            !where?.approvalStatus ||
            profile.approvalStatus === where.approvalStatus
          );
        }).length,
      );
    });
    prismaMock.order.count.mockImplementation(({ where }) =>
      Promise.resolve(filterOrders(where).length),
    );
    prismaMock.order.findMany.mockImplementation(
      ({ where, distinct, take }) => {
        let rows = filterOrders(where);
        if (distinct?.includes('shopId')) {
          const seen = new Set<string>();
          rows = rows.filter((order) => {
            if (seen.has(order.shopId)) return false;
            seen.add(order.shopId);
            return true;
          });
          return Promise.resolve(
            rows.slice(0, take).map((order) => ({ shopId: order.shopId })),
          );
        }
        return Promise.resolve(
          rows.slice(0, take).map((order) => ({
            ...order,
            shop: shops.find((shop) => shop.id === order.shopId),
          })),
        );
      },
    );
    prismaMock.deliveryShipment.count.mockImplementation(({ where }) =>
      Promise.resolve(filterShipments(where).length),
    );
    prismaMock.deliveryShipment.findMany.mockImplementation(({ where, take }) =>
      Promise.resolve(
        filterShipments(where)
          .slice(0, take)
          .map((shipment) => ({
            ...shipment,
            order: {
              ...orders.find((order) => order.id === shipment.orderId),
              shop: shops.find((shop) => shop.id === shipment.shopId),
            },
          })),
      ),
    );
    prismaMock.productVariant.count.mockImplementation(({ where }) => {
      let rows = variants.filter((variant) => variant.trackInventory);
      if (where?.stockQuantity === 0) {
        rows = rows.filter((variant) => variant.stockQuantity === 0);
      } else if (where?.stockQuantity?.gt === 0) {
        rows = rows.filter(
          (variant) =>
            variant.stockQuantity > 0 &&
            variant.stockQuantity <= variant.lowStockThreshold,
        );
      }
      return Promise.resolve(rows.length);
    });
    prismaMock.paymentReviewLog.findMany.mockResolvedValue([]);
    prismaMock.adminAuditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actorUserId: 'admin-1',
        targetUserId: 'seller-1',
        action: 'APPROVE_SELLER',
        entityType: 'SELLER_PROFILE',
        entityId: 'seller-1',
        reason: null,
        createdAt: new Date('2026-05-05T10:00:00Z'),
      },
    ]);

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
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('returns admin dashboard summary', async () => {
    const token = await loginAndGetToken(app, 'admin@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/admin/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<{
      orders: { total: number; paidWithoutDelivery: number };
      deliveries: { exceptions: number };
      inventory: { outOfStock: number; lowStock: number };
      sellers: { pending: number; approved: number; rejected: number };
      recent: {
        orders: unknown[];
        deliveryExceptions: unknown[];
        auditLogs: unknown[];
      };
    }>(response);
    expect(body.orders.total).toBe(3);
    expect(body.orders.paidWithoutDelivery).toBe(2);
    expect(body.deliveries.exceptions).toBe(1);
    expect(body.inventory.outOfStock).toBe(1);
    expect(body.inventory.lowStock).toBe(1);
    expect(body.sellers.pending).toBe(1);
    expect(body.sellers.approved).toBe(1);
    expect(body.sellers.rejected).toBe(1);
    expect(body.recent.orders.length).toBeGreaterThan(0);
    expect(body.recent.deliveryExceptions.length).toBe(1);
    expect(body.recent.auditLogs.length).toBe(1);
  });

  it('forbids non-admin dashboard access', async () => {
    const token = await loginAndGetToken(app, 'seller@example.com');
    await request(app.getHttpServer())
      .get('/api/admin/dashboard/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  function filterOrders(where?: Prisma.OrderWhereInput) {
    let rows = [...orders];
    if (where?.paymentStatus) {
      if (typeof where.paymentStatus === 'string') {
        rows = rows.filter(
          (order) => order.paymentStatus === where.paymentStatus,
        );
      } else if ('in' in where.paymentStatus) {
        rows = rows.filter((order) =>
          (where.paymentStatus.in as string[]).includes(order.paymentStatus),
        );
      }
    }
    if (where?.status) {
      if (typeof where.status === 'string') {
        rows = rows.filter((order) => order.status === where.status);
      } else if ('in' in where.status) {
        rows = rows.filter((order) =>
          (where.status.in as string[]).includes(order.status),
        );
      } else if ('notIn' in where.status) {
        rows = rows.filter(
          (order) => !(where.status.notIn as string[]).includes(order.status),
        );
      }
    }
    if (where?.deliveryShipments?.none) {
      const active = (
        where.deliveryShipments.none.internalStatus as { in: string[] }
      ).in;
      rows = rows.filter(
        (order) =>
          !order.deliveryShipments?.some((shipment) =>
            active.includes(shipment.internalStatus),
          ),
      );
    }
    return rows;
  }

  function filterShipments(where?: Prisma.DeliveryShipmentWhereInput) {
    let rows = [...shipments];
    if (where?.internalStatus) {
      if (typeof where.internalStatus === 'string') {
        rows = rows.filter(
          (shipment) => shipment.internalStatus === where.internalStatus,
        );
      } else if ('in' in where.internalStatus) {
        rows = rows.filter((shipment) =>
          (where.internalStatus.in as string[]).includes(
            shipment.internalStatus,
          ),
        );
      }
    }
    return rows;
  }
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
