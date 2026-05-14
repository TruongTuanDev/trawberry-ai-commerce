import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { PaymentResponseDto } from '../src/modules/payments/dto/payment-response.dto';
import { FilesService } from '../src/modules/files/files.service';
import { PublicOrderTrackingResponseDto } from '../src/modules/order-tracking/dto/public-order-tracking-response.dto';
import { readBody } from './test-helpers';

type DecimalLike = { toString(): string };

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
  paymentInstructions: string | null;
  sellerProfile: { userId: string };
};

type StoredOrder = {
  id: string;
  customerId: string;
  shopId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: DecimalLike;
  shippingAddress: string;
  shippingMethodName: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  paymentProofUrl: string | null;
  paymentProofStorageKey: string | null;
  paymentProofOriginalName: string | null;
  paymentProofMimeType: string | null;
  paymentProofSize: number | null;
  paymentProofUploadedAt: Date | null;
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
    priceAtPurchase: DecimalLike;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
  paymentReviewLogs: Array<{
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
      id?: string;
      fullName: string | null;
    };
  }>;
  deliveryShipments?: Array<{
    provider: string;
    internalStatus: string;
    providerShipmentId: string | null;
    providerStatus: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: Date | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    customerVisibleMessage: string | null;
    comments: Array<{
      id: string;
      visibility: string;
      message: string;
      createdAt: Date;
    }>;
  }>;
};

describe('OrderTrackingController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let orders: StoredOrder[];

  const decimal = (value: string): DecimalLike => ({ toString: () => value });

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const filesServiceMock = {
    storePaymentProof: jest.fn(),
    deleteProductImageFile: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'seller-user-1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'sp-1',
          userId: 'seller-user-1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'customer-user-1',
        email: 'customer1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Alice Customer',
        phone: '123456',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'sp-1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to account 123.',
        sellerProfile: { userId: 'seller-user-1' },
      },
    ];

    orders = [
      {
        id: 'order-1',
        customerId: 'customer-user-1',
        shopId: 'shop-1',
        orderNumber: 'ORD-TRACK-1001',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('120.00'),
        shippingAddress: '123 Main St',
        shippingMethodName: 'MANUAL_TRANSFER',
        customerName: 'Alice Customer',
        customerPhone: '123456',
        customerEmail: 'alice@example.com',
        customerNote: 'Ring bell',
        paymentProofUrl: null,
        paymentProofStorageKey: null,
        paymentProofOriginalName: null,
        paymentProofMimeType: null,
        paymentProofSize: null,
        paymentProofUploadedAt: null,
        createdAt: new Date('2025-01-10T10:00:00Z'),
        updatedAt: new Date('2025-01-10T10:00:00Z'),
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          paymentInstructions: 'Transfer to account 123.',
        },
        items: [
          {
            id: 'item-1',
            quantity: 2,
            priceAtPurchase: decimal('60.00'),
            productTitleSnapshot: 'Alpha Shoe',
            productSlugSnapshot: 'alpha-shoe',
            productImageSnapshot: 'https://example.com/a.jpg',
          },
        ],
        paymentReviewLogs: [],
        deliveryShipments: [],
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        include,
      }: {
        where: { email?: string; id?: string };
        include?: { sellerProfile?: boolean };
      }) => {
        const found = users.find((user) =>
          where.email
            ? user.email === where.email.toLowerCase()
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
      },
    );

    prismaMock.shop.findUnique.mockImplementation(
      ({
        where,
        select,
      }: {
        where: { id: string };
        select?: { sellerProfile?: { select: { userId: boolean } } };
      }) => {
        const shop = shops.find((entry) => entry.id === where.id) ?? null;
        if (!shop) return Promise.resolve(null);
        if (select?.sellerProfile) {
          return Promise.resolve({
            id: shop.id,
            sellerProfile: shop.sellerProfile,
          });
        }
        return Promise.resolve(shop);
      },
    );

    prismaMock.order.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: { id?: string; orderNumber?: string; shopId?: string };
      }) =>
        Promise.resolve(
          orders.find(
            (order) =>
              (!where.id || order.id === where.id) &&
              (!where.orderNumber || order.orderNumber === where.orderNumber) &&
              (!where.shopId || order.shopId === where.shopId),
          ) ?? null,
        ),
    );

    prismaMock.order.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          paymentStatus?: string;
          paymentProofUrl?: string;
          paymentProofStorageKey?: string;
          paymentProofOriginalName?: string;
          paymentProofMimeType?: string;
          paymentProofSize?: number;
          paymentProofUploadedAt?: Date;
          paymentReviewLogs?: {
            create: {
              id: string;
              action: string;
              fromStatus: string | null;
              toStatus: string | null;
              note: string | null;
              reviewer: { connect: { id: string } };
            };
          };
        };
      }) => {
        const target = orders.find((order) => order.id === where.id);
        if (!target) throw new Error('Order not found');
        if (data.paymentStatus !== undefined) {
          target.paymentStatus = data.paymentStatus;
        }
        if (data.paymentProofUrl !== undefined) {
          target.paymentProofUrl = data.paymentProofUrl;
          target.paymentProofStorageKey = data.paymentProofStorageKey ?? null;
          target.paymentProofOriginalName =
            data.paymentProofOriginalName ?? null;
          target.paymentProofMimeType = data.paymentProofMimeType ?? null;
          target.paymentProofSize = data.paymentProofSize ?? null;
          target.paymentProofUploadedAt = data.paymentProofUploadedAt ?? null;
        }
        if (data.paymentReviewLogs?.create) {
          const reviewerId = data.paymentReviewLogs.create.reviewer.connect.id;
          const reviewer = users.find((user) => user.id === reviewerId);
          target.paymentReviewLogs.unshift({
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
              id: reviewer?.id,
              fullName: reviewer?.fullName ?? null,
            },
          });
        }
        target.updatedAt = new Date();
        return Promise.resolve(target);
      },
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(callback(prismaMock)),
    );

    filesServiceMock.storePaymentProof.mockResolvedValue({
      publicUrl:
        'http://127.0.0.1:3001/uploads/payment-proofs/shop-1/order-1/proof.png',
      storageKey: 'payment-proofs/shop-1/order-1/proof.png',
      originalName: 'proof.png',
      mimeType: 'image/png',
      size: 128,
    });
    filesServiceMock.deleteProductImageFile.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(FilesService)
      .useValue(filesServiceMock)
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

  it('tracks order successfully with matching phone', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/orders/track?orderCode=ORD-TRACK-1001&phone=123456')
      .expect(200);

    const body = readBody<PublicOrderTrackingResponseDto>(response);
    expect(body.orderId).toBe('order-1');
    expect(body.customer.phone).toBe('123456');
    expect(body.paymentInstructions).toBe('Transfer to account 123.');
  });

  it('fails tracking when phone does not match', async () => {
    await request(app.getHttpServer())
      .get('/api/public/orders/track?orderCode=ORD-TRACK-1001&phone=999999')
      .expect(404);
  });

  it('uploads payment proof successfully and creates audit log', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/orders/order-1/payment-proof')
      .field('phone', '123456')
      .attach('file', Buffer.from([137, 80, 78, 71]), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(200);

    const body = readBody<PublicOrderTrackingResponseDto>(response);
    expect(body.paymentProof?.url).toContain('/payment-proofs/');
    expect(body.paymentLogs[0].action).toBe('UPLOAD_PROOF');
  });

  it('fails payment proof upload when phone does not match', async () => {
    await request(app.getHttpServer())
      .post('/api/public/orders/order-1/payment-proof')
      .field('phone', '999999')
      .attach('file', Buffer.from([137, 80, 78, 71]), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(404);
  });

  it('fails payment proof upload when file type is invalid', async () => {
    await request(app.getHttpServer())
      .post('/api/public/orders/order-1/payment-proof')
      .field('phone', '123456')
      .attach('file', Buffer.from('plain-text'), {
        filename: 'proof.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('shows customer-visible delivery exception data but hides internal comments', async () => {
    orders[0].deliveryShipments = [
      {
        provider: 'YANDEX',
        internalStatus: 'FAILED',
        providerShipmentId: 'ydx-100',
        providerStatus: 'FAILED',
        trackingNumber: 'TRK-FAILED',
        trackingUrl: 'https://track.example/failed',
        courierPhone: null,
        estimatedDeliveryAt: null,
        deliveryNote: 'Internal note must not be used here.',
        failureReasonCode: 'CUSTOMER_UNAVAILABLE',
        customerVisibleMessage: 'Courier could not reach you.',
        comments: [
          {
            id: 'comment-public',
            visibility: 'CUSTOMER_VISIBLE',
            message: 'Please contact support to schedule another attempt.',
            createdAt: new Date('2025-01-11T10:00:00Z'),
          },
          {
            id: 'comment-internal',
            visibility: 'INTERNAL',
            message: 'Seller internal escalation.',
            createdAt: new Date('2025-01-11T09:00:00Z'),
          },
        ],
      },
    ];

    const response = await request(app.getHttpServer())
      .get('/api/public/orders/order-1/track?phone=123456')
      .expect(200);

    const body = readBody<
      PublicOrderTrackingResponseDto & {
        delivery: {
          status: string;
          failureReasonCode: string | null;
          customerVisibleMessage: string | null;
          deliveryComments: Array<{ message: string }>;
        };
      }
    >(response);
    expect(body.delivery.status).toBe('FAILED');
    expect(body.delivery.failureReasonCode).toBe('CUSTOMER_UNAVAILABLE');
    expect(body.delivery.customerVisibleMessage).toBe(
      'Courier could not reach you.',
    );
    expect(body.delivery.deliveryComments).toEqual([
      expect.objectContaining({
        message: 'Please contact support to schedule another attempt.',
      }),
    ]);
    expect(JSON.stringify(body.delivery)).not.toContain(
      'Seller internal escalation.',
    );
  });

  it('seller payment detail shows proof and seller can mark paid after upload', async () => {
    await request(app.getHttpServer())
      .post('/api/public/orders/order-1/payment-proof')
      .field('phone', '123456')
      .attach('file', Buffer.from([137, 80, 78, 71]), {
        filename: 'proof.png',
        contentType: 'image/png',
      })
      .expect(200);

    const token = await loginAndGetToken(app);
    const detailResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/payments/order-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const detailBody = readBody<PaymentResponseDto>(detailResponse);
    expect(detailBody.paymentProof?.url).toContain('/payment-proofs/');
    expect(detailBody.reviewLogs[0].action).toBe('UPLOAD_PROOF');

    await request(app.getHttpServer())
      .post('/api/shops/shop-1/payments/order-1/mark-paid')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Proof verified.' })
      .expect(200);

    const trackedResponse = await request(app.getHttpServer())
      .get('/api/public/orders/order-1/track?phone=123456')
      .expect(200);
    const trackedBody =
      readBody<PublicOrderTrackingResponseDto>(trackedResponse);
    expect(trackedBody.paymentStatus).toBe('PAID');
  });
});

async function loginAndGetToken(app: INestApplication<App>) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'seller1@example.com', password: 'password123' })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
