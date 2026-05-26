import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
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
  sellerProfile?: any;
};

type MockHomepageSlide = {
  id: string;
  titleRu?: string | null;
  titleEn?: string | null;
  subtitleRu?: string | null;
  subtitleEn?: string | null;
  ctaLabelRu?: string | null;
  ctaLabelEn?: string | null;
  ctaUrl?: string | null;
  altTextRu?: string | null;
  altTextEn?: string | null;
  imageDesktopUrl: string;
  imageDesktopStorageKey?: string | null;
  imageMobileUrl?: string | null;
  imageMobileStorageKey?: string | null;
  backgroundColor?: string | null;
  displayOrder: number;
  isActive: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('HomepageSlides (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let slides: MockHomepageSlide[] = [];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    homepageSlide: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    slides = [];
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
      {
        id: 'customer-1',
        email: 'demo-customer@trawberry.local',
        passwordHash: bcrypt.hashSync('DemoCustomer123!', 10),
        fullName: 'Demo Customer',
        phone: '+79990000001',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) => {
        const found = users.find((user) =>
          where.email
            ? user.email === where.email.toLowerCase()
            : user.id === where.id,
        );
        return Promise.resolve(found ?? null);
      },
    );

    prismaMock.user.findFirst.mockImplementation(
      ({
        where,
      }: {
        where?: { OR?: Array<{ email?: string; phone?: string }> };
      }) => {
        const found = users.find((user) =>
          (where?.OR ?? []).some(
            (entry) =>
              (entry.email && entry.email === user.email) ||
              (entry.phone && entry.phone === user.phone),
          ),
        );
        return Promise.resolve(found ?? null);
      },
    );

    prismaMock.homepageSlide.findMany.mockImplementation(
      (params?: { where?: { isActive?: boolean } }) => {
        if (params?.where?.isActive) {
          const now = new Date();
          const filtered = slides
            .filter((slide) => {
              if (!slide.isActive) return false;
              if (slide.startsAt && new Date(slide.startsAt) > now)
                return false;
              if (slide.endsAt && new Date(slide.endsAt) < now) return false;
              return true;
            })
            .sort((a, b) => a.displayOrder - b.displayOrder);
          return Promise.resolve(filtered);
        }
        const sorted = [...slides].sort(
          (a, b) => a.displayOrder - b.displayOrder,
        );
        return Promise.resolve(sorted);
      },
    );

    prismaMock.homepageSlide.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const found = slides.find((slide) => slide.id === where.id);
        return Promise.resolve(found ?? null);
      },
    );

    prismaMock.homepageSlide.findFirst.mockImplementation(
      (params?: { orderBy?: { displayOrder: 'asc' | 'desc' } }) => {
        if (params?.orderBy?.displayOrder === 'desc') {
          const sorted = [...slides].sort(
            (a, b) => b.displayOrder - a.displayOrder,
          );
          return Promise.resolve(sorted[0] ?? null);
        }
        return Promise.resolve(slides[0] ?? null);
      },
    );

    prismaMock.homepageSlide.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<MockHomepageSlide, 'id' | 'createdAt' | 'updatedAt'>;
      }) => {
        const slide: MockHomepageSlide = {
          id: `slide-${slides.length + 1}`,
          titleRu: data.titleRu ?? null,
          titleEn: data.titleEn ?? null,
          subtitleRu: data.subtitleRu ?? null,
          subtitleEn: data.subtitleEn ?? null,
          ctaLabelRu: data.ctaLabelRu ?? null,
          ctaLabelEn: data.ctaLabelEn ?? null,
          ctaUrl: data.ctaUrl ?? null,
          altTextRu: data.altTextRu ?? null,
          altTextEn: data.altTextEn ?? null,
          imageDesktopUrl: data.imageDesktopUrl,
          imageDesktopStorageKey: data.imageDesktopStorageKey ?? null,
          imageMobileUrl: data.imageMobileUrl ?? null,
          imageMobileStorageKey: data.imageMobileStorageKey ?? null,
          backgroundColor: data.backgroundColor ?? null,
          displayOrder: data.displayOrder ?? 0,
          isActive: data.isActive ?? false,
          startsAt: data.startsAt ?? null,
          endsAt: data.endsAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        slides.push(slide);
        return Promise.resolve(slide);
      },
    );

    prismaMock.homepageSlide.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockHomepageSlide>;
      }) => {
        const index = slides.findIndex((slide) => slide.id === where.id);
        if (index === -1) throw new Error('Not found');
        slides[index] = {
          ...slides[index],
          ...data,
          updatedAt: new Date(),
        };
        return Promise.resolve(slides[index]);
      },
    );

    prismaMock.homepageSlide.delete.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const index = slides.findIndex((slide) => slide.id === where.id);
        if (index === -1) throw new Error('Not found');
        const deleted = slides[index];
        slides.splice(index, 1);
        return Promise.resolve(deleted);
      },
    );

    prismaMock.$transaction.mockImplementation((promises: Promise<any>[]) => {
      return Promise.all(promises);
    });

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

  async function getAdminToken() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({
        identifier: 'demo-admin@trawberry.local',
        password: 'DemoAdmin123!',
      })
      .expect(200);

    return readBody<{ accessToken: string }>(response).accessToken;
  }

  async function getCustomerToken() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/customer/login')
      .send({
        identifier: 'demo-customer@trawberry.local',
        password: 'DemoCustomer123!',
      })
      .expect(200);

    return readBody<{ accessToken: string }>(response).accessToken;
  }

  it('allows admins to manage homepage slides but restricts non-admins', async () => {
    const adminToken = await getAdminToken();
    const customerToken = await getCustomerToken();

    // 1. Create slide as admin
    const createRes = await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleRu: 'Скидка на платья',
        titleEn: 'Dress Sale',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
        isActive: true,
      })
      .expect(201);

    const createdSlide = readBody<MockHomepageSlide>(createRes);
    expect(createdSlide.id).toBeDefined();
    expect(createdSlide.titleEn).toBe('Dress Sale');

    // 2. Reject non-admin access to admin endpoints
    await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        titleRu: 'Failure',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
      })
      .expect(403);

    // 3. Update slide as admin
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/admin/homepage-slides/${createdSlide.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleEn: 'Updated Dress Sale',
      })
      .expect(200);

    const updatedSlide = readBody<MockHomepageSlide>(updateRes);
    expect(updatedSlide.titleEn).toBe('Updated Dress Sale');

    // 4. Toggle slide active state
    const toggleRes = await request(app.getHttpServer())
      .post(`/api/admin/homepage-slides/${createdSlide.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const toggledSlide = readBody<MockHomepageSlide>(toggleRes);
    expect(toggledSlide.isActive).toBe(false);

    // 5. Delete slide as admin
    await request(app.getHttpServer())
      .delete(`/api/admin/homepage-slides/${createdSlide.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('rejects invalid publish window where startsAt is after endsAt', async () => {
    const adminToken = await getAdminToken();

    await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleRu: 'Invalid Slide',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
        startsAt: '2026-06-01T00:00:00.000Z',
        endsAt: '2026-05-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('returns only active slides within valid window on public endpoint', async () => {
    const adminToken = await getAdminToken();

    // Create 3 slides:
    // 1. Active and no window constraints (always active)
    await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleEn: 'Always Active',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
        isActive: true,
        displayOrder: 1,
      });

    // 2. Inactive
    await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleEn: 'Inactive Slide',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
        isActive: false,
        displayOrder: 2,
      });

    // 3. Active but starts in future (inactive now)
    await request(app.getHttpServer())
      .post('/api/admin/homepage-slides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titleEn: 'Future Slide',
        imageDesktopUrl: 'http://localhost:3000/demo/demo-product-1.svg',
        isActive: true,
        startsAt: '2026-12-31T00:00:00.000Z',
        displayOrder: 3,
      });

    const publicRes = await request(app.getHttpServer())
      .get('/api/public/homepage-slides')
      .expect(200);

    const publicSlides = readBody<MockHomepageSlide[]>(publicRes);
    expect(publicSlides.length).toBe(1);
    expect(publicSlides[0].titleEn).toBe('Always Active');
  });
});
