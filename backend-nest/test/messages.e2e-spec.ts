import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { MessagesService } from '../src/modules/messages/messages.service';

function createPrismaMock() {
  return {
    shop: {
      findFirst: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    shopMessageThread: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
}

type NotificationsMock = {
  createNotification: jest.Mock;
  broadcastToAdmins: jest.Mock;
};

function createNotificationsMock() {
  return {
    createNotification: jest.fn().mockResolvedValue({}),
    broadcastToAdmins: jest.fn().mockResolvedValue({}),
  } satisfies NotificationsMock;
}

function expectCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(Error);
  const response =
    error instanceof BadRequestException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
      ? error.getResponse()
      : null;
  expect(response).toMatchObject({ code });
}

async function expectRejectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`Expected promise to reject with ${code}`);
  } catch (error) {
    expectCode(error, code);
  }
}

describe('MessagesService', () => {
  it('customer creates a thread only for an active approved shop', async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const service = new MessagesService(
      prisma,
      notifications as unknown as NotificationsService,
    );

    prisma.shop.findFirst = jest.fn().mockResolvedValue({
      id: 'shop-1',
      name: 'Demo shop',
      slug: 'demo-shop',
      sellerProfile: {
        user: {
          id: 'seller-1',
        },
      },
    });
    prisma.shopMessageThread.findFirst = jest.fn().mockResolvedValue(null);
    prisma.shopMessageThread.create = jest.fn().mockResolvedValue({
      id: 'thread-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      productId: null,
      orderId: null,
      status: 'OPEN',
      subject: 'Demo shop',
      lastMessageAt: new Date('2026-05-26T10:00:00.000Z'),
      lastCustomerReadAt: new Date('2026-05-26T10:00:00.000Z'),
      lastSellerReadAt: null,
      reportedAt: null,
      reportedReason: null,
      shop: {
        id: 'shop-1',
        name: 'Demo shop',
        slug: 'demo-shop',
        logoUrl: null,
      },
      product: null,
      order: null,
      customer: {
        id: 'customer-1',
        fullName: 'Customer One',
        email: 'customer@example.com',
        preferredLocale: 'ru',
      },
      seller: {
        id: 'seller-1',
        fullName: 'Seller One',
        email: 'seller@example.com',
        preferredLocale: 'en',
      },
      messages: [
        {
          id: 'message-1',
          senderRole: 'CUSTOMER',
          message: 'Hello',
          createdAt: new Date('2026-05-26T10:00:00.000Z'),
          senderCustomer: {
            id: 'customer-1',
            fullName: 'Customer One',
            email: 'customer@example.com',
          },
          senderSeller: null,
          senderAdmin: null,
        },
      ],
    });

    const result = await service.createCustomerThread(
      {
        userId: 'customer-1',
        role: 'CUSTOMER',
        email: 'customer@example.com',
        sub: 'customer-1',
      },
      {
        shopSlug: 'demo-shop',
        message: ' Hello ',
      },
    );

    expect(result).toMatchObject({
      id: 'thread-1',
      status: 'OPEN',
      shop: { slug: 'demo-shop' },
      messages: [{ senderRole: 'CUSTOMER', message: 'Hello' }],
    });
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });

  it('blocks empty messages', async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const service = new MessagesService(
      prisma,
      notifications as unknown as NotificationsService,
    );

    prisma.shop.findFirst = jest.fn().mockResolvedValue({
      id: 'shop-1',
      name: 'Demo shop',
      slug: 'demo-shop',
      sellerProfile: {
        user: { id: 'seller-1' },
      },
    });

    await expectRejectCode(
      service.createCustomerThread(
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
          sub: 'customer-1',
        },
        { shopSlug: 'demo-shop', message: '   ' },
      ),
      'MESSAGE_EMPTY',
    );
  });

  it('seller can only access own shop threads', async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const service = new MessagesService(
      prisma,
      notifications as unknown as NotificationsService,
    );

    prisma.shop.findFirst = jest.fn().mockResolvedValue(null);

    await expectRejectCode(
      service.listSellerThreads(
        'shop-1',
        {
          userId: 'seller-2',
          role: 'SELLER',
          email: 'seller@example.com',
          sub: 'seller-2',
        },
        {},
      ),
      'MESSAGE_FORBIDDEN',
    );
  });

  it('seller reply creates a customer notification', async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const service = new MessagesService(
      prisma,
      notifications as unknown as NotificationsService,
    );

    prisma.shop.findFirst = jest.fn().mockResolvedValue({ id: 'shop-1' });
    prisma.shopMessageThread.findFirst = jest.fn().mockResolvedValue({
      id: 'thread-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      productId: null,
      orderId: null,
      status: 'OPEN',
      subject: 'Demo shop',
      lastMessageAt: new Date('2026-05-26T10:00:00.000Z'),
      lastCustomerReadAt: new Date('2026-05-26T10:00:00.000Z'),
      lastSellerReadAt: null,
      reportedAt: null,
      reportedReason: null,
      shop: {
        id: 'shop-1',
        name: 'Demo shop',
        slug: 'demo-shop',
        logoUrl: null,
      },
      product: null,
      order: null,
      customer: {
        id: 'customer-1',
        fullName: 'Customer One',
        email: 'customer@example.com',
        preferredLocale: 'en',
      },
      seller: {
        id: 'seller-1',
        fullName: 'Seller One',
        email: 'seller@example.com',
        preferredLocale: 'vi',
      },
      messages: [
        {
          id: 'message-1',
          senderRole: 'CUSTOMER',
          message: 'Hello',
          createdAt: new Date('2026-05-26T10:00:00.000Z'),
          senderCustomer: {
            id: 'customer-1',
            fullName: 'Customer One',
            email: 'customer@example.com',
          },
          senderSeller: null,
          senderAdmin: null,
        },
      ],
    });
    prisma.shopMessageThread.update = jest.fn().mockResolvedValue({
      id: 'thread-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      productId: null,
      orderId: null,
      status: 'OPEN',
      subject: 'Demo shop',
      lastMessageAt: new Date('2026-05-26T10:02:00.000Z'),
      lastCustomerReadAt: new Date('2026-05-26T10:00:00.000Z'),
      lastSellerReadAt: new Date('2026-05-26T10:02:00.000Z'),
      reportedAt: null,
      reportedReason: null,
      shop: {
        id: 'shop-1',
        name: 'Demo shop',
        slug: 'demo-shop',
        logoUrl: null,
      },
      product: null,
      order: null,
      customer: {
        id: 'customer-1',
        fullName: 'Customer One',
        email: 'customer@example.com',
        preferredLocale: 'en',
      },
      seller: {
        id: 'seller-1',
        fullName: 'Seller One',
        email: 'seller@example.com',
        preferredLocale: 'vi',
      },
      messages: [
        {
          id: 'message-1',
          senderRole: 'CUSTOMER',
          message: 'Hello',
          createdAt: new Date('2026-05-26T10:00:00.000Z'),
          senderCustomer: {
            id: 'customer-1',
            fullName: 'Customer One',
            email: 'customer@example.com',
          },
          senderSeller: null,
          senderAdmin: null,
        },
        {
          id: 'message-2',
          senderRole: 'SELLER',
          message: 'Hi there',
          createdAt: new Date('2026-05-26T10:02:00.000Z'),
          senderCustomer: null,
          senderSeller: {
            id: 'seller-1',
            fullName: 'Seller One',
            email: 'seller@example.com',
          },
          senderAdmin: null,
        },
      ],
    });

    const result = await service.addSellerMessage(
      'shop-1',
      'thread-1',
      {
        userId: 'seller-1',
        role: 'SELLER',
        email: 'seller@example.com',
        sub: 'seller-1',
      },
      'Hi there',
    );

    expect(result.messages.at(-1)).toMatchObject({
      senderRole: 'SELLER',
      message: 'Hi there',
    });
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
  });

  it('reporting a thread makes it visible to admins', async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();
    const service = new MessagesService(
      prisma,
      notifications as unknown as NotificationsService,
    );

    prisma.shopMessageThread.findFirst = jest.fn().mockResolvedValue({
      id: 'thread-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      productId: null,
      orderId: null,
      status: 'OPEN',
      subject: 'Demo shop',
      lastMessageAt: new Date('2026-05-26T10:00:00.000Z'),
      lastCustomerReadAt: new Date('2026-05-26T10:00:00.000Z'),
      lastSellerReadAt: null,
      reportedAt: null,
      reportedReason: null,
      shop: {
        id: 'shop-1',
        name: 'Demo shop',
        slug: 'demo-shop',
        logoUrl: null,
      },
      product: null,
      order: null,
      customer: {
        id: 'customer-1',
        fullName: 'Customer One',
        email: 'customer@example.com',
        preferredLocale: 'ru',
      },
      seller: {
        id: 'seller-1',
        fullName: 'Seller One',
        email: 'seller@example.com',
        preferredLocale: 'en',
      },
      messages: [
        {
          id: 'message-1',
          senderRole: 'CUSTOMER',
          message: 'Hello',
          createdAt: new Date('2026-05-26T10:00:00.000Z'),
          senderCustomer: {
            id: 'customer-1',
            fullName: 'Customer One',
            email: 'customer@example.com',
          },
          senderSeller: null,
          senderAdmin: null,
        },
      ],
    });
    prisma.shopMessageThread.update = jest.fn().mockResolvedValue({
      id: 'thread-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      productId: null,
      orderId: null,
      status: 'REPORTED',
      subject: 'Demo shop',
      lastMessageAt: new Date('2026-05-26T10:00:00.000Z'),
      lastCustomerReadAt: new Date('2026-05-26T10:00:00.000Z'),
      lastSellerReadAt: null,
      reportedAt: new Date('2026-05-26T10:05:00.000Z'),
      reportedReason: 'Spam',
      shop: {
        id: 'shop-1',
        name: 'Demo shop',
        slug: 'demo-shop',
        logoUrl: null,
      },
      product: null,
      order: null,
      customer: {
        id: 'customer-1',
        fullName: 'Customer One',
        email: 'customer@example.com',
        preferredLocale: 'ru',
      },
      seller: {
        id: 'seller-1',
        fullName: 'Seller One',
        email: 'seller@example.com',
        preferredLocale: 'en',
      },
      messages: [
        {
          id: 'message-1',
          senderRole: 'CUSTOMER',
          message: 'Hello',
          createdAt: new Date('2026-05-26T10:00:00.000Z'),
          senderCustomer: {
            id: 'customer-1',
            fullName: 'Customer One',
            email: 'customer@example.com',
          },
          senderSeller: null,
          senderAdmin: null,
        },
      ],
    });

    const result = await service.reportCustomerThread(
      'thread-1',
      {
        userId: 'customer-1',
        role: 'CUSTOMER',
        email: 'customer@example.com',
        sub: 'customer-1',
      },
      'Spam',
    );

    expect(result.status).toBe('REPORTED');
    expect(notifications.broadcastToAdmins).toHaveBeenCalledTimes(1);
  });
});
