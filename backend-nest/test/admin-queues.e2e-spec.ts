/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Prisma } from '@prisma/client';
import { AdminQueuesController } from '../src/modules/admin/admin-queues.controller';
import { AdminQueuesService } from '../src/modules/admin/admin-queues.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { readBody } from './test-helpers';

describe('AdminQueuesController (e2e)', () => {
  let app: INestApplication<App>;

  const now = new Date();
  const old = new Date(now.getTime() - 30 * 60 * 60 * 1000);
  const shop = {
    id: 'shop-1',
    name: 'Queue Shop',
    sellerProfile: {
      userId: 'seller-1',
      user: { email: 'seller@example.com' },
    },
  };
  const pendingSeller = {
    id: 'profile-1',
    userId: 'seller-pending',
    approvalStatus: 'PENDING',
    legalName: 'Pending Seller LLC',
    contactName: 'Pending Seller',
    contactEmail: 'pending@example.com',
    createdAt: old,
    updatedAt: old,
    user: { email: 'pending@example.com', fullName: 'Pending Seller' },
    shops: [{ id: 'shop-pending', name: 'Pending Shop' }],
  };
  const pendingPaymentOrder = {
    id: 'order-pending',
    shopId: 'shop-1',
    orderNumber: 'ORD-PENDING',
    status: 'PENDING',
    paymentStatus: 'PENDING',
    totalAmount: new Prisma.Decimal(100),
    customerName: 'Payment Customer',
    createdAt: old,
    updatedAt: old,
    shop,
  };
  const paidWithoutDeliveryOrder = {
    ...pendingPaymentOrder,
    id: 'order-paid',
    orderNumber: 'ORD-PAID',
    paymentStatus: 'PAID',
    customerName: 'Delivery Customer',
  };
  const failedShipment = {
    id: 'shipment-failed',
    orderId: 'order-failed',
    provider: 'YANDEX',
    internalStatus: 'FAILED',
    failureReasonCode: 'CUSTOMER_UNAVAILABLE',
    createdAt: old,
    updatedAt: old,
    order: {
      orderNumber: 'ORD-FAILED',
      customerName: 'Failed Customer',
      shop,
    },
  };
  const lowStockVariant = {
    id: 'variant-low',
    productId: 'product-low',
    stockQuantity: 1,
    lowStockThreshold: 5,
    createdAt: old,
    updatedAt: old,
    product: {
      localTitle: 'Low Stock Product',
      wbTitle: 'Low Stock Product',
      shop,
    },
  };
  const outOfStockVariant = {
    ...lowStockVariant,
    id: 'variant-out',
    stockQuantity: 0,
    productId: 'product-out',
    product: { ...lowStockVariant.product, localTitle: 'Out Stock Product' },
  };

  const prismaMock = {
    sellerProfile: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([pendingSeller]),
    },
    order: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          where?.paymentStatus === 'PAID'
            ? [paidWithoutDeliveryOrder]
            : [pendingPaymentOrder],
        ),
      ),
    },
    deliveryShipment: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([failedShipment]),
    },
    productVariant: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn(({ where }) =>
        Promise.resolve(
          where?.stockQuantity === 0 ? [outOfStockVariant] : [lowStockVariant],
        ),
      ),
      fields: { lowStockThreshold: 'lowStockThreshold' },
    },
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminQueuesController],
      providers: [
        AdminQueuesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: { userId: string; role: string };
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: 'test-user',
            role: req.headers['x-test-role'] ?? 'ADMIN',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('returns pending sellers with SLA', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/queues/sellers?status=PENDING')
      .expect(200);
    const body = readBody<{
      items: Array<{ sellerEmail: string; slaStatus: string }>;
    }>(response);
    expect(body.items[0].sellerEmail).toBe('pending@example.com');
    expect(body.items[0].slaStatus).toBe('WARNING');
  });

  it('returns pending payment reviews', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/queues/payments?status=PENDING')
      .expect(200);
    const body = readBody<{
      items: Array<{ orderCode: string; slaStatus: string }>;
    }>(response);
    expect(body.items[0].orderCode).toBe('ORD-PENDING');
    expect(body.items[0].slaStatus).toBe('BREACHED');
  });

  it('returns paid orders without delivery', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/queues/deliveries?queueType=PAID_WITHOUT_DELIVERY')
      .expect(200);
    const body = readBody<{
      items: Array<{ orderCode: string; status: string }>;
    }>(response);
    expect(body.items[0].orderCode).toBe('ORD-PAID');
    expect(body.items[0].status).toBe('PAID_WITHOUT_DELIVERY');
  });

  it('returns delivery exceptions', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/queues/deliveries?queueType=EXCEPTION')
      .expect(200);
    const body = readBody<{
      items: Array<{ orderCode: string; slaStatus: string }>;
    }>(response);
    expect(body.items[0].orderCode).toBe('ORD-FAILED');
    expect(body.items[0].slaStatus).toBe('BREACHED');
  });

  it('returns inventory queues', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/queues/inventory?stockStatus=LOW_STOCK')
      .expect(200);
    const body = readBody<{
      items: Array<{ productName: string; slaStatus: string }>;
    }>(response);
    expect(body.items[0].productName).toBe('Low Stock Product');
    expect(body.items[0].slaStatus).toBe('WARNING');
  });

  it('forbids non-admin users', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/queues/sellers')
      .set('x-test-role', 'SELLER')
      .expect(403);
  });
});
