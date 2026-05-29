import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QueueService } from '../../common/queue/queue.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { FilesService } from '../files/files.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductReadinessService } from '../products/product-readiness.service';
import {
  AI_TRY_ON_GUEST_HEADER,
  AI_TRY_ON_JOB_GENERATE,
  AI_TRY_ON_PROVIDER_MODES,
  AI_TRY_ON_QUEUE,
  AI_TRY_ON_SETTINGS_ID,
  AI_TRY_ON_STATUSES,
} from './ai-try-on.constants';
import {
  findBuiltInTryOnModel,
  BUILT_IN_TRY_ON_MODELS,
} from './ai-try-on-models';
import {
  matchesSupportedCategoryValue,
  normalizeStoredSupportedCategoryValues,
  readSupportedCategoryValues,
  resolveCanonicalCategory,
} from './ai-try-on-supported-categories';
import { AiTryOnWorkerService } from './ai-try-on.worker';
import { UpdateAiTryOnSettingsDto } from './dto/ai-try-on-settings.dto';
import { CreateAiTryOnTaskDto } from './dto/create-ai-try-on-task.dto';
import { SizeRecommendationService } from './size-recommendation.service';

type PublicTryOnProduct = Prisma.ProductGetPayload<{
  include: {
    images: true;
    variants: true;
    category: true;
    shop: {
      select: {
        id: true;
        status: true;
        sellerProfile: {
          select: {
            approvalStatus: true;
          };
        };
      };
    };
  };
}>;

type ProductAvailabilitySyncSummary = {
  enabledProducts: number;
  disabledProducts: number;
  mode: 'RESTRICTED' | 'ALLOW_ALL_ELIGIBLE';
};

@Injectable()
export class AiTryOnService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly workerService: AiTryOnWorkerService,
    private readonly filesService: FilesService,
    private readonly categoriesService: CategoriesService,
    private readonly productReadiness: ProductReadinessService,
    private readonly sizeRecommendation: SizeRecommendationService,
  ) {}

  async getAdminSettings() {
    const settings = await this.getOrCreateSettings();
    const runtime =
      settings.aiTryOnProvider === 'openai'
        ? await this.getAiServiceHealth()
        : undefined;
    return this.mapSettings(settings, runtime);
  }

  async updateAdminSettings(dto: UpdateAiTryOnSettingsDto) {
    const normalizedSupportedCategories =
      await this.normalizeSupportedCategories(dto.supportedCategories);
    const result = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.aiFeatureSetting.upsert({
        where: { id: AI_TRY_ON_SETTINGS_ID },
        update: {
          aiTryOnEnabled: dto.enabled,
          aiTryOnProvider: dto.providerMode,
          guestDailyLimit: dto.guestDailyLimit,
          customerDailyLimit: dto.customerDailyLimit,
          requireConsent: dto.requireConsent,
          supportedCategories: normalizedSupportedCategories,
        },
        create: {
          id: AI_TRY_ON_SETTINGS_ID,
          aiTryOnEnabled: dto.enabled,
          aiTryOnProvider: dto.providerMode,
          guestDailyLimit: dto.guestDailyLimit,
          customerDailyLimit: dto.customerDailyLimit,
          requireConsent: dto.requireConsent,
          supportedCategories: normalizedSupportedCategories,
        },
      });
      const productAvailabilitySync =
        await this.syncProductAiTryOnEnabledFromSupportedCategories(
          tx,
          normalizedSupportedCategories,
        );

      return {
        settings,
        productAvailabilitySync,
      };
    });

    const runtime =
      result.settings.aiTryOnProvider === 'openai'
        ? await this.getAiServiceHealth()
        : undefined;
    return this.mapSettings(
      result.settings,
      runtime,
      result.productAvailabilitySync,
    );
  }

  async getPublicConfig() {
    const settings = await this.getOrCreateSettings();
    return {
      enabled: settings.aiTryOnEnabled,
      providerMode: settings.aiTryOnProvider,
      guestDailyLimit: settings.guestDailyLimit,
      customerDailyLimit: settings.customerDailyLimit,
      requireConsent: settings.requireConsent,
      supportedCategories: this.readSupportedCategories(
        settings.supportedCategories,
      ),
      builtInModels: BUILT_IN_TRY_ON_MODELS,
    };
  }

  async uploadReferenceImage(
    file: Express.Multer.File,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const guestSessionId = user ? null : this.resolveGuestSessionId(request);
    const stored = await this.filesService.storeAiTryOnReference(file, {
      scope: user ? 'customer' : 'guest',
      identifier: user?.userId ?? guestSessionId ?? 'guest-unknown',
    });

    return {
      url: stored.publicUrl,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      size: stored.size,
    };
  }

  async createTask(
    productId: string,
    dto: CreateAiTryOnTaskDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const settings = await this.getOrCreateSettings();
    if (!settings.aiTryOnEnabled) {
      throw this.buildCodeError(
        'AI_TRY_ON_DISABLED',
        'AI try-on is currently under development.',
      );
    }

    if (!dto.selectedSize?.trim()) {
      throw this.buildCodeError(
        'AI_TRY_ON_SIZE_REQUIRED',
        'Please select a size first.',
      );
    }

    if (settings.requireConsent && !dto.consentAccepted) {
      throw this.buildCodeError(
        'AI_TRY_ON_CONSENT_REQUIRED',
        'Consent is required before generating AI try-on results.',
      );
    }

    if (!dto.customerImageUrl && !dto.selectedModelId) {
      throw this.buildCodeError(
        'AI_TRY_ON_REFERENCE_REQUIRED',
        'Upload a customer photo or choose a built-in model first.',
      );
    }

    if (dto.customerImageUrl && dto.selectedModelId) {
      throw this.buildCodeError(
        'AI_TRY_ON_REFERENCE_CONFLICT',
        'Use either an uploaded photo or a built-in model, not both at the same time.',
      );
    }

    if (dto.selectedModelId && !findBuiltInTryOnModel(dto.selectedModelId)) {
      throw this.buildCodeError(
        'AI_TRY_ON_REFERENCE_REQUIRED',
        'The selected built-in model is not available.',
      );
    }

    if (
      (dto.heightCm !== undefined && dto.heightCm > 250) ||
      (dto.weightKg !== undefined && dto.weightKg > 300)
    ) {
      throw this.buildCodeError(
        'AI_TRY_ON_INVALID_BODY_PROFILE',
        'The provided body profile is outside the supported demo range.',
      );
    }

    const product = await this.findPublicProduct(productId);
    if (!product.images.length) {
      throw this.buildCodeError(
        'AI_TRY_ON_PRODUCT_IMAGE_REQUIRED',
        'A product image is required for AI try-on.',
      );
    }

    if (
      !product.aiTryOnEnabled ||
      !(await this.isProductSupported(product, settings.supportedCategories))
    ) {
      throw this.buildCodeError(
        'AI_TRY_ON_PRODUCT_UNSUPPORTED',
        'This product is not currently supported by AI try-on.',
      );
    }

    const actor = this.resolveActor(request, user);
    await this.assertDailyLimit(settings, actor);

    const recommendation = this.sizeRecommendation.recommend({
      categoryName: product.category?.name ?? product.categoryName,
      selectedSize: dto.selectedSize,
      selectedRussianSize: dto.selectedRussianSize,
      bodyType: dto.bodyType,
      bodyTraits: dto.bodyTraits,
    });

    const task = await this.prisma.aiTryOnTask.create({
      data: {
        customerId: actor.customerId,
        guestSessionId: actor.guestSessionId,
        shopId: product.shopId,
        productId: product.id,
        selectedSize: dto.selectedSize.trim(),
        selectedRussianSize: dto.selectedRussianSize?.trim() || null,
        customerImageUrl: dto.customerImageUrl ?? null,
        customerImageStorageKey: dto.customerImageStorageKey ?? null,
        selectedModelId: dto.selectedModelId ?? null,
        heightCm: dto.heightCm ?? null,
        weightKg: dto.weightKg ?? null,
        gender: dto.gender ?? null,
        bodyType: dto.bodyType ?? null,
        bodyTraits: dto.bodyTraits ?? [],
        consentAccepted: Boolean(dto.consentAccepted),
        providerMode: settings.aiTryOnProvider,
        status: AI_TRY_ON_STATUSES.PENDING,
        recommendedSize: recommendation.recommendedSize,
        recommendedRussianSize: recommendation.recommendedRussianSize,
        sizeRecommendationNote: recommendation.note,
        sizeRecommendationNoteRu: recommendation.noteRu,
        sizeRecommendationNoteEn: recommendation.noteEn,
        sizeRecommendationConfidence: recommendation.confidence,
      },
    });

    await this.prisma.aiTryOnUsageLog.create({
      data: {
        taskId: task.id,
        customerId: actor.customerId,
        guestSessionId: actor.guestSessionId,
        shopId: product.shopId,
        productId: product.id,
        providerMode: settings.aiTryOnProvider,
        status: AI_TRY_ON_STATUSES.PENDING,
      },
    });

    const queueResult = await this.queueService.enqueue(
      AI_TRY_ON_QUEUE,
      AI_TRY_ON_JOB_GENERATE,
      { taskId: task.id },
    );

    if (!queueResult.queued) {
      this.workerService.triggerMockProcessing(task.id);
    }

    const createdTask = await this.prisma.aiTryOnTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    return this.mapTask(createdTask);
  }

  async getTask(
    taskId: string,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const task = await this.prisma.aiTryOnTask.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      throw new NotFoundException(`AI try-on task ${taskId} was not found.`);
    }

    const actor = this.resolveActor(request, user);
    if (
      actor.customerId &&
      task.customerId &&
      task.customerId !== actor.customerId
    ) {
      throw new NotFoundException(`AI try-on task ${taskId} was not found.`);
    }
    if (
      !actor.customerId &&
      task.guestSessionId &&
      task.guestSessionId !== actor.guestSessionId
    ) {
      throw new NotFoundException(`AI try-on task ${taskId} was not found.`);
    }

    return this.mapTask(task);
  }

  private async findPublicProduct(
    productId: string,
  ): Promise<PublicTryOnProduct> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        visibility: 'ACTIVE',
        images: { some: {} },
        shop: {
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        variants: {
          some: {
            isActive: true,
            OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
          },
        },
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: true,
        category: true,
        shop: {
          select: {
            id: true,
            status: true,
            sellerProfile: {
              select: {
                approvalStatus: true,
              },
            },
          },
        },
      },
    });

    if (!product || !this.productReadiness.getReadiness(product).ready) {
      throw new NotFoundException(`Public product ${productId} was not found.`);
    }

    return product;
  }

  private async assertDailyLimit(
    settings: Awaited<ReturnType<AiTryOnService['getOrCreateSettings']>>,
    actor: { customerId: string | null; guestSessionId: string | null },
  ) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const count = await this.prisma.aiTryOnTask.count({
      where: actor.customerId
        ? {
            customerId: actor.customerId,
            createdAt: { gte: startOfDay },
          }
        : {
            guestSessionId: actor.guestSessionId,
            createdAt: { gte: startOfDay },
          },
    });

    const limit = actor.customerId
      ? settings.customerDailyLimit
      : settings.guestDailyLimit;

    if (limit > 0 && count >= limit) {
      throw this.buildCodeError(
        'AI_TRY_ON_LIMIT_EXCEEDED',
        'Daily AI try-on limit exceeded.',
      );
    }
  }

  private async isProductSupported(
    product: {
      categoryName: string | null;
      sourceCategoryName: string | null;
      categoryId?: bigint | null;
      category?: { id: bigint; name: string; slug: string | null } | null;
    },
    rawSupportedCategories: Prisma.JsonValue | null,
  ) {
    const supported = this.readSupportedCategories(rawSupportedCategories);
    if (supported.length === 0) {
      return true;
    }

    const fallbackCategory =
      product.category?.id || product.categoryId
        ? null
        : ((await this.categoriesService.findExistingCategoryByName(
            product.categoryName,
          )) ??
          (await this.categoriesService.findExistingCategoryByName(
            product.sourceCategoryName,
          )));

    const resolvedCategoryId =
      product.category?.id?.toString() ??
      product.categoryId?.toString() ??
      fallbackCategory?.id ??
      null;
    const resolvedCategoryName =
      product.category?.name ??
      fallbackCategory?.name ??
      product.categoryName ??
      product.sourceCategoryName;
    const resolvedCategorySlug =
      product.category?.slug ?? fallbackCategory?.slug ?? null;

    const categoryLookup =
      await this.categoriesService.listCategoryLookupRecords();
    const categoryById = new Map(
      categoryLookup.map((category) => [category.id, category]),
    );
    const enrichedSupported = new Set<string>(supported);
    for (const value of supported) {
      const matchedCategory = categoryById.get(value);
      if (!matchedCategory) {
        continue;
      }

      enrichedSupported.add(matchedCategory.name);
      if (matchedCategory.slug) {
        enrichedSupported.add(matchedCategory.slug);
      }
    }

    if (resolvedCategoryId && enrichedSupported.has(resolvedCategoryId)) {
      return true;
    }

    return matchesSupportedCategoryValue([...enrichedSupported], {
      categoryId: resolvedCategoryId,
      categoryName: resolvedCategoryName,
      categorySlug: resolvedCategorySlug,
      fallbackCategoryNames: [product.categoryName, product.sourceCategoryName],
    });
  }

  private async syncProductAiTryOnEnabledFromSupportedCategories(
    tx: Prisma.TransactionClient,
    supportedCategoryValues: string[],
  ): Promise<ProductAvailabilitySyncSummary> {
    const categoryIds = [
      ...new Set(
        supportedCategoryValues
          .map((value) => value.trim())
          .filter((value) => /^\d+$/.test(value))
          .map((value) => BigInt(value)),
      ),
    ];

    if (categoryIds.length === 0) {
      const eligibleWhere = this.buildEligiblePublicTryOnProductWhere();
      const enabled = await tx.product.updateMany({
        where: eligibleWhere,
        data: { aiTryOnEnabled: true },
      });
      const disabled = await tx.product.updateMany({
        where: {
          NOT: eligibleWhere,
        },
        data: { aiTryOnEnabled: false },
      });

      return {
        enabledProducts: enabled.count,
        disabledProducts: disabled.count,
        mode: 'ALLOW_ALL_ELIGIBLE',
      };
    }

    const enabled = await tx.product.updateMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
      },
      data: { aiTryOnEnabled: true },
    });
    const disabled = await tx.product.updateMany({
      where: {
        OR: [
          { categoryId: null },
          {
            categoryId: {
              notIn: categoryIds,
            },
          },
        ],
      },
      data: { aiTryOnEnabled: false },
    });

    return {
      enabledProducts: enabled.count,
      disabledProducts: disabled.count,
      mode: 'RESTRICTED',
    };
  }

  private resolveActor(request: Request, user?: AuthenticatedUser | null) {
    if (user?.userId) {
      return {
        customerId: user.userId,
        guestSessionId: null,
      };
    }

    return {
      customerId: null,
      guestSessionId: this.resolveGuestSessionId(request),
    };
  }

  private resolveGuestSessionId(request: Request) {
    const headerValue = request.header(AI_TRY_ON_GUEST_HEADER);
    if (headerValue?.trim()) {
      return headerValue.trim().slice(0, 255);
    }

    const cookieBag = request.cookies as
      | Record<string, string | undefined>
      | undefined;
    const cookieValue = cookieBag?.guest_session_id ?? null;
    if (cookieValue?.trim()) {
      return cookieValue.trim().slice(0, 255);
    }

    return `guest:${request.ip ?? 'unknown'}`;
  }

  private async getOrCreateSettings() {
    return this.prisma.aiFeatureSetting.upsert({
      where: { id: AI_TRY_ON_SETTINGS_ID },
      update: {},
      create: {
        id: AI_TRY_ON_SETTINGS_ID,
        aiTryOnEnabled: false,
        aiTryOnProvider: AI_TRY_ON_PROVIDER_MODES[0],
        guestDailyLimit: 3,
        customerDailyLimit: 5,
        requireConsent: true,
        supportedCategories: [],
      },
    });
  }

  private async normalizeSupportedCategories(values: string[]) {
    const normalizedValues = normalizeStoredSupportedCategoryValues(values);
    const categoryLookup =
      await this.categoriesService.listCategoryLookupRecords();
    const exactById = new Map(
      categoryLookup.map((category) => [category.id, category.id]),
    );
    const exactByName = new Map(
      categoryLookup.map((category) => [
        this.normalizeCategoryValue(category.name),
        category.id,
      ]),
    );
    const exactBySlug = new Map(
      categoryLookup
        .filter((category) => category.slug)
        .map((category) => [
          this.normalizeCategoryValue(category.slug),
          category.id,
        ]),
    );
    const firstByCanonical = new Map<string, string>();
    for (const category of categoryLookup) {
      const canonical = resolveCanonicalCategory(category.name);
      if (canonical && !firstByCanonical.has(canonical)) {
        firstByCanonical.set(canonical, category.id);
      }
    }

    const normalized = new Set<string>();
    for (const value of normalizedValues) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      if (exactById.has(trimmed)) {
        normalized.add(trimmed);
        continue;
      }

      const normalizedKey = this.normalizeCategoryValue(trimmed);
      const matchedId =
        exactByName.get(normalizedKey) ??
        exactBySlug.get(normalizedKey) ??
        (() => {
          const canonical = resolveCanonicalCategory(trimmed);
          return canonical ? firstByCanonical.get(canonical) : undefined;
        })();

      normalized.add(matchedId ?? trimmed);
    }

    return [...normalized];
  }

  private readSupportedCategories(value: Prisma.JsonValue | null) {
    return readSupportedCategoryValues(value);
  }

  private normalizeCategoryValue(value: string | null | undefined) {
    return (value ?? '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private mapSettings(
    settings: Awaited<ReturnType<AiTryOnService['getOrCreateSettings']>>,
    runtime?: {
      reachable: boolean;
      openAiConfigured: boolean;
      safeErrorCode: string | null;
    },
    productAvailabilitySync?: ProductAvailabilitySyncSummary | null,
  ) {
    return {
      id: settings.id,
      enabled: settings.aiTryOnEnabled,
      providerMode: settings.aiTryOnProvider,
      guestDailyLimit: settings.guestDailyLimit,
      customerDailyLimit: settings.customerDailyLimit,
      requireConsent: settings.requireConsent,
      supportedCategories: this.readSupportedCategories(
        settings.supportedCategories,
      ),
      providerConfigured:
        settings.aiTryOnProvider === 'openai'
          ? (runtime?.openAiConfigured ?? null)
          : null,
      aiServiceReachable:
        settings.aiTryOnProvider === 'openai'
          ? (runtime?.reachable ?? null)
          : null,
      providerSafeErrorCode:
        settings.aiTryOnProvider === 'openai'
          ? (runtime?.safeErrorCode ?? null)
          : null,
      productAvailabilitySync: productAvailabilitySync ?? null,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private buildEligiblePublicTryOnProductWhere(): Prisma.ProductWhereInput {
    return {
      visibility: 'ACTIVE',
      archivedAt: null,
      unpublishedAt: null,
      images: { some: {} },
      shop: {
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      variants: {
        some: {
          isActive: true,
          OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
        },
      },
    };
  }

  private mapTask(task: {
    id: string;
    customerId: string | null;
    guestSessionId: string | null;
    shopId: string;
    productId: string;
    selectedSize: string | null;
    selectedRussianSize: string | null;
    providerMode: string;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
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
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }) {
    return {
      id: task.id,
      customerId: task.customerId,
      guestSessionId: task.guestSessionId,
      shopId: task.shopId,
      productId: task.productId,
      selectedSize: task.selectedSize,
      selectedRussianSize: task.selectedRussianSize,
      providerMode: task.providerMode,
      status: task.status,
      errorCode: task.errorCode,
      errorMessage: task.errorMessage,
      resultImage: task.resultImageUrl
        ? {
            url: task.resultImageUrl,
            storageKey: task.resultImageStorageKey,
            mimeType: task.resultMimeType,
            width: task.resultWidth,
            height: task.resultHeight,
          }
        : null,
      sizeRecommendation: {
        recommendedSize: task.recommendedSize,
        recommendedRussianSize: task.recommendedRussianSize,
        note: task.sizeRecommendationNote,
        noteRu: task.sizeRecommendationNoteRu,
        noteEn: task.sizeRecommendationNoteEn,
        confidence: task.sizeRecommendationConfidence,
      },
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
    };
  }

  private buildCodeError(code: string, message: string) {
    return new BadRequestException({
      code,
      message,
    });
  }

  private async getAiServiceHealth(): Promise<{
    reachable: boolean;
    openAiConfigured: boolean;
    safeErrorCode: string | null;
  }> {
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
          openAiConfigured: false,
          safeErrorCode: null,
        };
      }

      const body = (await response.json()) as {
        openaiConfigured?: boolean;
        safeErrorCode?: string | null;
      };

      return {
        reachable: true,
        openAiConfigured: body.openaiConfigured ?? false,
        safeErrorCode: body.safeErrorCode ?? null,
      };
    } catch {
      return {
        reachable: false,
        openAiConfigured: false,
        safeErrorCode: null,
      };
    }
  }
}
