import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { readBody } from './test-helpers';

type StoredProduct = {
  id: string;
  shopId: string;
  wbTitle: string;
  localTitle: string | null;
  wbDescription: string | null;
  localDescription: string | null;
  brand: string | null;
  color: string | null;
  gender: string | null;
  composition: string | null;
  sellerSku: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  aiTryOnEnabled: boolean;
  visibility: string | null;
  catalogStatus: string;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number | null;
  categoryId: bigint | null;
  subjectId: bigint | null;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
  archivedAt: Date | null;
  unpublishedAt: Date | null;
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sizeName: string | null;
    russianSize: string | null;
    techSize: string | null;
    wbSize: string | null;
    sellerSku: string | null;
    isActive: boolean;
    basePrice: Prisma.Decimal | null;
    discountPrice: Prisma.Decimal | null;
    stockQuantity: number;
    reservedStock: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    createdAt: Date;
  }>;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
  category: {
    id: bigint;
    name: string;
    slug: string | null;
  } | null;
};

describe('RecommendationsController (e2e)', () => {
  let app: INestApplication<App>;
  let products: StoredProduct[];
  const originalEnv = { ...process.env };

  const prismaMock = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    productViewLog: {
      create: jest.fn(),
    },
    searchLog: {
      create: jest.fn(),
    },
    recommendationEvent: {
      create: jest.fn(),
    },
  };

  const buildApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    const nextApp: INestApplication<App> =
      moduleFixture.createNestApplication<App>();
    nextApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await nextApp.init();
    return nextApp;
  };

  beforeEach(async () => {
    process.env.RECOMMENDATIONS_ENABLED = 'true';
    process.env.PUBLIC_RECOMMENDATIONS_ENABLED = 'true';
    process.env.RECOMMENDATION_TRACKING_ENABLED = 'true';

    products = [
      buildProduct({
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Source jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Similar jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000003',
        title: 'Other product',
        categoryId: 22n,
        categoryName: 'Shoes',
        brand: 'City Berry',
      }),
    ];

    prismaMock.product.findMany.mockImplementation(
      ({ where }: { where?: Record<string, unknown> }) => {
        const excludedId =
          where &&
          typeof where.id === 'object' &&
          where.id !== null &&
          'not' in where.id
            ? String((where.id as { not?: string }).not)
            : null;

        return products.filter((product) => product.id !== excludedId);
      },
    );
    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where?: Record<string, unknown> }) => {
        return products.find((product) => product.id === where?.id) ?? null;
      },
    );
    prismaMock.product.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const product = products.find((item) => item.id === where.id);
        return product ? { shopId: product.shopId } : null;
      },
    );
    prismaMock.productViewLog.create.mockResolvedValue({});
    prismaMock.searchLog.create.mockResolvedValue({});
    prismaMock.recommendationEvent.create.mockResolvedValue({});
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns an empty home recommendation list when the query fails', async () => {
    prismaMock.product.findMany.mockRejectedValueOnce(new Error('boom'));

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=8')
      .expect(200);

    expect(readBody<{ items: unknown[]; algorithm: string }>(response)).toEqual(
      {
        algorithm: 'rule_based_v1',
        items: [],
      },
    );
  });

  it('returns similar products without including the source product', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/public/recommendations/products/00000000-0000-0000-0000-000000000001/similar?limit=2',
      )
      .expect(200);

    const body = readBody<{ items: Array<{ id: string; name: string }> }>(
      response,
    );
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.id).toBe('00000000-0000-0000-0000-000000000002');
    expect(
      body.items.some(
        (item) => item.id === '00000000-0000-0000-0000-000000000001',
      ),
    ).toBe(false);
  });

  it('returns 204 and skips writes when tracking is disabled', async () => {
    process.env.RECOMMENDATION_TRACKING_ENABLED = 'false';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/public/tracking/search')
      .send({
        query: 'jacket',
        resultCount: 3,
      })
      .expect(204);

    expect(response.text).toBe('');
    expect(prismaMock.searchLog.create).not.toHaveBeenCalled();
  });
});

function buildProduct({
  id,
  title,
  categoryId,
  categoryName,
  brand,
}: {
  id: string;
  title: string;
  categoryId: bigint;
  categoryName: string;
  brand: string;
}): StoredProduct {
  return {
    id,
    shopId: '10000000-0000-0000-0000-000000000001',
    wbTitle: title,
    localTitle: title,
    wbDescription: `${title} description`,
    localDescription: `${title} description`,
    brand,
    color: 'Black',
    gender: 'Unisex',
    composition: 'Cotton',
    sellerSku: `SKU-${id.slice(-4)}`,
    seoSlug: null,
    categoryName,
    sourceCategoryName: categoryName,
    aiTryOnEnabled: false,
    visibility: 'ACTIVE',
    catalogStatus: 'PUBLISHED',
    averageRating: new Prisma.Decimal('4.7'),
    feedbackCount: 12,
    categoryId,
    subjectId: 1n,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    publishedAt: new Date('2026-06-02T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T00:00:00.000Z'),
    archivedAt: null,
    unpublishedAt: null,
    images: [
      {
        id: `image-${id}`,
        wbUrl: 'https://example.com/image.jpg',
        localUrl: null,
        isMain: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: `variant-${id}`,
        sizeName: 'M',
        russianSize: '46',
        techSize: 'M',
        wbSize: 'M',
        sellerSku: `SKU-${id.slice(-4)}-M`,
        isActive: true,
        basePrice: new Prisma.Decimal('1999'),
        discountPrice: new Prisma.Decimal('1499'),
        stockQuantity: 8,
        reservedStock: 0,
        lowStockThreshold: 2,
        trackInventory: true,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ],
    shop: {
      id: '10000000-0000-0000-0000-000000000001',
      name: 'Ready Shop',
      slug: 'ready-shop',
      logoUrl: null,
      paymentInstructions: 'Manual transfer',
      status: 'ACTIVE',
      sellerProfile: {
        approvalStatus: 'APPROVED',
      },
    },
    category: {
      id: categoryId,
      name: categoryName,
      slug: categoryName.toLowerCase(),
    },
  };
}
