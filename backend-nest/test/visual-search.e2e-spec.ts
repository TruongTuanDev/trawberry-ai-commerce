import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { VisualEmbeddingClient } from '../src/modules/visual-search/visual-embedding.client';
import { VisualSearchService } from '../src/modules/visual-search/visual-search.service';
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
    productImage: {
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
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const visualEmbeddingClientMock = {
    embedBytes: jest.fn(),
    embedUrl: jest.fn(),
  };

  const buildApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(VisualEmbeddingClient)
      .useValue(visualEmbeddingClientMock)
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
    prismaMock.productImage.findMany.mockReset();
    prismaMock.visualSearchLog.create.mockReset();
    prismaMock.visualSearchEvent.create.mockReset();
    prismaMock.order.create.mockReset();
    prismaMock.marketplaceCheckout.create.mockReset();
    prismaMock.$queryRaw.mockReset();
    prismaMock.$executeRaw.mockReset();
    visualEmbeddingClientMock.embedBytes.mockReset();
    visualEmbeddingClientMock.embedUrl.mockReset();

    prismaMock.product.findMany.mockResolvedValue(products);
    prismaMock.visualSearchLog.create.mockResolvedValue({ id: 'log-1' });
    prismaMock.visualSearchEvent.create.mockResolvedValue({});
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.$executeRaw.mockResolvedValue(1);
    visualEmbeddingClientMock.embedBytes.mockResolvedValue({
      embedding: Array.from({ length: 512 }, () => 0.01),
      dimensions: 512,
      model: 'deterministic_mock_v1',
      provider: 'mock',
      fingerprint: 'query-fingerprint',
    });
    visualEmbeddingClientMock.embedUrl.mockResolvedValue({
      embedding: Array.from({ length: 512 }, () => 0.01),
      dimensions: 512,
      model: 'deterministic_mock_v1',
      provider: 'mock',
      fingerprint: 'product-fingerprint',
    });

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
        productDetected: false,
        category: 'Шорты',
        color: null,
        gender: null,
        material: null,
        pattern: null,
        style: null,
        keywords: [],
        confidence: 0,
      },
      products: [],
      matches: [],
      algorithm: 'visual_search_semantic_attributes_v2',
      provider: 'rule_based_ai_v1',
      fallbackUsed: true,
      vectorUsed: false,
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
      productDetected: true,
      category: 'Шорты',
      color: null,
      gender: null,
      material: null,
      pattern: null,
      style: null,
      keywords: [],
      confidence: 0.15,
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

  it('returns no candidates when vision detects no shoppable product', async () => {
    process.env.VISUAL_SEARCH_AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.VISUAL_SEARCH_OPENAI_MODEL = 'vision-test-model';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          output_text: JSON.stringify({
            productDetected: false,
            category: null,
            color: null,
            gender: null,
            material: null,
            pattern: null,
            style: null,
            confidence: 0.08,
            keywordsRu: [],
            keywordsEn: [],
          }),
        }),
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', pngBuffer, {
        filename: 'background.png',
        contentType: 'image/png',
      })
      .expect(201);

    const body = readBody<{
      analysis: { productDetected: boolean; confidence: number };
      products: Array<{ id: string }>;
      matches: Array<{ product: { id: string } }>;
    }>(response);
    expect(body.analysis).toEqual({
      productDetected: false,
      category: null,
      color: null,
      gender: null,
      material: null,
      pattern: null,
      style: null,
      keywords: [],
      confidence: 0.08,
    });
    expect(body.products).toEqual([]);
    expect(body.matches).toEqual([]);
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();

    const fetchCalls = (global.fetch as jest.Mock).mock.calls as Array<
      [string, { body?: string }]
    >;
    const fetchBody = JSON.parse(fetchCalls[0]?.[1].body ?? '{}') as {
      model: string;
    };
    expect(fetchBody.model).toBe('vision-test-model');
  });

  it('matches products by category, color, and keyword without touching checkout flows', async () => {
    process.env.VISUAL_SEARCH_AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    const openAiResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          output_text: JSON.stringify({
            productDetected: true,
            category: 'Шорты',
            color: 'Blue',
            gender: 'female',
            material: 'polyester',
            pattern: 'solid',
            style: 'sport',
            confidence: 0.94,
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
      matches: Array<{
        product: { id: string };
        score: number;
        reasons: string[];
      }>;
      provider: string;
      fallbackUsed: boolean;
    }>(response);

    expect(body.analysis.category).toBe('Шорты');
    expect(body.analysis.color).toBe('Blue');
    expect(body.analysis.material).toBe('polyester');
    expect(body.analysis.confidence).toBe(0.94);
    expect(body.analysis.keywords).toEqual(['спорт', 'running']);
    expect(body.products.map((product) => product.id)).toEqual(
      expect.arrayContaining(['product-shorts-blue']),
    );
    expect(body.products[0]?.id).toBe('product-shorts-blue');
    expect(body.matches[0]?.product.id).toBe('product-shorts-blue');
    expect(body.matches[0]?.score).toBeGreaterThan(0);
    expect(body.matches[0]?.reasons).toContain('category');
    expect(body.provider).toBe('openai');
    expect(body.fallbackUsed).toBe(false);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
    expect(prismaMock.marketplaceCheckout.create).not.toHaveBeenCalled();
  });

  it('uses pgvector candidates and hybrid ranking when vector search is enabled', async () => {
    process.env.VISUAL_SEARCH_VECTOR_ENABLED = 'true';
    prismaMock.$queryRaw.mockResolvedValue([
      { id: 'product-accessory', score: 0.96 },
      { id: 'product-shorts-blue', score: 0.72 },
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/public/visual-search')
      .attach('image', pngBuffer, {
        filename: 'similar.png',
        contentType: 'image/png',
      })
      .field('categoryHint', 'Аксессуары')
      .expect(201);

    const body = readBody<{
      algorithm: string;
      vectorUsed: boolean;
      matches: Array<{ product: { id: string }; reasons: string[] }>;
    }>(response);
    expect(body.algorithm).toBe('visual_search_clip_pgvector_hybrid_v3');
    expect(body.vectorUsed).toBe(true);
    expect(body.matches[0]?.product.id).toBe('product-accessory');
    expect(body.matches[0]?.reasons).toContain('image_similarity');
    expect(visualEmbeddingClientMock.embedBytes).toHaveBeenCalledTimes(1);
  });

  it('indexes public product image URLs and stores their vectors', async () => {
    prismaMock.productImage.findMany.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        productId: '22222222-2222-4222-8222-222222222222',
        localUrl: null,
        wbUrl: 'https://images.example.com/product.jpg',
        updatedAt: new Date('2026-06-20T00:00:00Z'),
      },
    ]);

    const service = app.get(VisualSearchService);
    const first = await service.reindexPublishedImages(10);
    expect(first).toEqual(
      expect.objectContaining({
        requested: 1,
        indexed: 1,
        skipped: 0,
        failed: 0,
      }),
    );
    expect(visualEmbeddingClientMock.embedUrl).toHaveBeenCalledWith(
      'https://images.example.com/product.jpg',
    );
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
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
