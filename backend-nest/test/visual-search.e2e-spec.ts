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

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=',
  'base64',
);

describe('VisualSearchController (e2e)', () => {
  let app: INestApplication<App>;
  let products: StoredProduct[];
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  const prismaMock = {
    product: {
      findMany: jest.fn(),
    },
    visualSearchLog: {
      create: jest.fn(),
    },
    visualSearchEvent: {
      create: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    marketplaceCheckout: {
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
      }),
    );
    await nextApp.init();
    return nextApp;
  };

  beforeEach(async () => {
    process.env.VISUAL_SEARCH_ENABLED = 'true';
    process.env.PUBLIC_VISUAL_SEARCH_ENABLED = 'true';
    process.env.VISUAL_SEARCH_TRACKING_ENABLED = 'true';
    delete process.env.VISUAL_SEARCH_AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;

    products = [
      buildProduct({
        id: 'product-shorts-blue',
        title: 'Blue running shorts',
        categoryName: 'Шорты',
        sourceCategoryName: 'Шорты',
        color: 'Blue',
        description: 'Sport shorts with lightweight fabric',
      }),
      buildProduct({
        id: 'product-top-red',
        title: 'Red summer top',
        categoryName: 'Топ',
        sourceCategoryName: 'Топ',
        color: 'Red',
        description: 'Simple top for everyday wear',
      }),
      buildProduct({
        id: 'product-accessory',
        title: 'Leather accessory set',
        categoryName: 'Аксессуары',
        sourceCategoryName: 'Аксессуары',
        color: 'Black',
        description: 'Accessory bundle',
      }),
    ];

    prismaMock.product.findMany.mockReset();
    prismaMock.visualSearchLog.create.mockReset();
    prismaMock.visualSearchEvent.create.mockReset();
    prismaMock.order.create.mockReset();
    prismaMock.marketplaceCheckout.create.mockReset();

    prismaMock.product.findMany.mockResolvedValue(products);
    prismaMock.visualSearchLog.create.mockResolvedValue({ id: 'log-1' });
    prismaMock.visualSearchEvent.create.mockResolvedValue({});

    global.fetch = jest.fn();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('returns a safe disabled response when the feature flag is off', async () => {
    process.env.PUBLIC_VISUAL_SEARCH_ENABLED = 'false';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', pngBuffer, {
        filename: 'shorts.png',
        contentType: 'image/png',
      })
      .field('categoryHint', 'Шорты')
      .expect(201);

    expect(readBody(response)).toEqual({
      analysis: {
        category: 'Шорты',
        color: null,
        gender: null,
        keywords: [],
      },
      products: [],
      algorithm: 'visual_search_rule_based_v1',
      visualSearchLogId: null,
      disabled: true,
    });
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid mime types', async () => {
    await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', Buffer.from('not-an-image'), {
        filename: 'bad.gif',
        contentType: 'image/gif',
      })
      .expect(400);
  });

  it('rejects images larger than 8MB', async () => {
    await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', Buffer.alloc(8 * 1024 * 1024 + 1, 1), {
        filename: 'too-large.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('falls back safely when the AI provider fails', async () => {
    process.env.VISUAL_SEARCH_AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const response = await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', pngBuffer, {
        filename: 'fallback.png',
        contentType: 'image/png',
      })
      .field('categoryHint', 'Шорты')
      .expect(201);

    const body = readBody<{
      analysis: {
        category: string | null;
        color: string | null;
        keywords: string[];
      };
      products: Array<{ id: string }>;
    }>(response);

    expect(body.analysis).toEqual({
      category: 'Шорты',
      color: null,
      gender: null,
      keywords: [],
    });
    expect(body.products[0]?.id).toBe('product-shorts-blue');
    const visualSearchLogCreateCalls = prismaMock.visualSearchLog.create.mock
      .calls as Array<
      [
        {
          data: {
            provider: string;
          };
        },
      ]
    >;
    expect(visualSearchLogCreateCalls[0]?.[0]?.data.provider).toBe(
      'rule_based_ai_v1',
    );
  });

  it('matches products by category, color, and keyword without touching checkout flows', async () => {
    process.env.VISUAL_SEARCH_AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const openAiResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          output_text: JSON.stringify({
            category: 'Шорты',
            color: 'Blue',
            gender: 'female',
            keywordsRu: ['спорт'],
            keywordsEn: ['running'],
          }),
        }),
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(openAiResponse);

    const response = await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', pngBuffer, {
        filename: 'match.png',
        contentType: 'image/png',
      })
      .field('categoryHint', 'Шорты')
      .expect(201);

    const body = readBody<{
      analysis: {
        category: string | null;
        color: string | null;
        gender: string | null;
        keywords: string[];
      };
      products: Array<{ id: string }>;
    }>(response);

    expect(body.analysis.category).toBe('Шорты');
    expect(body.analysis.color).toBe('Blue');
    expect(body.analysis.keywords).toEqual(['спорт', 'running']);
    expect(body.products.map((product) => product.id)).toEqual(
      expect.arrayContaining(['product-shorts-blue']),
    );
    expect(body.products[0]?.id).toBe('product-shorts-blue');
    expect(prismaMock.order.create).not.toHaveBeenCalled();
    expect(prismaMock.marketplaceCheckout.create).not.toHaveBeenCalled();
  });
});

function buildProduct({
  id,
  title,
  categoryName,
  sourceCategoryName,
  color,
  description,
}: {
  id: string;
  title: string;
  categoryName: string;
  sourceCategoryName: string;
  color: string;
  description: string;
}): StoredProduct {
  return {
    id,
    shopId: 'shop-1',
    wbTitle: title,
    localTitle: title,
    wbDescription: description,
    localDescription: description,
    brand: 'Berry Brand',
    color,
    gender: 'female',
    composition: 'Cotton',
    sellerSku: `${id}-sku`,
    seoSlug: id,
    categoryName,
    sourceCategoryName,
    aiTryOnEnabled: false,
    visibility: 'ACTIVE',
    catalogStatus: 'PUBLISHED',
    averageRating: new Prisma.Decimal('4.8'),
    feedbackCount: 12,
    categoryId: 10n,
    subjectId: 1n,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    publishedAt: new Date('2026-06-02T00:00:00Z'),
    updatedAt: new Date('2026-06-03T00:00:00Z'),
    archivedAt: null,
    unpublishedAt: null,
    images: [
      {
        id: `${id}-image`,
        wbUrl: `https://example.com/${id}.jpg`,
        localUrl: null,
        isMain: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: `${id}-variant`,
        sizeName: 'M',
        russianSize: '46',
        techSize: 'M',
        wbSize: 'M',
        sellerSku: `${id}-sku-m`,
        isActive: true,
        basePrice: new Prisma.Decimal('1499'),
        discountPrice: null,
        stockQuantity: 5,
        reservedStock: 0,
        lowStockThreshold: 2,
        trackInventory: true,
        createdAt: new Date('2026-06-01T00:00:00Z'),
      },
    ],
    shop: {
      id: 'shop-1',
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
      id: 10n,
      name: categoryName,
      slug: categoryName.toLowerCase(),
    },
  };
}
