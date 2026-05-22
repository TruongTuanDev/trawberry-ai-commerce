import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
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
    rejectionReason?: string | null;
    documents?: Array<{ id: string }>;
  } | null;
};

type StoredCustomerAddress = {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  country: string;
  countryCode?: string;
  city: string;
  region: string;
  federalSubject?: string | null;
  cityType?: string | null;
  district?: string | null;
  settlement?: string | null;
  street: string;
  building?: string;
  streetType?: string | null;
  buildingBlock?: string | null;
  entrance?: string | null;
  intercom?: string | null;
  floor?: string | null;
  apartment: string | null;
  postalCode: string | null;
  comment: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoPrecision?: string;
  geoProvider?: string;
  geoProviderUri?: string | null;
  addressFullName?: string | null;
  addressShortName?: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function parseCookies(rawCookieHeader: string | undefined) {
  if (!rawCookieHeader) {
    return {};
  }

  return Object.fromEntries(
    rawCookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex < 0) {
          return [part, ''] as const;
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ] as const;
      }),
  );
}

describe('CustomerAccountController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let customerAddresses: StoredCustomerAddress[];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
    },
    customerAddress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'admin-1',
        email: 'demo-admin@trawberry.local',
        passwordHash: bcrypt.hashSync('DemoAdmin123!', 10),
        fullName: 'Demo Admin',
        phone: '+79990000009',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        sellerProfile: null,
      },
      {
        id: 'customer-1',
        email: 'customer-one@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Customer One',
        phone: '+79990000010',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        sellerProfile: null,
      },
      {
        id: 'customer-2',
        email: 'customer-two@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Customer Two',
        phone: '+79990000011',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
        sellerProfile: null,
      },
      {
        id: 'seller-1',
        email: 'seller@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: '+79990000012',
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        sellerProfile: {
          id: 'seller-profile-1',
          userId: 'seller-1',
          approvalStatus: 'PENDING',
          currentShopId: null,
          rejectionReason: null,
          documents: [],
        },
      },
    ];

    customerAddresses = [];

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        include,
        select,
      }: {
        where: { email?: string; id?: string; phone?: string };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
        select?: Record<string, boolean>;
      }) => {
        const found = users.find((user) => {
          if (where.email) return user.email === where.email;
          if (where.id) return user.id === where.id;
          if (where.phone) return user.phone === where.phone;
          return false;
        });

        if (!found) {
          return null;
        }

        if (select) {
          return {
            ...(select.id ? { id: found.id } : {}),
            ...(select.email ? { email: found.email } : {}),
            ...(select.passwordHash
              ? { passwordHash: found.passwordHash }
              : {}),
            ...(select.fullName ? { fullName: found.fullName } : {}),
            ...(select.phone ? { phone: found.phone } : {}),
            ...(select.role ? { role: found.role } : {}),
            ...(select.status ? { status: found.status } : {}),
            ...(select.createdAt ? { createdAt: found.createdAt } : {}),
          };
        }

        if (include?.sellerProfile) {
          return {
            ...found,
            sellerProfile: found.sellerProfile ?? null,
          };
        }

        return found;
      },
    );

    prismaMock.user.findFirst.mockImplementation(
      ({
        where,
        include,
      }: {
        where?: {
          OR?: Array<{ email?: string; phone?: string }>;
        };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
      }) => {
        const found = users.find((user) =>
          (where?.OR ?? []).some(
            (entry) =>
              (entry.email && entry.email === user.email) ||
              (entry.phone && entry.phone === user.phone),
          ),
        );

        if (!found) {
          return null;
        }

        if (include?.sellerProfile) {
          return {
            ...found,
            sellerProfile: found.sellerProfile ?? null,
          };
        }

        return found;
      },
    );

    prismaMock.user.create.mockImplementation(
      ({ data }: { data: Partial<StoredUser> }) => {
        const created: StoredUser = {
          id: `user-${users.length + 1}`,
          email: data.email!,
          passwordHash: data.passwordHash!,
          fullName: data.fullName ?? null,
          phone: data.phone ?? null,
          role: data.role!,
          status: data.status!,
          createdAt: new Date(),
          sellerProfile: null,
        };
        users.push(created);
        return created;
      },
    );

    prismaMock.user.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredUser>;
      }) => {
        const user = users.find((entry) => entry.id === where.id);
        if (!user) {
          throw new Error('User not found');
        }

        Object.assign(user, data);
        return user;
      },
    );

    prismaMock.sellerProfile.create.mockImplementation(
      ({ data }: { data: { userId: string; approvalStatus: string } }) => {
        const user = users.find((entry) => entry.id === data.userId);
        if (!user) {
          throw new Error('User not found for seller profile');
        }

        user.sellerProfile = {
          id: `seller-profile-${user.id}`,
          userId: user.id,
          approvalStatus: data.approvalStatus,
          currentShopId: null,
          rejectionReason: null,
          documents: [],
        };

        return user.sellerProfile;
      },
    );

    prismaMock.customerAddress.findMany.mockImplementation(
      ({ where }: { where: { customerId: string } }) =>
        customerAddresses.filter(
          (address) => address.customerId === where.customerId,
        ),
    );

    prismaMock.customerAddress.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        customerAddresses.find((address) => address.id === where.id) ?? null,
    );

    prismaMock.customerAddress.findFirst.mockImplementation(
      ({ where }: { where?: { id?: string; customerId?: string } }) =>
        customerAddresses.find(
          (address) =>
            (!where?.id || address.id === where.id) &&
            (!where?.customerId || address.customerId === where.customerId),
        ) ?? null,
    );

    prismaMock.customerAddress.count.mockImplementation(
      ({ where }: { where: { customerId: string } }) =>
        customerAddresses.filter(
          (address) => address.customerId === where.customerId,
        ).length,
    );

    prismaMock.customerAddress.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<StoredCustomerAddress, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        const created: StoredCustomerAddress = {
          id: `address-${customerAddresses.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        customerAddresses.push(created);
        return created;
      },
    );

    prismaMock.customerAddress.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredCustomerAddress>;
      }) => {
        const address = customerAddresses.find(
          (entry) => entry.id === where.id,
        );
        if (!address) {
          throw new Error('Address not found');
        }

        Object.assign(address, data, { updatedAt: new Date() });
        return address;
      },
    );

    prismaMock.customerAddress.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { customerId?: string; isDefault?: boolean };
        data: Partial<StoredCustomerAddress>;
      }) => {
        let count = 0;
        for (const address of customerAddresses) {
          if (
            (where.customerId && address.customerId !== where.customerId) ||
            (where.isDefault !== undefined &&
              address.isDefault !== where.isDefault)
          ) {
            continue;
          }

          Object.assign(address, data, { updatedAt: new Date() });
          count += 1;
        }

        return { count };
      },
    );

    prismaMock.customerAddress.delete.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const index = customerAddresses.findIndex(
          (entry) => entry.id === where.id,
        );
        if (index < 0) {
          throw new Error('Address not found');
        }

        const [deleted] = customerAddresses.splice(index, 1);
        return deleted;
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
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.cookies = parseCookies(req.headers.cookie);
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('gets the current customer profile', async () => {
    const token = await loginAndGetToken(app, 'customer-one@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/customer/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(readBody<{ email: string; name: string | null }>(response)).toEqual(
      expect.objectContaining({
        email: 'customer-one@example.com',
        name: 'Customer One',
      }),
    );
  });

  it('rejects unauthenticated profile access', async () => {
    await request(app.getHttpServer()).get('/api/customer/profile').expect(401);
  });

  it('blocks seller and admin sessions from customer profile', async () => {
    const sellerToken = await loginAndGetToken(app, 'seller@example.com');
    const adminToken = await loginAndGetToken(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    await request(app.getHttpServer())
      .get('/api/customer/profile')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/customer/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('updates customer profile with normalized email and phone', async () => {
    const token = await loginAndGetToken(app, 'customer-one@example.com');

    const response = await request(app.getHttpServer())
      .patch('/api/customer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Customer Prime',
        email: 'CUSTOMER.PRIME@EXAMPLE.COM',
        phone: '8 999 000 00 15',
      })
      .expect(200);

    expect(
      readBody<{ name: string; email: string; phone: string }>(response),
    ).toEqual(
      expect.objectContaining({
        name: 'Customer Prime',
        email: 'customer.prime@example.com',
        phone: '+79990000015',
      }),
    );
  });

  it('rejects duplicate phone and duplicate email updates', async () => {
    const token = await loginAndGetToken(app, 'customer-one@example.com');

    await request(app.getHttpServer())
      .patch('/api/customer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+79990000011' })
      .expect(409);

    await request(app.getHttpServer())
      .patch('/api/customer/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'customer-two@example.com' })
      .expect(409);
  });

  it('changes password and invalidates the old password', async () => {
    const token = await loginAndGetToken(app, 'customer-one@example.com');

    await request(app.getHttpServer())
      .post('/api/customer/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'password123',
        newPassword: 'newPassword456',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'customer-one@example.com',
        password: 'password123',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'customer-one@example.com',
        password: 'newPassword456',
      })
      .expect(200);
  });

  it('creates, lists, updates, and deletes customer addresses', async () => {
    const token = await loginAndGetToken(app, 'customer-one@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Customer One',
        phone: '8 999 000 00 10',
        city: 'Moscow',
        region: 'Moscow',
        street: 'Tverskaya',
        building: '10',
        noEntrance: true,
        noFloor: true,
        apartment: '12',
        postalCode: '101000',
      })
      .expect(201);

    expect(readBody<{ isDefault: boolean; phone: string }>(created)).toEqual(
      expect.objectContaining({
        isDefault: true,
        phone: '+79990000010',
      }),
    );
    expect(
      readBody<{
        yandexManualReady: boolean;
        yandexApiReady: boolean;
        missingYandexFields: string[];
      }>(created),
    ).toEqual(
      expect.objectContaining({
        yandexManualReady: true,
        yandexApiReady: false,
      }),
    );

    const listed = await request(app.getHttpServer())
      .get('/api/customer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readBody<{ items: unknown[] }>(listed).items).toHaveLength(1);

    const addressId = readBody<{ id: string }>(created).id;
    const updated = await request(app.getHttpServer())
      .patch(`/api/customer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        city: 'Saint Petersburg',
        street: 'Nevsky',
        building: '20',
        latitude: 59.9343,
        longitude: 30.3351,
        geoPrecision: 'MANUAL_PIN',
      })
      .expect(200);

    expect(
      readBody<{
        city: string;
        street: string;
        yandexApiReady: boolean;
      }>(updated),
    ).toEqual(
      expect.objectContaining({
        city: 'Saint Petersburg',
        street: 'Nevsky',
        yandexApiReady: true,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/customer/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/api/customer/addresses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readBody<{ items: unknown[] }>(afterDelete).items).toHaveLength(0);
  });

  it('keeps only one default address and forbids cross-customer access', async () => {
    const customerOneToken = await loginAndGetToken(
      app,
      'customer-one@example.com',
    );
    const customerTwoToken = await loginAndGetToken(
      app,
      'customer-two@example.com',
    );

    const first = await request(app.getHttpServer())
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${customerOneToken}`)
      .send({
        fullName: 'Customer One',
        phone: '+79990000010',
        city: 'Moscow',
        region: 'Moscow',
        street: 'Street 1',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/customer/addresses')
      .set('Authorization', `Bearer ${customerOneToken}`)
      .send({
        fullName: 'Customer One',
        phone: '+79990000010',
        city: 'Kazan',
        region: 'Tatarstan',
        street: 'Street 2',
      })
      .expect(201);

    const firstId = readBody<{ id: string }>(first).id;
    const secondId = readBody<{ id: string }>(second).id;

    await request(app.getHttpServer())
      .post(`/api/customer/addresses/${secondId}/default`)
      .set('Authorization', `Bearer ${customerOneToken}`)
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/customer/addresses')
      .set('Authorization', `Bearer ${customerOneToken}`)
      .expect(200);
    const listBody = readBody<{
      items: Array<{ id: string; isDefault: boolean }>;
    }>(listResponse);

    expect(listBody.items.find((item) => item.id === firstId)?.isDefault).toBe(
      false,
    );
    expect(listBody.items.find((item) => item.id === secondId)?.isDefault).toBe(
      true,
    );

    await request(app.getHttpServer())
      .patch(`/api/customer/addresses/${secondId}`)
      .set('Authorization', `Bearer ${customerTwoToken}`)
      .send({ city: 'Blocked' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/customer/addresses/${secondId}`)
      .set('Authorization', `Bearer ${customerTwoToken}`)
      .expect(403);
  });
});

async function loginAndGetToken(
  app: INestApplication<App>,
  identifier: string,
  password = 'password123',
) {
  const path =
    identifier === 'demo-admin@trawberry.local'
      ? '/api/auth/admin/login'
      : identifier === 'seller@example.com'
        ? '/api/auth/seller/login'
        : '/api/auth/customer/login';

  const response = await request(app.getHttpServer())
    .post(path)
    .send({
      identifier,
      password,
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
