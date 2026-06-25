import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { rewriteUrlForAiService } from '../ai-images/ai-service-url.util';
import { FilesService } from '../files/files.service';
import {
  AI_TRY_ON_JOB_GENERATE,
  AI_TRY_ON_QUEUE,
  AI_TRY_ON_STATUSES,
} from './ai-try-on.constants';
import {
  AiTryOnAiServiceClientService,
  AiTryOnAiServiceError,
} from './ai-try-on-ai-service-client.service';
// Loaded dynamically from database

@Injectable()
export class AiTryOnWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiTryOnWorkerService.name);
  private worker?: Worker<{ taskId: string }>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiServiceClient: AiTryOnAiServiceClientService,
    private readonly filesService: FilesService,
  ) {}

  onModuleInit() {
    const isDisabled =
      this.configService.get<string>('BULLMQ_DISABLED', 'true') === 'true';
    if (isDisabled) {
      return;
    }

    // How many try-on jobs this worker processes in parallel. Each job is
    // mostly I/O-bound (waiting on the AI service), so a single worker can
    // safely fan out. Tune via env, or run multiple replicas to scale out.
    // Env values arrive as strings, so coerce to a finite positive number —
    // BullMQ throws if concurrency is not a number.
    const concurrencyRaw = this.configService.get<string | number>(
      'AI_TRY_ON_WORKER_CONCURRENCY',
      10,
    );
    const parsedConcurrency = Number(concurrencyRaw);
    const concurrency =
      Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
        ? Math.floor(parsedConcurrency)
        : 10;

    this.worker = new Worker<{ taskId: string }>(
      AI_TRY_ON_QUEUE,
      async (job: Job<{ taskId: string }>) => {
        if (job.name === AI_TRY_ON_JOB_GENERATE) {
          await this.processTask(String(job.data.taskId));
        }
      },
      {
        concurrency,
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

      const model = task.selectedModelId
        ? await this.prisma.aiTryOnModel.findFirst({
            where: { id: task.selectedModelId, isActive: true },
          })
        : null;

      if (task.selectedModelId && !model) {
        throw new Error(
          'DEMO_MODEL_NOT_FOUND: The selected demo model is not available.',
        );
      }

      const backendInternalBaseUrl = this.configService.get<string>(
        'BACKEND_INTERNAL_BASE_URL',
      );
      const backendPublicBaseUrl =
        this.configService.get<string>('BACKEND_PUBLIC_BASE_URL') ??
        this.configService.get<string>('FILES_PUBLIC_BASE_URL') ??
        null;
      const frontendPublicBaseUrl =
        this.configService.get<string>('FRONTEND_URL') ??
        this.configService.get<string>('PUBLIC_SITE_URL') ??
        null;
      const frontendInternalBaseUrl =
        this.configService.get<string>('FRONTEND_INTERNAL_BASE_URL') ??
        'http://frontend-next:3000';

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
          selectedModelImageUrl: this.resolveSelectedModelImageUrl(
            model?.imageUrl ?? null,
            frontendInternalBaseUrl,
            frontendPublicBaseUrl,
            backendInternalBaseUrl,
            backendPublicBaseUrl,
          ),
          selectedModelId: model?.id ?? task.selectedModelId,
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

      const image = response.images?.[0];
      if (!image) {
        throw new Error(
          'OPENAI_RESULT_IMAGE_MISSING: The try-on task generated no result image payload.',
        );
      }
      const resultPayload = await this.readResultImagePayload(image);
      const storedResult = await this.uploadResultImage({
        taskId: task.id,
        providerMode: task.providerMode,
        bytes: resultPayload.bytes,
        mimeType: resultPayload.mimeType,
        sequence: 1,
      });

      await this.prisma.aiTryOnTask.update({
        where: { id: task.id },
        data: {
          status: AI_TRY_ON_STATUSES.COMPLETED,
          resultImageUrl: storedResult.publicUrl,
          resultImageStorageKey: storedResult.storageKey,
          resultMimeType: storedResult.mimeType,
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
    frontendInternalBaseUrl: string,
    frontendPublicBaseUrl: string | null,
    backendInternalBaseUrl?: string | null,
    backendPublicBaseUrl?: string | null,
  ) {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('/')) {
      const resolved = new URL(trimmed, frontendInternalBaseUrl).toString();
      this.logger.log(
        `Resolved model image URL: ${resolved} (input: ${trimmed}, frontendInternalBaseUrl: ${frontendInternalBaseUrl})`,
      );
      return resolved;
    }

    return rewriteUrlForAiService(trimmed, {
      backendInternalBaseUrl,
      backendPublicBaseUrl,
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

  private resolveResultImageExtension(mimeType: string) {
    switch (mimeType.toLowerCase()) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/svg+xml':
        return 'svg';
      default:
        return 'bin';
    }
  }

  private async uploadResultImage(input: {
    taskId: string;
    providerMode: string;
    bytes: Buffer;
    mimeType: string | null;
    sequence: number;
  }) {
    const mimeType = input.mimeType ?? 'application/octet-stream';
    const storageKey = [
      input.providerMode,
      input.taskId,
      `${input.sequence}.${this.resolveResultImageExtension(mimeType)}`,
    ].join('/');

    this.logger.log(
      `Uploading result image bucket=ai-try-on key=${storageKey} bytes=${input.bytes.byteLength} mime=${mimeType}`,
    );

    try {
      const stored = await this.filesService.storeAiTryOnResult(
        {
          originalname: `result-${input.sequence}`,
          mimetype: mimeType,
          size: input.bytes.byteLength,
          buffer: input.bytes,
        },
        {
          providerMode: input.providerMode,
          taskId: input.taskId,
          sequence: input.sequence,
        },
      );

      this.logger.log(`Uploaded result image publicUrl=${stored.publicUrl}`);
      return stored;
    } catch (error) {
      this.logger.error(
        `Failed result image upload for task ${input.taskId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new Error(
        'RESULT_IMAGE_UPLOAD_FAILED: The generated try-on image could not be stored.',
      );
    }
  }

  private async readResultImagePayload(image: {
    imageBase64?: string | null;
    url?: string | null;
    mimeType?: string | null;
  }) {
    if (image.imageBase64) {
      try {
        if (!this.isBase64Payload(image.imageBase64)) {
          throw new Error('invalid base64');
        }
        const bytes = Buffer.from(image.imageBase64, 'base64');
        if (bytes.byteLength < 1) {
          throw new Error('empty image payload');
        }
        this.logger.log(
          `Received result image bytes length=${bytes.byteLength} mime=${image.mimeType ?? 'unknown'} source=base64`,
        );
        return {
          bytes,
          mimeType: image.mimeType ?? 'application/octet-stream',
        };
      } catch {
        throw new Error(
          'OPENAI_RESULT_IMAGE_MISSING: The try-on task returned an invalid image payload.',
        );
      }
    }

    if (image.url) {
      const response = await fetch(image.url);
      if (!response.ok) {
        throw new Error(
          'RESULT_IMAGE_UPLOAD_FAILED: The generated try-on image could not be downloaded for storage.',
        );
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength < 1) {
        throw new Error(
          'OPENAI_RESULT_IMAGE_MISSING: The try-on task returned an empty image payload.',
        );
      }

      this.logger.log(
        `Received result image bytes length=${bytes.byteLength} mime=${image.mimeType ?? response.headers.get('content-type') ?? 'unknown'} source=url publicUrl=${image.url}`,
      );
      return {
        bytes,
        mimeType:
          image.mimeType ??
          response.headers.get('content-type')?.split(';', 1)[0]?.trim() ??
          'application/octet-stream',
      };
    }

    throw new Error(
      'OPENAI_RESULT_IMAGE_MISSING: The try-on task generated no result image payload.',
    );
  }

  private isBase64Payload(value: string) {
    if (!value || value.length % 4 !== 0) {
      return false;
    }

    return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }
}
