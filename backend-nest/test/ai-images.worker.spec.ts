import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { MockAiImageProvider } from '../src/modules/ai-images/ai-image-provider.mock';
import {
  type AiServiceGenerateResponse,
  AiServiceClientService,
  AiServiceRequestError,
} from '../src/modules/ai-images/ai-service-client.service';
import {
  AI_DEFAULT_PROVIDER,
  AI_TASK_STATUSES,
  AI_TASK_TYPES,
} from '../src/modules/ai-images/ai-images.constants';
import { AiImagesWorkerService } from '../src/modules/ai-images/ai-images.worker';

type TaskRecord = {
  id: string;
  shopId: string;
  productId: string;
  requestedBy: string;
  creditCost: number;
  creditRefundedAt: Date | null;
  quantity: number;
  mode: string;
  taskType: string;
  prompt: string;
  stylePreset: string | null;
  sourceImage: {
    wbUrl: string;
    localUrl: string | null;
  } | null;
  inputFrontImage: {
    wbUrl: string;
    localUrl: string | null;
  } | null;
  inputBackImage: null;
  inputModelImage: null;
  product: {
    wbTitle: string;
    localTitle: string;
    images: Array<{
      wbUrl: string;
      localUrl: string | null;
      isMain: boolean;
      sortOrder: number;
    }>;
  };
};

type TaskUpdateData = {
  status?: string;
  providerTaskId?: string | null;
  creditRefundedAt?: Date | null;
};

type CreditState = {
  balance: number;
  usedCredits: number;
  remainingCredits: number;
};

type CreditRecord = {
  shopId: string;
  balance: number;
  usedCredits: number;
  remainingCredits: number;
};

type PrismaWorkerMock = {
  aiGenerationTask: {
    findUnique: jest.Mock<
      Promise<TaskRecord | null>,
      [{ where: { id: string } }]
    >;
    update: jest.Mock<
      Promise<TaskRecord & { status: string; providerTaskId?: string | null }>,
      [{ data: TaskUpdateData }]
    >;
  };
  aiGeneratedImage: {
    deleteMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
    create: jest.Mock<
      Promise<Record<string, unknown>>,
      [{ data: Record<string, unknown> }]
    >;
  };
  sellerAiCredit: {
    findUnique: jest.Mock<Promise<CreditRecord>, [unknown]>;
    update: jest.Mock<Promise<CreditRecord>, [unknown]>;
  };
  aiUsageLog: {
    create: jest.Mock<
      Promise<Record<string, unknown>>,
      [{ data: Record<string, unknown> }]
    >;
  };
  $transaction: jest.Mock<
    Promise<unknown>,
    [(tx: PrismaWorkerMock) => unknown]
  >;
};

function createTaskRecord(id: string): TaskRecord {
  return {
    id,
    shopId: 'shop-1',
    productId: 'prod-1',
    requestedBy: 'user-1',
    creditCost: 2,
    creditRefundedAt: null,
    quantity: 2,
    mode: 'generate',
    taskType: AI_TASK_TYPES.PRODUCT_MODEL_IMAGE,
    prompt: 'Create a hero image for this sneaker.',
    stylePreset: 'studio',
    sourceImage: null,
    inputFrontImage: {
      wbUrl: 'https://cdn.example.com/product-front.jpg',
      localUrl: null,
    },
    inputBackImage: null,
    inputModelImage: null,
    product: {
      wbTitle: 'Sneaker',
      localTitle: 'Premium Sneaker',
      images: [
        {
          wbUrl: 'https://cdn.example.com/product-front.jpg',
          localUrl: null,
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  };
}

function createPrismaWorkerMock(taskRecord: TaskRecord) {
  const createdImages: Array<Record<string, unknown>> = [];
  const usageLogs: Array<Record<string, unknown>> = [];
  let taskStatus = AI_TASK_STATUSES.PENDING;
  let providerTaskId: string | null = null;
  let creditState: CreditState = {
    balance: 8,
    usedCredits: 2,
    remainingCredits: 8,
  };

  const prismaMock: PrismaWorkerMock = {
    aiGenerationTask: {
      findUnique: jest
        .fn<Promise<TaskRecord | null>, [{ where: { id: string } }]>()
        .mockImplementation(({ where }) => {
          if (where.id !== taskRecord.id) {
            return Promise.resolve(null);
          }

          return Promise.resolve({
            ...taskRecord,
            creditRefundedAt:
              taskStatus === AI_TASK_STATUSES.FAILED
                ? new Date('2026-05-11T00:00:00Z')
                : null,
          });
        }),
      update: jest
        .fn<
          Promise<
            TaskRecord & { status: string; providerTaskId?: string | null }
          >,
          [{ data: TaskUpdateData }]
        >()
        .mockImplementation(({ data }) => {
          if (data.status) {
            taskStatus = data.status;
          }
          if (data.providerTaskId !== undefined) {
            providerTaskId = data.providerTaskId;
          }

          return Promise.resolve({
            ...taskRecord,
            status: taskStatus,
            providerTaskId,
            creditRefundedAt: data.creditRefundedAt ?? null,
          });
        }),
    },
    aiGeneratedImage: {
      deleteMany: jest
        .fn<Promise<{ count: number }>, [unknown]>()
        .mockResolvedValue({ count: 0 }),
      create: jest
        .fn<
          Promise<Record<string, unknown>>,
          [{ data: Record<string, unknown> }]
        >()
        .mockImplementation(({ data }) => {
          createdImages.push(data);
          return Promise.resolve(data);
        }),
    },
    sellerAiCredit: {
      findUnique: jest
        .fn<Promise<CreditRecord>, [unknown]>()
        .mockImplementation(() =>
          Promise.resolve({
            shopId: taskRecord.shopId,
            ...creditState,
          }),
        ),
      update: jest.fn<Promise<CreditRecord>, [unknown]>().mockImplementation(
        ({
          data,
        }: {
          data: {
            balance: { increment: number };
            usedCredits: number;
            remainingCredits: number;
          };
        }) => {
          creditState = {
            balance: creditState.balance + data.balance.increment,
            usedCredits: data.usedCredits,
            remainingCredits: data.remainingCredits,
          };
          return Promise.resolve({
            shopId: taskRecord.shopId,
            ...creditState,
          });
        },
      ),
    },
    aiUsageLog: {
      create: jest
        .fn<
          Promise<Record<string, unknown>>,
          [{ data: Record<string, unknown> }]
        >()
        .mockImplementation(({ data }) => {
          usageLogs.push(data);
          return Promise.resolve(data);
        }),
    },
    $transaction: jest
      .fn<Promise<unknown>, [(tx: PrismaWorkerMock) => unknown]>()
      .mockImplementation((callback) => Promise.resolve(callback(prismaMock))),
  };

  return {
    prismaMock,
    createdImages,
    usageLogs,
    getTaskStatus: () => taskStatus,
    getProviderTaskId: () => providerTaskId,
    getCreditState: () => creditState,
  };
}

function createConfigService(mode: 'internal-mock' | 'ai-service') {
  return {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'AI_WORKER_MODE') {
        return mode;
      }
      if (key === 'BACKEND_INTERNAL_BASE_URL') {
        return 'http://backend-nest:3001';
      }
      if (
        key === 'BACKEND_PUBLIC_BASE_URL' ||
        key === 'FILES_PUBLIC_BASE_URL'
      ) {
        return 'http://127.0.0.1:3001';
      }
      return fallback;
    }),
  } as unknown as ConfigService;
}

function createAiServiceClientMock(
  implementation?: () => Promise<AiServiceGenerateResponse>,
) {
  const generateImagesMock = jest.fn().mockImplementation(() => {
    if (implementation) {
      return implementation();
    }

    return Promise.resolve({
      taskId: 'task-1',
      status: 'COMPLETED',
      images: [
        {
          url: 'https://ai.example.com/generated-1.png',
          storageKey: 'generated/generated-1.png',
          provider: 'MOCK',
          width: 1024,
          height: 1024,
        },
        {
          url: 'https://ai.example.com/generated-2.png',
          storageKey: 'generated/generated-2.png',
          provider: 'MOCK',
          width: 1024,
          height: 1024,
        },
      ],
    });
  });

  return {
    client: {
      generateImages: generateImagesMock,
    } as unknown as AiServiceClientService,
    generateImagesMock,
  };
}

describe('AiImagesWorkerService', () => {
  it('uses the internal mock provider and marks the task completed', async () => {
    const taskRecord = createTaskRecord('task-1');
    const context = createPrismaWorkerMock(taskRecord);
    const aiServiceClient = createAiServiceClientMock();

    const worker = new AiImagesWorkerService(
      createConfigService('internal-mock'),
      context.prismaMock as unknown as PrismaService,
      aiServiceClient.client,
      new MockAiImageProvider(),
    );

    await worker.processTask('task-1');

    expect(context.getTaskStatus()).toBe(AI_TASK_STATUSES.COMPLETED);
    expect(context.getProviderTaskId()).toBe('mock-provider-task-1');
    expect(context.createdImages).toHaveLength(2);
    expect(context.createdImages[0]).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        productId: 'prod-1',
        provider: AI_DEFAULT_PROVIDER,
        isSelected: false,
      }),
    );
    expect(aiServiceClient.generateImagesMock).not.toHaveBeenCalled();
  });

  it('uses ai-service mode and persists generated images from the HTTP response', async () => {
    const taskRecord = createTaskRecord('task-1');
    taskRecord.inputFrontImage = {
      wbUrl: 'https://cdn.example.com/product-front.jpg',
      localUrl:
        'http://127.0.0.1:3001/uploads/products/shop-1/prod-1/front.jpg',
    };
    const context = createPrismaWorkerMock(taskRecord);
    const aiServiceClient = createAiServiceClientMock();

    const worker = new AiImagesWorkerService(
      createConfigService('ai-service'),
      context.prismaMock as unknown as PrismaService,
      aiServiceClient.client,
      new MockAiImageProvider(),
    );

    await worker.processTask('task-1');

    expect(aiServiceClient.generateImagesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 2,
        inputImages: {
          frontImageUrl:
            'http://backend-nest:3001/uploads/products/shop-1/prod-1/front.jpg',
          backImageUrl: null,
          modelImageUrl: null,
        },
      }),
    );
    expect(context.getTaskStatus()).toBe(AI_TASK_STATUSES.COMPLETED);
    expect(context.getProviderTaskId()).toBe('task-1');
    expect(context.createdImages[0]).toEqual(
      expect.objectContaining({
        provider: 'MOCK',
        storageKey: 'generated/generated-1.png',
      }),
    );
  });

  it('refunds credit when ai-service fails with a non-retryable error', async () => {
    const taskRecord = createTaskRecord('task-2');
    const context = createPrismaWorkerMock(taskRecord);
    const aiServiceClient = createAiServiceClientMock(() =>
      Promise.reject(
        new AiServiceRequestError('Unauthorized.', false, true, 401),
      ),
    );

    const worker = new AiImagesWorkerService(
      createConfigService('ai-service'),
      context.prismaMock as unknown as PrismaService,
      aiServiceClient.client,
      new MockAiImageProvider(),
    );

    await worker.processTask('task-2');

    expect(context.getTaskStatus()).toBe(AI_TASK_STATUSES.FAILED);
    expect(context.getCreditState()).toEqual({
      balance: 10,
      usedCredits: 0,
      remainingCredits: 10,
    });
    expect(context.usageLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'TASK_FAILED_REFUNDED',
          status: AI_TASK_STATUSES.FAILED,
        }),
      ]),
    );
  });

  it('refunds credit when ai-service returns a quality guard failure', async () => {
    const taskRecord = createTaskRecord('task-3');
    const context = createPrismaWorkerMock(taskRecord);
    const aiServiceClient = createAiServiceClientMock(() =>
      Promise.reject(
        new AiServiceRequestError(
          'Generated image failed quality validation because the binary is not a readable image.',
          false,
          true,
          502,
        ),
      ),
    );

    const worker = new AiImagesWorkerService(
      createConfigService('ai-service'),
      context.prismaMock as unknown as PrismaService,
      aiServiceClient.client,
      new MockAiImageProvider(),
    );

    await worker.processTask('task-3');

    expect(context.getTaskStatus()).toBe(AI_TASK_STATUSES.FAILED);
    expect(context.getCreditState()).toEqual({
      balance: 10,
      usedCredits: 0,
      remainingCredits: 10,
    });
    expect(context.usageLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'TASK_FAILED_REFUNDED',
          status: AI_TASK_STATUSES.FAILED,
          errorMessage:
            'Generated image failed quality validation because the binary is not a readable image.',
        }),
      ]),
    );
  });
});
