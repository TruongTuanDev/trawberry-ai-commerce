import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [];

    prismaMock.user.findUnique.mockImplementation(
      async ({
        where,
        include,
      }: {
        where: { email?: string; id?: string };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
      }) => {
        const found = users.find((user) =>
          where.email ? user.email === where.email : user.id === where.id,
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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('registers a customer with hashed password and returns JWTs', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer One',
        role: 'USER',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.email).toBe('customer@example.com');
    expect(body.role).toBe('CUSTOMER');
    expect(body.status).toBe('ACTIVE');
    expect(body.approvalStatus).toBeNull();

    expect(users).toHaveLength(1);
    expect(users[0].passwordHash).not.toBe('password123');
    expect(users[0].passwordHash.startsWith('$2')).toBe(true);
  });

  it('registers a seller and creates a pending seller profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'seller@example.com',
        password: 'password123',
        fullName: 'Seller One',
        role: 'SELLER',
      })
      .expect(201);
    const body = readBody<AuthResponseDto>(response);

    expect(body.role).toBe('SELLER');
    expect(body.approvalStatus).toBe('PENDING');
    expect(users[0].sellerProfile?.approvalStatus).toBe('PENDING');
  });

  it('logs in and returns a JWT', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'customer@example.com',
      password: 'password123',
      fullName: 'Customer One',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'customer@example.com',
        password: 'password123',
      })
      .expect(200);
    const body = readBody<AuthResponseDto>(response);

    expect(body.accessToken).toBeTruthy();
    expect(body.email).toBe('customer@example.com');
    expect(body.role).toBe('CUSTOMER');
  });

  it('returns current user from /api/auth/me', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer One',
      })
      .expect(201);
    const registerBody = readBody<AuthResponseDto>(registerResponse);

    const accessToken = registerBody.accessToken;

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const body = readBody<CurrentUserResponse>(response);

    expect(body.email).toBe('customer@example.com');
    expect(body.role).toBe('CUSTOMER');
    expect(body.fullName).toBe('Customer One');
  });

  it('refreshes token pair', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
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
});
