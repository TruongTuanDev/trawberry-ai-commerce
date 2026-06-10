import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FilesService } from '../src/modules/files/files.service';
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
  legalType: string | null;
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  kpp: string | null;
  legalAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bik: string | null;
  updatedAt: Date;
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

describe('Seller onboarding and KYC workflow (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let documents: StoredSellerDocument[];
  let auditLogs: Array<Record<string, unknown>>;
  const adminId = '11111111-1111-4111-8111-111111111111';
  const sellerId = '22222222-2222-4222-8222-222222222222';
  const otherSellerId = '33333333-3333-4333-8333-333333333333';

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sellerDocument: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

  const filesMock = {
    storeSellerDocument: jest.fn(),
    deleteStoredFile: jest.fn(),
  };

  beforeEach(async () => {
    documents = [];
    auditLogs = [];
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

    prismaMock.user.create.mockImplementation(
      ({ data }: { data: Partial<StoredUser> }) => {
        const sellerCount = users.filter(
          (user) => user.role === 'SELLER',
        ).length;
        const created: StoredUser = {
          id: sellerCount === 0 ? sellerId : otherSellerId,
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
        user.sellerProfile = emptyProfile(user.id, data.approvalStatus);
        return Promise.resolve(user.sellerProfile);
      },
    );

    prismaMock.sellerProfile.findUnique.mockImplementation(
      ({
        where,
        include,
      }: {
        where: { userId: string };
        include?: { user?: unknown };
      }) => {
        const user = users.find((entry) => entry.id === where.userId);
        if (!user?.sellerProfile) {
          return Promise.resolve(null);
        }
        return Promise.resolve(
          include?.user ? { ...user.sellerProfile, user } : user.sellerProfile,
        );
      },
    );

    prismaMock.sellerProfile.update.mockImplementation(
      ({
        where,
        data,
        include,
      }: {
        where: { userId: string };
        data: Partial<StoredSellerProfile>;
        include?: { user?: boolean };
      }) => {
        const user = users.find((entry) => entry.id === where.userId);
        if (!user?.sellerProfile) throw new Error('Seller profile not found.');
        user.sellerProfile = {
          ...user.sellerProfile,
          ...data,
          updatedAt: new Date(),
        };
        return Promise.resolve(
          include?.user ? { ...user.sellerProfile, user } : user.sellerProfile,
        );
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

    prismaMock.sellerDocument.create.mockImplementation(
      ({ data }: { data: Partial<StoredSellerDocument> }) => {
        const created: StoredSellerDocument = {
          id:
            documents.length === 0
              ? '55555555-5555-4555-8555-555555555555'
              : '66666666-6666-4666-8666-666666666666',
          userId: data.userId!,
          documentType: data.documentType!,
          url: data.url!,
          storageKey: data.storageKey ?? null,
          originalName: data.originalName ?? null,
          mimeType: data.mimeType ?? null,
          size: data.size ?? null,
          status: data.status ?? 'PENDING',
          rejectionReason: null,
          uploadedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
        };
        documents.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.sellerDocument.findMany.mockImplementation(
      ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          documents.filter((document) => document.userId === where.userId),
        ),
    );

    prismaMock.sellerDocument.findFirst.mockImplementation(
      ({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(
          documents.find(
            (document) =>
              document.id === where.id && document.userId === where.userId,
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

    prismaMock.sellerDocument.delete.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        documents = documents.filter((document) => document.id !== where.id);
        return Promise.resolve({});
      },
    );

    prismaMock.adminAuditLog.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `audit-${auditLogs.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        auditLogs.push(created);
        return Promise.resolve(created);
      },
    );
    prismaMock.adminAuditLog.findMany.mockImplementation(
      ({ where }: { where?: { targetUserId?: string } }) =>
        Promise.resolve(
          auditLogs.filter(
            (log) =>
              !where?.targetUserId || log.targetUserId === where.targetUserId,
          ),
        ),
    );

    prismaMock.shop.findUnique.mockResolvedValue(null);
    prismaMock.shop.create.mockImplementation(
      ({
        data,
      }: {
        data: { name: string; slug: string; sellerProfileId: string };
      }) =>
        Promise.resolve({
          id: 'shop-1',
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

    filesMock.storeSellerDocument.mockResolvedValue({
      publicUrl: 'http://localhost/uploads/document.pdf',
      storageKey: 'seller-documents/document.pdf',
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      size: 18,
    });
    filesMock.deleteStoredFile.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(FilesService)
      .useValue(filesMock)
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

  function emptyProfile(
    userId: string,
    approvalStatus: string,
  ): StoredSellerProfile {
    return {
      id: `profile-${userId}`,
      userId,
      approvalStatus,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      reviewedAt: null,
      reviewNote: null,
      currentShopId: null,
      legalType: null,
      legalName: null,
      inn: null,
      ogrn: null,
      kpp: null,
      legalAddress: null,
      contactName: null,
      contactPhone: null,
      contactEmail: null,
      bankName: null,
      bankAccount: null,
      bik: null,
      updatedAt: new Date('2026-05-13T00:00:00Z'),
    };
  }

  async function registerSeller(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'password123',
        fullName: 'Onboarding Seller',
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

  it('lets sellers save legal profile and upload a KYC document', async () => {
    await registerSeller('seller@example.com');
    const sellerLogin = await login('seller@example.com');

    const profileResponse = await request(app.getHttpServer())
      .put('/api/seller/onboarding/profile')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .send({
        legalType: 'IP',
        legalName: 'Seller IP',
        inn: '123456789012',
        ogrn: '1234567890123',
        legalAddress: 'Moscow',
        contactName: 'Seller Contact',
        contactPhone: '+79990000001',
        contactEmail: 'seller@example.com',
      })
      .expect(200);
    expect(readBody<{ legalName: string }>(profileResponse).legalName).toBe(
      'Seller IP',
    );

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/seller/onboarding/documents')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .field('documentType', 'INN')
      .attach('file', Buffer.from('%PDF-1.4\n'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(readBody<{ status: string }>(uploadResponse).status).toBe('PENDING');

    const listResponse = await request(app.getHttpServer())
      .get('/api/seller/onboarding/documents')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .expect(200);
    expect(readBody<Array<{ id: string }>>(listResponse)).toHaveLength(1);
  });

  it('prefills missing seller contact details from account identity', async () => {
    const seller = await registerSeller('seller@example.com');
    const storedSeller = users.find((entry) => entry.id === seller.userId);
    expect(storedSeller?.sellerProfile).toBeDefined();
    storedSeller!.sellerProfile!.contactName = '  ';
    storedSeller!.sellerProfile!.contactEmail = '';
    const sellerLogin = await login('seller@example.com');

    const profileResponse = await request(app.getHttpServer())
      .get('/api/seller/onboarding/profile')
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .expect(200);

    expect(
      readBody<{
        contactName: string;
        contactPhone: string | null;
        contactEmail: string;
      }>(profileResponse),
    ).toEqual(
      expect.objectContaining({
        contactName: 'Onboarding Seller',
        contactPhone: null,
        contactEmail: 'seller@example.com',
      }),
    );
  });

  it('prevents sellers from deleting another seller document', async () => {
    const seller = await registerSeller('seller@example.com');
    const otherSeller = await registerSeller('other@example.com');
    const sellerLogin = await login('seller@example.com');
    documents.push({
      id: '77777777-7777-4777-8777-777777777777',
      userId: otherSeller.userId,
      documentType: 'INN',
      url: 'http://localhost/uploads/foreign.pdf',
      storageKey: 'foreign.pdf',
      originalName: 'foreign.pdf',
      mimeType: 'application/pdf',
      size: 12,
      status: 'PENDING',
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
    });

    expect(seller.userId).not.toBe(otherSeller.userId);
    await request(app.getHttpServer())
      .delete(
        '/api/seller/onboarding/documents/77777777-7777-4777-8777-777777777777',
      )
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .expect(404);
  });

  it('lets admins review onboarding documents and records audit logs', async () => {
    const seller = await registerSeller('seller@example.com');
    documents.push({
      id: '55555555-5555-4555-8555-555555555555',
      userId: seller.userId,
      documentType: 'INN',
      url: 'http://localhost/uploads/document.pdf',
      storageKey: 'document.pdf',
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      size: 12,
      status: 'PENDING',
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
    });

    const adminLogin = await login('admin@example.com');
    const onboardingResponse = await request(app.getHttpServer())
      .get(`/api/admin/sellers/${seller.userId}/onboarding`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);
    expect(
      readBody<{ profile: { userId: string } }>(onboardingResponse).profile
        .userId,
    ).toBe(seller.userId);

    const approvedDocument = await request(app.getHttpServer())
      .post(
        `/api/admin/sellers/${seller.userId}/documents/55555555-5555-4555-8555-555555555555/approve`,
      )
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(201);
    expect(readBody<{ status: string }>(approvedDocument).status).toBe(
      'APPROVED',
    );

    const approvedSeller = await request(app.getHttpServer())
      .post(`/api/admin/sellers/${seller.userId}/approve`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(201);
    expect(readBody<{ sellerApprovalStatus: string }>(approvedSeller)).toEqual(
      expect.objectContaining({ sellerApprovalStatus: 'APPROVED' }),
    );

    const logsResponse = await request(app.getHttpServer())
      .get(`/api/admin/audit-logs?targetUserId=${seller.userId}`)
      .set('Authorization', `Bearer ${adminLogin.accessToken}`)
      .expect(200);
    expect(readBody<Array<{ action: string }>>(logsResponse)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'SELLER_DOCUMENT_APPROVED' }),
        expect.objectContaining({ action: 'SELLER_APPROVED' }),
      ]),
    );
  });

  it('blocks non-admin users from admin onboarding APIs', async () => {
    const seller = await registerSeller('seller@example.com');
    const sellerLogin = await login('seller@example.com');

    await request(app.getHttpServer())
      .get(`/api/admin/sellers/${seller.userId}/onboarding`)
      .set('Authorization', `Bearer ${sellerLogin.accessToken}`)
      .expect(403);
  });
});
