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
    legalType?: string | null;
    legalName?: string | null;
    inn?: string | null;
    legalAddress?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bik?: string | null;
    documents?: Array<{ id: string }>;
  } | null;
};

type CurrentUserResponse = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  sellerProfileId: string | null;
  currentShopId: string | null;
  sellerApprovalStatus: string | null;
  sellerRejectionReason: string | null;
  sellerNextStep: string | null;
  sellerOnboardingComplete: boolean | null;
  isSyntheticEmail: boolean;
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

        const name = part.slice(0, separatorIndex);
        const value = part.slice(separatorIndex + 1);
        return [name, decodeURIComponent(value)] as const;
      }),
  );
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
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
        createdAt: new Date(),
        sellerProfile: null,
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      async ({
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
          return Promise.resolve(null);
        }

        if (select) {
          return Promise.resolve({
            ...(select.id ? { id: found.id } : {}),
          });
        }

        if (include?.sellerProfile) {
          return Promise.resolve({
            ...found,
            sellerProfile: found.sellerProfile ?? null,
          });
        }

        return Promise.resolve(found);
      },
    );

    prismaMock.user.findFirst.mockImplementation(
      async ({
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
          return Promise.resolve(null);
        }

        if (include?.sellerProfile) {
          return Promise.resolve({
            ...found,
            sellerProfile: found.sellerProfile ?? null,
          });
        }

        return Promise.resolve(found);
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
        return Promise.resolve(created);
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

        return Promise.resolve(user.sellerProfile);
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

  it('registers a customer with email and password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer One',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.email).toBe('customer@example.com');
    expect(body.phone).toBeNull();
    expect(body.role).toBe('CUSTOMER');
    expect(body.status).toBe('ACTIVE');
    expect(body.approvalStatus).toBeNull();
  });

  it('registers a customer with phone and password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        phone: '8 (999) 000-00-11',
        password: 'password123',
        fullName: 'Phone Customer',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.phone).toBe('+79990000011');
    expect(body.role).toBe('CUSTOMER');
    expect(users.at(-1)?.email).toContain('phone-79990000011@customer.local');
    expect(body.isSyntheticEmail).toBe(true);
  });

  it('registers a seller with email and creates a pending seller profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/seller/register')
      .send({
        email: 'seller@example.com',
        password: 'password123',
        fullName: 'Seller One',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.role).toBe('SELLER');
    expect(body.approvalStatus).toBe('PENDING');
    expect(users.at(-1)?.sellerProfile?.approvalStatus).toBe('PENDING');
  });

  it('registers a seller with phone and creates a pending seller profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/seller/register')
      .send({
        phone: '+79990000012',
        password: 'password123',
        fullName: 'Phone Seller',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.role).toBe('SELLER');
    expect(body.phone).toBe('+79990000012');
    expect(body.approvalStatus).toBe('PENDING');
  });

  it('keeps legacy register compatibility for seller role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'legacy-seller@example.com',
        password: 'password123',
        fullName: 'Legacy Seller',
        role: 'SELLER',
      })
      .expect(201);

    expect(readBody<AuthResponseDto>(response).role).toBe('SELLER');
  });

  it('rejects admin creation through public register', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'password123',
        fullName: 'Blocked Admin',
        role: 'ADMIN',
      })
      .expect(400);
  });

  it('rejects duplicate email safely', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(409);
  });

  it('rejects duplicate phone safely', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        phone: '+7 (999) 000-00-13',
        password: 'password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/seller/register')
      .send({
        phone: '8 999 000 00 13',
        password: 'password123',
      })
      .expect(409);
  });

  it('logs customer in by email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'customer@example.com',
        password: 'password123',
      })
      .expect(200);
    const body = readBody<AuthResponseDto>(response);

    expect(body.role).toBe('CUSTOMER');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token='),
        expect.stringContaining('HttpOnly'),
      ]),
    );
  });

  it('logs customer in by phone', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        phone: '+7 (999) 000-00-14',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: '8 999 000 00 14',
        password: 'password123',
      })
      .expect(200);

    expect(readBody<AuthResponseDto>(response).phone).toBe('+79990000014');
  });

  it('logs seller in by identifier', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/seller/register')
      .send({
        email: 'seller@example.com',
        phone: '+79990000015',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/seller/login')
      .send({
        identifier: '+79990000015',
        password: 'password123',
      })
      .expect(200);

    expect(readBody<AuthResponseDto>(response).role).toBe('SELLER');
  });

  it('allows admin login only on admin endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({
        identifier: 'demo-admin@trawberry.local',
        password: 'DemoAdmin123!',
      })
      .expect(200);

    expect(readBody<AuthResponseDto>(response).role).toBe('ADMIN');
  });

  it('blocks wrong role login on role-specific endpoint', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({
        identifier: 'customer@example.com',
        password: 'password123',
      })
      .expect(401);
  });

  it('keeps legacy login compatibility with email field', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(readBody<AuthResponseDto>(response).role).toBe('CUSTOMER');
  });

  it('returns safe invalid credentials for unknown identifier', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'missing@example.com',
        password: 'password123',
      })
      .expect(401);
  });

  it('returns current user from /api/auth/me when authenticated by cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        phone: '+79990000016',
        password: 'password123',
        fullName: 'Customer One',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: '+79990000016',
        password: 'password123',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);
    const body = readBody<CurrentUserResponse>(response);

    expect(body.phone).toBe('+79990000016');
    expect(body.role).toBe('CUSTOMER');
    expect(body.fullName).toBe('Customer One');
    expect(body.isSyntheticEmail).toBe(true);
  });

  it('keeps Authorization bearer fallback for /api/auth/me', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer One',
      })
      .expect(201);
    const registerBody = readBody<AuthResponseDto>(registerResponse);

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerBody.accessToken}`)
      .expect(200);
    const body = readBody<CurrentUserResponse>(response);

    expect(body.email).toBe('customer@example.com');
    expect(body.role).toBe('CUSTOMER');
  });

  it('returns seller next step for pending onboarding accounts', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/seller/register')
      .send({
        phone: '+7 999 000 00 21',
        password: 'password123',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/seller/login')
      .send({
        identifier: '8 999 000 00 21',
        password: 'password123',
      })
      .expect(200);

    expect(readBody<AuthResponseDto>(registerResponse).sellerNextStep).toBe(
      'COMPLETE_ONBOARDING',
    );

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);
    const body = readBody<CurrentUserResponse>(response);

    expect(body.sellerNextStep).toBe('COMPLETE_ONBOARDING');
    expect(body.sellerOnboardingComplete).toBe(false);
  });

  it('throttles repeated customer login attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/customer/login')
        .send({
          identifier: 'missing@example.com',
          password: 'password123',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'missing@example.com',
        password: 'password123',
      })
      .expect(429);
  });

  it('throttles repeated admin login attempts more strictly', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({
          identifier: 'demo-admin@trawberry.local',
          password: 'wrong-password',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({
        identifier: 'demo-admin@trawberry.local',
        password: 'wrong-password',
      })
      .expect(429);
  });

  it('throttles repeated customer register attempts', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/customer/register')
        .send({
          phone: '+7 999 000 00 31',
          password: 'password123',
        })
        .expect(attempt === 0 ? 201 : 409);
    }

    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        phone: '+7 999 000 00 31',
        password: 'password123',
      })
      .expect(429);
  });

  it('refreshes token pair', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer One',
      })
      .expect(201);
    const registerBody = readBody<AuthResponseDto>(registerResponse);

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({
        refreshToken: registerBody.refreshToken,
      })
      .expect(200);
    const body = readBody<AuthResponseDto>(response);

    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.email).toBe('customer@example.com');
  });

  it('clears the auth cookie on logout', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/customer/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'customer@example.com',
        password: 'password123',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);

    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('Path=/'),
      ]),
    );
  });

});
