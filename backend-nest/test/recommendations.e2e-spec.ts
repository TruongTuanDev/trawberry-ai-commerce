/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  AdminJwtAuthGuard,
  SellerJwtAuthGuard,
} from '../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { BillingService } from '../src/modules/billing/billing.service';
import {
  DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS,
  DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
} from '../src/modules/recommendations/recommendation-tuning-config';
import { RecommendationsService } from '../src/modules/recommendations/recommendations.service';
import { readBody } from './test-helpers';

jest.setTimeout(30000);

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
  let billingService: BillingService;
  let recommendationsService: RecommendationsService;
  let products: StoredProduct[];
  let recommendationEvents: Array<Record<string, unknown>>;
  const originalEnv = { ...process.env };

  const prismaMock = {
    shop: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    sellerWallet: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    productViewLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    searchLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    sponsoredCampaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    billingLedgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    recommendationEvent: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    recommendationTuningPreset: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    recommendationTuningAuditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const buildApp = async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(AdminJwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string | undefined>;
              user?: {
                userId: string;
                sub: string;
                email: string;
                role: string;
              };
            };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            userId: request.headers['x-test-user-id'] ?? 'admin-user-1',
            sub: request.headers['x-test-user-id'] ?? 'admin-user-1',
            email: 'admin@example.com',
            role: request.headers['x-test-role'] ?? 'ADMIN',
          };
          return true;
        },
      })
      .overrideGuard(SellerJwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string | undefined>;
              user?: {
                userId: string;
                sub: string;
                email: string;
                role: string;
              };
            };
          };
        }) => {
          const request = context.switchToHttp().getRequest();
          const userId = request.headers['x-test-user-id'] ?? 'seller-user-1';
          request.user = {
            userId,
            sub: userId,
            email: `${userId}@example.com`,
            role: request.headers['x-test-role'] ?? 'SELLER',
          };
          return true;
        },
      })
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
    process.env.RECOMMENDATION_SMART_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_TUNING_WORKFLOW_ENABLED = 'false';
    process.env.RECOMMENDATION_TUNING_PRESETS_ENABLED = 'false';
    process.env.RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED = 'false';
    process.env.ADS_MODERATION_REQUIRED_FOR_SERVING = 'false';
    process.env.ADS_INVALID_CLICK_PROTECTION_ENABLED = 'true';
    process.env.ADS_SELF_CLICK_BLOCK_ENABLED = 'true';
    process.env.ADS_RAPID_REPEAT_CLICK_WINDOW_SECONDS = '30';
    process.env.ADS_IP_REPEAT_CLICK_WINDOW_SECONDS = '10';
    process.env.ADS_CLICK_HASH_SALT = 'test-ads-click-hash-salt';

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
      buildProduct({
        id: '00000000-0000-0000-0000-000000000004',
        title: 'Seller two product',
        categoryId: 33n,
        categoryName: 'Dresses',
        brand: 'South Berry',
        shopId: '20000000-0000-0000-0000-000000000002',
        shopName: 'Second Shop',
        shopSlug: 'second-shop',
      }),
    ];
    recommendationEvents = [];
    const walletState = {
      id: 'wallet-1',
      shopId: 'shop-1',
      balance: new Prisma.Decimal('50'),
      reservedBalance: new Prisma.Decimal('0'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T00:00:00Z'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
    };

    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      const matchingProduct = products.find(
        (product) => product.shopId === where.id,
      );
      if (where.id === 'shop-1') {
        if (select?.sellerProfile) {
          return Promise.resolve({
            id: where.id,
            sellerProfile: { userId: 'seller-user-1' },
          });
        }
        if (select?.name) {
          return Promise.resolve({ name: 'Ready Shop' });
        }
        return Promise.resolve({ id: where.id });
      }
      if (matchingProduct) {
        if (select?.sellerProfile) {
          return Promise.resolve({
            id: where.id,
            sellerProfile: {
              userId:
                where.id === '20000000-0000-0000-0000-000000000002'
                  ? 'seller-user-2'
                  : 'seller-user-1',
            },
          });
        }
        if (select?.name) {
          return Promise.resolve({ name: matchingProduct.shop.name });
        }
        return Promise.resolve({ id: where.id });
      }
      return Promise.resolve(null);
    });
    prismaMock.product.findMany.mockImplementation(
      ({ where }: { where?: Record<string, unknown> }) => {
        const includedIds =
          where &&
          typeof where.id === 'object' &&
          where.id !== null &&
          'in' in where.id &&
          Array.isArray((where.id as { in?: unknown[] }).in)
            ? new Set(
                ((where.id as { in?: unknown[] }).in ?? []).map((value) =>
                  String(value),
                ),
              )
            : null;
        const excludedId =
          where &&
          typeof where.id === 'object' &&
          where.id !== null &&
          'not' in where.id
            ? String((where.id as { not?: string }).not)
            : null;

        const shopId =
          where && typeof where.shopId === 'string' ? where.shopId : null;

        return products.filter(
          (product) =>
            product.id !== excludedId &&
            (!includedIds || includedIds.has(product.id)) &&
            (!shopId || product.shopId === shopId),
        );
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
        return product ?? null;
      },
    );
    prismaMock.productViewLog.create.mockResolvedValue({});
    prismaMock.productViewLog.findMany.mockResolvedValue([]);
    prismaMock.searchLog.create.mockResolvedValue({});
    prismaMock.searchLog.findMany.mockResolvedValue([]);
    prismaMock.sellerWallet.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where?.shopId?.in?.includes(walletState.shopId) ? [walletState] : [],
      ),
    );
    prismaMock.sellerWallet.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.shopId === walletState.shopId ? walletState : null),
    );
    prismaMock.sellerWallet.create.mockImplementation(({ data }) => {
      walletState.shopId = data.shopId;
      walletState.balance = new Prisma.Decimal(data.balance ?? 0);
      walletState.reservedBalance = new Prisma.Decimal(
        data.reservedBalance ?? 0,
      );
      walletState.currency = data.currency;
      walletState.status = data.status;
      return Promise.resolve({ ...walletState });
    });
    prismaMock.sellerWallet.upsert.mockImplementation(({ where, create }) => {
      if (where.shopId === walletState.shopId) {
        return Promise.resolve({ ...walletState });
      }
      walletState.shopId = create.shopId;
      walletState.balance = new Prisma.Decimal(create.balance ?? 0);
      walletState.reservedBalance = new Prisma.Decimal(
        create.reservedBalance ?? 0,
      );
      walletState.currency = create.currency;
      walletState.status = create.status;
      return Promise.resolve({ ...walletState });
    });
    prismaMock.sellerWallet.update.mockImplementation(({ data }) => {
      walletState.balance = new Prisma.Decimal(data.balance);
      walletState.reservedBalance = new Prisma.Decimal(data.reservedBalance);
      walletState.currency = data.currency ?? walletState.currency;
      return Promise.resolve({ ...walletState });
    });
    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([]);
    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue(null);
    prismaMock.billingLedgerEntry.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `ledger-${recommendationEvents.length + 1}`,
        createdAt: new Date('2026-06-07T00:00:00Z'),
        ...data,
        campaign: data.campaignId
          ? {
              id: data.campaignId,
              name: 'Sponsored Campaign',
            }
          : null,
      }),
    );
    prismaMock.billingLedgerEntry.findMany.mockResolvedValue([]);
    prismaMock.recommendationEvent.create.mockImplementation(({ data }) => {
      if (
        data.idempotencyKey &&
        recommendationEvents.some(
          (event) => event.idempotencyKey === data.idempotencyKey,
        )
      ) {
        const duplicateError = new Error('Duplicate recommendation event');
        Object.assign(duplicateError, { code: 'P2002' });
        return Promise.reject(duplicateError);
      }
      const created = {
        id: `event-${recommendationEvents.length + 1}`,
        createdAt: new Date(),
        ...data,
      };
      recommendationEvents.push(created);
      return Promise.resolve(created);
    });
    prismaMock.recommendationEvent.update.mockImplementation(
      ({ where, data }) => {
        const event = recommendationEvents.find((item) => item.id === where.id);
        if (event) {
          Object.assign(event, data);
        }
        return Promise.resolve(event ?? { id: where.id, ...data });
      },
    );
    prismaMock.recommendationEvent.findFirst.mockImplementation(({ where }) => {
      return Promise.resolve(
        recommendationEvents.find((event) => {
          if (where?.id?.not && event.id === where.id.not) {
            return false;
          }
          if (where?.type && event.type !== where.type) {
            return false;
          }
          if (where?.campaignId && event.campaignId !== where.campaignId) {
            return false;
          }
          if (where?.productId && event.productId !== where.productId) {
            return false;
          }
          if (where?.tokenHash && event.tokenHash !== where.tokenHash) {
            return false;
          }
          if (where?.sessionHash && event.sessionHash !== where.sessionHash) {
            return false;
          }
          if (where?.ipHash && event.ipHash !== where.ipHash) {
            return false;
          }
          if (
            where?.userAgentHash &&
            event.userAgentHash !== where.userAgentHash
          ) {
            return false;
          }
          if (
            where?.validityStatus &&
            event.validityStatus !== where.validityStatus
          ) {
            return false;
          }
          if (
            where?.createdAt?.gte &&
            new Date(String(event.createdAt)) < where.createdAt.gte
          ) {
            return false;
          }
          return true;
        }) ?? null,
      );
    });
    prismaMock.recommendationEvent.findMany.mockImplementation(({ where }) => {
      return Promise.resolve(
        recommendationEvents.filter((event) => {
          if (where?.campaignId && event.campaignId !== where.campaignId) {
            return false;
          }
          if (where?.charged !== undefined && event.charged !== where.charged) {
            return false;
          }
          if (
            where?.createdAt?.gte &&
            new Date(String(event.createdAt)) < where.createdAt.gte
          ) {
            return false;
          }
          if (
            where?.createdAt?.lte &&
            new Date(String(event.createdAt)) > where.createdAt.lte
          ) {
            return false;
          }
          if (
            where?.productId?.in &&
            !where.productId.in.includes(event.productId)
          ) {
            return false;
          }
          if (
            typeof where?.productId === 'string' &&
            event.productId !== where.productId
          ) {
            return false;
          }
          return true;
        }),
      );
    });
    const tuningPreset = {
      id: '40000000-0000-0000-0000-000000000001',
      presetKey: '40000000-0000-0000-0000-000000000002',
      name: 'Focused freshness preset',
      description: 'Recommendation E2E tuning preset',
      status: 'active',
      version: 1,
      weights: {
        ...DEFAULT_RECOMMENDATION_TUNING_WEIGHTS,
        freshnessScore: 0.5,
      },
      guardrails: { ...DEFAULT_RECOMMENDATION_TUNING_GUARDRAILS },
      createdByAdminId: 'admin-user-1',
      activatedAt: new Date('2026-06-11T00:00:00Z'),
      archivedAt: null,
      createdAt: new Date('2026-06-11T00:00:00Z'),
      updatedAt: new Date('2026-06-11T00:00:00Z'),
    };
    prismaMock.recommendationTuningPreset.findFirst.mockResolvedValue(
      tuningPreset,
    );
    prismaMock.recommendationTuningPreset.findUnique.mockResolvedValue(
      tuningPreset,
    );
    prismaMock.recommendationTuningAuditLog.create.mockResolvedValue({
      id: 'tuning-audit-1',
    });
    prismaMock.$transaction.mockImplementation((callback) =>
      callback(prismaMock),
    );
    app = await buildApp();
    billingService = app.get(BillingService);
    recommendationsService = app.get(RecommendationsService);
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

    expect(
      readBody<{
        items: unknown[];
        products: unknown[];
        algorithm: string;
        placement: string;
      }>(response),
    ).toEqual({
      algorithm: 'rule_based_v2',
      placement: 'home',
      items: [],
      products: [],
    });
  });

  it('keeps active tuning presets inert until the runtime flag is enabled', async () => {
    process.env.RECOMMENDATION_TUNING_WORKFLOW_ENABLED = 'true';
    process.env.RECOMMENDATION_TUNING_PRESETS_ENABLED = 'true';

    const baseline = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);
    const baselineScore = readBody<{ items: Array<{ score: number }> }>(
      baseline,
    ).items[0]?.score;

    process.env.RECOMMENDATION_TUNING_ACTIVE_PRESET_ENABLED = 'true';
    const tuned = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);
    const tunedScore = readBody<{ items: Array<{ score: number }> }>(tuned)
      .items[0]?.score;

    expect(tunedScore).not.toBe(baselineScore);
  });

  it('previews a tuning preset without recommendation events or billing charges', async () => {
    process.env.RECOMMENDATION_TUNING_WORKFLOW_ENABLED = 'true';
    process.env.RECOMMENDATION_TUNING_PRESETS_ENABLED = 'true';

    const response = await request(app.getHttpServer())
      .post(
        '/api/admin/recommendations/tuning-presets/40000000-0000-0000-0000-000000000001/preview',
      )
      .send({ placement: 'home', limit: 3 })
      .expect(201);

    const body = readBody<{
      items: Array<{
        current: { finalScore: number };
        tuned: { finalScore: number };
      }>;
      guardrailViolations: string[];
    }>(response);
    expect(body.items[0]?.tuned.finalScore).not.toBe(
      body.items[0]?.current.finalScore,
    );
    expect(body.guardrailViolations).toEqual([]);
    expect(prismaMock.recommendationEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.billingLedgerEntry.create).not.toHaveBeenCalled();
    expect(prismaMock.recommendationTuningAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'previewed' }),
      }),
    );
  });

  it('returns similar products without including the source product', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/public/recommendations/products/00000000-0000-0000-0000-000000000001/similar?limit=2',
      )
      .expect(200);

    const body = readBody<{
      algorithm: string;
      placement: string;
      items: Array<{
        product: { id: string; name: string };
        rank: number;
        score: number | null;
        reasonCodes: string[];
      }>;
      products: Array<{ id: string; name: string }>;
    }>(response);
    expect(body.items).toHaveLength(2);
    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.placement).toBe('product_detail');
    expect(body.items[0]?.product.id).toBe(
      '00000000-0000-0000-0000-000000000002',
    );
    expect(body.items[0]?.reasonCodes).toContain('same_category');
    expect(body.products[0]?.id).toBe('00000000-0000-0000-0000-000000000002');
    expect(
      body.items.some(
        (item) => item.product.id === '00000000-0000-0000-0000-000000000001',
      ),
    ).toBe(false);
  });

  it('returns safe empty recommendations when public recommendations are disabled', async () => {
    process.env.PUBLIC_RECOMMENDATIONS_ENABLED = 'false';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=8')
      .expect(200);

    expect(
      readBody<{
        algorithm: string;
        placement: string;
        items: unknown[];
        products: unknown[];
      }>(response),
    ).toEqual({
      algorithm: 'rule_based_v2',
      placement: 'home',
      items: [],
      products: [],
    });
  });

  it('returns rule_based_v1 responses when smart ranking is disabled', async () => {
    process.env.RECOMMENDATION_SMART_RANKING_ENABLED = 'false';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      placement: string;
      items: Array<{
        product: { id: string };
        rank: number;
        score: number | null;
        reasonCodes: string[];
      }>;
      products: Array<{ id: string }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v1');
    expect(body.placement).toBe('home');
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.rank).toBe(1);
    expect(body.items[0]?.score).toBeNull();
    expect(body.items[0]?.reasonCodes).toEqual([]);
    expect(body.products).toHaveLength(2);
  });

  it('returns admin recommendation analytics overview, algorithms, scenarios, and products without leaking raw actor data', async () => {
    recommendationEvents.push(
      buildAnalyticsEvent({
        id: 'analytics-impression-1',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        sponsored: true,
        charged: false,
        metadata: { personalized: true },
        createdAt: new Date('2026-06-07T09:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-click-1',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'click',
        sponsored: true,
        charged: true,
        cost: new Prisma.Decimal('1.25'),
        metadata: { personalized: true },
        createdAt: new Date('2026-06-07T09:05:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-impression-2',
        productId: '00000000-0000-0000-0000-000000000003',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v1',
        scenarioType: 'search',
        type: 'impression',
        sponsored: false,
        charged: false,
        metadata: { personalized: false },
        createdAt: new Date('2026-06-07T11:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-click-2',
        productId: '00000000-0000-0000-0000-000000000003',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v1',
        scenarioType: 'search',
        type: 'click',
        sponsored: false,
        charged: false,
        metadata: { personalized: false },
        createdAt: new Date('2026-06-07T11:10:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-impression-3',
        productId: '00000000-0000-0000-0000-000000000004',
        shopId: '20000000-0000-0000-0000-000000000002',
        algorithm: 'rule_based_v2',
        scenarioType: 'similar',
        type: 'impression',
        sponsored: false,
        charged: false,
        metadata: null,
        createdAt: new Date('2026-06-07T12:00:00.000Z'),
      }),
    );

    const overviewResponse = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/overview?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .expect(200);

    const algorithmsResponse = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/algorithms?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .expect(200);

    const scenariosResponse = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/scenarios?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .expect(200);

    const productsResponse = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/products?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z&limit=5',
      )
      .expect(200);

    const overview = readBody<{
      summary: {
        overall: { impressions: number; clicks: number; ctr: number };
        sponsored: {
          impressions: number;
          clicks: number;
          ctr: number;
          chargedAmount: string;
        };
        personalization: {
          trackedImpressions: number;
          trackedClicks: number;
          personalizedImpressions: number;
          personalizedClicks: number;
          personalizedCtr: number;
          nonPersonalizedImpressions: number;
          nonPersonalizedClicks: number;
          nonPersonalizedCtr: number;
        };
      };
    }>(overviewResponse);
    expect(overview.summary.overall).toEqual({
      impressions: 3,
      clicks: 2,
      ctr: 66.67,
    });
    expect(overview.summary.sponsored).toEqual({
      impressions: 1,
      clicks: 1,
      ctr: 100,
      chargedAmount: '1.25',
    });
    expect(overview.summary.personalization).toEqual({
      trackedImpressions: 2,
      trackedClicks: 2,
      personalizedImpressions: 1,
      personalizedClicks: 1,
      personalizedCtr: 100,
      nonPersonalizedImpressions: 1,
      nonPersonalizedClicks: 1,
      nonPersonalizedCtr: 100,
    });
    expect(JSON.stringify(overview)).not.toContain('userId');
    expect(JSON.stringify(overview)).not.toContain('guestSessionId');
    expect(JSON.stringify(overview)).not.toContain('recentViewScore');

    const algorithms = readBody<{
      items: Array<{
        algorithm: string;
        impressions: number;
        clicks: number;
        ctr: number;
        sponsoredCtr: number;
        chargedAmount: string;
      }>;
    }>(algorithmsResponse);
    expect(algorithms.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          algorithm: 'rule_based_v2',
          impressions: 2,
          clicks: 1,
          ctr: 50,
          sponsoredCtr: 100,
          chargedAmount: '1.25',
        }),
        expect.objectContaining({
          algorithm: 'rule_based_v1',
          impressions: 1,
          clicks: 1,
          ctr: 100,
          sponsoredCtr: 0,
          chargedAmount: '0.00',
        }),
      ]),
    );

    const scenarios = readBody<{
      items: Array<{
        scenarioType: 'home' | 'similar' | 'search';
        impressions: number;
        clicks: number;
        ctr: number;
      }>;
    }>(scenariosResponse);
    expect(scenarios.items).toEqual([
      expect.objectContaining({
        scenarioType: 'home',
        impressions: 1,
        clicks: 1,
        ctr: 100,
      }),
      expect.objectContaining({
        scenarioType: 'similar',
        impressions: 1,
        clicks: 0,
        ctr: 0,
      }),
      expect.objectContaining({
        scenarioType: 'search',
        impressions: 1,
        clicks: 1,
        ctr: 100,
      }),
    ]);

    const products = readBody<{
      topRecommendedProducts: Array<{
        productId: string;
        productName: string;
        shopName: string;
        impressions: number;
        clicks: number;
        chargedAmount: string;
      }>;
      topClickedProducts: Array<{
        productId: string;
        productName: string;
        clicks: number;
      }>;
    }>(productsResponse);
    expect(products.topRecommendedProducts[0]).toEqual(
      expect.objectContaining({
        productId: '00000000-0000-0000-0000-000000000002',
        productName: 'Similar jacket',
        shopName: 'Ready Shop',
        impressions: 1,
        clicks: 1,
        chargedAmount: '1.25',
      }),
    );
    expect(products.topClickedProducts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: '00000000-0000-0000-0000-000000000002',
          clicks: 1,
        }),
        expect.objectContaining({
          productId: '00000000-0000-0000-0000-000000000003',
          clicks: 1,
        }),
      ]),
    );
  });

  it('returns zero-safe analytics responses when no recommendation events match the range', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/overview?range=custom&from=2026-06-09T00:00:00.000Z&to=2026-06-09T23:59:59.999Z',
      )
      .expect(200);

    expect(
      readBody<{
        summary: {
          overall: { impressions: number; clicks: number; ctr: number };
          sponsored: {
            impressions: number;
            clicks: number;
            ctr: number;
            chargedAmount: string;
          };
        };
      }>(response),
    ).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          overall: { impressions: 0, clicks: 0, ctr: 0 },
          sponsored: {
            impressions: 0,
            clicks: 0,
            ctr: 0,
            chargedAmount: '0.00',
          },
        }),
      }),
    );
  });

  it('filters analytics by date range', async () => {
    recommendationEvents.push(
      buildAnalyticsEvent({
        id: 'analytics-date-old',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-05T08:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-date-new',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T08:00:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/admin/recommendations/analytics/overview?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .expect(200);

    expect(
      readBody<{
        summary: {
          overall: { impressions: number; clicks: number; ctr: number };
        };
      }>(response).summary.overall,
    ).toEqual({
      impressions: 1,
      clicks: 0,
      ctr: 0,
    });
  });

  it('limits seller recommendation analytics to the seller shop and blocks other sellers', async () => {
    recommendationEvents.push(
      buildAnalyticsEvent({
        id: 'seller-analytics-own',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        sponsored: true,
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'seller-analytics-own-click',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'click',
        sponsored: true,
        charged: true,
        cost: new Prisma.Decimal('2.00'),
        createdAt: new Date('2026-06-07T10:05:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'seller-analytics-other-shop',
        productId: '00000000-0000-0000-0000-000000000004',
        shopId: '20000000-0000-0000-0000-000000000002',
        algorithm: 'rule_based_v1',
        scenarioType: 'search',
        type: 'click',
        createdAt: new Date('2026-06-07T10:10:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .get(
        '/api/seller/shops/10000000-0000-0000-0000-000000000001/recommendations/analytics/overview?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .set('x-test-user-id', 'seller-user-1')
      .set('x-test-role', 'SELLER')
      .expect(200);

    const body = readBody<{
      shopId: string;
      shopName: string;
      summary: {
        overall: { impressions: number; clicks: number; ctr: number };
        sponsored: {
          impressions: number;
          clicks: number;
          ctr: number;
          chargedAmount: string;
        };
      };
      topClickedProducts: Array<{ productId: string }>;
    }>(response);
    expect(body.shopId).toBe('10000000-0000-0000-0000-000000000001');
    expect(body.shopName).toBe('Ready Shop');
    expect(body.summary.overall).toEqual({
      impressions: 1,
      clicks: 1,
      ctr: 100,
    });
    expect(body.summary.sponsored).toEqual({
      impressions: 1,
      clicks: 1,
      ctr: 100,
      chargedAmount: '2.00',
    });
    expect(body.topClickedProducts).toEqual([
      expect.objectContaining({
        productId: '00000000-0000-0000-0000-000000000002',
      }),
    ]);

    await request(app.getHttpServer())
      .get(
        '/api/seller/shops/10000000-0000-0000-0000-000000000001/recommendations/analytics/overview?range=custom&from=2026-06-07T00:00:00.000Z&to=2026-06-07T23:59:59.999Z',
      )
      .set('x-test-user-id', 'seller-user-2')
      .set('x-test-role', 'SELLER')
      .expect(403);
  });

  it('keeps personalization disabled by default even when behavior logs exist', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    prismaMock.productViewLog.findMany.mockResolvedValue([
      {
        productId: '00000000-0000-0000-0000-000000000003',
        createdAt: new Date('2026-06-07T00:00:00Z'),
      },
    ]);
    prismaMock.searchLog.findMany.mockResolvedValue([
      {
        query: 'city shoes',
        normalizedQuery: 'city shoes',
        createdAt: new Date('2026-06-07T00:00:00Z'),
      },
    ]);
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3&debug=true')
      .set('x-guest-session-id', 'guest-personalization-off')
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          scoreBreakdown?: {
            personalizationScore: number;
            recentViewScore: number;
            categoryAffinityScore: number;
            searchIntentScore: number;
            clickAffinityScore: number;
          } | null;
        };
      }>;
    }>(response);
    const viewedProduct = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000003',
    );

    expect(viewedProduct?.scoreExplanation?.scoreBreakdown).toMatchObject({
      personalizationScore: 0,
      recentViewScore: 0,
      categoryAffinityScore: 0,
      searchIntentScore: 0,
      clickAffinityScore: 0,
    });
  });

  it('adds bounded personalization scores when the env flag is enabled', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_PERSONALIZATION_ENABLED = 'true';
    products = [
      buildProduct({
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Base jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Blue linen dress',
        categoryId: 22n,
        categoryName: 'Dresses',
        brand: 'North Berry',
        feedbackCount: 2,
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000003',
        title: 'Black shoes',
        categoryId: 33n,
        categoryName: 'Shoes',
        brand: 'City Berry',
        feedbackCount: 14,
      }),
    ];
    prismaMock.productViewLog.findMany.mockResolvedValue([
      {
        productId: '00000000-0000-0000-0000-000000000002',
        createdAt: new Date('2026-06-08T00:00:00Z'),
      },
    ]);
    prismaMock.searchLog.findMany.mockResolvedValue([
      {
        query: 'linen dress',
        normalizedQuery: 'linen dress',
        createdAt: new Date('2026-06-08T00:00:00Z'),
      },
    ]);
    prismaMock.recommendationEvent.findMany.mockResolvedValue([
      {
        productId: '00000000-0000-0000-0000-000000000002',
        createdAt: new Date('2026-06-08T00:00:00Z'),
      },
    ]);
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3&debug=true')
      .set('x-guest-session-id', 'guest-personalization-on')
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          scoreBreakdown?: {
            personalizationScore: number;
            recentViewScore: number;
            categoryAffinityScore: number;
            searchIntentScore: number;
            clickAffinityScore: number;
          } | null;
        };
      }>;
    }>(response);
    const personalizedItem = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000002',
    );

    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.personalizationScore,
    ).toBeGreaterThan(0);
    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.personalizationScore,
    ).toBeLessThanOrEqual(18);
    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.recentViewScore,
    ).toBeGreaterThan(0);
    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.categoryAffinityScore,
    ).toBeGreaterThan(0);
    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.searchIntentScore,
    ).toBeGreaterThan(0);
    expect(
      personalizedItem?.scoreExplanation?.scoreBreakdown?.clickAffinityScore,
    ).toBeGreaterThan(0);
  });

  it('uses personalization safely in search recommendations without leaking actor data', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_PERSONALIZATION_ENABLED = 'true';
    prismaMock.searchLog.findMany.mockResolvedValue([
      {
        query: 'similar jacket',
        normalizedQuery: 'similar jacket',
        createdAt: new Date('2026-06-08T00:00:00Z'),
      },
      {
        query: 'north berry jacket',
        normalizedQuery: 'north berry jacket',
        createdAt: new Date('2026-06-08T12:00:00Z'),
      },
    ]);
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/public/recommendations/search?q=similar%20jacket&limit=2&debug=true',
      )
      .set('x-guest-session-id', 'guest-search-personalization')
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          scoreBreakdown?: {
            searchIntentScore: number;
          } | null;
        };
      }>;
    }>(response);
    const serialized = JSON.stringify(body);

    expect(
      body.items[0]?.scoreExplanation?.scoreBreakdown?.searchIntentScore ?? 0,
    ).toBeGreaterThanOrEqual(0);
    expect(serialized).not.toContain('guest-search-personalization');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('guestSessionId');
  });

  it('keeps sponsored ranking disabled by default even when config ids are present', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    process.env.RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS =
      '10000000-0000-0000-0000-000000000001';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2&debug=true')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          scoreBreakdown: {
            sponsoredBoostScore: number;
            businessBoostScore: number;
            maxSponsoredBoost: number;
          } | null;
          sponsoredReason?: string | null;
          campaignReadiness?: {
            campaignReadinessStatus: string;
          } | null;
        };
      }>;
    }>(response);
    const targetItem = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000002',
    );

    expect(body.algorithm).toBe('rule_based_v2');
    expect(
      targetItem?.scoreExplanation?.scoreBreakdown?.sponsoredBoostScore,
    ).toBe(0);
    expect(
      targetItem?.scoreExplanation?.scoreBreakdown?.businessBoostScore,
    ).toBe(0);
    expect(
      targetItem?.scoreExplanation?.scoreBreakdown?.maxSponsoredBoost,
    ).toBe(0);
    expect(targetItem?.scoreExplanation?.sponsoredReason).toBeNull();
    expect(
      targetItem?.scoreExplanation?.campaignReadiness?.campaignReadinessStatus,
    ).toBe('disabled');
  });

  it('applies bounded sponsored boosts only when the env flag is enabled', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    process.env.RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS =
      '10000000-0000-0000-0000-000000000001';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_BOOST = '8';
    process.env.RECOMMENDATION_BUSINESS_SHOP_BOOST = '4';
    process.env.RECOMMENDATION_SPONSORED_MAX_BOOST = '5';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3&debug=true')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          scoreBreakdown: {
            sponsoredBoostScore: number;
            businessBoostScore: number;
            maxSponsoredBoost: number;
          } | null;
          sponsoredReason?: string | null;
          campaignReadiness?: {
            sponsoredEligible: boolean;
            sponsoredBoostApplied: boolean;
            sponsoredBoostScore: number;
            sponsoredPresetId: string | null;
            campaignReadinessStatus: string;
            billingMode: string;
          } | null;
          sponsoredCampaign?: {
            campaignId: string | null;
            sponsorType: string;
            billingMode: string;
            rolloutMode: string;
          } | null;
        };
      }>;
    }>(response);
    const sponsoredItem = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000002',
    );
    const totalBoost =
      (sponsoredItem?.scoreExplanation?.scoreBreakdown?.sponsoredBoostScore ??
        0) +
      (sponsoredItem?.scoreExplanation?.scoreBreakdown?.businessBoostScore ??
        0);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(
      sponsoredItem?.scoreExplanation?.scoreBreakdown?.sponsoredBoostScore,
    ).toBeGreaterThan(0);
    expect(
      sponsoredItem?.scoreExplanation?.scoreBreakdown?.businessBoostScore,
    ).toBeGreaterThan(0);
    expect(totalBoost).toBeLessThanOrEqual(
      sponsoredItem?.scoreExplanation?.scoreBreakdown?.maxSponsoredBoost ?? 0,
    );
    expect(sponsoredItem?.scoreExplanation?.sponsoredReason).toContain(
      'Internal sponsored',
    );
    expect(sponsoredItem?.scoreExplanation?.campaignReadiness).toMatchObject({
      sponsoredEligible: true,
      sponsoredBoostApplied: true,
      sponsoredPresetId: 'balanced',
      campaignReadinessStatus: 'boosted',
      billingMode: 'none',
    });
    expect(sponsoredItem?.scoreExplanation?.sponsoredCampaign).toMatchObject({
      sponsorType: 'campaign',
      billingMode: 'none',
      rolloutMode: 'internal',
    });
  });

  it('keeps recommendation QA comparison disabled by default', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/recommendations/compare?placement=home&limit=2')
      .expect(404);
  });

  it('keeps recommendation QA snapshot export disabled by default', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/internal/recommendations/compare?placement=home&limit=2&export=true&format=json',
      )
      .expect(404);
  });

  it('keeps recommendation QA snapshot diff disabled by default', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/recommendations/diff')
      .send(buildSnapshotDiffPayload())
      .expect(404);
  });

  it('keeps recommendation QA threshold presets disabled by default', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/recommendations/presets')
      .expect(404);
  });

  it('keeps recommendation QA baseline catalog disabled by default', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/recommendations/baseline-catalog')
      .expect(404);
  });

  it('keeps sponsored ranking presets disabled by default', async () => {
    await request(app.getHttpServer())
      .get('/api/internal/recommendations/sponsored-presets')
      .expect(404);
  });

  it('keeps recommendation QA pack validation disabled by default', async () => {
    await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(buildQaPackPayload())
      .expect(404);
  });

  it('returns internal ranking comparison when the QA tools flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/internal/recommendations/compare?placement=home&limit=2&debug=true',
      )
      .expect(200);

    const body = readBody<{
      placement: string;
      sponsoredRanking: {
        sponsoredRankingEnabled: boolean;
        activePreset: {
          id: string;
          version: string;
        } | null;
      } | null;
      items: Array<{
        productId: string;
        productName: string;
        rankMovement: number | null;
        ruleBasedV1: {
          algorithm: string;
          rank: number | null;
          finalScore: number | null;
          reasons: string[];
          scoreBreakdown: Record<string, number> | null;
          campaignReadiness?: {
            campaignReadinessStatus: string;
          } | null;
        } | null;
        ruleBasedV2: {
          algorithm: string;
          rank: number | null;
          finalScore: number | null;
          reasons: string[];
          scoreBreakdown: Record<string, number> | null;
          campaignReadiness?: {
            campaignReadinessStatus: string;
            billingMode: string;
          } | null;
        } | null;
      }>;
    }>(response);

    expect(body.placement).toBe('home');
    expect(body.sponsoredRanking?.activePreset?.id).toBe('balanced');
    expect(body.sponsoredRanking?.activePreset?.version).toBe('1.0.0');
    expect(typeof body.items[0]?.productId).toBe('string');
    expect(typeof body.items[0]?.productName).toBe('string');
    expect(body.items[0]?.ruleBasedV1?.algorithm).toBe('rule_based_v1');
    expect(body.items[0]?.ruleBasedV2?.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.ruleBasedV2?.scoreBreakdown).toBeTruthy();
    expect(body.items[0]?.ruleBasedV2?.campaignReadiness).toMatchObject({
      billingMode: 'none',
    });
  });

  it('calculates rank movement and avoids leaking session or customer data', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    products = [
      buildProduct({
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Source jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
        feedbackCount: 25,
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Popular jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
        feedbackCount: 25,
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000003',
        title: 'Viewed shoes',
        categoryId: 22n,
        categoryName: 'Shoes',
        brand: 'City Berry',
        feedbackCount: 0,
        averageRating: '4.0',
      }),
    ];
    prismaMock.productViewLog.findMany.mockResolvedValue([
      { productId: '00000000-0000-0000-0000-000000000003' },
    ]);
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/internal/recommendations/compare?placement=home&limit=3&debug=true&guestSessionId=guest-qa',
      )
      .expect(200);

    const body = readBody<{
      items: Array<{
        productId: string;
        rankMovement: number | null;
        ruleBasedV1: { rank: number | null } | null;
        ruleBasedV2: { rank: number | null } | null;
      }>;
    }>(response);
    const viewedShoes = body.items.find(
      (item) => item.productId === '00000000-0000-0000-0000-000000000003',
    );
    const serialized = JSON.stringify(body);

    expect(viewedShoes?.ruleBasedV1?.rank).toBe(3);
    expect(viewedShoes?.ruleBasedV2?.rank).toBe(1);
    expect(viewedShoes?.rankMovement).toBe(2);
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('searchTerms');
  });

  it('exports a safe QA ranking snapshot when the internal flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/internal/recommendations/compare?placement=search&q=similar%20jacket&limit=2&debug=true&export=true&format=json',
      )
      .expect(200);

    const body = readBody<{
      scenarioType: string;
      placement: string;
      productId: string | null;
      query: string | null;
      limit: number;
      generatedAt: string;
      comparedAlgorithms: string[];
      items: Array<{
        product: {
          id: string;
          name: string;
          seoSlug: string | null;
          categoryName: string | null;
          brand: string | null;
          color: string | null;
          price: string | null;
          inStock: boolean;
          imageUrl: string | null;
          shopName: string | null;
          shopSlug: string | null;
        };
        rankMovement: number | null;
        ruleBasedV1: { rank: number | null } | null;
        ruleBasedV2: {
          algorithm: string;
          rank: number | null;
          finalScore: number | null;
          reasons: string[];
          scoreBreakdown: Record<string, number> | null;
        } | null;
      }>;
    }>(response);
    const serialized = JSON.stringify(body);

    expect(body.scenarioType).toBe('search');
    expect(body.placement).toBe('search');
    expect(body.productId).toBeNull();
    expect(body.query).toBe('similar jacket');
    expect(body.limit).toBe(2);
    expect(Array.isArray(body.comparedAlgorithms)).toBe(true);
    expect(body.comparedAlgorithms).toEqual(['rule_based_v1', 'rule_based_v2']);
    expect(typeof body.generatedAt).toBe('string');
    expect(body.items[0]?.product.id).toBe(
      '00000000-0000-0000-0000-000000000002',
    );
    expect(body.items[0]?.product.name).toContain('Similar jacket');
    expect(body.items[0]?.ruleBasedV1).toBeNull();
    expect(body.items[0]?.ruleBasedV2?.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.ruleBasedV2?.scoreBreakdown).toBeTruthy();
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('searchTerms');
    expect(serialized).not.toContain('paymentInstructions');
    expect(serialized).not.toContain('approvalStatus');
  });

  it('preserves rank movement in exported QA snapshots', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    products = [
      buildProduct({
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Source jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
        feedbackCount: 25,
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Popular jacket',
        categoryId: 11n,
        categoryName: 'Jackets',
        brand: 'North Berry',
        feedbackCount: 25,
      }),
      buildProduct({
        id: '00000000-0000-0000-0000-000000000003',
        title: 'Viewed shoes',
        categoryId: 22n,
        categoryName: 'Shoes',
        brand: 'City Berry',
        feedbackCount: 0,
        averageRating: '4.0',
      }),
    ];
    prismaMock.productViewLog.findMany.mockResolvedValue([
      { productId: '00000000-0000-0000-0000-000000000003' },
    ]);
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/internal/recommendations/compare?placement=home&limit=3&debug=true&guestSessionId=guest-qa&export=true&format=json',
      )
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        rankMovement: number | null;
        ruleBasedV1: { rank: number | null } | null;
        ruleBasedV2: { rank: number | null } | null;
      }>;
    }>(response);
    const viewedShoes = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000003',
    );

    expect(viewedShoes?.ruleBasedV1?.rank).toBe(3);
    expect(viewedShoes?.ruleBasedV2?.rank).toBe(1);
    expect(viewedShoes?.rankMovement).toBe(2);
  });

  it('diffs two QA snapshots with safe statuses, deltas, and no private leakage', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/diff')
      .send(buildSnapshotDiffPayload())
      .expect(201);

    const body = readBody<{
      summary: {
        totalItemsCompared: number;
        movedUpCount: number;
        movedDownCount: number;
        addedCount: number;
        removedCount: number;
        unchangedCount: number;
      };
      items: Array<{
        productId: string;
        status: string;
        oldRank: number | null;
        newRank: number | null;
        rankMovement: number | null;
        oldScore: number | null;
        newScore: number | null;
        scoreDelta: number | null;
        reasonDelta: {
          added: string[];
          removed: string[];
        } | null;
        scoreBreakdownDelta: {
          categoryScore: number;
          textScore: number;
          popularityScore: number;
          freshnessScore: number;
          ratingScore: number;
          stockScore: number;
          shopScore: number;
          penaltyScore: number;
          sponsoredBoostScore: number;
          businessBoostScore: number;
          maxSponsoredBoost: number;
        } | null;
      }>;
    }>(response);
    const unchanged = body.items.find((item) => item.productId === 'prod-1');
    const movedUp = body.items.find((item) => item.productId === 'prod-2');
    const movedDown = body.items.find((item) => item.productId === 'prod-3');
    const removed = body.items.find((item) => item.productId === 'prod-4');
    const added = body.items.find((item) => item.productId === 'prod-5');
    const serialized = JSON.stringify(body);

    expect(body.summary).toEqual({
      totalItemsCompared: 5,
      movedUpCount: 1,
      movedDownCount: 1,
      addedCount: 1,
      removedCount: 1,
      unchangedCount: 1,
    });
    expect(unchanged?.status).toBe('unchanged');
    expect(unchanged?.scoreDelta).toBe(1);
    expect(movedUp?.status).toBe('moved_up');
    expect(movedUp?.rankMovement).toBe(2);
    expect(movedDown?.status).toBe('moved_down');
    expect(movedDown?.rankMovement).toBe(-2);
    expect(removed?.status).toBe('removed');
    expect(removed?.newRank).toBeNull();
    expect(added?.status).toBe('added');
    expect(added?.oldRank).toBeNull();
    expect(movedUp?.reasonDelta?.added).toContain('Currently in stock');
    expect(movedUp?.scoreBreakdownDelta?.stockScore).toBe(1);
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('paymentInstructions');
    expect(serialized).not.toContain('approvalStatus');
  });

  it('validates a safe QA pack payload when the internal flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(buildQaPackPayload())
      .expect(201);

    const body = readBody<{
      valid: boolean;
      pack: {
        packName: string;
        description: string;
        scenarioType: string;
        query: string | null;
        limit: number;
        baselineSnapshot: { generatedAt: string };
        candidateSnapshot: { generatedAt: string };
        expectedSummaryThresholds?: {
          maxMovedDownCount?: number;
          maxMovedUpCount?: number;
          maxScoreDelta?: number;
        };
      };
      notices: string[];
      appliedThresholdPreset: {
        id: string;
        name: string;
        thresholds: {
          maxMovedDownCount?: number;
        };
      } | null;
      resolvedThresholds: {
        maxMovedDownCount?: number;
        maxRemovedCount?: number;
        maxScoreDelta?: number;
      };
      evaluation: {
        overallStatus: string;
        summary: {
          totalChangedCount: number;
          maxScoreDelta: number;
          maxAbsoluteRankMovement: number;
        };
        thresholds: Array<{
          key: string;
          status: string;
          actualValue: number;
          expectedValue: number;
        }>;
      };
    }>(response);
    const serialized = JSON.stringify(body);

    expect(body.valid).toBe(true);
    expect(body.pack.packName).toBe('Sample home QA pack');
    expect(body.pack.scenarioType).toBe('home');
    expect(body.pack.limit).toBe(5);
    expect(body.pack.expectedSummaryThresholds?.maxMovedDownCount).toBe(2);
    expect(body.appliedThresholdPreset).toBeNull();
    expect(body.resolvedThresholds).toMatchObject({
      maxMovedDownCount: 2,
      maxRemovedCount: 1,
      maxScoreDelta: 5,
    });
    expect(body.evaluation.overallStatus).toBe('pass');
    expect(body.evaluation.summary.totalChangedCount).toBe(4);
    expect(body.evaluation.summary.maxScoreDelta).toBe(4);
    expect(body.evaluation.summary.maxAbsoluteRankMovement).toBe(2);
    expect(body.evaluation.thresholds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'maxMovedDownCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 2,
        }),
      ]),
    );
    expect(Array.isArray(body.notices)).toBe(true);
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('paymentInstructions');
  });

  it('returns safe threshold presets only when the internal flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/internal/recommendations/presets')
      .expect(200);

    const body = readBody<{
      presets: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        updatedAt: string;
        owner: string;
        notes: string;
        stability: string;
        thresholds: {
          maxMovedDownCount?: number;
          maxScoreDelta?: number;
        };
      }>;
    }>(response);
    const strict = body.presets.find((preset) => preset.id === 'strict');
    const lenient = body.presets.find((preset) => preset.id === 'lenient');
    const serialized = JSON.stringify(body);

    expect(body.presets.length).toBeGreaterThanOrEqual(5);
    expect(strict?.thresholds.maxMovedDownCount).toBeLessThan(
      lenient?.thresholds.maxMovedDownCount ?? Number.MAX_SAFE_INTEGER,
    );
    expect(strict?.thresholds.maxScoreDelta).toBeLessThan(
      lenient?.thresholds.maxScoreDelta ?? Number.MAX_SAFE_INTEGER,
    );
    expect(strict?.version).toBe('1.0.0');
    expect(typeof strict?.updatedAt).toBe('string');
    expect(strict?.updatedAt).toContain('T');
    expect(strict?.owner).toBe('recommendations-team');
    expect(typeof strict?.notes).toBe('string');
    expect(strict?.notes?.length).toBeGreaterThan(0);
    expect(strict?.stability).toBe('stable');
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('paymentInstructions');
  });

  it('returns a safe baseline catalog only when the internal flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/internal/recommendations/baseline-catalog')
      .expect(200);

    const body = readBody<{
      catalog: Array<{
        id: string;
        name: string;
        description: string;
        version: string;
        updatedAt: string;
        owner: string;
        notes: string;
        stability: string;
        scenarioType: string;
        query: string | null;
        productId: string | null;
        defaultLimit: number;
        recommendedThresholdPresetId: string;
        mockPack: {
          packName: string;
          thresholdPresetId: string;
          baselineSnapshot: {
            generatedAt: string;
          };
          candidateSnapshot: {
            generatedAt: string;
          };
        } | null;
      }>;
    }>(response);
    const searchEntry = body.catalog.find(
      (entry) => entry.id === 'search-intent-stability',
    );
    const serialized = JSON.stringify(body);

    expect(body.catalog.length).toBeGreaterThanOrEqual(3);
    expect(searchEntry?.version).toBe('1.0.0');
    expect(typeof searchEntry?.updatedAt).toBe('string');
    expect(searchEntry?.updatedAt).toContain('T');
    expect(searchEntry?.owner).toBe('recommendations-team');
    expect(typeof searchEntry?.notes).toBe('string');
    expect(searchEntry?.notes?.length).toBeGreaterThan(0);
    expect(searchEntry?.stability).toBe('stable');
    expect(searchEntry?.scenarioType).toBe('search');
    expect(searchEntry?.query).toBe('jacket');
    expect(searchEntry?.productId).toBeNull();
    expect(searchEntry?.recommendedThresholdPresetId).toBe(
      'search-intent-sensitive',
    );
    expect(searchEntry?.mockPack?.packName).toBe('Sample search QA pack');
    expect(serialized).not.toContain('guestSessionId');
    expect(serialized).not.toContain('customerId');
    expect(serialized).not.toContain('paymentInstructions');
    expect(serialized).not.toContain('approvalStatus');
  });

  it('returns safe sponsored presets only when the internal flag is enabled', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRESET_ID = 'aggressive-internal-only';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/internal/recommendations/sponsored-presets')
      .expect(200);

    const body = readBody<{
      sponsoredRankingEnabled: boolean;
      activePreset: {
        id: string;
        name: string;
        version: string;
        stability: string;
        maxSponsoredBoost: number;
        maxBusinessBoost: number;
        allowedScenarioTypes: string[];
      } | null;
      presets: Array<{
        id: string;
        maxSponsoredBoost: number;
        maxBusinessBoost: number;
        allowedScenarioTypes: string[];
      }>;
    }>(response);
    const conservative = body.presets.find(
      (preset) => preset.id === 'conservative',
    );
    const aggressive = body.presets.find(
      (preset) => preset.id === 'aggressive-internal-only',
    );
    const serialized = JSON.stringify(body);

    expect(body.sponsoredRankingEnabled).toBe(true);
    expect(body.activePreset?.id).toBe('aggressive-internal-only');
    expect(body.activePreset?.stability).toBe('experimental');
    expect(conservative?.maxSponsoredBoost).toBeLessThan(
      aggressive?.maxSponsoredBoost ?? Number.MAX_SAFE_INTEGER,
    );
    expect(conservative?.maxBusinessBoost).toBeLessThan(
      aggressive?.maxBusinessBoost ?? Number.MAX_SAFE_INTEGER,
    );
    expect(aggressive?.allowedScenarioTypes).toEqual(
      expect.arrayContaining(['home', 'similar', 'search']),
    );
    expect(serialized).not.toContain('RECOMMENDATION_SPONSORED_PRODUCT_IDS');
    expect(serialized).not.toContain('RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS');
    expect(serialized).not.toContain('00000000-0000-0000-0000-000000000002');
    expect(serialized).not.toContain('10000000-0000-0000-0000-000000000001');
  });

  it('marks QA pack evaluation as not_evaluated when thresholds are omitted', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const payload = buildQaPackPayload();
    delete payload.expectedSummaryThresholds;

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(payload)
      .expect(201);

    const body = readBody<{
      evaluation: {
        overallStatus: string;
        thresholds: unknown[];
      };
    }>(response);

    expect(body.evaluation.overallStatus).toBe('not_evaluated');
    expect(body.evaluation.thresholds).toEqual([]);
  });

  it('passes QA pack threshold evaluation when every configured threshold stays within range', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(
        buildQaPackPayload({
          maxMovedDownCount: 1,
          maxMovedUpCount: 1,
          maxAddedCount: 1,
          maxRemovedCount: 1,
          maxScoreDelta: 4,
          maxAbsoluteRankMovement: 2,
          minUnchangedCount: 1,
          maxTotalChangedCount: 4,
        }),
      )
      .expect(201);

    const body = readBody<{
      evaluation: {
        overallStatus: string;
        summary: {
          movedUpCount: number;
          movedDownCount: number;
          addedCount: number;
          removedCount: number;
          unchangedCount: number;
          totalChangedCount: number;
          maxScoreDelta: number;
          maxAbsoluteRankMovement: number;
        };
        thresholds: Array<{
          key: string;
          status: string;
          actualValue: number;
          expectedValue: number;
          operator: string;
        }>;
      };
    }>(response);

    expect(body.evaluation.overallStatus).toBe('pass');
    expect(body.evaluation.summary).toMatchObject({
      movedUpCount: 1,
      movedDownCount: 1,
      addedCount: 1,
      removedCount: 1,
      unchangedCount: 1,
      totalChangedCount: 4,
      maxScoreDelta: 4,
      maxAbsoluteRankMovement: 2,
    });
    expect(body.evaluation.thresholds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'maxMovedDownCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 1,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'maxMovedUpCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 1,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'maxAddedCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 1,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'maxRemovedCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 1,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'maxScoreDelta',
          status: 'pass',
          actualValue: 4,
          expectedValue: 4,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'maxAbsoluteRankMovement',
          status: 'pass',
          actualValue: 2,
          expectedValue: 2,
          operator: '<=',
        }),
        expect.objectContaining({
          key: 'minUnchangedCount',
          status: 'pass',
          actualValue: 1,
          expectedValue: 1,
          operator: '>=',
        }),
        expect.objectContaining({
          key: 'maxTotalChangedCount',
          status: 'pass',
          actualValue: 4,
          expectedValue: 4,
          operator: '<=',
        }),
      ]),
    );
  });

  it('fails QA pack threshold evaluation when any configured threshold is exceeded', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(
        buildQaPackPayload({
          maxMovedDownCount: 0,
          minUnchangedCount: 2,
          maxTotalChangedCount: 3,
        }),
      )
      .expect(201);

    const body = readBody<{
      evaluation: {
        overallStatus: string;
        thresholds: Array<{
          key: string;
          status: string;
          actualValue: number;
          expectedValue: number;
        }>;
      };
    }>(response);

    expect(body.evaluation.overallStatus).toBe('fail');
    expect(body.evaluation.thresholds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'maxMovedDownCount',
          status: 'fail',
          actualValue: 1,
          expectedValue: 0,
        }),
        expect.objectContaining({
          key: 'minUnchangedCount',
          status: 'fail',
          actualValue: 1,
          expectedValue: 2,
        }),
        expect.objectContaining({
          key: 'maxTotalChangedCount',
          status: 'fail',
          actualValue: 4,
          expectedValue: 3,
        }),
      ]),
    );
  });

  it('expands preset thresholds during QA pack validation', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send({
        ...buildQaPackPayload(undefined),
        catalogId: 'home-ranking-stability',
        thresholdPresetId: 'balanced',
        expectedSummaryThresholds: undefined,
      })
      .expect(201);

    const body = readBody<{
      appliedThresholdPreset: {
        id: string;
        thresholds: {
          maxMovedDownCount?: number;
          maxRemovedCount?: number;
        };
      } | null;
      resolvedThresholds: {
        maxMovedDownCount?: number;
        maxRemovedCount?: number;
        maxScoreDelta?: number;
      };
      evaluation: {
        overallStatus: string;
      };
    }>(response);

    expect(body.appliedThresholdPreset?.id).toBe('balanced');
    expect(body.resolvedThresholds.maxMovedDownCount).toBe(1);
    expect(body.resolvedThresholds.maxRemovedCount).toBe(1);
    expect(body.resolvedThresholds.maxScoreDelta).toBe(4);
    expect(body.evaluation.overallStatus).toBe('pass');
  });

  it('allows explicit thresholds to override or extend preset thresholds', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send({
        ...buildQaPackPayload({
          maxMovedDownCount: 2,
          maxRemovedCount: 0,
        }),
        thresholdPresetId: 'strict',
      })
      .expect(201);

    const body = readBody<{
      appliedThresholdPreset: {
        id: string;
      } | null;
      resolvedThresholds: {
        maxMovedDownCount?: number;
        maxRemovedCount?: number;
      };
      evaluation: {
        overallStatus: string;
      };
    }>(response);

    expect(body.appliedThresholdPreset?.id).toBe('strict');
    expect(body.resolvedThresholds.maxMovedDownCount).toBe(2);
    expect(body.resolvedThresholds.maxRemovedCount).toBe(0);
    expect(body.evaluation.overallStatus).toBe('fail');
  });

  it('rejects malformed QA pack payloads', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send({
        packName: 'Broken pack',
        scenarioType: 'search',
      })
      .expect(400);
  });

  it('rejects malformed QA pack threshold payloads', async () => {
    process.env.RECOMMENDATION_QA_TOOLS_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    await request(app.getHttpServer())
      .post('/api/internal/recommendations/packs/validate')
      .send(
        buildQaPackPayload({
          maxMovedUpCount: -1,
        }),
      )
      .expect(400);
  });

  it('returns search recommendations for matching products', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/search?q=similar%20jacket&limit=2')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      placement: string;
      items: Array<{ product: { id: string; name: string } }>;
      products: Array<{ id: string; name: string }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.placement).toBe('search');
    expect(body.items[0]?.product.name).toContain('Similar jacket');
    expect(body.products[0]?.name).toContain('Similar jacket');
  });

  it('keeps stronger similar-product relevance ahead of a sponsored but less relevant candidate', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000003';
    process.env.RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS =
      '10000000-0000-0000-0000-000000000001';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_BOOST = '8';
    process.env.RECOMMENDATION_BUSINESS_SHOP_BOOST = '4';
    process.env.RECOMMENDATION_SPONSORED_MAX_BOOST = '5';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get(
        '/api/public/recommendations/products/00000000-0000-0000-0000-000000000001/similar?limit=2&debug=true',
      )
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.product.id).toBe(
      '00000000-0000-0000-0000-000000000002',
    );
  });

  it('keeps public recommendation responses backward compatible and free of sponsored config leakage', async () => {
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    process.env.RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS =
      '10000000-0000-0000-0000-000000000001';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_BOOST = '8';
    process.env.RECOMMENDATION_BUSINESS_SHOP_BOOST = '4';
    process.env.RECOMMENDATION_SPONSORED_MAX_BOOST = '5';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      placement: string;
      items: Array<{
        product: { id: string };
        rank: number;
        score: number | null;
        reasonCodes: string[];
        scoreExplanation?: unknown;
      }>;
      products: Array<{ id: string }>;
    }>(response);
    const serialized = JSON.stringify(body);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.placement).toBe('home');
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.items[0]?.scoreExplanation).toBeUndefined();
    expect(serialized).not.toContain('sponsoredBoostScore');
    expect(serialized).not.toContain('businessBoostScore');
    expect(serialized).not.toContain('maxSponsoredBoost');
    expect(serialized).not.toContain('sponsoredReason');
    expect(serialized).not.toContain('sponsoredPreset');
    expect(serialized).not.toContain('campaignReadiness');
    expect(serialized).not.toContain('sponsoredCampaign');
    expect(serialized).not.toContain('billingMode');
    expect(serialized).not.toContain('campaignId');
    expect(serialized).not.toContain('RECOMMENDATION_SPONSORED_PRODUCT_IDS');
    expect(serialized).not.toContain('RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS');
  });

  it('keeps score explanations hidden when debug mode is missing', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=1')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        scoreExplanation?: unknown;
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.scoreExplanation).toBeUndefined();
  });

  it('keeps score explanations hidden when the internal explainability flag is off', async () => {
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=1&debug=true')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        scoreExplanation?: unknown;
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.scoreExplanation).toBeUndefined();
  });

  it('returns optional score explanations only when internal explainability is enabled', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    process.env.RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS =
      '10000000-0000-0000-0000-000000000001';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=1&debug=true')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        scoreExplanation?: {
          algorithm: string;
          finalScore: number | null;
          reasons: string[];
          scoreBreakdown: {
            categoryScore: number;
            textScore: number;
            popularityScore: number;
            freshnessScore: number;
            ratingScore: number;
            stockScore: number;
            shopScore: number;
            penaltyScore: number;
            sponsoredBoostScore: number;
            businessBoostScore: number;
            maxSponsoredBoost: number;
          } | null;
          sponsoredReason?: string | null;
          sponsoredPreset?: {
            id: string;
            name: string;
            version: string;
            stability: string;
            maxSponsoredBoost: number;
            maxBusinessBoost: number;
            allowedScenarioTypes: string[];
          } | null;
          campaignReadiness?: {
            sponsoredEligible: boolean;
            sponsoredBoostApplied: boolean;
            sponsoredBoostScore: number;
            sponsoredReason: string | null;
            sponsoredPresetId: string | null;
            campaignReadinessStatus: string;
            billingMode: string;
            rolloutMode: string;
          } | null;
          sponsoredCampaign?: {
            campaignId: string | null;
            sponsorType: string;
            maxBoost: number;
            scenarioType: string;
            billingMode: string;
            rolloutMode: string;
          } | null;
        };
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.scoreExplanation).toMatchObject({
      algorithm: 'rule_based_v2',
    });
    expect(body.items[0]?.scoreExplanation?.scoreBreakdown).toBeTruthy();
    expect(body.items[0]?.scoreExplanation?.sponsoredPreset).toMatchObject({
      id: 'balanced',
      version: '1.0.0',
      stability: 'stable',
    });
    expect(body.items[0]?.scoreExplanation?.campaignReadiness).toMatchObject({
      sponsoredEligible: true,
      sponsoredPresetId: 'balanced',
      billingMode: 'none',
    });
    expect(body.items[0]?.scoreExplanation?.sponsoredCampaign).toMatchObject({
      sponsorType: 'campaign',
      scenarioType: 'home',
      billingMode: 'none',
    });
    expect(
      body.items[0]?.scoreExplanation?.scoreBreakdown?.sponsoredBoostScore,
    ).toBeGreaterThanOrEqual(0);
  });

  it('keeps analytics tuning internals hidden in normal public recommendation responses', async () => {
    process.env.RECOMMENDATION_ANALYTICS_TUNING_ENABLED = 'true';
    recommendationEvents.push(
      buildAnalyticsEvent({
        id: 'analytics-hidden-impression',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T13:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-hidden-click',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'click',
        createdAt: new Date('2026-06-07T13:05:00.000Z'),
      }),
    );
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        scoreExplanation?: unknown;
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0]?.scoreExplanation).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('analyticsSignalsUsed');
    expect(JSON.stringify(body)).not.toContain('analyticsPerformanceScore');
  });

  it('shows bounded analytics tuning breakdown only in internal explainability mode', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_ANALYTICS_TUNING_ENABLED = 'true';
    recommendationEvents.push(
      buildAnalyticsEvent({
        id: 'analytics-debug-impression-1',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        metadata: { personalized: true },
        createdAt: new Date('2026-06-07T14:00:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-impression-2',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        metadata: { personalized: true },
        createdAt: new Date('2026-06-07T14:01:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-impression-3',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:02:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-impression-4',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:03:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-impression-5',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:04:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-click-1',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'click',
        metadata: { personalized: true },
        createdAt: new Date('2026-06-07T14:05:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-click-2',
        productId: '00000000-0000-0000-0000-000000000002',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'click',
        createdAt: new Date('2026-06-07T14:06:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-other-impression-1',
        productId: '00000000-0000-0000-0000-000000000003',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:07:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-other-impression-2',
        productId: '00000000-0000-0000-0000-000000000003',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:08:00.000Z'),
      }),
      buildAnalyticsEvent({
        id: 'analytics-debug-other-impression-3',
        productId: '00000000-0000-0000-0000-000000000003',
        shopId: '10000000-0000-0000-0000-000000000001',
        algorithm: 'rule_based_v2',
        scenarioType: 'home',
        type: 'impression',
        createdAt: new Date('2026-06-07T14:09:00.000Z'),
      }),
    );
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2&debug=true')
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          analyticsSignalsUsed?: string[];
          analyticsTuningEnabled?: boolean;
          scoreBreakdown?: {
            analyticsPerformanceScore: number;
            ctrScore: number;
            productEngagementScore: number;
            algorithmPerformanceHint: number;
            scenarioPerformanceHint: number;
          } | null;
        };
      }>;
    }>(response);
    const tunedItem = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000002',
    );

    expect(tunedItem?.scoreExplanation?.analyticsTuningEnabled).toBe(true);
    expect(tunedItem?.scoreExplanation?.analyticsSignalsUsed).toEqual(
      expect.arrayContaining([
        'ctr',
        'engagement',
        'algorithm_hint',
        'scenario_hint',
      ]),
    );
    expect(
      tunedItem?.scoreExplanation?.scoreBreakdown?.analyticsPerformanceScore ??
        0,
    ).toBeGreaterThan(0);
    expect(
      tunedItem?.scoreExplanation?.scoreBreakdown?.ctrScore ?? 0,
    ).toBeGreaterThan(0);
    expect(
      tunedItem?.scoreExplanation?.scoreBreakdown?.productEngagementScore ?? 0,
    ).toBeGreaterThan(0);
    expect(
      tunedItem?.scoreExplanation?.scoreBreakdown?.algorithmPerformanceHint ??
        0,
    ).toBeGreaterThan(0);
    expect(
      tunedItem?.scoreExplanation?.scoreBreakdown?.scenarioPerformanceHint ?? 0,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(tunedItem)).not.toContain('guestSessionId');
    expect(JSON.stringify(tunedItem)).not.toContain('customerId');
  });

  it('falls back to a safe preset and clamps unbounded sponsored boost overrides', async () => {
    process.env.RECOMMENDATION_EXPLAINABILITY_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRESET_ID = 'not-a-real-preset';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_BOOST = '999';
    process.env.RECOMMENDATION_BUSINESS_SHOP_BOOST = '999';
    process.env.RECOMMENDATION_SPONSORED_MAX_BOOST = '999';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2&debug=true')
      .expect(200);

    const body = readBody<{
      items: Array<{
        product: { id: string };
        scoreExplanation?: {
          sponsoredPreset?: {
            id: string;
            maxSponsoredBoost: number;
            maxBusinessBoost: number;
          } | null;
          scoreBreakdown?: {
            maxSponsoredBoost: number;
          } | null;
        };
      }>;
    }>(response);
    const sponsoredItem = body.items.find(
      (item) => item.product.id === '00000000-0000-0000-0000-000000000002',
    );

    expect(sponsoredItem?.scoreExplanation?.sponsoredPreset?.id).toBe(
      'balanced',
    );
    expect(
      sponsoredItem?.scoreExplanation?.sponsoredPreset?.maxSponsoredBoost,
    ).toBe(5);
    expect(
      sponsoredItem?.scoreExplanation?.sponsoredPreset?.maxBusinessBoost,
    ).toBe(2);
    expect(
      sponsoredItem?.scoreExplanation?.scoreBreakdown?.maxSponsoredBoost,
    ).toBe(5);
  });

  it('keeps fallback algorithm behavior safe when smart ranking is off even if sponsored ranking is enabled', async () => {
    process.env.RECOMMENDATION_SMART_RANKING_ENABLED = 'false';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRODUCT_IDS =
      '00000000-0000-0000-0000-000000000002';
    await app.close();
    app = await buildApp();

    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=2')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{
        score: number | null;
      }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v1');
    expect(body.items[0]?.score).toBeNull();
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

  it('swallows recommendation tracking persistence failures', async () => {
    prismaMock.recommendationEvent.create.mockRejectedValueOnce(
      new Error('boom'),
    );

    await expect(
      recommendationsService.trackRecommendationEvent(
        {
          type: 'click',
          placement: 'search',
          productId: '00000000-0000-0000-0000-000000000002',
          algorithm: 'rule_based_v2',
          rank: 1,
          score: 12.5,
        },
        {
          get: () => undefined,
          headers: {},
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        } as never,
        null,
      ),
    ).resolves.toBeUndefined();
    expect(prismaMock.recommendationEvent.create).toHaveBeenCalledTimes(1);
  });

  it('preserves a fallback algorithm name when tracking recommendation events', async () => {
    await recommendationsService.trackRecommendationEvent(
      {
        type: 'impression',
        placement: 'home',
        productId: '00000000-0000-0000-0000-000000000002',
        algorithm: 'rule_based_v1',
        rank: 2,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    const trackingCalls = prismaMock.recommendationEvent.create.mock
      .calls as Array<
      [
        {
          data: {
            algorithm: string;
            placement: string;
            rank: number | null;
          };
        },
      ]
    >;
    const lastPayload = trackingCalls.at(-1)?.[0];

    expect(lastPayload?.data.algorithm).toBe('rule_based_v1');
    expect(lastPayload?.data.placement).toBe('home');
    expect(lastPayload?.data.rank).toBe(2);
  });

  it('charges a sponsored CPC click once when a valid tracking token is returned', async () => {
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRESET_ID = 'balanced';
    process.env.ADS_MODERATION_REQUIRED_FOR_SERVING = 'true';
    await app.close();
    app = await buildApp();

    const sponsoredProduct = products[1];
    const activeCampaign = {
      id: 'campaign-1',
      shopId: sponsoredProduct.shopId,
      name: 'Sponsored Campaign',
      description: null,
      status: 'active',
      moderationStatus: 'approved',
      moderationReason: null,
      reviewedByAdminId: 'admin-user-1',
      reviewedAt: new Date('2026-06-06T00:00:00Z'),
      submittedAt: new Date('2026-06-05T00:00:00Z'),
      scenarioTypes: ['home'],
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('20'),
      billingMode: 'cpc',
      maxBoost: new Prisma.Decimal('4'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
      targets: [
        {
          id: 'target-1',
          campaignId: 'campaign-1',
          productId: sponsoredProduct.id,
          boost: new Prisma.Decimal('4'),
          status: 'active',
          createdAt: new Date('2026-06-07T00:00:00Z'),
          updatedAt: new Date('2026-06-07T00:00:00Z'),
          product: {
            id: sponsoredProduct.id,
            shopId: sponsoredProduct.shopId,
            wbTitle: sponsoredProduct.wbTitle,
            localTitle: sponsoredProduct.localTitle,
            seoSlug: sponsoredProduct.seoSlug,
          },
        },
      ],
    };

    prismaMock.sellerWallet.findMany.mockResolvedValue([
      {
        shopId: sponsoredProduct.shopId,
        balance: new Prisma.Decimal('50'),
        reservedBalance: new Prisma.Decimal('0'),
        status: 'active',
      },
    ]);
    prismaMock.sellerWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      shopId: sponsoredProduct.shopId,
      balance: new Prisma.Decimal('50'),
      reservedBalance: new Prisma.Decimal('0'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T00:00:00Z'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
    });
    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([activeCampaign]);
    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue({
      id: 'campaign-1',
      shopId: sponsoredProduct.shopId,
      status: 'active',
      moderationStatus: 'approved',
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('20'),
      billingMode: 'cpc',
    });

    const recommendationsResponse = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3')
      .expect(200);

    const recommendationsBody = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        sponsored?: boolean;
        trackingToken?: string | null;
      }>;
    }>(recommendationsResponse);
    const sponsoredItem = recommendationsBody.items.find(
      (item) => item.product.id === sponsoredProduct.id,
    );

    expect(sponsoredItem?.sponsored).toBe(true);
    expect(sponsoredItem?.trackingToken).toBeTruthy();

    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        rank: 1,
        idempotencyKey: 'click-charge-duplicate-token',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        rank: 1,
        idempotencyKey: 'click-charge-1',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(1);
    expect(
      prismaMock.recommendationEvent.update.mock.calls.at(-1)?.[0]?.data,
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'duplicate_token',
        validityStatus: 'invalid',
        invalidReason: 'duplicate_token',
      }),
    );
    const eventCountBeforeIdempotencyRetry = recommendationEvents.length;
    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        rank: 1,
        idempotencyKey: 'click-charge-1',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );
    expect(recommendationEvents).toHaveLength(eventCountBeforeIdempotencyRetry);
    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(1);

    const getFreshTrackingToken = async () => {
      const response = await request(app.getHttpServer())
        .get('/api/public/recommendations/home?limit=3')
        .expect(200);
      return readBody<{
        items: Array<{
          product: { id: string };
          trackingToken?: string | null;
        }>;
      }>(response).items.find((item) => item.product.id === sponsoredProduct.id)
        ?.trackingToken;
    };
    const clickRequest = (ip: string, userAgent: string) =>
      ({
        get: (name: string) =>
          name.toLowerCase() === 'user-agent' ? userAgent : undefined,
        headers: { 'x-forwarded-for': ip },
        ip,
        socket: { remoteAddress: ip },
      }) as never;
    const trackFreshClick = async (
      idempotencyKey: string,
      options?: {
        guestSessionId?: string;
        ip?: string;
        userAgent?: string;
        user?: {
          sub: string;
          userId: string;
          email: string;
          role: string;
        };
      },
    ) => {
      await recommendationsService.trackRecommendationEvent(
        {
          type: 'click',
          placement: 'home',
          productId: sponsoredProduct.id,
          algorithm: recommendationsBody.algorithm,
          idempotencyKey,
          guestSessionId: options?.guestSessionId,
          sponsored: true,
          trackingToken: await getFreshTrackingToken(),
        },
        clickRequest(
          options?.ip ?? `10.0.0.${recommendationEvents.length + 1}`,
          options?.userAgent ?? `test-agent-${recommendationEvents.length + 1}`,
        ),
        options?.user ?? null,
      );
    };

    await trackFreshClick('click-session-valid', {
      guestSessionId: 'guest-repeat',
      ip: '10.1.0.1',
      userAgent: 'session-agent-a',
    });
    await trackFreshClick('click-session-repeat', {
      guestSessionId: 'guest-repeat',
      ip: '10.1.0.2',
      userAgent: 'session-agent-b',
    });
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-session-repeat',
      ),
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'rapid_repeat_session',
        validityStatus: 'invalid',
      }),
    );

    await trackFreshClick('click-network-valid', {
      guestSessionId: 'guest-network-a',
      ip: '10.2.0.1',
      userAgent: 'shared-network-agent',
    });
    await trackFreshClick('click-network-repeat', {
      guestSessionId: 'guest-network-b',
      ip: '10.2.0.1',
      userAgent: 'shared-network-agent',
    });
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-network-repeat',
      ),
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'rapid_repeat_network',
        validityStatus: 'invalid',
      }),
    );

    await trackFreshClick('click-seller-self', {
      ip: '10.3.0.1',
      userAgent: 'seller-agent',
      user: {
        sub: 'seller-user-1',
        userId: 'seller-user-1',
        email: 'seller@example.com',
        role: 'SELLER',
      },
    });
    await trackFreshClick('click-admin', {
      ip: '10.3.0.2',
      userAgent: 'admin-agent',
      user: {
        sub: 'admin-user-1',
        userId: 'admin-user-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    });
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-seller-self',
      ),
    ).toEqual(expect.objectContaining({ chargeStatus: 'seller_self_click' }));
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-admin',
      ),
    ).toEqual(expect.objectContaining({ chargeStatus: 'admin_click' }));

    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        idempotencyKey: 'click-malformed-token',
        sponsored: true,
        trackingToken: 'malformed-token',
      },
      clickRequest('10.4.0.1', 'malformed-agent'),
      null,
    );
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-malformed-token',
      ),
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'invalid_token',
        validityStatus: 'invalid',
      }),
    );

    const outOfStockToken = await getFreshTrackingToken();
    sponsoredProduct.variants.forEach((variant) => {
      variant.stockQuantity = 0;
    });
    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        idempotencyKey: 'click-out-of-stock',
        sponsored: true,
        trackingToken: outOfStockToken,
      },
      clickRequest('10.5.0.1', 'out-of-stock-agent'),
      null,
    );
    sponsoredProduct.variants.forEach((variant) => {
      variant.stockQuantity = 10;
    });
    expect(
      recommendationEvents.find(
        (event) => event.idempotencyKey === 'click-out-of-stock',
      ),
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'product_not_chargeable',
        validityStatus: 'ineligible',
      }),
    );

    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(3);

    for (const moderationStatus of [
      'pending_review',
      'rejected',
      'suspended',
    ]) {
      const moderationToken = await getFreshTrackingToken();
      prismaMock.sponsoredCampaign.findFirst.mockResolvedValue({
        id: 'campaign-1',
        shopId: sponsoredProduct.shopId,
        status: 'active',
        moderationStatus,
        startAt: new Date('2026-06-01T00:00:00Z'),
        endAt: new Date('2026-06-30T00:00:00Z'),
        budgetLimit: new Prisma.Decimal('20'),
        billingMode: 'cpc',
      });
      await recommendationsService.trackRecommendationEvent(
        {
          type: 'click',
          placement: 'home',
          productId: sponsoredProduct.id,
          algorithm: recommendationsBody.algorithm,
          rank: 1,
          idempotencyKey: `click-charge-${moderationStatus}`,
          sponsored: true,
          trackingToken: moderationToken,
        },
        clickRequest(
          `10.6.0.${recommendationEvents.length + 1}`,
          'moderation-agent',
        ),
        null,
      );
      expect(
        recommendationEvents.find(
          (event) =>
            event.idempotencyKey === `click-charge-${moderationStatus}`,
        ),
      ).toEqual(
        expect.objectContaining({
          chargeStatus: 'campaign_not_approved',
          charged: false,
        }),
      );
    }
    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(3);
  });

  it('still charges sponsored CPC clicks after dev funding credits the wallet', async () => {
    process.env.BILLING_DEV_TOOLS_ENABLED = 'true';
    process.env.ADS_DEMO_FUNDING_ENABLED = 'true';
    process.env.BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT = '1000';
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    process.env.RECOMMENDATION_SPONSORED_PRESET_ID = 'balanced';
    await app.close();
    app = await buildApp();
    billingService = app.get(BillingService);
    recommendationsService = app.get(RecommendationsService);

    const sponsoredProduct = products[1];

    await billingService.devCreditWallet(sponsoredProduct.shopId, 75, {
      sub: 'seller-user-1',
      userId: 'seller-user-1',
      email: 'seller1@example.com',
      role: 'SELLER',
    });

    const activeCampaign = {
      id: 'campaign-dev-funding',
      shopId: sponsoredProduct.shopId,
      name: 'Dev Funding Campaign',
      description: null,
      status: 'active',
      scenarioTypes: ['home'],
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('100'),
      billingMode: 'cpc',
      maxBoost: new Prisma.Decimal('4'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
      targets: [
        {
          id: 'target-dev-funding',
          campaignId: 'campaign-dev-funding',
          productId: sponsoredProduct.id,
          boost: new Prisma.Decimal('4'),
          status: 'active',
          createdAt: new Date('2026-06-07T00:00:00Z'),
          updatedAt: new Date('2026-06-07T00:00:00Z'),
          product: {
            id: sponsoredProduct.id,
            shopId: sponsoredProduct.shopId,
            wbTitle: sponsoredProduct.wbTitle,
            localTitle: sponsoredProduct.localTitle,
            seoSlug: sponsoredProduct.seoSlug,
          },
        },
      ],
    };

    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([activeCampaign]);
    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue({
      id: 'campaign-dev-funding',
      shopId: sponsoredProduct.shopId,
      status: 'active',
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('100'),
      billingMode: 'cpc',
    });

    const recommendationsResponse = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3')
      .expect(200);

    const recommendationsBody = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        sponsored?: boolean;
        trackingToken?: string | null;
      }>;
    }>(recommendationsResponse);

    const sponsoredItem = recommendationsBody.items.find(
      (item) => item.sponsored,
    );
    expect(sponsoredItem?.trackingToken).toBeTruthy();

    await recommendationsService.trackRecommendationEvent(
      {
        productId: sponsoredProduct.id,
        type: 'click',
        placement: 'home',
        algorithm: recommendationsBody.algorithm,
        rank: 1,
        idempotencyKey: 'click-dev-funded-wallet-1',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalled();
    expect(
      prismaMock.recommendationEvent.update.mock.calls.at(-1)?.[0]?.data,
    ).toEqual(
      expect.objectContaining({
        charged: true,
        chargeStatus: 'charged',
      }),
    );
  });

  it('marks sponsored clicks as insufficient_wallet when the wallet cannot cover CPC', async () => {
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    await app.close();
    app = await buildApp();

    const sponsoredProduct = products[1];
    prismaMock.sellerWallet.findMany.mockResolvedValue([
      {
        shopId: sponsoredProduct.shopId,
        balance: new Prisma.Decimal('50'),
        reservedBalance: new Prisma.Decimal('0'),
        status: 'active',
      },
    ]);
    prismaMock.sellerWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      shopId: sponsoredProduct.shopId,
      balance: new Prisma.Decimal('50'),
      reservedBalance: new Prisma.Decimal('0'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T00:00:00Z'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
    });
    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([
      {
        id: 'campaign-2',
        shopId: sponsoredProduct.shopId,
        name: 'Low Wallet Campaign',
        description: null,
        status: 'active',
        scenarioTypes: ['home'],
        startAt: new Date('2026-06-01T00:00:00Z'),
        endAt: new Date('2026-06-30T00:00:00Z'),
        budgetLimit: new Prisma.Decimal('20'),
        billingMode: 'cpc',
        maxBoost: new Prisma.Decimal('4'),
        updatedAt: new Date('2026-06-07T00:00:00Z'),
        targets: [
          {
            id: 'target-2',
            campaignId: 'campaign-2',
            productId: sponsoredProduct.id,
            boost: new Prisma.Decimal('4'),
            status: 'active',
            createdAt: new Date('2026-06-07T00:00:00Z'),
            updatedAt: new Date('2026-06-07T00:00:00Z'),
            product: {
              id: sponsoredProduct.id,
              shopId: sponsoredProduct.shopId,
              wbTitle: sponsoredProduct.wbTitle,
              localTitle: sponsoredProduct.localTitle,
              seoSlug: sponsoredProduct.seoSlug,
            },
          },
        ],
      },
    ]);
    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue({
      id: 'campaign-2',
      shopId: sponsoredProduct.shopId,
      status: 'active',
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('20'),
      billingMode: 'cpc',
    });

    const recommendationsResponse = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3')
      .expect(200);
    const recommendationsBody = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        trackingToken?: string | null;
      }>;
    }>(recommendationsResponse);
    const sponsoredItem = recommendationsBody.items.find(
      (item) => item.product.id === sponsoredProduct.id,
    );

    prismaMock.sellerWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      shopId: sponsoredProduct.shopId,
      balance: new Prisma.Decimal('0.50'),
      reservedBalance: new Prisma.Decimal('0'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T00:00:00Z'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
    });

    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        idempotencyKey: 'click-insufficient-wallet-1',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(0);
    expect(
      prismaMock.recommendationEvent.update.mock.calls.at(-1)?.[0]?.data,
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'insufficient_wallet',
      }),
    );
  });

  it('marks sponsored clicks as budget_exhausted when the campaign budget is already consumed', async () => {
    process.env.RECOMMENDATION_SPONSORED_RANKING_ENABLED = 'true';
    await app.close();
    app = await buildApp();
    recommendationsService = app.get(RecommendationsService);

    const sponsoredProduct = products[1];
    recommendationEvents.push({
      id: 'charged-budget-event-1',
      campaignId: 'campaign-budget-1',
      productId: sponsoredProduct.id,
      type: 'click',
      placement: 'home',
      scenarioType: 'home',
      algorithm: 'rule_based_v2',
      sponsored: true,
      charged: true,
      chargeStatus: 'charged',
      billingMode: 'cpc',
      cost: new Prisma.Decimal('1.00'),
      ledgerEntryId: 'ledger-budget-1',
      createdAt: new Date('2026-06-07T00:00:00Z'),
    });

    prismaMock.sellerWallet.findMany.mockResolvedValue([
      {
        shopId: sponsoredProduct.shopId,
        balance: new Prisma.Decimal('50'),
        reservedBalance: new Prisma.Decimal('0'),
        status: 'active',
      },
    ]);
    prismaMock.sellerWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      shopId: sponsoredProduct.shopId,
      balance: new Prisma.Decimal('50'),
      reservedBalance: new Prisma.Decimal('0'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T00:00:00Z'),
      updatedAt: new Date('2026-06-07T00:00:00Z'),
    });
    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([
      {
        id: 'campaign-budget-1',
        shopId: sponsoredProduct.shopId,
        name: 'Budget Exhausted Campaign',
        description: null,
        status: 'active',
        scenarioTypes: ['home'],
        startAt: new Date('2026-06-01T00:00:00Z'),
        endAt: new Date('2026-06-30T00:00:00Z'),
        budgetLimit: new Prisma.Decimal('1.00'),
        billingMode: 'cpc',
        maxBoost: new Prisma.Decimal('4'),
        updatedAt: new Date('2026-06-07T00:00:00Z'),
        targets: [
          {
            id: 'target-budget-1',
            campaignId: 'campaign-budget-1',
            productId: sponsoredProduct.id,
            boost: new Prisma.Decimal('4'),
            status: 'active',
            createdAt: new Date('2026-06-07T00:00:00Z'),
            updatedAt: new Date('2026-06-07T00:00:00Z'),
            product: {
              id: sponsoredProduct.id,
              shopId: sponsoredProduct.shopId,
              wbTitle: sponsoredProduct.wbTitle,
              localTitle: sponsoredProduct.localTitle,
              seoSlug: sponsoredProduct.seoSlug,
            },
          },
        ],
      },
    ]);
    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue({
      id: 'campaign-budget-1',
      shopId: sponsoredProduct.shopId,
      status: 'active',
      startAt: new Date('2026-06-01T00:00:00Z'),
      endAt: new Date('2026-06-30T00:00:00Z'),
      budgetLimit: new Prisma.Decimal('1.00'),
      billingMode: 'cpc',
    });

    const recommendationsResponse = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=3')
      .expect(200);
    const recommendationsBody = readBody<{
      algorithm: string;
      items: Array<{
        product: { id: string };
        trackingToken?: string | null;
      }>;
    }>(recommendationsResponse);
    const sponsoredItem = recommendationsBody.items.find(
      (item) => item.product.id === sponsoredProduct.id,
    );

    await recommendationsService.trackRecommendationEvent(
      {
        type: 'click',
        placement: 'home',
        productId: sponsoredProduct.id,
        algorithm: recommendationsBody.algorithm,
        idempotencyKey: 'click-budget-exhausted-1',
        sponsored: true,
        trackingToken: sponsoredItem?.trackingToken,
      },
      {
        get: () => undefined,
        headers: {},
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
      null,
    );

    expect(prismaMock.billingLedgerEntry.create).toHaveBeenCalledTimes(0);
    expect(
      prismaMock.recommendationEvent.update.mock.calls.at(-1)?.[0]?.data,
    ).toEqual(
      expect.objectContaining({
        chargeStatus: 'budget_exhausted',
      }),
    );
  });
});

function buildAnalyticsEvent({
  id,
  productId,
  shopId,
  algorithm,
  scenarioType,
  type,
  sponsored = false,
  charged = false,
  cost = null,
  metadata = null,
  createdAt,
}: {
  id: string;
  productId: string;
  shopId: string;
  algorithm: string;
  scenarioType: 'home' | 'similar' | 'search';
  type: 'impression' | 'click';
  sponsored?: boolean;
  charged?: boolean;
  cost?: Prisma.Decimal | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}) {
  return {
    id,
    type,
    placement: scenarioType === 'similar' ? 'product_detail' : scenarioType,
    productId,
    shopId,
    campaignId: sponsored ? `campaign-${productId}` : null,
    algorithm,
    scenarioType,
    sponsored,
    charged,
    cost,
    metadata,
    createdAt,
  };
}

function buildProduct({
  id,
  title,
  categoryId,
  categoryName,
  brand,
  feedbackCount = 12,
  averageRating = '4.7',
  shopId = '10000000-0000-0000-0000-000000000001',
  shopName = 'Ready Shop',
  shopSlug = 'ready-shop',
}: {
  id: string;
  title: string;
  categoryId: bigint;
  categoryName: string;
  brand: string;
  feedbackCount?: number;
  averageRating?: string;
  shopId?: string;
  shopName?: string;
  shopSlug?: string;
}): StoredProduct {
  return {
    id,
    shopId,
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
    averageRating: new Prisma.Decimal(averageRating),
    feedbackCount,
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
      id: shopId,
      name: shopName,
      slug: shopSlug,
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

function buildSnapshotDiffPayload() {
  return {
    baseline: {
      scenarioType: 'home',
      placement: 'home',
      sponsoredRanking: null,
      productId: null,
      query: null,
      limit: 5,
      generatedAt: '2026-06-06T13:00:00.000Z',
      comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
      items: [
        buildSnapshotItem('prod-1', 'Stable Product', 1, 10, ['Popular'], {
          categoryScore: 4,
          textScore: 1,
          popularityScore: 3,
          freshnessScore: 1,
          ratingScore: 1,
          stockScore: 0,
          shopScore: 0,
          penaltyScore: 0,
        }),
        buildSnapshotItem('prod-2', 'Moved Up Product', 4, 7, ['Popular'], {
          categoryScore: 2,
          textScore: 0,
          popularityScore: 2,
          freshnessScore: 1,
          ratingScore: 1,
          stockScore: 0,
          shopScore: 1,
          penaltyScore: 0,
        }),
        buildSnapshotItem('prod-3', 'Moved Down Product', 1, 12, ['Fresh'], {
          categoryScore: 5,
          textScore: 1,
          popularityScore: 2,
          freshnessScore: 2,
          ratingScore: 1,
          stockScore: 1,
          shopScore: 0,
          penaltyScore: 0,
        }),
        buildSnapshotItem(
          'prod-4',
          'Removed Product',
          3,
          6,
          ['Keyword match'],
          {
            categoryScore: 1,
            textScore: 2,
            popularityScore: 1,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 0,
            shopScore: 0,
            penaltyScore: 0,
          },
        ),
      ],
    },
    candidate: {
      scenarioType: 'home',
      placement: 'home',
      sponsoredRanking: null,
      productId: null,
      query: null,
      limit: 5,
      generatedAt: '2026-06-06T13:30:00.000Z',
      comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
      items: [
        buildSnapshotItem('prod-1', 'Stable Product', 1, 11, ['Popular'], {
          categoryScore: 4,
          textScore: 1,
          popularityScore: 3,
          freshnessScore: 1,
          ratingScore: 1,
          stockScore: 1,
          shopScore: 0,
          penaltyScore: 0,
        }),
        buildSnapshotItem(
          'prod-2',
          'Moved Up Product',
          2,
          9,
          ['Popular', 'Currently in stock'],
          {
            categoryScore: 2,
            textScore: 0,
            popularityScore: 2,
            freshnessScore: 1,
            ratingScore: 1,
            stockScore: 1,
            shopScore: 1,
            penaltyScore: 0,
          },
        ),
        buildSnapshotItem('prod-3', 'Moved Down Product', 3, 8, ['Fresh'], {
          categoryScore: 3,
          textScore: 0,
          popularityScore: 1,
          freshnessScore: 2,
          ratingScore: 1,
          stockScore: 1,
          shopScore: 0,
          penaltyScore: 0,
        }),
        buildSnapshotItem('prod-5', 'Added Product', 4, 7, ['Same shop'], {
          categoryScore: 1,
          textScore: 0,
          popularityScore: 1,
          freshnessScore: 1,
          ratingScore: 1,
          stockScore: 1,
          shopScore: 2,
          penaltyScore: 0,
        }),
      ],
    },
  };
}

function buildQaPackPayload(expectedSummaryThresholds?: {
  maxMovedDownCount?: number;
  maxMovedUpCount?: number;
  maxAddedCount?: number;
  maxRemovedCount?: number;
  maxScoreDelta?: number;
  maxAbsoluteRankMovement?: number;
  minUnchangedCount?: number;
  maxTotalChangedCount?: number;
}) {
  return {
    packName: 'Sample home QA pack',
    description:
      'Safe mock QA pack for repeatable home ranking audits with sample data only.',
    scenarioType: 'home',
    query: null,
    productId: null,
    limit: 5,
    baselineSnapshot: buildSnapshotDiffPayload().baseline,
    candidateSnapshot: buildSnapshotDiffPayload().candidate,
    expectedSummaryThresholds: expectedSummaryThresholds ?? {
      maxMovedDownCount: 2,
      maxRemovedCount: 1,
      maxScoreDelta: 5,
    },
  };
}

function buildSnapshotItem(
  productId: string,
  name: string,
  rank: number,
  score: number,
  reasons: string[],
  scoreBreakdown: {
    categoryScore: number;
    textScore: number;
    popularityScore: number;
    freshnessScore: number;
    ratingScore: number;
    stockScore: number;
    shopScore: number;
    penaltyScore: number;
    personalizationScore?: number;
    recentViewScore?: number;
    categoryAffinityScore?: number;
    searchIntentScore?: number;
    clickAffinityScore?: number;
    analyticsPerformanceScore?: number;
    ctrScore?: number;
    productEngagementScore?: number;
    engagementScore?: number;
    algorithmPerformanceHint?: number;
    scenarioPerformanceHint?: number;
    sponsoredBoostScore?: number;
    businessBoostScore?: number;
    maxSponsoredBoost?: number;
  },
) {
  return {
    product: {
      id: productId,
      name,
      seoSlug: null,
      categoryName: 'Jackets',
      brand: 'North Berry',
      color: 'Black',
      price: '1499',
      inStock: true,
      imageUrl: 'https://example.com/image.jpg',
      shopName: 'Ready Shop',
      shopSlug: 'ready-shop',
    },
    rankMovement: null,
    ruleBasedV1: null,
    ruleBasedV2: {
      algorithm: 'rule_based_v2',
      rank,
      finalScore: score,
      reasons,
      scoreBreakdown: {
        ...scoreBreakdown,
        personalizationScore: scoreBreakdown.personalizationScore ?? 0,
        recentViewScore: scoreBreakdown.recentViewScore ?? 0,
        categoryAffinityScore: scoreBreakdown.categoryAffinityScore ?? 0,
        searchIntentScore: scoreBreakdown.searchIntentScore ?? 0,
        clickAffinityScore: scoreBreakdown.clickAffinityScore ?? 0,
        analyticsPerformanceScore:
          scoreBreakdown.analyticsPerformanceScore ?? 0,
        ctrScore: scoreBreakdown.ctrScore ?? 0,
        productEngagementScore:
          scoreBreakdown.productEngagementScore ??
          scoreBreakdown.engagementScore ??
          0,
        engagementScore:
          scoreBreakdown.engagementScore ??
          scoreBreakdown.productEngagementScore ??
          0,
        algorithmPerformanceHint: scoreBreakdown.algorithmPerformanceHint ?? 0,
        scenarioPerformanceHint: scoreBreakdown.scenarioPerformanceHint ?? 0,
        sponsoredBoostScore: scoreBreakdown.sponsoredBoostScore ?? 0,
        businessBoostScore: scoreBreakdown.businessBoostScore ?? 0,
        maxSponsoredBoost: scoreBreakdown.maxSponsoredBoost ?? 0,
      },
      sponsoredReason: null,
      sponsoredPreset: null,
      campaignReadiness: null,
      sponsoredCampaign: null,
    },
  };
}
