import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  AI_IMAGE_PROVIDER,
  type AiImageProvider,
} from './ai-image-provider.interface';
import {
  AiServiceClientService,
  AiServiceRequestError,
} from './ai-service-client.service';
import {
  AI_DEFAULT_PROVIDER,
  AI_IMAGE_JOB_GENERATE,
  AI_IMAGE_QUEUE,
  AI_TASK_STATUSES,
} from './ai-images.constants';

@Injectable()
export class AiImagesWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiImagesWorkerService.name);
  private worker?: Worker<{ taskId: string }>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiServiceClient: AiServiceClientService,
    @Inject(AI_IMAGE_PROVIDER)
    private readonly aiImageProvider: AiImageProvider,
  ) {}

  onModuleInit() {
    const isDisabled =
      this.configService.get<string>('BULLMQ_DISABLED', 'true') === 'true';
    if (isDisabled) {
      return;
    }

    this.worker = new Worker<{ taskId: string }>(
      AI_IMAGE_QUEUE,
      async (job: Job<{ taskId: string }>) => {
        if (job.name === AI_IMAGE_JOB_GENERATE) {
          await this.processTask(String(job.data.taskId));
        }
      },
      {
        connection: {
          host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          password:
            this.configService.get<string>('REDIS_PASSWORD') || undefined,
          db: this.configService.get<number>('REDIS_DB', 0),
          lazyConnect: true,
        },
      },
    );
  }

  async processTask(taskId: string) {
    const task = await this.prisma.aiGenerationTask.findUnique({
      where: { id: taskId },
      include: {
        sourceImage: true,
        inputFrontImage: true,
        inputBackImage: true,
        inputModelImage: true,
        product: {
          include: {
            images: {
              orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
    });

    if (!task) {
      this.logger.warn(`AI generation task ${taskId} not found.`);
      return;
    }

    try {
      await this.prisma.aiGenerationTask.update({
        where: { id: taskId },
        data: {
          status: AI_TASK_STATUSES.PROCESSING,
          attemptCount: {
            increment: 1,
          },
          errorMessage: null,
        },
      });

      const frontImageUrl =
        task.inputFrontImage?.localUrl ??
        task.inputFrontImage?.wbUrl ??
        task.sourceImage?.localUrl ??
        task.sourceImage?.wbUrl ??
        task.product.images[0]?.localUrl ??
        task.product.images[0]?.wbUrl ??
        null;
      const backImageUrl =
        task.inputBackImage?.localUrl ?? task.inputBackImage?.wbUrl ?? null;
      const modelImageUrl =
        task.inputModelImage?.localUrl ?? task.inputModelImage?.wbUrl ?? null;

      const result = await this.generateTaskOutput({
        task,
        frontImageUrl,
        backImageUrl,
        modelImageUrl,
      });

      await this.persistCompletedTask(
        task.id,
        task.productId,
        task.shopId,
        task.requestedBy,
        result,
      );
    } catch (error) {
      await this.persistFailedTask(task, error);
    }
  }

  private async generateTaskOutput({
    task,
    frontImageUrl,
    backImageUrl,
    modelImageUrl,
  }: {
    task: {
      id: string;
      shopId: string;
      productId: string;
      taskType: string;
      quantity: number;
      prompt: string;
      stylePreset: string | null;
    };
    frontImageUrl: string | null;
    backImageUrl: string | null;
    modelImageUrl: string | null;
  }) {
    const workerMode = this.configService.get<string>(
      'AI_WORKER_MODE',
      'internal-mock',
    );

    if (workerMode === 'ai-service') {
      const response = await this.aiServiceClient.generateImages({
        taskId: task.id,
        shopId: task.shopId,
        productId: task.productId,
        quantity: task.quantity,
        taskType: task.taskType,
        stylePreset: task.stylePreset,
        prompt: task.prompt,
        inputImages: {
          frontImageUrl,
          backImageUrl,
          modelImageUrl,
        },
      });

      return {
        providerTaskId: response.taskId,
        provider:
          response.images[0]?.provider && response.images[0].provider.length > 0
            ? response.images[0].provider
            : 'AI_SERVICE_MOCK',
        images: response.images.map((image) => ({
          imageUrl: image.url,
          storageKey: image.storageKey ?? null,
          thumbnailUrl: null,
          mimeType: null,
          width: image.width ?? null,
          height: image.height ?? null,
          metadata: {
            source: 'ai-service',
          },
        })),
      };
    }

    return this.aiImageProvider.generateProductImage({
      taskId: task.id,
      shopId: task.shopId,
      productId: task.productId,
      taskType: task.taskType,
      quantity: task.quantity,
      prompt: task.prompt,
      stylePreset: task.stylePreset ?? null,
      inputFrontImageUrl: frontImageUrl,
      inputBackImageUrl: backImageUrl,
      inputModelImageUrl: modelImageUrl,
    });
  }

  triggerMockProcessing(taskId: string) {
    setTimeout(() => {
      void this.processTask(taskId);
    }, 0);
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async persistCompletedTask(
    taskId: string,
    productId: string,
    shopId: string,
    requestedBy: string,
    result: {
      providerTaskId: string;
      provider: string;
      images: Array<{
        imageUrl: string;
        storageKey?: string | null;
        thumbnailUrl?: string | null;
        mimeType?: string | null;
        width?: number | null;
        height?: number | null;
        metadata?: Record<string, unknown> | null;
      }>;
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.aiGeneratedImage.deleteMany({
        where: {
          taskId,
        },
      });

      for (const image of result.images) {
        await tx.aiGeneratedImage.create({
          data: {
            taskId,
            shopId,
            productId,
            imageUrl: image.imageUrl,
            storageKey: image.storageKey ?? null,
            thumbnailUrl: image.thumbnailUrl ?? null,
            provider: result.provider,
            storageProvider: result.provider,
            mimeType: image.mimeType ?? null,
            width: image.width ?? null,
            height: image.height ?? null,
            isSelected: false,
            metadata: (image.metadata ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          },
        });
      }

      await tx.aiGenerationTask.update({
        where: { id: taskId },
        data: {
          status: AI_TASK_STATUSES.COMPLETED,
          providerTaskId: result.providerTaskId ?? null,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      const credit = await tx.sellerAiCredit.findUnique({
        where: { shopId },
      });

      await tx.aiUsageLog.create({
        data: {
          shopId,
          taskId,
          userId: requestedBy,
          provider: result.provider,
          action: 'TASK_COMPLETED',
          creditCost: 0,
          status: AI_TASK_STATUSES.COMPLETED,
          errorMessage: null,
          creditDelta: 0,
          balanceAfter: credit?.remainingCredits ?? credit?.balance ?? 0,
          metadata: {
            imageCount: result.images.length,
          },
        },
      });
    });
  }

  private async persistFailedTask(
    task: {
      id: string;
      shopId: string;
      requestedBy: string;
      creditCost: number;
      creditRefundedAt: Date | null;
    },
    error: unknown,
  ) {
    const message =
      error instanceof Error ? error.message : 'AI generation failed.';
    const shouldRefund =
      error instanceof AiServiceRequestError ? error.refundCredit : true;

    await this.prisma.$transaction(async (tx) => {
      const currentTask = await tx.aiGenerationTask.findUnique({
        where: {
          id: task.id,
        },
      });

      if (shouldRefund && currentTask && !currentTask.creditRefundedAt) {
        const currentCredit = await tx.sellerAiCredit.findUnique({
          where: { shopId: task.shopId },
        });

        if (currentCredit) {
          await tx.sellerAiCredit.update({
            where: { shopId: task.shopId },
            data: {
              balance: {
                increment: currentTask.creditCost,
              },
              usedCredits: Math.max(
                currentCredit.usedCredits - currentTask.creditCost,
                0,
              ),
              remainingCredits:
                currentCredit.remainingCredits + currentTask.creditCost,
            },
          });
        }
      }

      await tx.aiGenerationTask.update({
        where: { id: task.id },
        data: {
          status: AI_TASK_STATUSES.FAILED,
          errorMessage: message,
          completedAt: null,
          creditRefundedAt:
            shouldRefund && currentTask && !currentTask.creditRefundedAt
              ? new Date()
              : (currentTask?.creditRefundedAt ?? null),
        },
      });

      const credit = await tx.sellerAiCredit.findUnique({
        where: { shopId: task.shopId },
      });

      await tx.aiUsageLog.create({
        data: {
          shopId: task.shopId,
          taskId: task.id,
          userId: task.requestedBy,
          provider: AI_DEFAULT_PROVIDER,
          action: shouldRefund ? 'TASK_FAILED_REFUNDED' : 'TASK_FAILED',
          creditCost: currentTask?.creditCost ?? task.creditCost,
          status: AI_TASK_STATUSES.FAILED,
          errorMessage: message,
          creditDelta: shouldRefund
            ? (currentTask?.creditCost ?? task.creditCost)
            : 0,
          balanceAfter: credit?.remainingCredits ?? credit?.balance ?? 0,
          metadata: {
            refunded: shouldRefund,
          },
        },
      });
    });
  }
}
