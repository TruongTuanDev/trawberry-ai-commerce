import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

type StoredSellerProfile = {
  id: string;
  userId: string;
  approvalStatus: string;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  currentShopId: string | null;
};

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: Date;
  sellerProfile?: StoredSellerProfile | null;
};

type StoredSellerDocument = {
  id: string;
  userId: string;
  documentType: string;
  url: string;
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  status: string;
  rejectionReason: string | null;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
};

describe('Admin seller approval workflow (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let documents: StoredSellerDocument[];
  const adminId = '11111111-1111-4111-8111-111111111111';
  const sellerId = '22222222-2222-4222-8222-222222222222';
  const rejectedSellerId = '33333333-3333-4333-8333-333333333333';

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sellerDocument: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    adminAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: adminId,
        email: 'admin@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Admin',
        phone: null,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date('2026-05-13T00:00:00Z'),
        sellerProfile: null,
      },
    ];
    documents = [];

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        include,
      }: {
        where: { email?: string; id?: string };
        include?: { sellerProfile?: unknown };
      }) => {
        const user = users.find((entry) =>
          where.email ? entry.email === where.email : entry.id === where.id,
        );
        if (!user) return null;
        return include?.sellerProfile
          ? { ...user, sellerProfile: user.sellerProfile ?? null }
          : user;
      },
    );

    prismaMock.user.findMany.mockImplementation(
      ({
        where,
      }: {
        where?: { role?: string; sellerProfile?: { approvalStatus?: string } };
      }) =>
        users
          .filter((user) => !where?.role || user.role === where.role)
          .filter((user) => {
            const status = where?.sellerProfile?.approvalStatus;
            return !status || user.sellerProfile?.approvalStatus === status;
          })
          .map((user) => ({
            ...user,
            sellerProfile: user.sellerProfile ?? null,
          })),
    );

    prismaMock.user.create.mockImplementation(
      ({ data }: { data: Partial<StoredUser> }) => {
        const nextSellerIndex = users.filter(
          (user) => user.role === 'SELLER',
        ).length;
        const created: StoredUser = {
          id: nextSellerIndex === 0 ? sellerId : rejectedSellerId,
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
        if (!user) throw new Error('User not found.');
        user.sellerProfile = {
          id: `sp-${data.userId}`,
          userId: data.userId,
          approvalStatus: data.approvalStatus,
          approvedAt: null,
          rejectedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewNote: null,
          currentShopId: null,
        };
        return Promise.resolve(user.sellerProfile);
      },
    );

    prismaMock.sellerProfile.findUnique.mockImplementation(
      ({ where }: { where: { userId?: string; id?: string } }) =>
        users.find((user) =>
          where.userId
            ? user.id === where.userId
            : user.sellerProfile?.id === where.id,
        )?.sellerProfile ?? null,
    );

    prismaMock.sellerProfile.update.mockImplementation(
      ({
        where,
        data,
        include,
      }: {
        where: { userId?: string; id?: string };
        data: Partial<StoredSellerProfile>;
        include?: { user?: boolean };
      }) => {
        const user = users.find((entry) =>
          where.userId
            ? entry.id === where.userId
            : entry.sellerProfile?.id === where.id,
        );
        if (!user?.sellerProfile) throw new Error('Seller profile not found.');
        user.sellerProfile = { ...user.sellerProfile, ...data };
        return include?.user
          ? { ...user.sellerProfile, user }
          : user.sellerProfile;
      },
    );

    prismaMock.sellerDocument.count.mockImplementation(
      ({ where }: { where: { userId: string; status?: string } }) =>
        Promise.resolve(
          documents.filter(
            (document) =>
              document.userId === where.userId &&
              (!where.status || document.status === where.status),
          ).length,
        ),
    );
    prismaMock.sellerDocument.findMany.mockImplementation(
      ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          documents.filter((document) => document.userId === where.userId),
        ),
    );
    prismaMock.sellerDocument.findFirst.mockImplementation(
      ({ where }: { where: { userId: string; id: string } }) =>
        Promise.resolve(
          documents.find(
            (document) =>
              document.userId === where.userId && document.id === where.id,
          ) ?? null,
        ),
    );
    prismaMock.sellerDocument.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredSellerDocument>;
      }) => {
        const index = documents.findIndex(
          (document) => document.id === where.id,
        );
        if (index < 0) throw new Error('Document not found.');
        documents[index] = { ...documents[index], ...data };
        return Promise.resolve(documents[index]);
      },
    );
    prismaMock.adminAuditLog.create.mockResolvedValue({});
    prismaMock.adminAuditLog.findMany.mockResolvedValue([]);

    prismaMock.shop.findUnique.mockResolvedValue(null);
    prismaMock.shop.create.mockImplementation(
      ({
        data,
      }: {
        data: { sellerProfileId: string; name: string; slug: string };
      }) =>
        Promise.resolve({
          id: '44444444-4444-4444-8444-444444444444',
          ...data,
          logoUrl: null,
          contactInfo: null,
          bankName: null,
          accountNumber: null,
          accountHolderName: null,
          bik: null,
          correspondentAccount: null,
          paymentInstructions: null,
          status: 'ACTIVE',
          _count: { products: 0 },
        }),
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
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  async function registerSeller(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'New Seller',
        role: 'SELLER',
      })
      .expect(201);
    return readBody<AuthResponseDto>(response);
  }

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return readBody<AuthResponseDto>(response);
  }

  it('requires admin approval before sellers can create shops', async () => {
    const seller = await registerSeller('pending@example.com');
    expect(seller.approvalStatus).toBe('PENDING');

    const sellerLogin = await login('pending@example.com');
    await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .send({ name: 'Pending Shop', slug: 'pending-shop' })
      .expect(403);

    documents.push({
      id: '55555555-5555-4555-8555-555555555555',
      userId: seller.userId,
      documentType: 'INN',
      url: 'http://localhost/uploads/inn.pdf',
      storageKey: 'seller-documents/inn.pdf',
      originalName: 'inn.pdf',
      mimeType: 'application/pdf',
      size: 12,
      status: 'APPROVED',
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: adminId,
    });

    const adminLogin = await login('admin@example.com');
    const pendingList = await request(app.getHttpServer())
      .get('/api/admin/sellers?status=PENDING')
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);
    expect(readBody<Array<{ userId: string }>>(pendingList)).toContainEqual(
      expect.objectContaining({ userId: seller.userId }),
    );

    const approved = await request(app.getHttpServer())
      .post(`/api/admin/sellers/${seller.userId}/approve`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(201);
    expect(readBody<{ sellerApprovalStatus: string }>(approved)).toEqual(
      expect.objectContaining({ sellerApprovalStatus: 'APPROVED' }),
    );

    await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .send({ name: 'Approved Shop', slug: 'approved-shop' })
      .expect(201);
  });

  it('rejects sellers and blocks non-admin review actions', async () => {
    const rejectedSeller = await registerSeller('reject@example.com');
    const regularSeller = await registerSeller('regular@example.com');
    const regularLogin = await login('regular@example.com');

    await request(app.getHttpServer())
      .post(`/api/admin/sellers/${rejectedSeller.userId}/approve`)
      .set('Authorization', `Bearer ${regularLogin.accessToken}`)
      .expect(403);

    const adminLogin = await login('admin@example.com');
    const rejected = await request(app.getHttpServer())
      .post(`/api/admin/sellers/${rejectedSeller.userId}/reject`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .send({ reason: 'Incomplete documents.' })
      .expect(201);
    expect(readBody<{ sellerApprovalStatus: string }>(rejected)).toEqual(
      expect.objectContaining({ sellerApprovalStatus: 'REJECTED' }),
    );

    const rejectedLogin = await login('reject@example.com');
    await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${rejectedLogin.accessToken}`)
      .send({ name: 'Rejected Shop', slug: 'rejected-shop' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/admin/sellers/${regularSeller.userId}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);
  });
});
