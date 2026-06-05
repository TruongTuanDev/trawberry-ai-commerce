/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
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
};

describe('AdminUsersController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let auditLogs: any[];
  let sellerProfiles: any[];

  const ADMIN_ID = '11111111-1111-4111-a111-111111111111';
  const SELLER_ID = '22222222-2222-4222-a222-222222222222';
  const CUSTOMER_ID = '33333333-3333-4333-a333-333333333333';

  // Mock dependency counts
  let mockOrderCount = 0;
  let mockCheckoutCount = 0;
  let mockShopCount = 0;
  let mockLedgerCount = 0;

  const prismaMock = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    marketplaceCheckout: {
      count: jest.fn(),
    },
    shop: {
      count: jest.fn(),
    },
    sellerFeeLedgerEntry: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: ADMIN_ID,
        email: 'admin@trawberry.local',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        fullName: 'System Admin',
        phone: '+79990000001',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: SELLER_ID,
        email: 'seller@trawberry.local',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        fullName: 'Seller One',
        phone: '+79990000002',
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
      {
        id: CUSTOMER_ID,
        email: 'customer@trawberry.local',
        passwordHash: bcrypt.hashSync('Password123!', 10),
        fullName: 'Customer One',
        phone: '+79990000003',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
      },
    ];

    auditLogs = [];
    sellerProfiles = [];
    mockOrderCount = 0;
    mockCheckoutCount = 0;
    mockShopCount = 0;
    mockLedgerCount = 0;

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(callback(prismaMock)),
    );

    prismaMock.user.findMany.mockImplementation(
      async ({ where, skip, take }) => {
        let filtered = [...users];
        if (where?.role) {
          filtered = filtered.filter((u) => u.role === where.role);
        }
        if (where?.status) {
          filtered = filtered.filter((u) => u.status === where.status);
        }
        if (where?.OR) {
          const queryTerms = where.OR.map((term: any) => {
            return (
              term.email?.contains ||
              term.fullName?.contains ||
              term.phone?.contains
            );
          }).filter(Boolean);

          if (queryTerms.length > 0) {
            filtered = filtered.filter((u) => {
              return queryTerms.some((term: string) => {
                return (
                  u.email.toLowerCase().includes(term.toLowerCase()) ||
                  (u.fullName &&
                    u.fullName.toLowerCase().includes(term.toLowerCase())) ||
                  (u.phone && u.phone.includes(term))
                );
              });
            });
          }
        }
        return Promise.resolve(
          filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? 20)),
        );
      },
    );

    prismaMock.user.count.mockImplementation(async ({ where }) => {
      let filtered = [...users];
      if (where?.role) {
        filtered = filtered.filter((u) => u.role === where.role);
      }
      if (where?.status) {
        filtered = filtered.filter((u) => u.status === where.status);
      }
      return Promise.resolve(filtered.length);
    });

    prismaMock.user.findUnique.mockImplementation(async ({ where }) => {
      const found = users.find((u) => {
        if (where.id) return u.id === where.id;
        if (where.email) return u.email === where.email;
        if (where.phone) return u.phone === where.phone;
        return false;
      });
      return Promise.resolve(found ?? null);
    });

    prismaMock.user.create.mockImplementation(async ({ data }) => {
      const created: StoredUser = {
        id: randomUUID(),
        email: data.email,
        phone: data.phone ?? null,
        fullName: data.fullName ?? null,
        role: data.role,
        status: data.status,
        passwordHash: data.passwordHash,
        createdAt: new Date(),
      };
      users.push(created);
      return Promise.resolve(created);
    });

    prismaMock.user.update.mockImplementation(async ({ where, data }) => {
      const idx = users.findIndex((u) => u.id === where.id);
      if (idx === -1) return Promise.resolve(null);
      const updated = {
        ...users[idx],
        ...data,
      };
      users[idx] = updated;
      return Promise.resolve(updated);
    });

    prismaMock.user.delete.mockImplementation(async ({ where }) => {
      const idx = users.findIndex((u) => u.id === where.id);
      if (idx === -1) return Promise.resolve(null);
      const deleted = users[idx];
      users.splice(idx, 1);
      return Promise.resolve(deleted);
    });

    prismaMock.sellerProfile.create.mockImplementation(async ({ data }) => {
      const profile = {
        id: `sp-${data.userId}`,
        userId: data.userId,
        approvalStatus: data.approvalStatus,
      };
      sellerProfiles.push(profile);
      return Promise.resolve(profile);
    });

    prismaMock.adminAuditLog.create.mockImplementation(async ({ data }) => {
      const log = { id: `log-${auditLogs.length + 1}`, ...data };
      auditLogs.push(log);
      return Promise.resolve(log);
    });

    prismaMock.order.count.mockImplementation(async () =>
      Promise.resolve(mockOrderCount),
    );
    prismaMock.marketplaceCheckout.count.mockImplementation(async () =>
      Promise.resolve(mockCheckoutCount),
    );
    prismaMock.shop.count.mockImplementation(async () =>
      Promise.resolve(mockShopCount),
    );
    prismaMock.sellerFeeLedgerEntry.count.mockImplementation(async () =>
      Promise.resolve(mockLedgerCount),
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

  const getAdminHeaders = async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({
        identifier: 'admin@trawberry.local',
        password: 'Password123!',
      })
      .expect(200);

    return {
      Authorization: `Bearer ${readBody<AuthResponseDto>(response).accessToken}`,
    };
  };

  const getSellerHeaders = async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/seller/login')
      .send({
        identifier: 'seller@trawberry.local',
        password: 'Password123!',
      })
      .expect(200);

    return {
      Authorization: `Bearer ${readBody<AuthResponseDto>(response).accessToken}`,
    };
  };

  it('rejects non-admin access to users API', async () => {
    const sellerHeaders = await getSellerHeaders();
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set(sellerHeaders)
      .expect(403);
  });

  it('lists all users in the system', async () => {
    const adminHeaders = await getAdminHeaders();
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set(adminHeaders)
      .expect(200);

    const body = readBody<any>(res);
    expect(body.items.length).toBe(3);
    expect(body.items[0].passwordHash).toBeUndefined(); // passwordHash is hidden
    expect(body.meta.total).toBe(3);
  });

  it('filters users by role', async () => {
    const adminHeaders = await getAdminHeaders();
    const res = await request(app.getHttpServer())
      .get('/api/admin/users?role=SELLER')
      .set(adminHeaders)
      .expect(200);

    const body = readBody<any>(res);
    expect(body.items.length).toBe(1);
    expect(body.items[0].role).toBe('SELLER');
  });

  it('searches users by email or fullName', async () => {
    const adminHeaders = await getAdminHeaders();
    const res = await request(app.getHttpServer())
      .get('/api/admin/users?q=customer')
      .set(adminHeaders)
      .expect(200);

    const body = readBody<any>(res);
    expect(body.items.length).toBe(1);
    expect(body.items[0].email).toBe('customer@trawberry.local');
  });

  it('creates a new user and hashes password', async () => {
    const adminHeaders = await getAdminHeaders();
    const payload = {
      fullName: 'New Customer',
      email: 'newcustomer@trawberry.local',
      phone: '+79991234567',
      role: 'CUSTOMER',
      password: 'mypassword',
    };

    const res = await request(app.getHttpServer())
      .post('/api/admin/users')
      .set(adminHeaders)
      .send(payload)
      .expect(201);

    const body = readBody<any>(res);
    expect(body.email).toBe('newcustomer@trawberry.local');
    expect(body.role).toBe('CUSTOMER');
    expect(body.passwordHash).toBeUndefined();

    // Verify hash
    const createdUser = users.find(
      (u) => u.email === 'newcustomer@trawberry.local',
    );
    expect(createdUser).toBeDefined();
    expect(createdUser!.passwordHash).not.toBe('mypassword');
    expect(bcrypt.compareSync('mypassword', createdUser!.passwordHash)).toBe(
      true,
    );

    // Verify audit log
    const createLog = auditLogs.find((l) => l.action === 'CREATE_USER');
    expect(createLog).toBeDefined();
    expect(createLog.targetUserId).toBe(createdUser!.id);
  });

  it('creates a seller and creates pending seller profile', async () => {
    const adminHeaders = await getAdminHeaders();
    const payload = {
      fullName: 'New Seller',
      email: 'newseller@trawberry.local',
      phone: '+79991234568',
      role: 'SELLER',
      password: 'mypassword',
    };

    await request(app.getHttpServer())
      .post('/api/admin/users')
      .set(adminHeaders)
      .send(payload)
      .expect(201);

    const createdUser = users.find(
      (u) => u.email === 'newseller@trawberry.local',
    );
    expect(createdUser).toBeDefined();

    const profile = sellerProfiles.find((sp) => sp.userId === createdUser!.id);
    expect(profile).toBeDefined();
    expect(profile.approvalStatus).toBe('PENDING');
  });

  it('rejects user creation with duplicate email', async () => {
    const adminHeaders = await getAdminHeaders();
    const payload = {
      email: 'customer@trawberry.local', // duplicate
      role: 'CUSTOMER',
      password: 'mypassword',
    };

    await request(app.getHttpServer())
      .post('/api/admin/users')
      .set(adminHeaders)
      .send(payload)
      .expect(409);
  });

  it('updates user successfully', async () => {
    const adminHeaders = await getAdminHeaders();
    const payload = {
      fullName: 'Updated Name',
      status: 'DISABLED',
    };

    const res = await request(app.getHttpServer())
      .patch(`/api/admin/users/${CUSTOMER_ID}`)
      .set(adminHeaders)
      .send(payload)
      .expect(200);

    const body = readBody<any>(res);
    expect(body.fullName).toBe('Updated Name');
    expect(body.status).toBe('DISABLED');
  });

  it('resets user password successfully', async () => {
    const adminHeaders = await getAdminHeaders();
    const payload = {
      password: 'newsecretpassword',
    };

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${CUSTOMER_ID}`)
      .set(adminHeaders)
      .send(payload)
      .expect(200);

    const updatedUser = users.find((u) => u.id === CUSTOMER_ID);
    expect(
      bcrypt.compareSync('newsecretpassword', updatedUser!.passwordHash),
    ).toBe(true);
  });

  it('prevents demoting or disabling the last active admin', async () => {
    const adminHeaders = await getAdminHeaders();
    // Only admin-1 is active admin in the mock database
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${ADMIN_ID}`)
      .set(adminHeaders)
      .send({ role: 'CUSTOMER' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${ADMIN_ID}`)
      .set(adminHeaders)
      .send({ status: 'DISABLED' })
      .expect(400);
  });

  it('prevents disabling self even if there is another admin', async () => {
    const adminHeaders = await getAdminHeaders();
    // Add another admin
    users.push({
      id: randomUUID(),
      email: 'admin2@trawberry.local',
      passwordHash: 'hash',
      fullName: 'Admin Two',
      phone: null,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    // admin-1 tries to disable admin-1
    await request(app.getHttpServer())
      .patch(`/api/admin/users/${ADMIN_ID}`)
      .set(adminHeaders)
      .send({ status: 'DISABLED' })
      .expect(400);
  });

  it('prevents deleting self', async () => {
    const adminHeaders = await getAdminHeaders();
    await request(app.getHttpServer())
      .delete(`/api/admin/users/${ADMIN_ID}`)
      .set(adminHeaders)
      .expect(400);
  });

  it('rejects deleting a user with dependencies', async () => {
    const adminHeaders = await getAdminHeaders();
    mockOrderCount = 1;

    const res = await request(app.getHttpServer())
      .delete(`/api/admin/users/${CUSTOMER_ID}`)
      .set(adminHeaders)
      .expect(400);

    const body = readBody<any>(res);
    expect(body.code || body.message).toContain('USER_HAS_DEPENDENCIES');
  });

  it('successfully deletes a user without dependencies', async () => {
    const adminHeaders = await getAdminHeaders();
    mockOrderCount = 0;
    mockCheckoutCount = 0;
    mockShopCount = 0;
    mockLedgerCount = 0;

    await request(app.getHttpServer())
      .delete(`/api/admin/users/${CUSTOMER_ID}`)
      .set(adminHeaders)
      .expect(200);

    const found = users.find((u) => u.id === CUSTOMER_ID);
    expect(found).toBeUndefined();
  });
});
