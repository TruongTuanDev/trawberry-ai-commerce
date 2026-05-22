/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
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
  name: string;
  slug: string;
  status: string;
  paymentInstructions: string | null;
  sellerProfile: { userId: string; approvalStatus: string };
};

type StoredOrder = {
  id: string;
  marketplaceCheckoutId: string | null;
  customerId: string;
  shopId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: DecimalLike;
  shippingCost: DecimalLike;
  shippingMethodName: string | null;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  customerCompletedAt: Date | null;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: DecimalLike;
    unitPrice: DecimalLike | null;
    lineTotal: DecimalLike | null;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
    variantNameSnapshot: string | null;
  }>;
};

type StoredCheckout = {
  id: string;
  checkoutCode: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  grandTotal: DecimalLike;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredSupportCase = {
  id: string;
  checkoutId: string;
  checkoutCode: string;
  orderId: string | null;
  shopId: string | null;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  issueType: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
};

type StoredSupportCaseMessage = {
  id: string;
  caseId: string;
  senderUserId: string | null;
  senderRole: string;
  message: string;
  isInternal: boolean;
  createdAt: Date;
};

type StoredSupportCaseEvent = {
  id: string;
  caseId: string;
  actorUserId: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: Date;
};

describe('SupportCasesController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let orders: StoredOrder[];
  let checkouts: StoredCheckout[];
  let supportCases: StoredSupportCase[];
  let supportCaseMessages: StoredSupportCaseMessage[];
  let supportCaseEvents: StoredSupportCaseEvent[];
  let caseSequence = 1;
  let messageSequence = 1;
  let eventSequence = 1;

  const decimal = (value: string): DecimalLike => ({ toString: () => value });

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    marketplaceCheckout: {
      findFirst: jest.fn(),
    },
    supportCase: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const buildCaseView = (entry: StoredSupportCase) => {
    const order = entry.orderId
      ? (orders.find((candidate) => candidate.id === entry.orderId) ?? null)
      : null;
    const shop = entry.shopId
      ? (shops.find((candidate) => candidate.id === entry.shopId) ?? null)
      : null;
    const messages = supportCaseMessages
      .filter((candidate) => candidate.caseId === entry.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((candidate) => ({
        ...candidate,
        sender: candidate.senderUserId
          ? (() => {
              const sender = users.find(
                (user) => user.id === candidate.senderUserId,
              );
              return sender
                ? {
                    id: sender.id,
                    fullName: sender.fullName,
                    email: sender.email,
                  }
                : null;
            })()
          : null,
      }));
    const events = supportCaseEvents
      .filter((candidate) => candidate.caseId === entry.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return {
      ...entry,
      shop: shop ? { id: shop.id, name: shop.name } : null,
      order: order
        ? {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
          }
        : null,
      messages,
      events,
    };
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
        sellerProfile: null,
      },
      {
        id: 'customer-1',
        email: 'customer-1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Customer One',
        phone: '+70000000001',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
      {
        id: 'customer-2',
        email: 'customer-2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Customer Two',
        phone: '+70000000002',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
      {
        id: 'seller-1',
        email: 'seller-1@example.com',
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
        id: 'seller-2',
        email: 'seller-2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'sp-2',
          userId: 'seller-2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
    ];

    shops = [
      {
        id: 'shop-1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to shop one.',
        sellerProfile: { userId: 'seller-1', approvalStatus: 'APPROVED' },
      },
      {
        id: 'shop-2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to shop two.',
        sellerProfile: { userId: 'seller-2', approvalStatus: 'APPROVED' },
      },
    ];

    orders = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        marketplaceCheckoutId: 'checkout-1',
        customerId: 'customer-1',
        shopId: 'shop-1',
        orderNumber: 'ORD-SUPPORT-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('100.00'),
        shippingCost: decimal('0'),
        shippingMethodName: 'PREPAID_SELLER_QR',
        shippingAddress: 'Customer address',
        customerName: 'Customer One',
        customerPhone: '+70000000001',
        customerEmail: 'customer-1@example.com',
        customerNote: null,
        createdAt: new Date('2026-05-10T10:00:00Z'),
        updatedAt: new Date('2026-05-10T10:00:00Z'),
        customerCompletedAt: null,
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            variantId: 'variant-1',
            quantity: 1,
            priceAtPurchase: decimal('100.00'),
            unitPrice: decimal('100.00'),
            lineTotal: decimal('100.00'),
            productTitleSnapshot: 'Product One',
            productSlugSnapshot: 'product-one',
            productImageSnapshot: 'https://example.com/one.jpg',
            variantNameSnapshot: 'Default',
          },
        ],
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        marketplaceCheckoutId: 'checkout-1',
        customerId: 'customer-1',
        shopId: 'shop-2',
        orderNumber: 'ORD-SUPPORT-2',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('200.00'),
        shippingCost: decimal('0'),
        shippingMethodName: 'PREPAID_SELLER_QR',
        shippingAddress: 'Customer address',
        customerName: 'Customer One',
        customerPhone: '+70000000001',
        customerEmail: 'customer-1@example.com',
        customerNote: null,
        createdAt: new Date('2026-05-10T10:00:00Z'),
        updatedAt: new Date('2026-05-10T10:00:00Z'),
        customerCompletedAt: null,
        items: [
          {
            id: 'item-2',
            productId: 'product-2',
            variantId: 'variant-2',
            quantity: 1,
            priceAtPurchase: decimal('200.00'),
            unitPrice: decimal('200.00'),
            lineTotal: decimal('200.00'),
            productTitleSnapshot: 'Product Two',
            productSlugSnapshot: 'product-two',
            productImageSnapshot: 'https://example.com/two.jpg',
            variantNameSnapshot: 'Default',
          },
        ],
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        marketplaceCheckoutId: 'checkout-2',
        customerId: 'customer-2',
        shopId: 'shop-2',
        orderNumber: 'ORD-OTHER-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: decimal('300.00'),
        shippingCost: decimal('0'),
        shippingMethodName: 'PREPAID_SELLER_QR',
        shippingAddress: 'Other address',
        customerName: 'Customer Two',
        customerPhone: '+70000000002',
        customerEmail: 'customer-2@example.com',
        customerNote: null,
        createdAt: new Date('2026-05-11T10:00:00Z'),
        updatedAt: new Date('2026-05-11T10:00:00Z'),
        customerCompletedAt: null,
        items: [
          {
            id: 'item-3',
            productId: 'product-3',
            variantId: 'variant-3',
            quantity: 1,
            priceAtPurchase: decimal('300.00'),
            unitPrice: decimal('300.00'),
            lineTotal: decimal('300.00'),
            productTitleSnapshot: 'Product Three',
            productSlugSnapshot: 'product-three',
            productImageSnapshot: 'https://example.com/three.jpg',
            variantNameSnapshot: 'Default',
          },
        ],
      },
    ];

    checkouts = [
      {
        id: 'checkout-1',
        checkoutCode: 'CHK-SUPPORT-1',
        customerUserId: 'customer-1',
        customerName: 'Customer One',
        customerPhone: '+70000000001',
        customerEmail: 'customer-1@example.com',
        grandTotal: decimal('300.00'),
        status: 'PENDING',
        createdAt: new Date('2026-05-10T10:00:00Z'),
        updatedAt: new Date('2026-05-10T10:00:00Z'),
      },
      {
        id: 'checkout-2',
        checkoutCode: 'CHK-SUPPORT-2',
        customerUserId: 'customer-2',
        customerName: 'Customer Two',
        customerPhone: '+70000000002',
        customerEmail: 'customer-2@example.com',
        grandTotal: decimal('300.00'),
        status: 'PENDING',
        createdAt: new Date('2026-05-11T10:00:00Z'),
        updatedAt: new Date('2026-05-11T10:00:00Z'),
      },
    ];

    supportCases = [];
    supportCaseMessages = [];
    supportCaseEvents = [];
    caseSequence = 1;
    messageSequence = 1;
    eventSequence = 1;

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        select,
        include,
      }: {
        where: { email?: string; id?: string };
        select?: { id?: boolean };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
      }) => {
        const user = users.find((entry) =>
          where.email
            ? entry.email === where.email.toLowerCase()
            : entry.id === where.id,
        );
        if (!user) return Promise.resolve(null);
        if (select?.id) return Promise.resolve({ id: user.id });
        if (include?.sellerProfile) {
          return Promise.resolve({
            ...user,
            sellerProfile: user.sellerProfile ?? null,
          });
        }
        return Promise.resolve(user);
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
            sellerProfile: { userId: shop.sellerProfile.userId },
          });
        }
        return Promise.resolve(shop);
      },
    );

    prismaMock.marketplaceCheckout.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: {
          checkoutCode?: string;
          customerUserId?: string | null;
          customerPhone?: string;
        };
      }) => {
        const checkout = checkouts.find(
          (entry) =>
            (!where.checkoutCode ||
              entry.checkoutCode === where.checkoutCode) &&
            (where.customerUserId === undefined ||
              entry.customerUserId === where.customerUserId) &&
            (!where.customerPhone ||
              entry.customerPhone === where.customerPhone),
        );
        if (!checkout) return Promise.resolve(null);
        return Promise.resolve({
          ...checkout,
          orders: orders
            .filter((order) => order.marketplaceCheckoutId === checkout.id)
            .map((order) => ({
              ...order,
              shop: {
                id: order.shopId,
                name:
                  shops.find((shop) => shop.id === order.shopId)?.name ??
                  order.shopId,
                paymentInstructions:
                  shops.find((shop) => shop.id === order.shopId)
                    ?.paymentInstructions ?? null,
              },
              deliveryShipments: [],
            })),
          supportCases: supportCases
            .filter((entry) => entry.checkoutId === checkout.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        });
      },
    );

    prismaMock.supportCase.create.mockImplementation(
      ({ data }: { data: any }) => {
        const supportCase: StoredSupportCase = {
          id: `case-${caseSequence++}`,
          checkoutId: data.checkoutId,
          checkoutCode: data.checkoutCode,
          orderId: data.orderId ?? null,
          shopId: data.shopId ?? null,
          customerUserId: data.customerUserId ?? null,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail ?? null,
          issueType: data.issueType,
          status: data.status,
          priority: data.priority,
          subject: data.subject,
          description: data.description,
          resolutionNote: data.resolutionNote ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          resolvedAt: null,
          closedAt: null,
        };
        supportCases.push(supportCase);
        if (data.messages?.create) {
          supportCaseMessages.push({
            id: `message-${messageSequence++}`,
            caseId: supportCase.id,
            senderUserId: data.messages.create.senderUserId ?? null,
            senderRole: data.messages.create.senderRole,
            message: data.messages.create.message,
            isInternal: data.messages.create.isInternal ?? false,
            createdAt: new Date(),
          });
        }
        if (data.events?.create) {
          supportCaseEvents.push({
            id: `event-${eventSequence++}`,
            caseId: supportCase.id,
            actorUserId: data.events.create.actorUserId ?? null,
            action: data.events.create.action,
            fromStatus: data.events.create.fromStatus ?? null,
            toStatus: data.events.create.toStatus ?? null,
            note: data.events.create.note ?? null,
            createdAt: new Date(),
          });
        }
        return Promise.resolve(buildCaseView(supportCase));
      },
    );

    prismaMock.supportCase.findMany.mockImplementation(
      ({ where }: { where?: any }) =>
        Promise.resolve(
          supportCases
            .filter((entry) => {
              if (
                where?.customerUserId &&
                entry.customerUserId !== where.customerUserId
              )
                return false;
              if (where?.shopId && entry.shopId !== where.shopId) return false;
              if (where?.status && entry.status !== where.status) return false;
              if (where?.issueType && entry.issueType !== where.issueType)
                return false;
              if (where?.priority && entry.priority !== where.priority)
                return false;
              if (
                where?.checkoutCode &&
                entry.checkoutCode !== where.checkoutCode
              )
                return false;
              return true;
            })
            .map((entry) => buildCaseView(entry)),
        ),
    );

    prismaMock.supportCase.count.mockImplementation(
      ({ where }: { where?: any }) =>
        Promise.resolve(
          supportCases.filter((entry) => {
            if (
              where?.customerUserId &&
              entry.customerUserId !== where.customerUserId
            )
              return false;
            if (where?.shopId && entry.shopId !== where.shopId) return false;
            if (where?.status && entry.status !== where.status) return false;
            if (where?.issueType && entry.issueType !== where.issueType)
              return false;
            if (where?.priority && entry.priority !== where.priority)
              return false;
            if (
              where?.checkoutCode &&
              entry.checkoutCode !== where.checkoutCode
            )
              return false;
            return true;
          }).length,
        ),
    );

    prismaMock.supportCase.findFirst.mockImplementation(
      ({ where }: { where: any }) => {
        const entry =
          supportCases.find((candidate) => {
            if (where.id && candidate.id !== where.id) return false;
            if (
              where.customerUserId &&
              candidate.customerUserId !== where.customerUserId
            )
              return false;
            if (where.shopId && candidate.shopId !== where.shopId) return false;
            return true;
          }) ?? null;
        return Promise.resolve(entry ? buildCaseView(entry) : null);
      },
    );

    prismaMock.supportCase.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const entry =
          supportCases.find((candidate) => candidate.id === where.id) ?? null;
        return Promise.resolve(entry ? buildCaseView(entry) : null);
      },
    );

    prismaMock.supportCase.update.mockImplementation(
      ({ where, data }: { where: { id: string }; data: any }) => {
        const entry = supportCases.find(
          (candidate) => candidate.id === where.id,
        );
        if (!entry) {
          throw new Error('Support case not found');
        }
        if (data.status !== undefined) entry.status = data.status;
        if (data.priority !== undefined) entry.priority = data.priority;
        if (data.resolutionNote !== undefined)
          entry.resolutionNote = data.resolutionNote;
        if (data.resolvedAt !== undefined) entry.resolvedAt = data.resolvedAt;
        if (data.closedAt !== undefined) entry.closedAt = data.closedAt;
        entry.updatedAt = new Date();
        if (data.messages?.create) {
          supportCaseMessages.push({
            id: `message-${messageSequence++}`,
            caseId: entry.id,
            senderUserId: data.messages.create.senderUserId ?? null,
            senderRole: data.messages.create.senderRole,
            message: data.messages.create.message,
            isInternal: data.messages.create.isInternal ?? false,
            createdAt: new Date(),
          });
        }
        if (data.events?.create) {
          supportCaseEvents.push({
            id: `event-${eventSequence++}`,
            caseId: entry.id,
            actorUserId: data.events.create.actorUserId ?? null,
            action: data.events.create.action,
            fromStatus: data.events.create.fromStatus ?? null,
            toStatus: data.events.create.toStatus ?? null,
            note: data.events.create.note ?? null,
            createdAt: new Date(),
          });
        }
        return Promise.resolve(buildCaseView(entry));
      },
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
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  async function login(email: string, password = 'password123') {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return readBody<AuthResponseDto>(response);
  }

  it('customer creates checkout-level support case and receipt includes summary', async () => {
    const customer = await login('customer-1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/customer/checkouts/CHK-SUPPORT-1/support-cases')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        issueType: 'DELIVERY_DELAY',
        subject: 'Where is my parcel?',
        description: 'The combined checkout is late.',
      })
      .expect(201);

    const created = readBody<any>(createResponse);
    expect(created.orderId).toBeNull();
    expect(created.status).toBe('OPEN');
    expect(created.messages).toHaveLength(1);

    const receiptResponse = await request(app.getHttpServer())
      .get('/api/customer/orders/CHK-SUPPORT-1')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(200);

    const receipt = readBody<any>(receiptResponse);
    expect(receipt.supportCases).toHaveLength(1);
    expect(receipt.supportCases[0].subject).toBe('Where is my parcel?');
  });

  it('customer cannot create case for another customer checkout', async () => {
    const customer = await login('customer-1@example.com');

    await request(app.getHttpServer())
      .post('/api/customer/checkouts/CHK-SUPPORT-2/support-cases')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        issueType: 'OTHER',
        subject: 'Unauthorized',
        description: 'Should fail.',
      })
      .expect(404);
  });

  it('customer creates order-linked case and seller visibility is isolated', async () => {
    const customer = await login('customer-1@example.com');
    const sellerA = await login('seller-1@example.com');
    const sellerB = await login('seller-2@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/customer/checkouts/CHK-SUPPORT-1/support-cases')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        orderId: '11111111-1111-4111-8111-111111111111',
        issueType: 'WRONG_ITEM',
        subject: 'Wrong item arrived',
        description: 'Shop one sent the wrong SKU.',
      })
      .expect(201);

    const created = readBody<any>(createResponse);
    expect(created.order.orderCode).toBe('ORD-SUPPORT-1');

    const sellerList = await request(app.getHttpServer())
      .get('/api/shops/shop-1/support-cases')
      .set('Authorization', `Bearer ${sellerA.accessToken}`)
      .expect(200);
    expect(readBody<any>(sellerList).items).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/shops/shop-2/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${sellerB.accessToken}`)
      .expect(404);
  });

  it('admin public and internal messages are filtered for customer and seller', async () => {
    const customer = await login('customer-1@example.com');
    const admin = await login('admin@example.com');
    const seller = await login('seller-1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/customer/checkouts/CHK-SUPPORT-1/support-cases')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        orderId: '11111111-1111-4111-8111-111111111111',
        issueType: 'PAYMENT_PROOF',
        subject: 'Need payment confirmation',
        description: 'Please review proof.',
      })
      .expect(201);

    const created = readBody<any>(createResponse);

    await request(app.getHttpServer())
      .post(`/api/admin/support-cases/${created.id}/messages`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ message: 'Internal note only.', isInternal: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/support-cases/${created.id}/messages`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ message: 'Public update for customer.', isInternal: false })
      .expect(201);

    const customerView = await request(app.getHttpServer())
      .get(`/api/customer/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(200);
    const customerBody = readBody<any>(customerView);
    expect(customerBody.messages.map((entry: any) => entry.message)).toEqual(
      expect.arrayContaining([
        'Please review proof.',
        'Public update for customer.',
      ]),
    );
    expect(
      customerBody.messages.map((entry: any) => entry.message),
    ).not.toContain('Internal note only.');

    const sellerView = await request(app.getHttpServer())
      .get(`/api/shops/shop-1/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(200);
    expect(
      readBody<any>(sellerView).messages.map((entry: any) => entry.message),
    ).not.toContain('Internal note only.');

    const adminView = await request(app.getHttpServer())
      .get(`/api/admin/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(
      readBody<any>(adminView).messages.map((entry: any) => entry.message),
    ).toContain('Internal note only.');
  });

  it('admin update respects status workflow and seller can reply', async () => {
    const customer = await login('customer-1@example.com');
    const admin = await login('admin@example.com');
    const seller = await login('seller-1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/customer/checkouts/CHK-SUPPORT-1/support-cases')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        orderId: '11111111-1111-4111-8111-111111111111',
        issueType: 'DAMAGED_ITEM',
        subject: 'Damaged product',
        description: 'Box arrived broken.',
      })
      .expect(201);

    const created = readBody<any>(createResponse);

    await request(app.getHttpServer())
      .patch(`/api/admin/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'RESOLVED' })
      .expect(400);

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/support-cases/${created.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'IN_REVIEW', priority: 'HIGH' })
      .expect(200);

    expect(readBody<any>(updated).status).toBe('IN_REVIEW');

    const sellerReply = await request(app.getHttpServer())
      .post(`/api/shops/shop-1/support-cases/${created.id}/messages`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ message: 'Seller acknowledged and will replace item.' })
      .expect(201);

    expect(
      readBody<any>(sellerReply).messages.map((entry: any) => entry.message),
    ).toContain('Seller acknowledged and will replace item.');
  });
});
