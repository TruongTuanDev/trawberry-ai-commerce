import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { QueueService } from '../src/common/queue/queue.service';
import {
  AI_DEFAULT_DEV_CREDITS,
  AI_TASK_STATUSES,
  AI_TASK_TYPES,
} from '../src/modules/ai-images/ai-images.constants';
import { AiImagesWorkerService } from '../src/modules/ai-images/ai-images.worker';
import { AiCreditResponseDto } from '../src/modules/ai-images/dto/ai-credit-response.dto';
import { AiImageTaskResponseDto } from '../src/modules/ai-images/dto/ai-image-task-response.dto';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { ProductImageResponseDto } from '../src/modules/product-images/dto/product-image-response.dto';
import { readBody } from './test-helpers';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: string;
  status: string;
  sellerProfile?: {
    id: string;
    userId: string;
    approvalStatus: string;
    currentShopId: string | null;
  } | null;
};

type StoredShop = {
  id: string;
  sellerProfileId: string;
  name: string;
  slug: string;
  status: string;
  sellerProfile: {
    userId: string;
  };
};

type StoredProduct = {
  id: string;
  shopId: string;
  localTitle: string | null;
  wbTitle: string;
};

type StoredProductImage = {
  id: string;
  productId: string;
  wbUrl: string;
  localUrl: string | null;
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  imageType: string;
  isMain: boolean | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredCredit = {
  id: string;
  shopId: string;
  balance: number;
  reserved: number;
  totalCredits: number;
  usedCredits: number;
  remainingCredits: number;
  createdAt: Date;
  updatedAt: Date;
};

type StoredGeneratedImage = {
  id: string;
  taskId: string;
  shopId: string;
  productId: string;
  imageUrl: string;
  storageKey: string | null;
  thumbnailUrl: string | null;
  provider: string | null;
  storageProvider: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  isSelected: boolean;
  attachedImageId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

type StoredTask = {
  id: string;
  shopId: string;
  productId: string;
  requestedBy: string;
  status: string;
  mode: string;
  taskType: string;
  quantity: number;
  prompt: string;
  stylePreset: string | null;
  sourceImageId: string | null;
  inputFrontImageId: string | null;
  inputBackImageId: string | null;
  inputModelImageId: string | null;
  creditCost: number;
  creditRefundedAt: Date | null;
  attemptCount: number;
  queueJobId: string | null;
  providerTaskId: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('AiImagesController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let products: StoredProduct[];
  let productImages: StoredProductImage[];
  let credits: StoredCredit[];
  let tasks: StoredTask[];
  let generatedImages: StoredGeneratedImage[];
  let usageLogs: Array<Record<string, unknown>>;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    productImage: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    sellerAiCredit: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiGenerationTask: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    aiGeneratedImage: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    aiUsageLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const queueServiceMock = {
    enqueue: jest.fn(),
  };

  const workerServiceMock = {
    triggerMockProcessing: jest.fn(),
    processTask: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'user-s1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        role: 'SELLER',
        status: 'ACTIVE',
        sellerProfile: {
          id: 'sp1',
          userId: 'user-s1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'user-s2',
        email: 'seller2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        role: 'SELLER',
        status: 'ACTIVE',
        sellerProfile: {
          id: 'sp2',
          userId: 'user-s2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'sp1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        sellerProfile: {
          userId: 'user-s1',
        },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        sellerProfile: {
          userId: 'user-s2',
        },
      },
    ];

    products = [
      {
        id: 'prod-1',
        shopId: 'shop-1',
        localTitle: 'Local Product One',
        wbTitle: 'WB Product One',
      },
      {
        id: 'prod-2',
        shopId: 'shop-2',
        localTitle: 'Local Product Two',
        wbTitle: 'WB Product Two',
      },
    ];

    productImages = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        productId: 'prod-1',
        wbUrl: 'https://cdn.example.com/front-1.jpg',
        localUrl: 'https://cdn.example.com/front-1.jpg',
        storageKey: 'products/shop-1/prod-1/front-1.jpg',
        originalName: 'front-1.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        imageType: 'FRONT',
        isMain: true,
        sortOrder: 0,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'prod-1',
        wbUrl: 'https://cdn.example.com/back-1.jpg',
        localUrl: 'https://cdn.example.com/back-1.jpg',
        storageKey: 'products/shop-1/prod-1/back-1.jpg',
        originalName: 'back-1.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        imageType: 'BACK',
        isMain: false,
        sortOrder: 1,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        productId: 'prod-2',
        wbUrl: 'https://cdn.example.com/front-2.jpg',
        localUrl: 'https://cdn.example.com/front-2.jpg',
        storageKey: 'products/shop-2/prod-2/front-2.jpg',
        originalName: 'front-2.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        imageType: 'FRONT',
        isMain: true,
        sortOrder: 0,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ];

    credits = [
      {
        id: 'credit-1',
        shopId: 'shop-1',
        balance: 10,
        reserved: 0,
        totalCredits: 10,
        usedCredits: 0,
        remainingCredits: 10,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
      {
        id: 'credit-2',
        shopId: 'shop-2',
        balance: 0,
        reserved: 0,
        totalCredits: 0,
        usedCredits: 0,
        remainingCredits: 0,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ];

    tasks = [
      {
        id: '44444444-4444-4444-8444-444444444444',
        shopId: 'shop-1',
        productId: 'prod-1',
        requestedBy: 'user-s1',
        status: AI_TASK_STATUSES.FAILED,
        mode: 'generate',
        taskType: AI_TASK_TYPES.PRODUCT_MODEL_IMAGE,
        quantity: 1,
        prompt: 'Old failed task',
        stylePreset: 'studio',
        sourceImageId: '11111111-1111-4111-8111-111111111111',
        inputFrontImageId: '11111111-1111-4111-8111-111111111111',
        inputBackImageId: null,
        inputModelImageId: null,
        creditCost: 1,
        creditRefundedAt: new Date('2026-05-10T01:00:00.000Z'),
        attemptCount: 1,
        queueJobId: 'job-old',
        providerTaskId: null,
        errorMessage: 'Mock failure',
        completedAt: null,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ];

    generatedImages = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        taskId: '44444444-4444-4444-8444-444444444444',
        shopId: 'shop-1',
        productId: 'prod-1',
        imageUrl:
          'https://mock-ai.local/generated/44444444-4444-4444-8444-444444444444/1.png',
        storageKey: null,
        thumbnailUrl: null,
        provider: 'mock-provider',
        storageProvider: 'mock-provider',
        mimeType: 'image/png',
        width: 1024,
        height: 1024,
        isSelected: false,
        attachedImageId: null,
        createdAt: new Date('2026-05-10T01:00:00.000Z'),
      },
    ];

    usageLogs = [];

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
          where.email
            ? user.email === where.email.toLowerCase()
            : user.id === where.id,
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

    prismaMock.shop.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(shops.find((shop) => shop.id === where.id) ?? null),
    );

    prismaMock.product.findFirst.mockImplementation(
      ({
        where,
        select,
      }: {
        where: { id?: string; shopId?: string };
        select?: Record<string, boolean>;
      }) => {
        const found =
          products.find(
            (product) =>
              (where.id === undefined || product.id === where.id) &&
              (where.shopId === undefined || product.shopId === where.shopId),
          ) ?? null;

        if (!found) {
          return Promise.resolve(null);
        }

        if (select) {
          return Promise.resolve({
            id: found.id,
            localTitle: found.localTitle,
            wbTitle: found.wbTitle,
          });
        }

        return Promise.resolve(found);
      },
    );

    prismaMock.productImage.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; productId?: string } }) =>
        Promise.resolve(
          productImages.find(
            (image) =>
              (where.id === undefined || image.id === where.id) &&
              (where.productId === undefined ||
                image.productId === where.productId),
          ) ?? null,
        ),
    );

    prismaMock.productImage.count.mockImplementation(
      ({ where }: { where: { productId: string } }) =>
        Promise.resolve(
          productImages.filter((image) => image.productId === where.productId)
            .length,
        ),
    );

    prismaMock.productImage.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<StoredProductImage, 'createdAt' | 'updatedAt'>;
      }) => {
        const created: StoredProductImage = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        productImages.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.sellerAiCredit.findUnique.mockImplementation(
      ({ where }: { where: { shopId: string } }) =>
        Promise.resolve(
          credits.find((credit) => credit.shopId === where.shopId) ?? null,
        ),
    );

    prismaMock.sellerAiCredit.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<StoredCredit, 'createdAt' | 'updatedAt'> & {
          lastGrantedAt?: Date | null;
        };
      }) => {
        const created: StoredCredit = {
          id: data.id,
          shopId: data.shopId,
          balance: data.balance,
          reserved: data.reserved,
          totalCredits: data.totalCredits,
          usedCredits: data.usedCredits,
          remainingCredits: data.remainingCredits,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        credits.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.sellerAiCredit.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { shopId: string };
        data: Record<string, unknown>;
      }) => {
        const credit = credits.find((entry) => entry.shopId === where.shopId);
        if (!credit) {
          throw new Error('Credit not found');
        }

        if (typeof data.usedCredits === 'object' && data.usedCredits) {
          const value = data.usedCredits as { increment?: number };
          if (value.increment !== undefined) {
            credit.usedCredits += value.increment;
          }
        } else if (typeof data.usedCredits === 'number') {
          credit.usedCredits = data.usedCredits;
        }

        if (
          typeof data.remainingCredits === 'object' &&
          data.remainingCredits
        ) {
          const value = data.remainingCredits as {
            increment?: number;
            decrement?: number;
          };
          if (value.increment !== undefined) {
            credit.remainingCredits += value.increment;
          }
          if (value.decrement !== undefined) {
            credit.remainingCredits -= value.decrement;
          }
        } else if (typeof data.remainingCredits === 'number') {
          credit.remainingCredits = data.remainingCredits;
        }

        if (typeof data.balance === 'object' && data.balance) {
          const value = data.balance as {
            increment?: number;
            decrement?: number;
          };
          if (value.increment !== undefined) {
            credit.balance += value.increment;
          }
          if (value.decrement !== undefined) {
            credit.balance -= value.decrement;
          }
        } else if (typeof data.balance === 'number') {
          credit.balance = data.balance;
        }

        credit.updatedAt = new Date();
        return Promise.resolve(credit);
      },
    );

    prismaMock.aiGenerationTask.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<
          StoredTask,
          | 'createdAt'
          | 'updatedAt'
          | 'attemptCount'
          | 'queueJobId'
          | 'providerTaskId'
          | 'errorMessage'
          | 'completedAt'
          | 'creditRefundedAt'
        > & {
          creditRefundedAt?: Date | null;
          attemptCount?: number;
          queueJobId?: string | null;
          providerTaskId?: string | null;
          errorMessage?: string | null;
          completedAt?: Date | null;
        };
      }) => {
        const created: StoredTask = {
          ...data,
          attemptCount: data.attemptCount ?? 0,
          queueJobId: data.queueJobId ?? null,
          providerTaskId: data.providerTaskId ?? null,
          errorMessage: data.errorMessage ?? null,
          completedAt: data.completedAt ?? null,
          creditRefundedAt: data.creditRefundedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        tasks.push(created);
        return Promise.resolve({
          ...created,
          generatedImages: generatedImages.filter(
            (image) => image.taskId === created.id,
          ),
        });
      },
    );

    prismaMock.aiGenerationTask.update.mockImplementation(
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
        return Promise.resolve({
          ...task,
          generatedImages: generatedImages.filter(
            (image) => image.taskId === task.id,
          ),
        });
      },
    );

    prismaMock.aiGenerationTask.findMany.mockImplementation(
      ({
        where,
      }: {
        where: { shopId: string; status?: string; productId?: string };
      }) =>
        Promise.resolve(
          tasks
            .filter(
              (task) =>
                task.shopId === where.shopId &&
                (where.status === undefined || task.status === where.status) &&
                (where.productId === undefined ||
                  task.productId === where.productId),
            )
            .map((task) => ({
              ...task,
              generatedImages: generatedImages.filter(
                (image) => image.taskId === task.id,
              ),
            })),
        ),
    );

    prismaMock.aiGenerationTask.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; shopId?: string } }) =>
        Promise.resolve(
          tasks
            .filter(
              (task) =>
                (where.id === undefined || task.id === where.id) &&
                (where.shopId === undefined || task.shopId === where.shopId),
            )
            .map((task) => ({
              ...task,
              generatedImages: generatedImages.filter(
                (image) => image.taskId === task.id,
              ),
            }))[0] ?? null,
        ),
    );

    prismaMock.aiGenerationTask.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(tasks.find((task) => task.id === where.id) ?? null),
    );

    prismaMock.aiGeneratedImage.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: { id?: string; shopId?: string; productId?: string };
      }) =>
        Promise.resolve(
          generatedImages.find(
            (image) =>
              (where.id === undefined || image.id === where.id) &&
              (where.shopId === undefined || image.shopId === where.shopId) &&
              (where.productId === undefined ||
                image.productId === where.productId),
          ) ?? null,
        ),
    );

    prismaMock.aiGeneratedImage.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredGeneratedImage>;
      }) => {
        const image = generatedImages.find((entry) => entry.id === where.id);
        if (!image) {
          throw new Error('Generated image not found');
        }

        Object.assign(image, data);
        return Promise.resolve(image);
      },
    );

    prismaMock.aiGeneratedImage.create.mockImplementation(
      ({ data }: { data: StoredGeneratedImage }) => {
        generatedImages.push(data);
        return Promise.resolve(data);
      },
    );

    prismaMock.aiGeneratedImage.deleteMany.mockImplementation(
      ({ where }: { where: { taskId: string } }) => {
        const before = generatedImages.length;
        generatedImages = generatedImages.filter(
          (image) => image.taskId !== where.taskId,
        );
        return Promise.resolve({ count: before - generatedImages.length });
      },
    );

    prismaMock.aiUsageLog.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        usageLogs.push(data);
        return Promise.resolve(data);
      },
    );

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );

    queueServiceMock.enqueue.mockResolvedValue({
      jobId: 'job-1',
      queued: true,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(QueueService)
      .useValue(queueServiceMock)
      .overrideProvider(AiImagesWorkerService)
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

  it('creates an AI image task, deducts credits, and enqueues the job', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/ai-images/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        taskType: AI_TASK_TYPES.PRODUCT_MODEL_IMAGE,
        prompt:
          'Create a polished studio hero shot for this product with clean lighting.',
        stylePreset: 'studio-editorial',
        quantity: 2,
        inputFrontImageId: '11111111-1111-4111-8111-111111111111',
        inputBackImageId: '22222222-2222-4222-8222-222222222222',
      })
      .expect(201);
    const body = readBody<AiImageTaskResponseDto>(response);

    expect(body.status).toBe(AI_TASK_STATUSES.PENDING);
    expect(body.quantity).toBe(2);
    expect(body.taskType).toBe(AI_TASK_TYPES.PRODUCT_MODEL_IMAGE);
    expect(body.queueJobId).toBe('job-1');
    expect(
      credits.find((credit) => credit.shopId === 'shop-1')?.remainingCredits,
    ).toBe(8);
    expect(queueServiceMock.enqueue).toHaveBeenCalledWith(
      'ai-images',
      'generate-product-image',
      expect.objectContaining({
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 2,
      }),
    );
  });

  it('creates default credits for a shop that has no credit record yet', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    credits = credits.filter((credit) => credit.shopId !== 'shop-1');

    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/ai-credits')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<AiCreditResponseDto>(response);

    expect(body.totalCredits).toBe(AI_DEFAULT_DEV_CREDITS);
    expect(body.remainingCredits).toBe(AI_DEFAULT_DEV_CREDITS);
  });

  it('returns seller-safe AI runtime status for the current shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/ai-images/runtime')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<{
      shopId: string;
      workerMode: string;
      effectiveMode: string;
      supportsTaskGeneration: boolean;
      supportsTaskAttach: boolean;
      supportsCredits: boolean;
      supportsVirtualTryOn: boolean;
      tryOnReady: boolean;
    }>(response);

    expect(body.shopId).toBe('shop-1');
    expect(['internal-mock', 'ai-service']).toContain(body.workerMode);
    expect([
      'INTERNAL_MOCK',
      'AI_SERVICE_MOCK',
      'OPENAI_REAL',
      'AI_SERVICE_UNAVAILABLE',
    ]).toContain(body.effectiveMode);
    expect(body.supportsTaskGeneration).toBe(true);
    expect(body.supportsTaskAttach).toBe(true);
    expect(body.supportsCredits).toBe(true);
    expect(body.supportsVirtualTryOn).toBe(false);
    expect(body.tryOnReady).toBe(false);
  });

  it('rejects task creation when credits are insufficient', async () => {
    const token = await loginAndGetToken(app, 'seller2@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-2/products/prod-2/ai-images/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Create a premium campaign render for this product.',
        quantity: 1,
        inputFrontImageId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(400);
    const body = readBody<{ message: string }>(response);

    expect(body.message).toBe('Insufficient AI credits.');
  });

  it('rejects task creation when input image belongs to another product', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/ai-images/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Create a refined hero image.',
        quantity: 1,
        inputFrontImageId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(400);
    const body = readBody<{ message: string }>(response);

    expect(body.message).toContain('front image');
  });

  it('forbids cross-shop access', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/shops/shop-2/products/prod-2/ai-images/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        prompt: 'Create a premium campaign render for this product.',
        quantity: 1,
        inputFrontImageId: '33333333-3333-4333-8333-333333333333',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/shops/shop-2/ai-images/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('retries a FAILED task and deducts credits again', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post(
        '/api/shops/shop-1/ai-images/tasks/44444444-4444-4444-8444-444444444444/retry',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<AiImageTaskResponseDto>(response);

    expect(body.status).toBe(AI_TASK_STATUSES.PENDING);
    expect(body.creditRefundedAt).toBeNull();
    expect(
      credits.find((credit) => credit.shopId === 'shop-1')?.remainingCredits,
    ).toBe(9);
  });

  it('attaches a generated image into product images as AI_GENERATED', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post(
        '/api/shops/shop-1/products/prod-1/ai-images/55555555-5555-4555-8555-555555555555/attach',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const body = readBody<ProductImageResponseDto>(response);

    expect(body.imageType).toBe('AI_GENERATED');
    expect(
      productImages.some(
        (image) =>
          image.productId === 'prod-1' &&
          image.wbUrl ===
            'https://mock-ai.local/generated/44444444-4444-4444-8444-444444444444/1.png' &&
          image.imageType === 'AI_GENERATED',
      ),
    ).toBe(true);
    expect(
      generatedImages.find(
        (image) => image.id === '55555555-5555-4555-8555-555555555555',
      )?.isSelected,
    ).toBe(true);
  });
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password: 'password123',
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
