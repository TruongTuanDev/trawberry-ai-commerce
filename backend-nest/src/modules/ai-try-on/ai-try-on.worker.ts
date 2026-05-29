import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  resolveFrontendAssetUrlForAiService,
  rewriteUrlForAiService,
} from '../ai-images/ai-service-url.util';
import {
  AI_TRY_ON_JOB_GENERATE,
  AI_TRY_ON_QUEUE,
  AI_TRY_ON_STATUSES,
} from './ai-try-on.constants';
import {
  AiTryOnAiServiceClientService,
  AiTryOnAiServiceError,
} from './ai-try-on-ai-service-client.service';
import { findBuiltInTryOnModel } from './ai-try-on-models';

@Injectable()
export class AiTryOnWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiTryOnWorkerService.name);
  private worker?: Worker<{ taskId: string }>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiServiceClient: AiTryOnAiServiceClientService,
  ) {}

  onModuleInit() {
    const isDisabled =
      this.configService.get<string>('BULLMQ_DISABLED', 'true') === 'true';
    if (isDisabled) {
      return;
    }

    this.worker = new Worker<{ taskId: string }>(
      AI_TRY_ON_QUEUE,
      async (job: Job<{ taskId: string }>) => {
        if (job.name === AI_TRY_ON_JOB_GENERATE) {
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

  triggerMockProcessing(taskId: string) {
    setTimeout(() => {
      void this.processTask(taskId);
    }, 0);
  }

  async processTask(taskId: string) {
    const task = await this.prisma.aiTryOnTask.findUnique({
      where: { id: taskId },
      include: {
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
      this.logger.warn(`AI try-on task ${taskId} not found.`);
      return;
    }

    try {
      await this.prisma.aiTryOnTask.update({
        where: { id: task.id },
        data: {
          status: AI_TRY_ON_STATUSES.PROCESSING,
          errorCode: null,
          errorMessage: null,
        },
      });

      const productImageUrl =
        task.product.images[0]?.localUrl ??
        task.product.images[0]?.wbUrl ??
        null;
      if (!productImageUrl) {
        throw new Error(
          'AI_TRY_ON_PRODUCT_IMAGE_REQUIRED: Product image is required.',
        );
      }

      const model = findBuiltInTryOnModel(task.selectedModelId);
      const backendInternalBaseUrl = this.configService.get<string>(
        'BACKEND_INTERNAL_BASE_URL',
      );
      const backendPublicBaseUrl =
        this.configService.get<string>('BACKEND_PUBLIC_BASE_URL') ??
        this.configService.get<string>('FILES_PUBLIC_BASE_URL') ??
        null;
      const frontendInternalBaseUrl =
        this.configService.get<string>('FRONTEND_INTERNAL_BASE_URL') ?? null;
      const frontendPublicBaseUrl =
        this.configService.get<string>('FRONTEND_URL') ??
        this.configService.get<string>('PUBLIC_SITE_URL') ??
        null;
      const selectedModelImageUrl = this.resolveSelectedModelImageUrl(
        model?.imageUrl ?? null,
        frontendInternalBaseUrl,
        frontendPublicBaseUrl,
      );

      if (task.selectedModelId && !selectedModelImageUrl) {
        throw new Error(
          'AI_TRY_ON_MODEL_IMAGE_UNAVAILABLE: The demo model image could not be loaded.',
        );
      }

      const response = await this.aiServiceClient.generateTryOn({
        taskId: task.id,
        providerMode: task.providerMode,
        product: {
          id: task.productId,
          name: task.product.localTitle ?? task.product.wbTitle,
          imageUrl: rewriteUrlForAiService(productImageUrl, {
            backendInternalBaseUrl,
            backendPublicBaseUrl,
          })!,
          category:
            task.product.categoryName ?? task.product.sourceCategoryName,
          selectedSize: task.selectedSize,
          selectedRussianSize: task.selectedRussianSize,
        },
        person: {
          customerImageUrl: rewriteUrlForAiService(task.customerImageUrl, {
            backendInternalBaseUrl,
            backendPublicBaseUrl,
          }),
          selectedModelImageUrl,
          selectedModelId: model?.modelId ?? task.selectedModelId,
          heightCm: task.heightCm,
          weightKg: task.weightKg,
          gender: task.gender,
          bodyType: task.bodyType,
          bodyTraits: this.readTraits(task.bodyTraits),
        },
        prompt: this.buildPrompt(
          task.product.localTitle ?? task.product.wbTitle,
          task,
        ),
        locale: 'ru',
      });

      const image = response.images[0];
      await this.prisma.aiTryOnTask.update({
        where: { id: task.id },
        data: {
          status: AI_TRY_ON_STATUSES.COMPLETED,
          resultImageUrl: image.url,
          resultImageStorageKey: image.storageKey ?? null,
          resultMimeType: image.mimeType ?? null,
          resultWidth: image.width ?? null,
          resultHeight: image.height ?? null,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });

      await this.prisma.aiTryOnUsageLog.create({
        data: {
          taskId: task.id,
          customerId: task.customerId,
          guestSessionId: task.guestSessionId,
          shopId: task.shopId,
          productId: task.productId,
          providerMode: task.providerMode,
          status: AI_TRY_ON_STATUSES.COMPLETED,
        },
      });
    } catch (error) {
      const parsed = this.parseError(error);
      await this.prisma.aiTryOnTask.update({
        where: { id: task.id },
        data: {
          status: AI_TRY_ON_STATUSES.FAILED,
          errorCode: parsed.code,
          errorMessage: parsed.message,
        },
      });

      await this.prisma.aiTryOnUsageLog.create({
        data: {
          taskId: task.id,
          customerId: task.customerId,
          guestSessionId: task.guestSessionId,
          shopId: task.shopId,
          productId: task.productId,
          providerMode: task.providerMode,
          status: AI_TRY_ON_STATUSES.FAILED,
        },
      });
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private buildPrompt(
    productName: string,
    task: {
      selectedSize: string | null;
      selectedRussianSize: string | null;
      bodyType: string | null;
      gender: string | null;
    },
  ) {
    return [
      `Create a stable virtual try-on preview for ${productName}.`,
      task.selectedSize ? `Selected size: ${task.selectedSize}.` : null,
      task.selectedRussianSize
        ? `Russian size: ${task.selectedRussianSize}.`
        : null,
      task.gender ? `Gender profile: ${task.gender}.` : null,
      task.bodyType ? `Body type: ${task.bodyType}.` : null,
      'Keep the garment fit realistic and demo-safe.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private resolveSelectedModelImageUrl(
    value: string | null | undefined,
    frontendInternalBaseUrl: string | null,
    frontendPublicBaseUrl: string | null,
  ) {
    return resolveFrontendAssetUrlForAiService(value, {
      frontendInternalBaseUrl,
      frontendPublicBaseUrl,
    });
  }

  private readTraits(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private parseError(error: unknown) {
    if (error instanceof AiTryOnAiServiceError) {
      return {
        code: error.safeErrorCode ?? 'AI_PROVIDER_ERROR',
        message: error.message,
      };
    }

    const rawMessage =
      error instanceof Error ? error.message : 'AI try-on generation failed.';
    const match = rawMessage.match(/^([A-Z0-9_]+):\s*(.+)$/);
    if (match) {
      return { code: match[1], message: match[2] };
    }

    return {
      code: 'AI_TRY_ON_GENERATION_FAILED',
      message: rawMessage,
    };
  }
}
