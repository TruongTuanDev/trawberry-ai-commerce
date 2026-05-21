import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { PaginatedPaymentsResponseDto } from '../src/modules/payments/dto/paginated-payments-response.dto';
import { PaymentResponseDto } from '../src/modules/payments/dto/payment-response.dto';
import { readBody } from './test-helpers';

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
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  recipientPhone?: string | null;
  sbpPhone?: string | null;
  staticQrImageUrl?: string | null;
  paymentMode?: string | null;
  paymentConfigStatus?: string;
  sellerProfile: { userId: string };
};

type DecimalLike = { toString(): string };

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
  paymentModeSnapshot?: string | null;
  paymentBankNameSnapshot?: string | null;
  paymentRecipientNameSnapshot?: string | null;
  paymentRecipientPhoneSnapshot?: string | null;
  paymentRecipientAccountSnapshot?: string | null;
  paymentSbpPhoneSnapshot?: string | null;
  paymentQrImageUrlSnapshot?: string | null;
  paymentInstructionSnapshot?: string | null;
  paymentProofStatus?: string;
  paymentProofBuyerNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
    bankName?: string | null;
    accountHolderName?: string | null;
    accountNumber?: string | null;
    recipientPhone?: string | null;
    sbpPhone?: string | null;
    staticQrImageUrl?: string | null;
    paymentMode?: string | null;
    paymentConfigStatus?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: DecimalLike;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
  paymentReviewLogs: StoredPaymentReviewLog[];
};

type UserFindUniqueArgs = {
  where: { email?: string; id?: string };
  include?: {
    sellerProfile?: boolean | { select: Record<string, boolean> };
  };
};

type ShopFindUniqueArgs = {
  where: { id: string };
  select?: {
    id?: boolean;
    sellerProfile?: {
      select: {
        userId: boolean;
      };
    };
  };
};

type OrderWhere = {
  id?: string;
  shopId?: string;
  paymentStatus?: string | { in?: string[] };
  paymentProofStatus?: string;
  OR?: Array<{
    orderNumber?: { contains: string };
    customerName?: { contains: string };
    customerEmail?: { contains: string };
    customerPhone?: { contains: string };
    shippingMethodName?: { contains: string };
  }>;
};

describe('PaymentsController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let orders: StoredOrder[];

  const decimal = (value: string): DecimalLike => ({ toString: () => value });

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
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
        id: 'admin-user-1',
        email: 'demo-admin@trawberry.local',
        passwordHash: bcrypt.hashSync('DemoAdmin123!', 10),
        fullName: 'Demo Admin',
        phone: null,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
      {
        id: 'seller-user-2',
        email: 'seller2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
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
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to account 123.',
        sellerProfile: { userId: 'seller-user-1' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp-2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        paymentInstructions: null,
        sellerProfile: { userId: 'seller-user-2' },
      },
    ];

    orders = [
      {
        id: 'order-1',
        customerId: 'cust-1',
        shopId: 'shop-1',
        orderNumber: 'ORD-1001',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('120.00'),
        shippingAddress: '123 Main St',
        shippingMethodName: 'MANUAL_TRANSFER',
        customerName: 'Alice',
        customerPhone: '123456',
        customerEmail: 'alice@example.com',
        customerNote: 'Ring bell',
        paymentModeSnapshot: 'STATIC_QR',
        paymentBankNameSnapshot: 'T-Bank',
        paymentRecipientNameSnapshot: 'Seller One',
        paymentRecipientPhoneSnapshot: '+79990000001',
        paymentRecipientAccountSnapshot: '123',
        paymentSbpPhoneSnapshot: '+79990000001',
        paymentQrImageUrlSnapshot: 'https://example.com/qr-shop-1.png',
        paymentInstructionSnapshot: 'Transfer to account 123.',
        paymentProofStatus: 'NOT_SUBMITTED',
        createdAt: new Date('2025-01-10T10:00:00Z'),
        updatedAt: new Date('2025-01-10T10:00:00Z'),
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          paymentInstructions: 'Transfer to account 123.',
          bankName: 'T-Bank',
          accountHolderName: 'Seller One',
          accountNumber: '123',
          recipientPhone: '+79990000001',
          sbpPhone: '+79990000001',
          staticQrImageUrl: 'https://example.com/qr-shop-1.png',
          paymentMode: 'STATIC_QR',
          paymentConfigStatus: 'READY',
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
      },
      {
        id: 'order-2',
        customerId: 'cust-2',
        shopId: 'shop-1',
        orderNumber: 'ORD-1002',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        totalAmount: decimal('80.00'),
        shippingAddress: '456 Side St',
        shippingMethodName: 'CASH_ON_DELIVERY',
        customerName: 'Bob',
        customerPhone: '987654',
        customerEmail: 'bob@example.com',
        customerNote: null,
        paymentModeSnapshot: 'STATIC_QR',
        paymentInstructionSnapshot: 'Transfer to account 123.',
        paymentProofStatus: 'NOT_SUBMITTED',
        createdAt: new Date('2025-01-12T10:00:00Z'),
        updatedAt: new Date('2025-01-12T10:00:00Z'),
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          paymentInstructions: 'Transfer to account 123.',
          bankName: 'T-Bank',
          accountHolderName: 'Seller One',
          accountNumber: '123',
          recipientPhone: '+79990000001',
          sbpPhone: '+79990000001',
          staticQrImageUrl: 'https://example.com/qr-shop-1.png',
          paymentMode: 'STATIC_QR',
          paymentConfigStatus: 'READY',
        },
        items: [],
        paymentReviewLogs: [],
      },
      {
        id: 'order-3',
        customerId: 'cust-3',
        shopId: 'shop-1',
        orderNumber: 'ORD-1003',
        status: 'ASSEMBLING',
        paymentStatus: 'PAID',
        totalAmount: decimal('95.00'),
        shippingAddress: '789 Another St',
        shippingMethodName: 'MANUAL_TRANSFER',
        customerName: 'Carol',
        customerPhone: '555123',
        customerEmail: 'carol@example.com',
        customerNote: null,
        paymentModeSnapshot: 'STATIC_QR',
        paymentInstructionSnapshot: 'Transfer to account 123.',
        paymentProofStatus: 'SELLER_CONFIRMED',
        createdAt: new Date('2025-01-13T10:00:00Z'),
        updatedAt: new Date('2025-01-13T10:00:00Z'),
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          paymentInstructions: 'Transfer to account 123.',
          bankName: 'T-Bank',
          accountHolderName: 'Seller One',
          accountNumber: '123',
          recipientPhone: '+79990000001',
          sbpPhone: '+79990000001',
          staticQrImageUrl: 'https://example.com/qr-shop-1.png',
          paymentMode: 'STATIC_QR',
          paymentConfigStatus: 'READY',
        },
        items: [],
        paymentReviewLogs: [],
      },
      {
        id: 'order-4',
        customerId: 'cust-4',
        shopId: 'shop-2',
        orderNumber: 'ORD-2001',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('40.00'),
        shippingAddress: '789 Other St',
        shippingMethodName: 'MANUAL_TRANSFER',
        customerName: 'Dave',
        customerPhone: '999000',
        customerEmail: 'dave@example.com',
        customerNote: null,
        paymentProofStatus: 'NOT_SUBMITTED',
        createdAt: new Date('2025-01-11T10:00:00Z'),
        updatedAt: new Date('2025-01-11T10:00:00Z'),
        shop: {
          id: 'shop-2',
          name: 'Shop Two',
          paymentInstructions: null,
          bankName: null,
          accountHolderName: null,
          accountNumber: null,
          recipientPhone: null,
          sbpPhone: null,
          staticQrImageUrl: null,
          paymentMode: 'STATIC_QR',
          paymentConfigStatus: 'PENDING_REVIEW',
        },
        items: [],
        paymentReviewLogs: [],
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({ where, include }: UserFindUniqueArgs) => {
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
      ({ where, select }: ShopFindUniqueArgs) => {
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

    prismaMock.order.findMany.mockImplementation(
      ({
        where,
        skip = 0,
        take = orders.length,
      }: {
        where: OrderWhere;
        skip?: number;
        take?: number;
      }) =>
        Promise.resolve(filterOrders(orders, where).slice(skip, skip + take)),
    );
    prismaMock.order.count.mockImplementation(
      ({ where }: { where: OrderWhere }) =>
        Promise.resolve(filterOrders(orders, where).length),
    );
    prismaMock.order.findFirst.mockImplementation(
      ({ where }: { where: OrderWhere }) =>
        Promise.resolve(filterOrders(orders, where)[0] ?? null),
    );
    prismaMock.order.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          paymentStatus?: string;
          status?: string;
          paymentProofStatus?: string;
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
        if (data.paymentReviewLogs?.create) {
          const reviewerId = data.paymentReviewLogs.create.reviewer.connect.id;
          const reviewer = users.find((user) => user.id === reviewerId);
          if (!reviewer) {
            throw new Error('Reviewer not found');
          }
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
              id: reviewer.id,
              fullName: reviewer.fullName,
            },
          });
        }
        if (data.paymentStatus !== undefined) {
          target.paymentStatus = data.paymentStatus;
        }
        if (data.status !== undefined) {
          target.status = data.status;
        }
        if (data.paymentProofStatus !== undefined) {
          target.paymentProofStatus = data.paymentProofStatus;
        }
        target.updatedAt = new Date();
        return Promise.resolve(target);
      },
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(callback(prismaMock)),
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
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('lists pending payments by default', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/payments?page=1&size=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<PaginatedPaymentsResponseDto>(response);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].orderNumber).toBe('ORD-1002');
    expect(body.items[1].paymentStatus).toBe('PENDING');
  });

  it('returns payment detail with review logs and instructions', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/payments/order-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.id).toBe('order-1');
    expect(body.paymentMethod).toBe('MANUAL_TRANSFER');
    expect(body.paymentInstructions).toBe('Transfer to account 123.');
    expect(body.paymentDetails.staticQrImageUrl).toBe(
      'https://example.com/qr-shop-1.png',
    );
    expect(body.customer.name).toBe('Alice');
  });

  it('marks payment as paid and creates audit log', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/payments/order-1/mark-paid')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Manual transfer confirmed.' })
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.paymentStatus).toBe('PAID');
    expect(body.paymentProofStatus).toBe('SELLER_CONFIRMED');
    expect(body.reviewLogs[0].action).toBe('SELLER_CONFIRMED');
    expect(body.reviewLogs[0].note).toBe('Manual transfer confirmed.');
  });

  it('rejects payment and cancels order when still pending', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/payments/order-2/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Customer payment failed review.' })
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.paymentStatus).toBe('REJECTED');
    expect(body.status).toBe('CANCELLED');
    expect(body.paymentProofStatus).toBe('SELLER_REJECTED');
    expect(body.reviewLogs[0].action).toBe('SELLER_REJECTED');
  });

  it('adds note without changing payment status', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/payments/order-1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Waiting for bank screenshot.' })
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.paymentStatus).toBe('PENDING');
    expect(body.reviewLogs[0].action).toBe('ADD_NOTE');
    expect(body.reviewLogs[0].note).toBe('Waiting for bank screenshot.');
  });

  it('forbids access to another seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .get('/api/shops/shop-2/payments')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('rejects invalid transition when payment is already paid', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post('/api/shops/shop-1/payments/order-3/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Too late.' })
      .expect(400);
  });

  it('lists buyer-marked payments in seller confirmation queue', async () => {
    orders[0].paymentProofStatus = 'BUYER_MARKED_PAID';

    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get(
        '/api/shops/shop-1/payments?page=1&size=10&proofStatus=BUYER_MARKED_PAID',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<PaginatedPaymentsResponseDto>(response);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('order-1');
  });

  it('allows admin to list marketplace payments for supervision', async () => {
    orders[0].paymentProofStatus = 'BUYER_MARKED_PAID';

    const token = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    const response = await request(app.getHttpServer())
      .get('/api/admin/payments?page=1&size=10&proofStatus=BUYER_MARKED_PAID')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<PaginatedPaymentsResponseDto>(response);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('order-1');
  });

  it('allows admin to confirm a buyer-marked payment', async () => {
    orders[0].paymentProofStatus = 'BUYER_MARKED_PAID';

    const token = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    const response = await request(app.getHttpServer())
      .post('/api/admin/payments/order-1/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Admin verified seller confirmation.' })
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.paymentStatus).toBe('PAID');
    expect(body.paymentProofStatus).toBe('SELLER_CONFIRMED');
    expect(body.reviewLogs[0].action).toBe('ADMIN_CONFIRMED');
  });

  it('allows admin to reject a buyer-marked payment', async () => {
    orders[0].paymentProofStatus = 'BUYER_MARKED_PAID';

    const token = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    const response = await request(app.getHttpServer())
      .post('/api/admin/payments/order-1/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Proof does not match the transfer.' })
      .expect(200);

    const body = readBody<PaymentResponseDto>(response);
    expect(body.paymentStatus).toBe('REJECTED');
    expect(body.paymentProofStatus).toBe('SELLER_REJECTED');
    expect(body.reviewLogs[0].action).toBe('ADMIN_REJECTED');
  });

  it('forbids sellers from accessing admin payment supervision routes', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .get('/api/admin/payments')
      .set('Authorization', `Bearer ${token}`)
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

function filterOrders(orders: StoredOrder[], where: OrderWhere) {
  return orders
    .filter((order) => {
      if (where.id && order.id !== where.id) {
        return false;
      }
      if (where.shopId && order.shopId !== where.shopId) {
        return false;
      }
      if (typeof where.paymentStatus === 'string') {
        if (order.paymentStatus !== where.paymentStatus) {
          return false;
        }
      } else if (where.paymentStatus?.in) {
        if (!where.paymentStatus.in.includes(order.paymentStatus)) {
          return false;
        }
      }
      if (
        where.paymentProofStatus &&
        order.paymentProofStatus !== where.paymentProofStatus
      ) {
        return false;
      }

      if (where.OR?.length) {
        const match = where.OR.some((condition) => {
          if (condition.orderNumber?.contains) {
            return order.orderNumber
              .toLowerCase()
              .includes(condition.orderNumber.contains.toLowerCase());
          }
          if (condition.customerName?.contains) {
            return order.customerName
              .toLowerCase()
              .includes(condition.customerName.contains.toLowerCase());
          }
          if (condition.customerEmail?.contains) {
            return (order.customerEmail ?? '')
              .toLowerCase()
              .includes(condition.customerEmail.contains.toLowerCase());
          }
          if (condition.customerPhone?.contains) {
            return order.customerPhone
              .toLowerCase()
              .includes(condition.customerPhone.contains.toLowerCase());
          }
          if (condition.shippingMethodName?.contains) {
            return (order.shippingMethodName ?? '')
              .toLowerCase()
              .includes(condition.shippingMethodName.contains.toLowerCase());
          }
          return false;
        });

        if (!match) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
