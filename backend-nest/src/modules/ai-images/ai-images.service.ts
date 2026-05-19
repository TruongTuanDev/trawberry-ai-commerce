import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';
import { ProductImageResponseDto } from '../product-images/dto/product-image-response.dto';
import {
  AI_DEFAULT_DEV_CREDITS,
  AI_DEFAULT_PROVIDER,
  AI_IMAGE_JOB_GENERATE,
  AI_IMAGE_QUEUE,
  AI_TASK_STATUSES,
  AI_TASK_TYPES,
} from './ai-images.constants';
import { AiImagesWorkerService } from './ai-images.worker';
import { AiCreditResponseDto } from './dto/ai-credit-response.dto';
import { CreateAiImageTaskDto } from './dto/create-ai-image-task.dto';
import { ListAiImageTasksQueryDto } from './dto/list-ai-image-tasks-query.dto';

@Injectable()
export class AiImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly workerService: AiImagesWorkerService,
    private readonly configService: ConfigService,
  ) {}

  async getRuntimeStatus(shopId: string) {
    const workerMode = this.configService.get<'internal-mock' | 'ai-service'>(
      'AI_WORKER_MODE',
      'internal-mock',
    );
    const aiServiceConfigured = workerMode === 'ai-service';
    const aiServiceHealth = await this.getAiServiceHealth(workerMode);

    return {
      shopId,
      workerMode,
      effectiveMode:
        workerMode === 'internal-mock'
          ? 'INTERNAL_MOCK'
          : !aiServiceHealth.reachable
            ? 'AI_SERVICE_UNAVAILABLE'
            : aiServiceHealth.provider === 'openai'
              ? 'OPENAI_REAL'
              : 'AI_SERVICE_MOCK',
      supportsTaskGeneration: true,
      supportsTaskAttach: true,
      supportsCredits: true,
      supportsTaskRetry: true,
      supportsVirtualTryOn: false,
      tryOnReady: false,
      aiServiceConfigured,
      aiServiceReachable: aiServiceHealth.reachable,
      aiServiceProvider: aiServiceHealth.provider,
      aiServiceStorageDriver: aiServiceHealth.storageDriver,
      openAiConfigured: aiServiceHealth.openAiConfigured,
      statusMessage:
        workerMode === 'internal-mock'
          ? 'NestJS is generating AI tasks with the internal mock worker path.'
          : !aiServiceHealth.reachable
            ? 'NestJS is configured for ai-service mode, but the ai-service health endpoint is unreachable.'
            : aiServiceHealth.provider === 'openai'
              ? 'NestJS is using ai-service with the OpenAI provider.'
              : 'NestJS is using ai-service with the mock provider.',
    };
  }

  async createTask(
    shopId: string,
    productId: string,
    dto: CreateAiImageTaskDto,
    requestedBy: string,
  ) {
    const product = await this.assertProductBelongsToShop(shopId, productId);
    const taskType = dto.taskType ?? AI_TASK_TYPES.PRODUCT_MODEL_IMAGE;
    const quantity = dto.quantity ?? 1;
    const inputFrontImageId =
      dto.inputFrontImageId ?? dto.sourceImageId ?? null;
    const inputBackImageId = dto.inputBackImageId ?? null;
    const inputModelImageId = dto.inputModelImageId ?? null;

    await this.assertInputImageBelongsToProduct(
      productId,
      inputFrontImageId,
      'front image',
    );
    await this.assertInputImageBelongsToProduct(
      productId,
      inputBackImageId,
      'back image',
    );
    await this.assertInputImageBelongsToProduct(
      productId,
      inputModelImageId,
      'model image',
    );

    const credits = await this.getOrCreateCredits(shopId);
    if (credits.remainingCredits < quantity) {
      throw new BadRequestException('Insufficient AI credits.');
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const updatedCredits = await tx.sellerAiCredit.update({
        where: { shopId },
        data: {
          balance: {
            decrement: quantity,
          },
          usedCredits: {
            increment: quantity,
          },
          remainingCredits: {
            decrement: quantity,
          },
        },
      });

      const createdTask = await tx.aiGenerationTask.create({
        data: {
          id: randomUUID(),
          shopId,
          productId,
          requestedBy,
          status: AI_TASK_STATUSES.PENDING,
          mode: dto.mode ?? 'generate',
          taskType,
          quantity,
          prompt: dto.prompt,
          negativePrompt: null,
          stylePreset: dto.stylePreset ?? null,
          sourceImageId: inputFrontImageId,
          inputFrontImageId,
          inputBackImageId,
          inputModelImageId,
          creditCost: quantity,
        },
        include: {
          generatedImages: true,
        },
      });

      await tx.aiUsageLog.create({
        data: {
          shopId,
          taskId: createdTask.id,
          userId: requestedBy,
          provider: AI_DEFAULT_PROVIDER,
          action: 'TASK_CREATED',
          creditCost: quantity,
          status: AI_TASK_STATUSES.PENDING,
          errorMessage: null,
          creditDelta: -quantity,
          balanceAfter: updatedCredits.remainingCredits,
          metadata: {
            productId,
            productTitle: product.localTitle ?? product.wbTitle,
            taskType,
          },
        },
      });

      return createdTask;
    });

    const queueResult = await this.queueService.enqueue(
      AI_IMAGE_QUEUE,
      AI_IMAGE_JOB_GENERATE,
      {
        taskId: task.id,
        shopId,
        productId,
        quantity,
        taskType,
      },
    );

    const updatedTask = await this.prisma.aiGenerationTask.update({
      where: { id: task.id },
      data: {
        queueJobId: queueResult.jobId,
      },
      include: {
        generatedImages: true,
      },
    });

    if (!queueResult.queued) {
      this.workerService.triggerMockProcessing(task.id);
    }

    return this.toTaskResponse(updatedTask);
  }

  async listTasks(shopId: string, query: ListAiImageTasksQueryDto) {
    const tasks = await this.prisma.aiGenerationTask.findMany({
      where: {
        shopId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  prompt: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  stylePreset: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        generatedImages: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return tasks.map((task) => this.toTaskResponse(task));
  }

  async getTask(shopId: string, taskId: string) {
    const task = await this.prisma.aiGenerationTask.findFirst({
      where: {
        id: taskId,
        shopId,
      },
      include: {
        generatedImages: true,
      },
    });

    if (!task) {
      throw new NotFoundException(
        `AI task ${taskId} was not found in shop ${shopId}.`,
      );
    }

    return this.toTaskResponse(task);
  }

  async retryTask(shopId: string, taskId: string) {
    const task = await this.prisma.aiGenerationTask.findFirst({
      where: {
        id: taskId,
        shopId,
      },
      include: {
        generatedImages: true,
      },
    });

    if (!task) {
      throw new NotFoundException(
        `AI task ${taskId} was not found in shop ${shopId}.`,
      );
    }

    if (task.status !== AI_TASK_STATUSES.FAILED) {
      throw new BadRequestException('Only FAILED tasks can be retried.');
    }

    const credits = await this.getOrCreateCredits(shopId);
    if (credits.remainingCredits < task.quantity) {
      throw new BadRequestException('Insufficient AI credits.');
    }

    const resetTask = await this.prisma.$transaction(async (tx) => {
      const updatedCredits = await tx.sellerAiCredit.update({
        where: { shopId },
        data: {
          balance: {
            decrement: task.quantity,
          },
          usedCredits: {
            increment: task.quantity,
          },
          remainingCredits: {
            decrement: task.quantity,
          },
        },
      });

      await tx.aiUsageLog.create({
        data: {
          shopId,
          taskId: task.id,
          userId: task.requestedBy,
          provider: AI_DEFAULT_PROVIDER,
          action: 'TASK_RETRY_QUEUED',
          creditCost: task.quantity,
          status: AI_TASK_STATUSES.PENDING,
          errorMessage: null,
          creditDelta: -task.quantity,
          balanceAfter: updatedCredits.remainingCredits,
          metadata: {
            retry: true,
          },
        },
      });

      return tx.aiGenerationTask.update({
        where: { id: task.id },
        data: {
          status: AI_TASK_STATUSES.PENDING,
          errorMessage: null,
          completedAt: null,
          providerTaskId: null,
          creditRefundedAt: null,
        },
        include: {
          generatedImages: true,
        },
      });
    });

    const queueResult = await this.queueService.enqueue(
      AI_IMAGE_QUEUE,
      AI_IMAGE_JOB_GENERATE,
      {
        taskId: task.id,
        shopId: task.shopId,
        productId: task.productId,
        quantity: task.quantity,
        taskType: task.taskType,
        retry: true,
      },
    );

    const updatedTask = await this.prisma.aiGenerationTask.update({
      where: { id: task.id },
      data: {
        queueJobId: queueResult.jobId,
      },
      include: {
        generatedImages: true,
      },
    });

    if (!queueResult.queued) {
      this.workerService.triggerMockProcessing(task.id);
    }

    return this.toTaskResponse(updatedTask ?? resetTask);
  }

  async attachGeneratedImage(
    shopId: string,
    productId: string,
    generatedImageId: string,
  ): Promise<ProductImageResponseDto> {
    await this.assertProductBelongsToShop(shopId, productId);

    const generatedImage = await this.prisma.aiGeneratedImage.findFirst({
      where: {
        id: generatedImageId,
        shopId,
        productId,
      },
    });

    if (!generatedImage) {
      throw new NotFoundException(
        `Generated image ${generatedImageId} was not found for product ${productId}.`,
      );
    }

    if (generatedImage.attachedImageId) {
      const existing = await this.prisma.productImage.findFirst({
        where: {
          id: generatedImage.attachedImageId,
          productId,
        },
      });

      if (existing) {
        return this.toProductImageResponse(shopId, existing);
      }
    }

    const sortOrder = await this.prisma.productImage.count({
      where: {
        productId,
      },
    });

    const attached = await this.prisma.$transaction(async (tx) => {
      const createdImage = await tx.productImage.create({
        data: {
          id: randomUUID(),
          productId,
          wbUrl: generatedImage.imageUrl,
          localUrl: generatedImage.imageUrl,
          storageKey: generatedImage.storageKey,
          originalName: null,
          mimeType: generatedImage.mimeType,
          size: null,
          imageType: 'AI_GENERATED',
          isMain: sortOrder === 0,
          sortOrder,
        },
      });

      await tx.aiGeneratedImage.update({
        where: {
          id: generatedImage.id,
        },
        data: {
          attachedImageId: createdImage.id,
          isSelected: true,
        },
      });

      const credit = await tx.sellerAiCredit.findUnique({
        where: {
          shopId,
        },
      });

      await tx.aiUsageLog.create({
        data: {
          shopId,
          taskId: generatedImage.taskId,
          provider: generatedImage.provider ?? AI_DEFAULT_PROVIDER,
          action: 'IMAGE_ATTACHED',
          creditCost: 0,
          status: AI_TASK_STATUSES.COMPLETED,
          errorMessage: null,
          creditDelta: 0,
          balanceAfter: credit?.remainingCredits ?? credit?.balance ?? 0,
          metadata: {
            generatedImageId,
            attachedImageId: createdImage.id,
          },
        },
      });

      return createdImage;
    });

    return this.toProductImageResponse(shopId, attached);
  }

  async getCredits(shopId: string): Promise<AiCreditResponseDto> {
    const credits = await this.getOrCreateCredits(shopId);
    return this.toCreditResponse(credits);
  }

  private async getOrCreateCredits(shopId: string) {
    const existing = await this.prisma.sellerAiCredit.findUnique({
      where: { shopId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.sellerAiCredit.create({
      data: {
        id: randomUUID(),
        shopId,
        balance: AI_DEFAULT_DEV_CREDITS,
        reserved: 0,
        totalCredits: AI_DEFAULT_DEV_CREDITS,
        usedCredits: 0,
        remainingCredits: AI_DEFAULT_DEV_CREDITS,
        lastGrantedAt: new Date(),
      },
    });
  }

  private async assertProductBelongsToShop(shopId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      select: {
        id: true,
        localTitle: true,
        wbTitle: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} was not found in shop ${shopId}.`,
      );
    }

    return product;
  }

  private async assertInputImageBelongsToProduct(
    productId: string,
    imageId: string | null,
    label: string,
  ) {
    if (!imageId) {
      return;
    }

    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
      select: {
        id: true,
      },
    });

    if (!image) {
      throw new BadRequestException(
        `The ${label} does not belong to product ${productId}.`,
      );
    }
  }

  private toTaskResponse(task: {
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
    generatedImages: Array<{
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
      createdAt: Date;
    }>;
  }) {
    return {
      id: task.id,
      shopId: task.shopId,
      productId: task.productId,
      requestedBy: task.requestedBy,
      userId: task.requestedBy,
      status: task.status,
      taskType: task.taskType,
      mode: task.mode,
      quantity: task.quantity,
      prompt: task.prompt,
      stylePreset: task.stylePreset,
      sourceImageId: task.sourceImageId,
      inputFrontImageId: task.inputFrontImageId,
      inputBackImageId: task.inputBackImageId,
      inputModelImageId: task.inputModelImageId,
      creditCost: task.creditCost,
      creditRefundedAt: task.creditRefundedAt?.toISOString() ?? null,
      attemptCount: task.attemptCount,
      queueJobId: task.queueJobId,
      providerTaskId: task.providerTaskId,
      errorMessage: task.errorMessage,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      generatedImages: task.generatedImages.map((image) => ({
        id: image.id,
        taskId: image.taskId,
        shopId: image.shopId,
        productId: image.productId,
        url: image.imageUrl,
        imageUrl: image.imageUrl,
        storageKey: image.storageKey,
        provider:
          image.provider ?? image.storageProvider ?? AI_DEFAULT_PROVIDER,
        thumbnailUrl: image.thumbnailUrl,
        storageProvider: image.storageProvider,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        isSelected: image.isSelected,
        attachedImageId: image.attachedImageId,
        createdAt: image.createdAt.toISOString(),
      })),
    };
  }

  private toProductImageResponse(
    shopId: string,
    image: {
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
    },
  ): ProductImageResponseDto {
    return {
      id: image.id,
      shopId,
      productId: image.productId,
      url: image.localUrl ?? image.wbUrl,
      wbUrl: image.wbUrl,
      localUrl: image.localUrl,
      storageKey: image.storageKey,
      originalName: image.originalName,
      mimeType: image.mimeType,
      size: image.size,
      imageType: image.imageType,
      isMain: image.isMain ?? false,
      sortOrder: image.sortOrder,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    };
  }

  private toCreditResponse(credits: {
    id: string;
    shopId: string;
    totalCredits: number;
    usedCredits: number;
    remainingCredits: number;
    createdAt: Date;
    updatedAt: Date;
  }): AiCreditResponseDto {
    return {
      id: credits.id,
      shopId: credits.shopId,
      totalCredits: credits.totalCredits,
      usedCredits: credits.usedCredits,
      remainingCredits: credits.remainingCredits,
      createdAt: credits.createdAt.toISOString(),
      updatedAt: credits.updatedAt.toISOString(),
    };
  }

  private async getAiServiceHealth(
    workerMode: 'internal-mock' | 'ai-service',
  ): Promise<{
    reachable: boolean;
    provider: 'mock' | 'openai' | null;
    storageDriver: 'mock' | 'local' | 's3' | null;
    openAiConfigured: boolean;
  }> {
    if (workerMode !== 'ai-service') {
      return {
        reachable: false,
        provider: null,
        storageDriver: null,
        openAiConfigured: false,
      };
    }

    const baseUrl = this.configService.get<string>(
      'AI_SERVICE_BASE_URL',
      'http://localhost:8000',
    );

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return {
          reachable: false,
          provider: null,
          storageDriver: null,
          openAiConfigured: false,
        };
      }

      const body = (await response.json()) as {
        aiImageProvider?: 'mock' | 'openai';
        storageDriver?: 'mock' | 'local' | 's3';
        openaiConfigured?: boolean;
      };

      return {
        reachable: true,
        provider: body.aiImageProvider ?? null,
        storageDriver: body.storageDriver ?? null,
        openAiConfigured: body.openaiConfigured ?? false,
      };
    } catch {
      return {
        reachable: false,
        provider: null,
        storageDriver: null,
        openAiConfigured: false,
      };
    }
  }
}
