import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { QueueService } from '../src/common/queue/queue.service';
import { AiTryOnWorkerService } from '../src/modules/ai-try-on/ai-try-on.worker';
import { AiTryOnAiServiceClientService } from '../src/modules/ai-try-on/ai-try-on-ai-service-client.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

jest.setTimeout(30000);

type ManagedAiTryOnProduct = {
  id: string;
  shopId: string;
  aiTryOnEnabled: boolean;
  catalogStatus: string;
  visibility: string;
  localTitle: string;
  wbTitle: string;
  categoryId: bigint | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  unpublishedAt: Date | null;
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sizeName: string;
    russianSize: string;
    techSize: string;
    wbSize: string;
    sellerSku: string;
    basePrice: { toString(): string };
    discountPrice: { toString(): string } | null;
    stockQuantity: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    isActive: boolean;
  }>;
  category: {
    id: bigint;
    name: string;
    slug: string | null;
  } | null;
  shop: {
    id: string;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
};

describe('AiTryOnController (e2e)', () => {
  let app: INestApplication<App>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const settings = {
    id: 'default',
    aiTryOnEnabled: false,
    aiTryOnProvider: 'mock',
    guestDailyLimit: 3,
    customerDailyLimit: 5,
    requireConsent: true,
    supportedCategories: [] as string[],
    createdAt: new Date('2026-05-27T00:00:00.000Z'),
    updatedAt: new Date('2026-05-27T00:00:00.000Z'),
  };

  const users = [
    {
      id: 'admin-1',
      email: 'demo-admin@trawberry.local',
      passwordHash: bcrypt.hashSync('DemoAdmin123!', 10),
      fullName: 'Demo Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'customer-1',
      email: 'customer@example.com',
      passwordHash: bcrypt.hashSync('password123', 10),
      fullName: 'Demo Customer',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
  ];

  const product: ManagedAiTryOnProduct = {
    id: 'product-1',
    shopId: 'shop-1',
    aiTryOnEnabled: true,
    catalogStatus: 'PUBLISHED',
    visibility: 'ACTIVE',
    localTitle: 'Virtual Try-On Jacket',
    wbTitle: 'Virtual Try-On Jacket',
    categoryId: BigInt(10),
    categoryName: 'jackets',
    sourceCategoryName: 'jackets',
    publishedAt: new Date('2026-05-26T00:00:00.000Z'),
    archivedAt: null,
    unpublishedAt: null,
    images: [
      {
        id: 'image-1',
        wbUrl: 'https://cdn.example.com/jacket.jpg',
        localUrl: 'https://cdn.example.com/jacket.jpg',
        isMain: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: 'variant-1',
        sizeName: 'M',
        russianSize: 'RU 46',
        techSize: 'M',
        wbSize: '46',
        sellerSku: 'SKU-1',
        basePrice: { toString: () => '1990' },
        discountPrice: null,
        stockQuantity: 5,
        lowStockThreshold: 2,
        trackInventory: true,
        isActive: true,
      },
    ],
    category: {
      id: BigInt(10),
      name: 'Jackets',
      slug: 'jackets',
    },
    shop: {
      id: 'shop-1',
      status: 'ACTIVE',
      sellerProfile: {
        approvalStatus: 'APPROVED',
      },
    },
  };

  const categories = [
    {
      id: BigInt(10),
      name: 'Jackets',
      slug: 'jackets',
    },
    {
      id: BigInt(11),
      name: 'Dresses',
      slug: 'dresses',
    },
    {
      id: BigInt(12),
      name: 'Pants',
      slug: 'pants',
    },
    {
      id: BigInt(13),
      name: 'Bermuda',
      slug: 'bermuda',
    },
    {
      id: BigInt(1010),
      name: 'Джинсы',
      slug: 'jeans',
    },
    {
      id: BigInt(1040),
      name: 'Шорты',
      slug: 'shorts',
    },
  ];

  let tasks: Array<{
    id: string;
    customerId: string | null;
    guestSessionId: string | null;
    shopId: string;
    productId: string;
    selectedSize: string | null;
    selectedRussianSize: string | null;
    customerImageUrl: string | null;
    customerImageStorageKey: string | null;
    selectedModelId: string | null;
    heightCm: number | null;
    weightKg: number | null;
    gender: string | null;
    bodyType: string | null;
    bodyTraits: string[];
    consentAccepted: boolean;
    providerMode: string;
    status: string;
    resultImageUrl: string | null;
    resultImageStorageKey: string | null;
    resultMimeType: string | null;
    resultWidth: number | null;
    resultHeight: number | null;
    recommendedSize: string | null;
    recommendedRussianSize: string | null;
    sizeRecommendationNote: string | null;
    sizeRecommendationNoteRu: string | null;
    sizeRecommendationNoteEn: string | null;
    sizeRecommendationConfidence: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }> = [];
  let managedProducts: ManagedAiTryOnProduct[] = [];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    aiFeatureSetting: {
      upsert: jest.fn(),
    },
    aiTryOnTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    aiTryOnUsageLog: {
      create: jest.fn(),
    },
    aiTryOnModel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const queueServiceMock = {
    enqueue: jest.fn(),
  };

  const workerServiceMock = {
    triggerMockProcessing: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith('/health')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'OK',
              openaiConfigured: false,
              safeErrorCode: 'OPENAI_UNAUTHORIZED',
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            },
          ),
        );
      }

      return Promise.reject(
        new Error(`Unexpected fetch call in ai-try-on e2e test: ${url}`),
      );
    });

    tasks = [];
    managedProducts = [
      {
        ...product,
        id: 'product-1',
        categoryId: BigInt(10),
        categoryName: 'jackets',
        sourceCategoryName: 'jackets',
        aiTryOnEnabled: true,
        category: {
          id: BigInt(10),
          name: 'Jackets',
          slug: 'jackets',
        },
      },
      {
        ...product,
        id: 'product-2',
        categoryId: BigInt(11),
        categoryName: 'Dresses',
        sourceCategoryName: 'Dresses',
        aiTryOnEnabled: true,
        category: {
          id: BigInt(11),
          name: 'Dresses',
          slug: 'dresses',
        },
      },
      {
        ...product,
        id: 'product-3',
        categoryId: BigInt(1010),
        categoryName: 'Джинсы',
        sourceCategoryName: 'Джинсы',
        aiTryOnEnabled: false,
        category: {
          id: BigInt(1010),
          name: 'Джинсы',
          slug: 'jeans',
        },
      },
      {
        ...product,
        id: 'product-4',
        categoryId: BigInt(1040),
        categoryName: 'Шорты',
        sourceCategoryName: 'Шорты',
        aiTryOnEnabled: false,
        category: {
          id: BigInt(1040),
          name: 'Шорты',
          slug: 'shorts',
        },
      },
      {
        ...product,
        id: 'product-5',
        categoryId: null,
        categoryName: 'Legacy category',
        sourceCategoryName: 'Legacy category',
        aiTryOnEnabled: true,
        category: null,
      },
      {
        ...product,
        id: 'product-6',
        categoryId: BigInt(10),
        categoryName: 'jackets',
        sourceCategoryName: 'jackets',
        aiTryOnEnabled: true,
        visibility: 'INACTIVE',
        unpublishedAt: new Date('2026-05-26T00:00:00.000Z'),
        images: [],
        category: {
          id: BigInt(10),
          name: 'Jackets',
          slug: 'jackets',
        },
      },
    ];
    settings.aiTryOnEnabled = false;
    settings.aiTryOnProvider = 'mock';
    settings.guestDailyLimit = 3;
    settings.customerDailyLimit = 5;
    settings.requireConsent = true;
    settings.supportedCategories = [];

    prismaMock.user.findUnique.mockImplementation(
      ({ where }: { where: { email?: string; id?: string } }) =>
        users.find((user) =>
          where.email
            ? user.email === where.email.toLowerCase()
            : user.id === where.id,
        ) ?? null,
    );

    prismaMock.category.findMany.mockResolvedValue(categories);
    prismaMock.category.findFirst.mockImplementation(
      ({ where }: { where?: { OR?: Array<Record<string, unknown>> } }) => {
        const predicates = where?.OR ?? [];
        return (
          categories.find((category) =>
            predicates.some((predicate) => {
              const byName = predicate.name as
                | { equals?: string; mode?: string }
                | undefined;
              if (
                byName?.equals &&
                category.name.toLowerCase() === byName.equals.toLowerCase()
              ) {
                return true;
              }

              const bySlug = predicate.slug as
                | { equals?: string; mode?: string }
                | undefined;
              if (
                bySlug?.equals &&
                (category.slug ?? '').toLowerCase() ===
                  bySlug.equals.toLowerCase()
              ) {
                return true;
              }

              return false;
            }),
          ) ?? null
        );
      },
    );
    prismaMock.category.findUnique.mockImplementation(
      ({ where }: { where: { id: bigint } }) =>
        categories.find((category) => category.id === where.id) ?? null,
    );

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where?: { id?: string } }) =>
        managedProducts.find((entry) =>
          where?.id ? entry.id === where.id : entry.id === 'product-1',
        ) ?? null,
    );
    prismaMock.product.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: { aiTryOnEnabled: boolean };
      }) => {
        let count = 0;
        managedProducts = managedProducts.map((entry) => {
          if (!matchesAiTryOnSyncWhere(entry, where)) {
            return entry;
          }
          count += 1;
          return {
            ...entry,
            aiTryOnEnabled: data.aiTryOnEnabled,
          };
        });
        return { count };
      },
    );
    prismaMock.aiFeatureSetting.upsert.mockImplementation(
      ({
        update,
        create,
      }: {
        update: Record<string, unknown>;
        create: typeof settings;
      }) => {
        if (Object.keys(update).length > 0) {
          Object.assign(settings, update);
        } else if (!settings.id) {
          Object.assign(settings, create);
        }
        settings.updatedAt = new Date();
        return settings;
      },
    );
    prismaMock.aiTryOnTask.count.mockImplementation(
      ({
        where,
      }: {
        where: {
          customerId?: string;
          guestSessionId?: string;
          createdAt: { gte: Date };
        };
      }) =>
        tasks.filter((task) =>
          where.customerId
            ? task.customerId === where.customerId
            : task.guestSessionId === where.guestSessionId,
        ).length,
    );
    prismaMock.aiTryOnTask.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `task-${tasks.length + 1}`,
          customerId: (data.customerId as string | null) ?? null,
          guestSessionId: (data.guestSessionId as string | null) ?? null,
          shopId: String(data.shopId),
          productId: String(data.productId),
          selectedSize: (data.selectedSize as string | null) ?? null,
          selectedRussianSize:
            (data.selectedRussianSize as string | null) ?? null,
          customerImageUrl: (data.customerImageUrl as string | null) ?? null,
          customerImageStorageKey:
            (data.customerImageStorageKey as string | null) ?? null,
          selectedModelId: (data.selectedModelId as string | null) ?? null,
          heightCm: (data.heightCm as number | null) ?? null,
          weightKg: (data.weightKg as number | null) ?? null,
          gender: (data.gender as string | null) ?? null,
          bodyType: (data.bodyType as string | null) ?? null,
          bodyTraits: (data.bodyTraits as string[]) ?? [],
          consentAccepted: Boolean(data.consentAccepted),
          providerMode: String(data.providerMode),
          status: String(data.status),
          resultImageUrl: null,
          resultImageStorageKey: null,
          resultMimeType: null,
          resultWidth: null,
          resultHeight: null,
          recommendedSize: (data.recommendedSize as string | null) ?? null,
          recommendedRussianSize:
            (data.recommendedRussianSize as string | null) ?? null,
          sizeRecommendationNote:
            (data.sizeRecommendationNote as string | null) ?? null,
          sizeRecommendationNoteRu:
            (data.sizeRecommendationNoteRu as string | null) ?? null,
          sizeRecommendationNoteEn:
            (data.sizeRecommendationNoteEn as string | null) ?? null,
          sizeRecommendationConfidence:
            (data.sizeRecommendationConfidence as string | null) ?? null,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        };
        tasks.push(created);
        return created;
      },
    );
    prismaMock.aiTryOnTask.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        tasks.find((task) => task.id === where.id) ?? null,
    );
    prismaMock.aiTryOnTask.findUniqueOrThrow.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const task = tasks.find((entry) => entry.id === where.id);
        if (!task) {
          throw new Error('Task not found');
        }
        return task;
      },
    );
    prismaMock.aiTryOnTask.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const task = tasks.find((entry) => entry.id === where.id);
        if (!task) {
          throw new Error('Task not found');
        }
        Object.assign(task, data, { updatedAt: new Date() });
        return task;
      },
    );
    prismaMock.aiTryOnUsageLog.create.mockResolvedValue({});

    const mockModels = Array.from({ length: 10 }, (_, i) => ({
      id: `model-${i + 1}`,
      labelEn: `Model ${i + 1} En`,
      labelRu: `Model ${i + 1} Ru`,
      gender: i < 5 ? 'female' : 'male',
      bodyType: 'regular',
      heightCm: 170 + i,
      weightKg: 60 + i,
      imageUrl: `/ai-try-on/models/model${i + 1}.png`,
      sortOrder: (i + 1) * 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    prismaMock.aiTryOnModel.findMany.mockImplementation(
      ({ where }: { where?: { isActive?: boolean } }) => {
        if (where?.isActive === true) {
          return Promise.resolve(mockModels.filter((m) => m.isActive));
        }
        return Promise.resolve(mockModels);
      },
    );

    prismaMock.aiTryOnModel.findFirst.mockImplementation(
      ({ where }: { where?: { id?: string; isActive?: boolean } }) => {
        const found = mockModels.find(
          (m) =>
            (!where?.id || m.id === where.id) &&
            (where?.isActive === undefined || m.isActive === where.isActive),
        );
        return Promise.resolve(found ?? null);
      },
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(callback(prismaMock)),
    );

    queueServiceMock.enqueue.mockResolvedValue({
      jobId: 'simulated-job',
      queued: false,
    });
    workerServiceMock.triggerMockProcessing.mockImplementation(
      (taskId: string) => {
        const task = tasks.find((entry) => entry.id === taskId);
        if (!task) {
          return;
        }
        if (task.providerMode === 'openai') {
          task.status = 'FAILED';
          task.errorCode = 'AI_PROVIDER_NOT_CONFIGURED';
          task.errorMessage =
            'OpenAI provider is not configured for AI try-on.';
          task.updatedAt = new Date();
          return;
        }
        task.status = 'COMPLETED';
        task.resultImageUrl = `https://mock-ai.local/${task.id}.svg`;
        task.resultImageStorageKey = `ai-try-on/${task.id}.svg`;
        task.resultMimeType = 'image/svg+xml';
        task.resultWidth = 1024;
        task.resultHeight = 1536;
        task.completedAt = new Date();
        task.updatedAt = new Date();
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(QueueService)
      .useValue(queueServiceMock)
      .overrideProvider(AiTryOnWorkerService)
      .useValue(workerServiceMock)
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
    fetchSpy.mockRestore();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('admin can get and update AI settings', async () => {
    const token = await login(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    const initial = await request(app.getHttpServer())
      .get('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readBody<{ enabled: boolean }>(initial).enabled).toBe(false);

    const updated = await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'demo',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['jackets'],
      })
      .expect(200);

    const body = readBody<{ enabled: boolean; providerMode: string }>(updated);
    expect(body.enabled).toBe(true);
    expect(body.providerMode).toBe('demo');
    expect(
      readBody<{
        productAvailabilitySync: {
          enabledProducts: number;
          disabledProducts: number;
          mode: string;
        } | null;
      }>(updated).productAvailabilitySync,
    ).toEqual({
      enabledProducts: 2,
      disabledProducts: 4,
      mode: 'RESTRICTED',
    });

    const openAiUpdated = await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'openai',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['jackets'],
      })
      .expect(200);

    expect(
      readBody<{
        providerConfigured: boolean | null;
        aiServiceReachable: boolean | null;
        providerSafeErrorCode: string | null;
      }>(openAiUpdated),
    ).toMatchObject({
      providerConfigured: false,
      aiServiceReachable: true,
      providerSafeErrorCode: 'OPENAI_UNAUTHORIZED',
    });
  });

  it('public config returns the current AI settings', async () => {
    settings.aiTryOnEnabled = true;
    settings.aiTryOnProvider = 'mock';

    const response = await request(app.getHttpServer())
      .get('/api/public/ai-try-on/config')
      .expect(200);

    const body = readBody<{
      enabled: boolean;
      providerMode: string;
    }>(response);
    expect(body.enabled).toBe(true);
    expect(body.providerMode).toBe('mock');
  });

  it('public models endpoint returns active models from database', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/ai-try-on/models')
      .expect(200);

    const body =
      readBody<Array<{ modelId: string; imageUrl: string }>>(response);
    expect(body).toHaveLength(10);
    expect(body[0]).toMatchObject({
      modelId: 'model-1',
      imageUrl: '/ai-try-on/models/model1.png',
    });
    expect(body[9]).toMatchObject({
      modelId: 'model-10',
      imageUrl: '/ai-try-on/models/model10.png',
    });
    expect(
      body.every((model) =>
        model.imageUrl.startsWith('/ai-try-on/models/model'),
      ),
    ).toBe(true);
    expect(body.some((model) => model.imageUrl.endsWith('.svg'))).toBe(false);
  });

  it('reads legacy supported categories payloads without losing values', async () => {
    settings.supportedCategories =
      'jackets, dresses, pants' as unknown as string[];

    const response = await request(app.getHttpServer())
      .get('/api/public/ai-try-on/config')
      .expect(200);

    expect(
      readBody<{ supportedCategories: string[] }>(response).supportedCategories,
    ).toEqual(['jackets', 'dresses', 'pants']);
  });

  it('maps supported category updates to category ids when a matching category exists', async () => {
    const token = await login(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    const updated = await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'mock',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['jackets'],
      })
      .expect(200);

    expect(
      readBody<{ supportedCategories: string[] }>(updated).supportedCategories,
    ).toEqual(['10']);
  });

  it('syncs product ai try-on availability when admin changes supported categories', async () => {
    const token = await login(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'mock',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['1010', '1040'],
      })
      .expect(200);

    expect(
      managedProducts.find((entry) => entry.id === 'product-3')?.aiTryOnEnabled,
    ).toBe(true);
    expect(
      managedProducts.find((entry) => entry.id === 'product-4')?.aiTryOnEnabled,
    ).toBe(true);
    expect(
      managedProducts.find((entry) => entry.id === 'product-1')?.aiTryOnEnabled,
    ).toBe(false);
    expect(
      managedProducts.find((entry) => entry.id === 'product-5')?.aiTryOnEnabled,
    ).toBe(false);

    await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'mock',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['1010'],
      })
      .expect(200);

    expect(
      managedProducts.find((entry) => entry.id === 'product-3')?.aiTryOnEnabled,
    ).toBe(true);
    expect(
      managedProducts.find((entry) => entry.id === 'product-4')?.aiTryOnEnabled,
    ).toBe(false);
  });

  it('re-enables all eligible products when supported categories are cleared', async () => {
    const token = await login(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );
    managedProducts = managedProducts.map((entry) => ({
      ...entry,
      aiTryOnEnabled: false,
    }));

    const updated = await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'mock',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: [],
      })
      .expect(200);

    expect(
      readBody<{
        productAvailabilitySync: {
          enabledProducts: number;
          disabledProducts: number;
          mode: string;
        } | null;
      }>(updated).productAvailabilitySync,
    ).toEqual({
      enabledProducts: 5,
      disabledProducts: 1,
      mode: 'ALLOW_ALL_ELIGIBLE',
    });
    expect(
      managedProducts.find((entry) => entry.id === 'product-1')?.aiTryOnEnabled,
    ).toBe(true);
    expect(
      managedProducts.find((entry) => entry.id === 'product-4')?.aiTryOnEnabled,
    ).toBe(true);
    expect(
      managedProducts.find((entry) => entry.id === 'product-6')?.aiTryOnEnabled,
    ).toBe(false);
  });

  it('allows try-on after admin save sync flips a supported product to enabled', async () => {
    const token = await login(
      app,
      'demo-admin@trawberry.local',
      'DemoAdmin123!',
    );

    expect(
      managedProducts.find((entry) => entry.id === 'product-4')?.aiTryOnEnabled,
    ).toBe(false);

    await request(app.getHttpServer())
      .patch('/api/admin/ai-settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        providerMode: 'mock',
        guestDailyLimit: 2,
        customerDailyLimit: 4,
        requireConsent: true,
        supportedCategories: ['1040'],
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-4/try-on/tasks')
      .set('x-guest-session-id', 'guest-after-sync')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    expect(readBody<{ status: string }>(response).status).toBe('COMPLETED');
  });

  it('blocks task creation when feature is disabled', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-1')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'AI_TRY_ON_DISABLED',
    );
  });

  it('requires consent and a reference when enabled', async () => {
    settings.aiTryOnEnabled = true;

    const consentResponse = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-1')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: false,
      })
      .expect(400);
    expect(readBody<{ code: string }>(consentResponse).code).toBe(
      'AI_TRY_ON_CONSENT_REQUIRED',
    );

    const referenceResponse = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-1')
      .send({
        selectedSize: 'M',
        consentAccepted: true,
      })
      .expect(400);
    expect(readBody<{ code: string }>(referenceResponse).code).toBe(
      'AI_TRY_ON_REFERENCE_REQUIRED',
    );
  });

  it('accepts an uploaded photo without requiring a demo model', async () => {
    settings.aiTryOnEnabled = true;

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-photo-only')
      .send({
        selectedSize: 'M',
        customerImageUrl: 'https://cdn.example.com/customer-reference.png',
        customerImageStorageKey:
          'ai-try-on/guest/guest-photo-only/customer-reference.png',
        consentAccepted: true,
      })
      .expect(201);

    const body = readBody<{
      status: string;
      selectedSize: string | null;
    }>(response);
    expect(body.status).toBe('COMPLETED');
    expect(body.selectedSize).toBe('M');
  });

  it('rejects requests that send both uploaded photo and demo model', async () => {
    settings.aiTryOnEnabled = true;

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-reference-conflict')
      .send({
        selectedSize: 'M',
        customerImageUrl: 'https://cdn.example.com/customer-reference.png',
        customerImageStorageKey:
          'ai-try-on/guest/guest-reference-conflict/customer-reference.png',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'AI_TRY_ON_REFERENCE_CONFLICT',
    );
  });

  it('creates a mock task and returns completed result data', async () => {
    settings.aiTryOnEnabled = true;
    settings.aiTryOnProvider = 'mock';

    const created = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-1')
      .send({
        selectedSize: 'M',
        selectedRussianSize: 'RU 46',
        heightCm: 172,
        weightKg: 70,
        gender: 'female',
        bodyType: 'regular',
        bodyTraits: ['wide_shoulders'],
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);
    const createdBody = readBody<{ id: string }>(created);

    const taskResponse = await request(app.getHttpServer())
      .get(`/api/public/ai-try-on/tasks/${createdBody.id}`)
      .set('x-guest-session-id', 'guest-1')
      .expect(200);
    const task = readBody<{
      status: string;
      resultImage: { url: string } | null;
      sizeRecommendation: { recommendedRussianSize: string | null };
    }>(taskResponse);

    expect(task.status).toBe('COMPLETED');
    expect(task.resultImage?.url).toContain(createdBody.id);
    expect(task.resultImage?.mimeType).toBe('image/svg+xml');
    expect(task.resultImage?.width).toBe(1024);
    expect(task.resultImage?.height).toBe(1536);
    expect(task.sizeRecommendation.recommendedRussianSize).toBe('RU 46');
  });

  it('creates a demo task and still returns completed result data', async () => {
    settings.aiTryOnEnabled = true;
    settings.aiTryOnProvider = 'demo';

    const created = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-demo')
      .send({
        selectedSize: 'L',
        selectedRussianSize: 'RU 48',
        gender: 'female',
        bodyType: 'regular',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    const taskResponse = await request(app.getHttpServer())
      .get(
        `/api/public/ai-try-on/tasks/${readBody<{ id: string }>(created).id}`,
      )
      .set('x-guest-session-id', 'guest-demo')
      .expect(200);

    expect(
      readBody<{
        providerMode: string;
        status: string;
        resultImage: { mimeType: string } | null;
      }>(taskResponse),
    ).toMatchObject({
      providerMode: 'demo',
      status: 'COMPLETED',
      resultImage: {
        mimeType: 'image/svg+xml',
      },
    });
  });

  it('blocks guest usage after the configured daily limit', async () => {
    settings.aiTryOnEnabled = true;
    settings.guestDailyLimit = 1;
    tasks.push({
      id: 'existing-task',
      customerId: null,
      guestSessionId: 'guest-limit',
      shopId: 'shop-1',
      productId: 'product-1',
      selectedSize: 'M',
      selectedRussianSize: 'RU 46',
      customerImageUrl: null,
      customerImageStorageKey: null,
      selectedModelId: 'model-3',
      heightCm: 170,
      weightKg: 60,
      gender: 'female',
      bodyType: 'regular',
      bodyTraits: [],
      consentAccepted: true,
      providerMode: 'mock',
      status: 'COMPLETED',
      resultImageUrl: 'https://mock-ai.local/existing.svg',
      resultImageStorageKey: 'ai-try-on/existing.svg',
      resultMimeType: 'image/svg+xml',
      resultWidth: 1024,
      resultHeight: 1536,
      recommendedSize: 'M',
      recommendedRussianSize: 'RU 46',
      sizeRecommendationNote: 'note',
      sizeRecommendationNoteRu: 'note',
      sizeRecommendationNoteEn: 'note',
      sizeRecommendationConfidence: 'medium',
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-limit')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'AI_TRY_ON_LIMIT_EXCEEDED',
    );
  });

  it('fails with AI_PROVIDER_NOT_CONFIGURED when openai mode is attempted without a configured key', async () => {
    settings.aiTryOnEnabled = true;
    settings.aiTryOnProvider = 'openai';

    const created = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-openai')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-7',
        consentAccepted: true,
      })
      .expect(201);

    const task = await request(app.getHttpServer())
      .get(
        `/api/public/ai-try-on/tasks/${readBody<{ id: string }>(created).id}`,
      )
      .set('x-guest-session-id', 'guest-openai')
      .expect(200);

    const body = readBody<{ status: string; errorCode: string | null }>(task);
    expect(body.status).toBe('FAILED');
    expect(body.errorCode).toBe('AI_PROVIDER_NOT_CONFIGURED');
  });

  it('supports alias and phrase matching for configured try-on categories', async () => {
    settings.aiTryOnEnabled = true;
    settings.supportedCategories = ['bermuda'];
    prismaMock.product.findFirst.mockResolvedValue({
      ...product,
      localTitle: 'Шорты джинсовые бермуды',
      wbTitle: 'Шорты джинсовые бермуды',
      category: null,
      categoryName: 'Шорты джинсовые бермуды',
      sourceCategoryName: 'Шорты джинсовые бермуды',
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-bermuda')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    expect(readBody<{ status: string }>(response).status).toBe('COMPLETED');
  });

  it('supports products when admin settings store matching category ids as strings', async () => {
    settings.aiTryOnEnabled = true;
    settings.supportedCategories = ['1040'];
    prismaMock.product.findFirst.mockResolvedValue({
      ...product,
      categoryId: BigInt(1040),
      category: {
        id: BigInt(1040),
        name: 'Шорты',
        slug: 'shorts',
      },
      categoryName: 'Шорты',
      sourceCategoryName: 'Шорты',
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-shorts-id')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    expect(readBody<{ status: string }>(response).status).toBe('COMPLETED');
  });

  it('supports products by resolving legacy category names when category id is missing', async () => {
    settings.aiTryOnEnabled = true;
    settings.supportedCategories = ['1040'];
    prismaMock.product.findFirst.mockResolvedValue({
      ...product,
      categoryId: null,
      category: null,
      categoryName: 'Шорты',
      sourceCategoryName: 'Шорты',
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-shorts-name')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    expect(readBody<{ status: string }>(response).status).toBe('COMPLETED');
  });

  it('supports numeric stored category ids without failing number string matching', async () => {
    settings.aiTryOnEnabled = true;
    settings.supportedCategories = [1010] as unknown as string[];
    prismaMock.product.findFirst.mockResolvedValue({
      ...product,
      categoryId: BigInt(1010),
      category: {
        id: BigInt(1010),
        name: 'Джинсы',
        slug: 'jeans',
      },
      categoryName: 'Джинсы',
      sourceCategoryName: 'Джинсы',
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-jeans-id')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(201);

    expect(readBody<{ status: string }>(response).status).toBe('COMPLETED');
  });

  it('keeps blocking products whose categories are not selected', async () => {
    settings.aiTryOnEnabled = true;
    settings.supportedCategories = ['1040'];
    prismaMock.product.findFirst.mockResolvedValue({
      ...product,
      categoryId: BigInt(1010),
      category: {
        id: BigInt(1010),
        name: 'Джинсы',
        slug: 'jeans',
      },
      categoryName: 'Джинсы',
      sourceCategoryName: 'Джинсы',
    });

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-unsupported-category')
      .send({
        selectedSize: 'M',
        selectedModelId: 'model-3',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'AI_TRY_ON_PRODUCT_UNSUPPORTED',
    );
  });

  it('rejects task creation with outdated legacy model IDs', async () => {
    settings.aiTryOnEnabled = true;

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-legacy-model')
      .send({
        selectedSize: 'M',
        selectedModelId: 'try-on-model-female-regular',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'DEMO_MODEL_OUTDATED',
    );
  });

  it('rejects task creation with non-existent model IDs', async () => {
    settings.aiTryOnEnabled = true;

    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-invalid-model')
      .send({
        selectedSize: 'M',
        selectedModelId: 'non-existent-model-id',
        consentAccepted: true,
      })
      .expect(400);

    expect(readBody<{ code: string }>(response).code).toBe(
      'DEMO_MODEL_NOT_FOUND',
    );
  });
});

async function login(
  app: INestApplication<App>,
  email: string,
  password: string,
) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}

function matchesAiTryOnSyncWhere(
  productRow: ManagedAiTryOnProduct,
  where: Record<string, unknown> | undefined,
): boolean {
  if (!where) {
    return true;
  }

  if (Array.isArray(where.OR)) {
    return where.OR.some((entry) =>
      matchesAiTryOnSyncWhere(
        productRow,
        entry as Record<string, unknown> | undefined,
      ),
    );
  }

  if (where.NOT && typeof where.NOT === 'object') {
    return !matchesAiTryOnSyncWhere(
      productRow,
      where.NOT as Record<string, unknown>,
    );
  }

  if (where.visibility && productRow.visibility !== where.visibility) {
    return false;
  }

  if ('archivedAt' in where && productRow.archivedAt !== where.archivedAt) {
    return false;
  }

  if (
    'unpublishedAt' in where &&
    productRow.unpublishedAt !== where.unpublishedAt
  ) {
    return false;
  }

  if (
    where.images &&
    typeof where.images === 'object' &&
    'some' in (where.images as Record<string, unknown>) &&
    productRow.images.length < 1
  ) {
    return false;
  }

  if (where.shop && typeof where.shop === 'object') {
    const shopWhere = where.shop as {
      status?: string;
      sellerProfile?: { approvalStatus?: string };
    };
    if (shopWhere.status && productRow.shop.status !== shopWhere.status) {
      return false;
    }
    if (
      shopWhere.sellerProfile?.approvalStatus &&
      productRow.shop.sellerProfile.approvalStatus !==
        shopWhere.sellerProfile.approvalStatus
    ) {
      return false;
    }
  }

  if (where.variants && typeof where.variants === 'object') {
    const variantsWhere = where.variants as {
      some?: {
        isActive?: boolean;
        OR?: Array<{
          discountPrice?: { gt?: number };
          basePrice?: { gt?: number };
        }>;
      };
    };
    if (variantsWhere.some) {
      const matched = productRow.variants.some((variant) => {
        if (
          variantsWhere.some?.isActive !== undefined &&
          variant.isActive !== variantsWhere.some.isActive
        ) {
          return false;
        }

        if (!variantsWhere.some?.OR?.length) {
          return true;
        }

        return variantsWhere.some.OR.some((priceWhere) => {
          const discountPrice = Number(
            variant.discountPrice ? variant.discountPrice.toString() : '0',
          );
          const basePrice = Number(variant.basePrice.toString());

          return Boolean(
            (priceWhere.discountPrice?.gt !== undefined &&
              discountPrice > priceWhere.discountPrice.gt) ||
            (priceWhere.basePrice?.gt !== undefined &&
              basePrice > priceWhere.basePrice.gt),
          );
        });
      });

      if (!matched) {
        return false;
      }
    }
  }

  if (where.categoryId === null) {
    return productRow.categoryId === null;
  }

  if (where.categoryId && typeof where.categoryId === 'object') {
    const categoryWhere = where.categoryId as {
      in?: bigint[];
      notIn?: bigint[];
    };
    if (
      categoryWhere.in &&
      !categoryWhere.in.some((value) => value === productRow.categoryId)
    ) {
      return false;
    }
    if (
      categoryWhere.notIn &&
      categoryWhere.notIn.some((value) => value === productRow.categoryId)
    ) {
      return false;
    }
  }

  return true;
}

describe('AiTryOnWorkerService URL Resolution', () => {
  it('resolves model-2 image relative URL to frontend-next:3000 and never to backend-nest:3001', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiTryOnWorkerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: string): string | undefined => {
                if (key === 'FRONTEND_INTERNAL_BASE_URL') {
                  return 'http://frontend-next:3000';
                }
                return defaultValue;
              },
            ),
          },
        },
        { provide: PrismaService, useValue: {} },
        { provide: AiTryOnAiServiceClientService, useValue: {} },
      ],
    }).compile();

    const workerService =
      moduleRef.get<AiTryOnWorkerService>(AiTryOnWorkerService);
    const resolved = (
      workerService as unknown as {
        resolveSelectedModelImageUrl: (
          a: string,
          b: string,
          c: string | null,
          d: string,
          e: string | null,
        ) => string;
      }
    ).resolveSelectedModelImageUrl(
      '/ai-try-on/models/model2.png',
      'http://frontend-next:3000',
      null,
      'http://backend-nest:3001',
      null,
    );

    expect(resolved).toBe(
      'http://frontend-next:3000/ai-try-on/models/model2.png',
    );
    expect(resolved).not.toContain('backend-nest:3001');
  });
});
