import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { QueueService } from '../src/common/queue/queue.service';
import { AiTryOnWorkerService } from '../src/modules/ai-try-on/ai-try-on.worker';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

describe('AiTryOnController (e2e)', () => {
  let app: INestApplication<App>;

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

  const product = {
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

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
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
    tasks = [];
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

    prismaMock.product.findFirst.mockResolvedValue(product);
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
  });

  it('public config returns the current AI settings', async () => {
    settings.aiTryOnEnabled = true;
    settings.aiTryOnProvider = 'mock';

    const response = await request(app.getHttpServer())
      .get('/api/public/ai-try-on/config')
      .expect(200);

    const body = readBody<{ enabled: boolean; providerMode: string }>(response);
    expect(body.enabled).toBe(true);
    expect(body.providerMode).toBe('mock');
  });

  it('blocks task creation when feature is disabled', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/products/product-1/try-on/tasks')
      .set('x-guest-session-id', 'guest-1')
      .send({
        selectedSize: 'M',
        selectedModelId: 'female_regular_165',
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
        selectedModelId: 'female_regular_165',
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
        selectedModelId: 'female_regular_165',
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
    expect(task.sizeRecommendation.recommendedRussianSize).toBe('RU 46');
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
      selectedModelId: 'female_regular_165',
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
        selectedModelId: 'female_regular_165',
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
        selectedModelId: 'male_regular_175',
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
