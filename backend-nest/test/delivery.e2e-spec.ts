/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { DeliveryDetailResponseDto } from '../src/modules/delivery/dto/delivery-detail-response.dto';
import { DeliveryOffersResponseDto } from '../src/modules/delivery/dto/delivery-offers-response.dto';
import { DeliverySettingsResponseDto } from '../src/modules/delivery/dto/delivery-settings-response.dto';
import { DeliveryShipmentResponseDto } from '../src/modules/delivery/dto/delivery-shipment-response.dto';
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
  sellerProfile: { userId: string };
};

type StoredDeliverySetting = {
  id: string;
  shopId: string;
  pickupCountry: string;
  pickupAddress: string;
  pickupCity: string;
  pickupPostalCode: string | null;
  pickupLatitude: DecimalLike | null;
  pickupLongitude: DecimalLike | null;
  pickupContactPhone: string;
  pickupContactName: string;
  pickupWorkingHours: string | null;
  pickupComment: string | null;
  enabledCarriers: Prisma.JsonValue;
  defaultCarrier: string;
  sameCityPreferredCarrier: string;
  interCityPreferredCarrier: string;
  fallbackCarrier: string;
  defaultWeightGram: number;
  defaultLengthCm: number;
  defaultWidthCm: number;
  defaultHeightCm: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredDeliveryOffer = {
  id: string;
  shopId: string;
  orderId: string;
  provider: string;
  offerType: string;
  priceAmount: DecimalLike;
  priceCurrency: string;
  estimatedMinMinutes: number | null;
  estimatedMaxMinutes: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  pickupPointId: string | null;
  isRecommended: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

type StoredDeliveryEvent = {
  id: string;
  deliveryShipmentId: string;
  shopId: string;
  orderId: string;
  provider: string;
  eventType: string;
  providerStatus: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  action: string | null;
  oldStatus: string | null;
  newStatus: string | null;
  message: string | null;
  createdAt: Date;
};

type StoredDeliveryComment = {
  id: string;
  deliveryShipmentId: string;
  orderId: string;
  actorUserId: string | null;
  actorRole: string;
  visibility: string;
  message: string;
  createdAt: Date;
};

type StoredDeliveryShipment = {
  id: string;
  shopId: string;
  orderId: string;
  provider: string;
  providerShipmentId: string | null;
  providerOrderNumber: string | null;
  providerStatus: string;
  internalStatus: string;
  priceAmount: DecimalLike | null;
  priceCurrency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  courierPhone: string | null;
  estimatedDeliveryAt: Date | null;
  deliveryNote: string | null;
  failureReasonCode: string | null;
  failureReasonText: string | null;
  failedAt: Date | null;
  customerVisibleMessage: string | null;
  lastAdminNote: string | null;
  lastSellerNote: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  rawProviderPayload: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  deliveredAt: Date | null;
};

type StoredOrder = {
  id: string;
  shopId: string;
  customerId: string;
  orderNumber: string;
  paymentStatus: string;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  status?: string;
  totalAmount?: DecimalLike;
  createdAt?: Date;
};

describe('DeliveryController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let settings: StoredDeliverySetting[];
  let orders: StoredOrder[];
  let offers: StoredDeliveryOffer[];
  let shipments: StoredDeliveryShipment[];
  let events: StoredDeliveryEvent[];
  let comments: StoredDeliveryComment[];

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    order: { findFirst: jest.fn(), findMany: jest.fn() },
    shopDeliverySetting: { findUnique: jest.fn(), upsert: jest.fn() },
    deliveryOffer: { deleteMany: jest.fn(), create: jest.fn() },
    deliveryShipment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    paymentReviewLog: { findMany: jest.fn() },
    deliveryEvent: { create: jest.fn(), findMany: jest.fn() },
    deliveryComment: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'admin-user-1',
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
        sellerProfile: { userId: 'seller-user-1' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp-2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        sellerProfile: { userId: 'seller-user-2' },
      },
    ];

    settings = [];
    offers = [];
    shipments = [];
    events = [];
    comments = [];
    orders = [
      {
        id: 'order-paid',
        shopId: 'shop-1',
        customerId: 'customer-1',
        orderNumber: 'ORD-DEL-1001',
        paymentStatus: 'PAID',
        shippingAddress: 'Lenina 10, Moscow',
        customerName: 'Alice',
        customerPhone: '+79990000001',
      },
      {
        id: 'order-unpaid',
        shopId: 'shop-1',
        customerId: 'customer-2',
        orderNumber: 'ORD-DEL-1002',
        paymentStatus: 'PENDING',
        shippingAddress: 'Nevsky 5, Moscow',
        customerName: 'Bob',
        customerPhone: '+79990000002',
      },
      {
        id: 'order-other-shop',
        shopId: 'shop-2',
        customerId: 'customer-3',
        orderNumber: 'ORD-DEL-2001',
        paymentStatus: 'PAID',
        shippingAddress: 'Arbat 7, Kazan',
        customerName: 'Carol',
        customerPhone: '+79990000003',
      },
    ];

    prismaMock.user.findUnique.mockImplementation(({ where, include }) => {
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
    });

    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      const shop = shops.find((entry) => entry.id === where.id) ?? null;
      if (!shop) return Promise.resolve(null);
      if (select?.sellerProfile) {
        return Promise.resolve({
          id: shop.id,
          sellerProfile: shop.sellerProfile,
        });
      }
      return Promise.resolve(shop);
    });

    prismaMock.shopDeliverySetting.findUnique.mockImplementation(
      ({ where }) => {
        return Promise.resolve(
          settings.find((entry) => entry.shopId === where.shopId) ?? null,
        );
      },
    );

    prismaMock.shopDeliverySetting.upsert.mockImplementation(
      ({ where, update, create }) => {
        const existingIndex = settings.findIndex(
          (entry) => entry.shopId === where.shopId,
        );
        const now = new Date();
        if (existingIndex >= 0) {
          settings[existingIndex] = {
            ...settings[existingIndex],
            ...normalizeSettingData(update),
            updatedAt: now,
          };
          return Promise.resolve(settings[existingIndex]);
        }

        const next: StoredDeliverySetting = {
          id: create.id,
          shopId: create.shopId,
          ...normalizeSettingData(create),
          createdAt: now,
          updatedAt: now,
        };
        settings.push(next);
        return Promise.resolve(next);
      },
    );

    const adminOrderFor = (orderId: string) => {
      const order = orders.find((entry) => entry.id === orderId);
      if (!order) throw new Error(`Missing order ${orderId}`);
      const shop = shops.find((entry) => entry.id === order.shopId);
      if (!shop) throw new Error(`Missing shop ${order.shopId}`);
      const seller = users.find(
        (entry) => entry.id === shop.sellerProfile.userId,
      );
      return {
        ...order,
        status: order.status ?? 'NEW',
        customerEmail: order.customerEmail ?? null,
        totalAmount: order.totalAmount ?? new Prisma.Decimal('100'),
        createdAt: order.createdAt ?? new Date(),
        shop: {
          id: shop.id,
          name: shop.name,
          sellerProfile: {
            userId: shop.sellerProfile.userId,
            user: {
              email: seller?.email ?? 'seller@example.com',
              fullName: seller?.fullName ?? null,
            },
          },
        },
      };
    };

    prismaMock.order.findFirst.mockImplementation(({ where }) => {
      const order = orders.find((entry) => {
        if (where.id && entry.id !== where.id) return false;
        if (where.shopId && entry.shopId !== where.shopId) return false;
        if (where.orderNumber && entry.orderNumber !== where.orderNumber)
          return false;
        return true;
      });
      if (!order) return Promise.resolve(null);

      const shop = shops.find((entry) => entry.id === order.shopId);
      if (!shop) return Promise.resolve(null);
      const shopSetting =
        settings.find((entry) => entry.shopId === order.shopId) ?? null;
      const orderOffers = offers
        .filter((entry) => entry.orderId === order.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const orderShipments = shipments
        .filter((entry) => entry.orderId === order.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((shipment) => ({
          ...shipment,
          events: events
            .filter((event) => event.deliveryShipmentId === shipment.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          comments: comments
            .filter((comment) => comment.deliveryShipmentId === shipment.id)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        }));

      return Promise.resolve({
        ...order,
        status: order.status ?? 'NEW',
        customerEmail: order.customerEmail ?? null,
        totalAmount: order.totalAmount ?? new Prisma.Decimal('100'),
        createdAt: order.createdAt ?? new Date(),
        shop: {
          id: shop.id,
          deliverySettings: shopSetting,
        },
        deliveryOffers: orderOffers,
        deliveryShipments: orderShipments,
      });
    });

    prismaMock.order.findMany.mockImplementation(({ where }) => {
      let rows = orders;
      if (where?.paymentStatus) {
        rows = rows.filter(
          (entry) => entry.paymentStatus === where.paymentStatus,
        );
      }
      if (where?.shopId) {
        rows = rows.filter((entry) => entry.shopId === where.shopId);
      }
      rows = rows.filter((entry) => {
        const activeShipment = shipments.find(
          (shipment) =>
            shipment.orderId === entry.id &&
            !['CANCELLED', 'DELIVERED', 'FAILED'].includes(
              shipment.internalStatus,
            ),
        );
        return !activeShipment;
      });
      return Promise.resolve(rows.map((order) => adminOrderFor(order.id)));
    });

    prismaMock.deliveryOffer.deleteMany.mockImplementation(({ where }) => {
      offers = offers.filter((entry) => entry.orderId !== where.orderId);
      return Promise.resolve({ count: 1 });
    });

    prismaMock.deliveryOffer.create.mockImplementation(({ data }) => {
      const next: StoredDeliveryOffer = {
        id: data.id,
        shopId: data.shopId,
        orderId: data.orderId,
        provider: data.provider,
        offerType: data.offerType,
        priceAmount: data.priceAmount,
        priceCurrency: data.priceCurrency,
        estimatedMinMinutes: data.estimatedMinMinutes ?? null,
        estimatedMaxMinutes: data.estimatedMaxMinutes ?? null,
        estimatedMinDays: data.estimatedMinDays ?? null,
        estimatedMaxDays: data.estimatedMaxDays ?? null,
        pickupPointId: data.pickupPointId ?? null,
        isRecommended: data.isRecommended ?? false,
        expiresAt: data.expiresAt ?? null,
        createdAt: new Date(),
      };
      offers.push(next);
      return Promise.resolve(next);
    });

    prismaMock.deliveryShipment.create.mockImplementation(({ data }) => {
      const next: StoredDeliveryShipment = {
        id: data.id,
        shopId: data.shopId,
        orderId: data.orderId,
        provider: data.provider,
        providerShipmentId: data.providerShipmentId ?? null,
        providerOrderNumber: data.providerOrderNumber ?? null,
        providerStatus: data.providerStatus,
        internalStatus: data.internalStatus,
        priceAmount: data.priceAmount ?? null,
        priceCurrency: data.priceCurrency,
        trackingNumber: data.trackingNumber ?? null,
        trackingUrl: data.trackingUrl ?? null,
        courierPhone: data.courierPhone ?? null,
        estimatedDeliveryAt: data.estimatedDeliveryAt ?? null,
        deliveryNote: data.deliveryNote ?? null,
        failureReasonCode: data.failureReasonCode ?? null,
        failureReasonText: data.failureReasonText ?? null,
        failedAt: data.failedAt ?? null,
        customerVisibleMessage: data.customerVisibleMessage ?? null,
        lastAdminNote: data.lastAdminNote ?? null,
        lastSellerNote: data.lastSellerNote ?? null,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        rawProviderPayload: data.rawProviderPayload ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        acceptedAt: data.acceptedAt ?? null,
        cancelledAt: data.cancelledAt ?? null,
        deliveredAt: data.deliveredAt ?? null,
      };
      shipments.push(next);
      return Promise.resolve(next);
    });

    prismaMock.deliveryShipment.findFirst.mockImplementation(({ where }) => {
      return Promise.resolve(
        shipments.find(
          (entry) =>
            entry.id === where.id &&
            entry.shopId === where.shopId &&
            entry.orderId === where.orderId,
        ) ?? null,
      );
    });

    prismaMock.deliveryShipment.findUnique.mockImplementation(
      ({ where, include }) => {
        const shipment =
          shipments.find((entry) => entry.id === where.id) ?? null;
        if (shipment && include) {
          return Promise.resolve({
            ...shipment,
            order: adminOrderFor(shipment.orderId),
            events: events.filter(
              (event) => event.deliveryShipmentId === shipment.id,
            ),
            comments: comments.filter(
              (comment) => comment.deliveryShipmentId === shipment.id,
            ),
          });
        }
        return Promise.resolve(shipment);
      },
    );

    prismaMock.deliveryShipment.findMany.mockImplementation(({ where }) => {
      let rows = [...shipments];
      if (where?.internalStatus) {
        if (typeof where.internalStatus === 'string') {
          rows = rows.filter(
            (entry) => entry.internalStatus === where.internalStatus,
          );
        } else if ('in' in where.internalStatus) {
          rows = rows.filter((entry) =>
            (where.internalStatus.in as string[]).includes(
              entry.internalStatus,
            ),
          );
        }
      }
      if (where?.provider) {
        rows = rows.filter((entry) => entry.provider === where.provider);
      }
      if (where?.shopId) {
        rows = rows.filter((entry) => entry.shopId === where.shopId);
      }
      return Promise.resolve(
        rows.map((shipment) => ({
          ...shipment,
          order: adminOrderFor(shipment.orderId),
          events: events.filter(
            (event) => event.deliveryShipmentId === shipment.id,
          ),
          comments: comments.filter(
            (comment) => comment.deliveryShipmentId === shipment.id,
          ),
        })),
      );
    });

    prismaMock.deliveryShipment.update.mockImplementation(({ where, data }) => {
      const index = shipments.findIndex((entry) => entry.id === where.id);
      if (index === -1) {
        throw new Error('Shipment not found');
      }
      shipments[index] = {
        ...shipments[index],
        ...data,
        updatedAt: new Date(),
      };
      return Promise.resolve(shipments[index]);
    });

    prismaMock.deliveryEvent.create.mockImplementation(({ data }) => {
      const event: StoredDeliveryEvent = {
        id: data.id,
        deliveryShipmentId: data.deliveryShipmentId,
        shopId: data.shopId,
        orderId: data.orderId,
        provider: data.provider,
        eventType: data.eventType,
        providerStatus: data.providerStatus ?? null,
        actorUserId: data.actorUserId ?? null,
        actorRole: data.actorRole ?? null,
        action: data.action ?? null,
        oldStatus: data.oldStatus ?? null,
        newStatus: data.newStatus ?? null,
        message: data.message ?? null,
        createdAt: new Date(),
      };
      events.push(event);
      return Promise.resolve(event);
    });

    prismaMock.deliveryEvent.findMany.mockImplementation(() =>
      Promise.resolve(events),
    );

    prismaMock.deliveryComment.create.mockImplementation(({ data }) => {
      const comment: StoredDeliveryComment = {
        id: data.id,
        deliveryShipmentId: data.deliveryShipmentId,
        orderId: data.orderId,
        actorUserId: data.actorUserId ?? null,
        actorRole: data.actorRole,
        visibility: data.visibility,
        message: data.message,
        createdAt: new Date(),
      };
      comments.push(comment);
      return Promise.resolve(comment);
    });

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

  it('updates delivery settings for a shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .patch('/api/shops/shop-1/delivery/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(validSettingsPayload())
      .expect(200);

    const body = readBody<DeliverySettingsResponseDto>(response);
    expect(body.pickupCity).toBe('Moscow');
    expect(body.defaultCarrier).toBe('YANDEX');
    expect(body.sameCityPreferredCarrier).toBe('YANDEX');
    expect(body.interCityPreferredCarrier).toBe('CDEK');
    expect(body.enabledCarriers).toEqual(['CDEK', 'YANDEX']);
  });

  it('calculates same-city mock offers with Yandex recommended', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const body = readBody<DeliveryOffersResponseDto>(response);
    expect(body.offers).toHaveLength(2);
    expect(body.offers.find((offer) => offer.isRecommended)?.provider).toBe(
      'YANDEX',
    );
    expect(
      body.offers.some((offer) => offer.offerType === 'CDEK_COURIER'),
    ).toBe(true);
  });

  it('calculates inter-city mock offers with CDEK recommended', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-other-shop/delivery/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404);

    expect(response.status).toBe(404);

    orders.push({
      id: 'order-intercity',
      shopId: 'shop-1',
      customerId: 'customer-4',
      orderNumber: 'ORD-DEL-1003',
      paymentStatus: 'PAID',
      shippingAddress: 'Baumana 1, Kazan',
      customerName: 'Dan',
      customerPhone: '+79990000004',
    });

    const interCityResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-intercity/delivery/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const body = readBody<DeliveryOffersResponseDto>(interCityResponse);
    expect(body.offers.find((offer) => offer.isRecommended)?.provider).toBe(
      'CDEK',
    );
    expect(body.offers.some((offer) => offer.offerType === 'CDEK_PICKUP')).toBe(
      true,
    );
  });

  it('creates, refreshes, and cancels a mock shipment', async () => {
    await setSettings(app);
    await calculateOffers(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'YANDEX' })
      .expect(201);
    const created = readBody<DeliveryShipmentResponseDto>(createResponse);
    expect(created.provider).toBe('YANDEX');
    expect(created.providerStatus).toBe('CREATED');

    const acceptResponse = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/accept`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(
      readBody<DeliveryShipmentResponseDto>(acceptResponse).internalStatus,
    ).toBe('ACCEPTED');

    const refreshResponse = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/refresh`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(
      readBody<DeliveryShipmentResponseDto>(refreshResponse).internalStatus,
    ).toBe('IN_TRANSIT');

    const cancelResponse = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/cancel`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Customer changed mind.' })
      .expect(201);
    expect(
      readBody<DeliveryShipmentResponseDto>(cancelResponse).internalStatus,
    ).toBe('CANCELLED');
  });

  it('returns delivery detail with offers and active shipment', async () => {
    await setSettings(app);
    await calculateOffers(app);
    await createShipment(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/orders/order-paid/delivery')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<DeliveryDetailResponseDto>(response);
    expect(body.activeShipment?.provider).toBe('YANDEX');
    expect(body.offers.length).toBeGreaterThan(0);
    expect(body.events[0].eventType).toBe('SHIPMENT_CREATED');
  });

  it('rejects shipment creation when order is unpaid', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-unpaid/delivery/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'CDEK' })
      .expect(400);
  });

  it('rejects shipment creation when settings are missing', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'CDEK' })
      .expect(400);
  });

  it('rejects duplicate active shipment for the same order', async () => {
    await setSettings(app);
    await calculateOffers(app);
    await createShipment(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'CDEK' })
      .expect(400);
  });

  it('forbids cross-shop delivery access', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .get('/api/shops/shop-2/delivery/settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('creates seller-managed manual delivery and writes audit events', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'YANDEX',
        trackingNumber: 'YANDEX-MANUAL-1',
        trackingUrl: 'https://track.example/yandex-manual-1',
        courierPhone: '+79991112233',
        deliveryNote: 'Seller created shipment in Yandex dashboard.',
      })
      .expect(201);

    const created = readBody<DeliveryShipmentResponseDto>(createResponse);
    expect(created.internalStatus).toBe('CREATED_MANUALLY');
    expect(created.trackingNumber).toBe('YANDEX-MANUAL-1');
    expect(events.at(-1)?.actorUserId).toBe('seller-user-1');
    expect(events.at(-1)?.oldStatus).toBe('NOT_CREATED');
  });

  it('rejects manual delivery creation when order is unpaid', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post('/api/shops/shop-1/orders/order-unpaid/delivery/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'YANDEX', trackingNumber: 'UNPAID-1' })
      .expect(400);
  });

  it('marks seller-managed delivery delivered and rejects cancelling delivered', async () => {
    await setSettings(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const created = await createManualDelivery(app);

    const deliveredResponse = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/mark-delivered`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Delivered by seller.' })
      .expect(201);

    expect(
      readBody<DeliveryShipmentResponseDto>(deliveredResponse).internalStatus,
    ).toBe('DELIVERED');

    await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/cancel`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Too late.' })
      .expect(400);
  });

  it('lists paid orders without delivery for admin supervision', async () => {
    const adminToken = await loginAndGetToken(app, 'admin@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/admin/deliveries?paidWithoutDelivery=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      readBody<{ items: Array<{ orderId: string; internalStatus: string }> }>(
        response,
      ).items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: 'order-paid',
          internalStatus: 'NOT_CREATED',
        }),
      ]),
    );
  });

  it('allows admin to override manual delivery status', async () => {
    await setSettings(app);
    const created = await createManualDelivery(app);
    const adminToken = await loginAndGetToken(app, 'admin@example.com');

    const response = await request(app.getHttpServer())
      .post(`/api/admin/deliveries/${created.id}/mark-in-transit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Admin override.' })
      .expect(201);

    expect(readBody<{ internalStatus: string }>(response).internalStatus).toBe(
      'IN_TRANSIT',
    );
    expect(events.at(-1)?.actorRole).toBe('ADMIN');
    expect(events.at(-1)?.oldStatus).toBe('CREATED_MANUALLY');
  });

  it('seller marks delivery failed with reason and audit event', async () => {
    await setSettings(app);
    const created = await createManualDelivery(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/mark-failed`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        reasonCode: 'CUSTOMER_UNAVAILABLE',
        reasonText: 'Customer did not answer courier calls.',
        customerVisibleMessage: 'Courier could not reach you today.',
      })
      .expect(201);

    const body = readBody<DeliveryShipmentResponseDto>(response);
    expect(body.internalStatus).toBe('FAILED');
    expect(body.failureReasonCode).toBe('CUSTOMER_UNAVAILABLE');
    expect(body.customerVisibleMessage).toBe(
      'Courier could not reach you today.',
    );
    expect(events.at(-1)?.eventType).toBe('MANUAL_DELIVERY_FAILED');
    expect(events.at(-1)?.actorUserId).toBe('seller-user-1');
  });

  it('seller cannot mark delivered shipment failed', async () => {
    await setSettings(app);
    const created = await createManualDelivery(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/mark-delivered`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Delivered.' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/mark-failed`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ reasonCode: 'OTHER', reasonText: 'Too late.' })
      .expect(400);
  });

  it('seller adds internal comment and customer-visible comment updates shipment message', async () => {
    await setSettings(app);
    const created = await createManualDelivery(app);
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/comments`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({ visibility: 'INTERNAL', message: 'Call customer after 18:00.' })
      .expect(201);

    const visibleResponse = await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${created.id}/comments`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        visibility: 'CUSTOMER_VISIBLE',
        message: 'We will contact you to arrange a new delivery window.',
      })
      .expect(201);

    expect(readBody<{ visibility: string }>(visibleResponse).visibility).toBe(
      'CUSTOMER_VISIBLE',
    );
    expect(comments).toHaveLength(2);
    expect(events.at(-1)?.eventType).toBe('DELIVERY_COMMENT_ADDED');
  });

  it('admin exceptionOnly sees failed and cancelled deliveries', async () => {
    await setSettings(app);
    const failed = await createManualDelivery(app);
    shipments.push({
      ...shipments[0],
      id: 'shipment-cancelled',
      internalStatus: 'CANCELLED',
      providerStatus: 'CANCELLED',
      cancelledAt: new Date(),
      failureReasonCode: 'SELLER_CANCELLED',
    });
    const sellerToken = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .post(
        `/api/shops/shop-1/orders/order-paid/delivery/shipments/${failed.id}/mark-failed`,
      )
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ reasonCode: 'LOST_PACKAGE' })
      .expect(201);

    const adminToken = await loginAndGetToken(app, 'admin@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/admin/deliveries?exceptionOnly=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = readBody<{ items: Array<{ internalStatus: string }> }>(
      response,
    );
    expect(body.items.map((item) => item.internalStatus)).toEqual(
      expect.arrayContaining(['FAILED', 'CANCELLED']),
    );
  });

  it('admin overrides customer-visible message', async () => {
    await setSettings(app);
    const created = await createManualDelivery(app);
    const adminToken = await loginAndGetToken(app, 'admin@example.com');

    const response = await request(app.getHttpServer())
      .patch(`/api/admin/deliveries/${created.id}/customer-message`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerVisibleMessage: 'Admin updated customer message.' })
      .expect(200);

    expect(
      readBody<{ customerVisibleMessage: string }>(response)
        .customerVisibleMessage,
    ).toBe('Admin updated customer message.');
    expect(events.at(-1)?.eventType).toBe(
      'ADMIN_DELIVERY_CUSTOMER_MESSAGE_UPDATED',
    );
  });

  async function setSettings(testApp: INestApplication<App>) {
    const token = await loginAndGetToken(testApp, 'seller1@example.com');
    await request(testApp.getHttpServer())
      .patch('/api/shops/shop-1/delivery/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(validSettingsPayload())
      .expect(200);
  }

  async function calculateOffers(testApp: INestApplication<App>) {
    const token = await loginAndGetToken(testApp, 'seller1@example.com');
    await request(testApp.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
  }

  async function createShipment(testApp: INestApplication<App>) {
    const token = await loginAndGetToken(testApp, 'seller1@example.com');
    await request(testApp.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({ provider: 'YANDEX' })
      .expect(201);
  }

  async function createManualDelivery(testApp: INestApplication<App>) {
    const token = await loginAndGetToken(testApp, 'seller1@example.com');
    const response = await request(testApp.getHttpServer())
      .post('/api/shops/shop-1/orders/order-paid/delivery/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider: 'YANDEX',
        trackingNumber: 'YANDEX-MANUAL-2',
        trackingUrl: 'https://track.example/yandex-manual-2',
      })
      .expect(201);
    return readBody<DeliveryShipmentResponseDto>(response);
  }
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}

function validSettingsPayload() {
  return {
    pickupAddress: 'Tverskaya 1',
    pickupCity: 'Moscow',
    pickupPostalCode: '101000',
    pickupContactPhone: '+74950000000',
    pickupContactName: 'Seller Ops',
    enabledCarriers: ['CDEK', 'YANDEX'],
    defaultCarrier: 'YANDEX',
    sameCityPreferredCarrier: 'YANDEX',
    interCityPreferredCarrier: 'CDEK',
    fallbackCarrier: 'CDEK',
    defaultWeightGram: 1200,
    defaultLengthCm: 30,
    defaultWidthCm: 20,
    defaultHeightCm: 10,
  };
}

function normalizeSettingData(
  input: Record<string, unknown>,
): Omit<StoredDeliverySetting, 'id' | 'shopId' | 'createdAt' | 'updatedAt'> {
  return {
    pickupCountry: toScalarString(input.pickupCountry) ?? 'RU',
    pickupAddress: String(input.pickupAddress),
    pickupCity: String(input.pickupCity),
    pickupPostalCode: toScalarString(input.pickupPostalCode),
    pickupLatitude: input.pickupLatitude
      ? decimalLike(input.pickupLatitude)
      : null,
    pickupLongitude: input.pickupLongitude
      ? decimalLike(input.pickupLongitude)
      : null,
    pickupContactPhone: String(input.pickupContactPhone),
    pickupContactName: String(input.pickupContactName),
    pickupWorkingHours: toScalarString(input.pickupWorkingHours),
    pickupComment: toScalarString(input.pickupComment),
    enabledCarriers: (input.enabledCarriers as Prisma.JsonValue) ?? ['CDEK'],
    defaultCarrier: String(input.defaultCarrier),
    sameCityPreferredCarrier:
      toScalarString(input.sameCityPreferredCarrier) ?? 'YANDEX',
    interCityPreferredCarrier:
      toScalarString(input.interCityPreferredCarrier) ?? 'CDEK',
    fallbackCarrier: toScalarString(input.fallbackCarrier) ?? 'CDEK',
    defaultWeightGram: Number(input.defaultWeightGram ?? 1000),
    defaultLengthCm: Number(input.defaultLengthCm ?? 30),
    defaultWidthCm: Number(input.defaultWidthCm ?? 20),
    defaultHeightCm: Number(input.defaultHeightCm ?? 10),
  };
}

function decimalLike(value: unknown): DecimalLike {
  return {
    toString: () => toScalarString(value) ?? '',
  };
}

function toScalarString(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
}
