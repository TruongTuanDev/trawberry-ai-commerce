import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  createdAt: Date;
};

type StoredNotification = {
  id: string;
  recipientUserId: string;
  recipientRole: string;
  shopId: string | null;
  orderId: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  severity: string;
  status: string;
  dedupeKey: string | null;
  createdAt: Date;
  readAt: Date | null;
  archivedAt: Date | null;
};

type NotifWhereInput = {
  recipientUserId?: string;
  recipientRole?: string;
  status?: string | { in: string[] };
  type?: string;
  severity?: string;
  id?: string;
  dedupeKey?: string;
};

type NotifCreateData = {
  recipientUserId: string;
  recipientRole: string;
  shopId?: string | null;
  orderId?: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  severity: string;
  status?: string;
  dedupeKey?: string | null;
};

type NotifUpdateData = Partial<StoredNotification>;

type UserWhereInput = { email?: string; id?: string; role?: string };

type NotificationListResponse = {
  items: StoredNotification[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type UnreadCountResponse = { count: number };

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let notifications: StoredNotification[];
  let mockPrisma: any;

  beforeEach(async () => {
    users = [
      {
        id: 'cust-1',
        email: 'customer1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: 'sell-1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: 'admin-1',
        email: 'admin1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: 'admin-2',
        email: 'admin2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    ];

    notifications = [
      {
        id: 'notif-1',
        recipientUserId: 'cust-1',
        recipientRole: 'CUSTOMER',
        shopId: null,
        orderId: null,
        type: 'SYSTEM',
        title: 'Chào mừng',
        message: 'Chào mừng bạn đến với chợ',
        actionUrl: null,
        severity: 'INFO',
        status: 'UNREAD',
        dedupeKey: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        readAt: null,
        archivedAt: null,
      },
      {
        id: 'notif-2',
        recipientUserId: 'sell-1',
        recipientRole: 'SELLER',
        shopId: 'shop-1',
        orderId: 'order-1',
        type: 'ORDER_NEW',
        title: 'Có đơn hàng mới',
        message: 'Đơn hàng ORD-1001 cần xử lý',
        actionUrl: '/seller/orders/order-1',
        severity: 'INFO',
        status: 'UNREAD',
        dedupeKey: 'new-order:order-1',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        readAt: null,
        archivedAt: null,
      },
      {
        id: 'notif-3',
        recipientUserId: 'cust-1',
        recipientRole: 'CUSTOMER',
        shopId: null,
        orderId: null,
        type: 'DELIVERY_STATUS_CHANGED',
        title: 'Đã giao hàng',
        message: 'Đơn hàng của bạn đang được giao',
        actionUrl: '/orders/order-1',
        severity: 'SUCCESS',
        status: 'READ',
        dedupeKey: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        readAt: new Date('2026-01-03T01:00:00Z'),
        archivedAt: null,
      },
    ];

    mockPrisma = {
      user: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: UserWhereInput }) => {
            const found = users.find((u) =>
              where.email
                ? u.email === where.email.toLowerCase()
                : u.id === where.id,
            );
            return Promise.resolve(found ?? null);
          }),
        findMany: jest
          .fn()
          .mockImplementation(({ where }: { where: UserWhereInput }) => {
            let found = users;
            if (where?.role) {
              found = found.filter((u) => u.role === where.role);
            }
            return Promise.resolve(found);
          }),
      },
      notification: {
        findMany: jest
          .fn()
          .mockImplementation(
            ({
              where,
              skip,
              take,
            }: {
              where: NotifWhereInput;
              skip?: number;
              take?: number;
            }) => {
              let result = notifications.filter((n) => {
                if (
                  where.recipientUserId &&
                  n.recipientUserId !== where.recipientUserId
                ) {
                  return false;
                }
                if (
                  where.recipientRole &&
                  n.recipientRole !== where.recipientRole
                ) {
                  return false;
                }
                if (where.status) {
                  const statusFilter = where.status;
                  if (typeof statusFilter === 'object' && statusFilter.in) {
                    return statusFilter.in.includes(n.status);
                  }
                  if (n.status !== statusFilter) {
                    return false;
                  }
                }
                if (where.type && n.type !== where.type) {
                  return false;
                }
                if (where.severity && n.severity !== where.severity) {
                  return false;
                }
                return true;
              });
              result.sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
              );
              if (skip !== undefined && take !== undefined) {
                result = result.slice(skip, skip + take);
              }
              return Promise.resolve(result);
            },
          ),
        count: jest
          .fn()
          .mockImplementation(({ where }: { where: NotifWhereInput }) => {
            const result = notifications.filter((n) => {
              if (
                where.recipientUserId &&
                n.recipientUserId !== where.recipientUserId
              ) {
                return false;
              }
              if (
                where.recipientRole &&
                n.recipientRole !== where.recipientRole
              ) {
                return false;
              }
              if (where.status) {
                const statusFilter = where.status;
                if (typeof statusFilter === 'object' && statusFilter.in) {
                  return statusFilter.in.includes(n.status);
                }
                if (n.status !== statusFilter) {
                  return false;
                }
              }
              return true;
            });
            return Promise.resolve(result.length);
          }),
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: { where: NotifWhereInput }) => {
            const found = notifications.find((n) => {
              if (where.id && n.id !== where.id) return false;
              if (
                where.recipientUserId &&
                n.recipientUserId !== where.recipientUserId
              )
                return false;
              if (
                where.recipientRole &&
                n.recipientRole !== where.recipientRole
              )
                return false;
              return true;
            });
            return Promise.resolve(found ?? null);
          }),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: NotifWhereInput }) => {
            const found = notifications.find((n) => {
              if (where.dedupeKey && n.dedupeKey !== where.dedupeKey)
                return false;
              if (where.id && n.id !== where.id) return false;
              return true;
            });
            return Promise.resolve(found ?? null);
          }),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: NotifCreateData }) => {
            const created: StoredNotification = {
              id: `notif-new-${Math.random()}`,
              recipientUserId: data.recipientUserId,
              recipientRole: data.recipientRole,
              shopId: data.shopId ?? null,
              orderId: data.orderId ?? null,
              type: data.type,
              title: data.title,
              message: data.message,
              actionUrl: data.actionUrl ?? null,
              severity: data.severity,
              status: data.status ?? 'UNREAD',
              dedupeKey: data.dedupeKey ?? null,
              createdAt: new Date(),
              readAt: null,
              archivedAt: null,
            };
            notifications.push(created);
            return Promise.resolve(created);
          }),
        update: jest
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: NotifWhereInput;
              data: NotifUpdateData;
            }) => {
              const idx = notifications.findIndex((n) => n.id === where.id);
              if (idx === -1) throw new Error('Notification not found');
              const prev = notifications[idx];
              notifications[idx] = {
                ...prev,
                ...data,
                createdAt: data.createdAt ?? prev.createdAt,
              };
              return Promise.resolve(notifications[idx]);
            },
          ),
        updateMany: jest
          .fn()
          .mockImplementation(
            ({
              where,
              data,
            }: {
              where: NotifWhereInput;
              data: NotifUpdateData;
            }) => {
              let count = 0;
              notifications.forEach((n, idx) => {
                if (
                  n.recipientUserId === where.recipientUserId &&
                  n.recipientRole === where.recipientRole &&
                  n.status === where.status
                ) {
                  notifications[idx] = {
                    ...n,
                    ...data,
                  };
                  count++;
                }
              });
              return Promise.resolve({ count });
            },
          ),
      },
      order: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve([])),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
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

  it('lists notifications for customer with role isolation', async () => {
    const token = await loginAndGetToken(app, 'customer1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/customer/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<NotificationListResponse>(response);
    expect(body.items).toHaveLength(2); // 'notif-1' and 'notif-3'
    expect(body.items[0].recipientRole).toBe('CUSTOMER');
    expect(body.items[1].recipientRole).toBe('CUSTOMER');
  });

  it('lists notifications for seller with role isolation', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/seller/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<NotificationListResponse>(response);
    expect(body.items).toHaveLength(1); // 'notif-2'
    expect(body.items[0].recipientRole).toBe('SELLER');
  });

  it('returns correct unread count for user', async () => {
    const token = await loginAndGetToken(app, 'customer1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/customer/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<UnreadCountResponse>(response);
    expect(body.count).toBe(1); // 'notif-1' is unread, 'notif-3' is read
  });

  it('marks a notification as read', async () => {
    const token = await loginAndGetToken(app, 'customer1@example.com');
    await request(app.getHttpServer())
      .post('/api/customer/notifications/notif-1/read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const notif1 = notifications.find((n) => n.id === 'notif-1');
    expect(notif1?.status).toBe('READ');
    expect(notif1?.readAt).toBeInstanceOf(Date);
  });

  it('marks all notifications as read', async () => {
    const token = await loginAndGetToken(app, 'customer1@example.com');
    await request(app.getHttpServer())
      .post('/api/customer/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const customerUnread = notifications.filter(
      (n) => n.recipientUserId === 'cust-1' && n.status === 'UNREAD',
    );
    expect(customerUnread).toHaveLength(0);
  });

  it('archives a notification', async () => {
    const token = await loginAndGetToken(app, 'customer1@example.com');
    await request(app.getHttpServer())
      .post('/api/customer/notifications/notif-1/archive')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const notif1 = notifications.find((n) => n.id === 'notif-1');
    expect(notif1?.status).toBe('ARCHIVED');
    expect(notif1?.archivedAt).toBeInstanceOf(Date);
  });
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password: 'password123',
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
