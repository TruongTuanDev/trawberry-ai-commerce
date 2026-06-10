import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CategoryMappingService } from '../categories/category-mapping.service';
import { SyncAllProductsDto } from './dto/sync-all-products.dto';
import { SyncProductByArticleDto } from './dto/sync-product-by-article.dto';
import { SyncProductsByCodesDto } from './dto/sync-products-by-codes.dto';
import {
  normalizeManualProductCode,
  parseManualProductCodes,
} from './manual-product-code-parser';
import { WbApiClientService } from './wb-api-client.service';
import { WbProductMapperService } from './wb-product-mapper.service';
import {
  WbApiSourceMode,
  WbConnectionVerifyResult,
  WbMappedProduct,
  WbSyncIssue,
  WbSyncType,
  WbDiagnosticsResult,
} from './wb-sync.types';

const SOURCE = 'WILDBERRIES_API';
const WB_IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;
const WB_IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;

type CredentialRecord = {
  encryptedApiKey: string;
  keyLast4: string | null;
  lastVerifiedAt: Date | null;
  lastVerificationStatus: 'SUCCESS' | 'FAILED' | 'NOT_VERIFIED';
  lastVerificationError: string | null;
  updatedAt: Date;
};

type LoadedCredential = {
  apiKey: string;
  keyLast4: string | null;
};

@Injectable()
export class WbProductSyncService {
  private readonly logger = new Logger(WbProductSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: WbApiClientService,
    private readonly mapper: WbProductMapperService,
    private readonly categoriesService: CategoriesService,
    private readonly categoryMappingService: CategoryMappingService,
    private readonly config: ConfigService,
  ) {}

  async saveCredentials(
    shopId: string,
    user: AuthenticatedUser,
    apiKey: string,
  ) {
    await this.assertApprovedSellerForShop(shopId, user);
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey) {
      throw new BadRequestException('Wildberries API key is required.');
    }

    const encryptedApiKey = this.encryptApiKey(normalizedApiKey);
    const keyLast4 = normalizedApiKey.slice(-4);

    const credentials = await this.prisma.shopWbCredential.upsert({
      where: { shopId },
      create: {
        shopId,
        encryptedApiKey,
        keyLast4,
        lastVerificationStatus: 'NOT_VERIFIED',
        lastVerificationError: null,
      },
      update: {
        encryptedApiKey,
        keyLast4,
        lastVerifiedAt: null,
        lastVerificationStatus: 'NOT_VERIFIED',
        lastVerificationError: null,
      },
      select: {
        encryptedApiKey: true,
        keyLast4: true,
        lastVerifiedAt: true,
        lastVerificationStatus: true,
        lastVerificationError: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'wb_credentials_saved',
        shopId,
        userId: user.userId,
        mode: this.syncMode(),
        connected: true,
        keyLast4,
        encryptedLength: encryptedApiKey.length,
        lastVerificationStatus: credentials.lastVerificationStatus,
      }),
    );

    return this.mapCredentialsStatus(
      shopId,
      this.normalizeCredentialRecord(credentials),
    );
  }

  async credentialsStatus(shopId: string, user: AuthenticatedUser) {
    await this.assertApprovedSellerForShop(shopId, user);
    const credentials = await this.prisma.shopWbCredential.findUnique({
      where: { shopId },
      select: {
        encryptedApiKey: true,
        keyLast4: true,
        lastVerifiedAt: true,
        lastVerificationStatus: true,
        lastVerificationError: true,
        updatedAt: true,
      },
    });
    return this.mapCredentialsStatus(
      shopId,
      this.normalizeCredentialRecord(credentials),
    );
  }

  async diagnostics(
    shopId: string,
    user: AuthenticatedUser,
  ): Promise<WbDiagnosticsResult> {
    await this.assertApprovedSellerForShop(shopId, user);
    const credentials = await this.prisma.shopWbCredential.findUnique({
      where: { shopId },
      select: {
        encryptedApiKey: true,
        keyLast4: true,
        lastVerifiedAt: true,
        lastVerificationStatus: true,
        lastVerificationError: true,
        updatedAt: true,
      },
    });

    return this.mapDiagnostics(
      shopId,
      this.normalizeCredentialRecord(credentials),
    );
  }

  async deleteCredentials(shopId: string, user: AuthenticatedUser) {
    await this.assertApprovedSellerForShop(shopId, user);
    await this.prisma.shopWbCredential.deleteMany({
      where: { shopId },
    });
    this.logger.log(
      JSON.stringify({
        event: 'wb_credentials_deleted',
        shopId,
        userId: user.userId,
        mode: this.syncMode(),
        connected: false,
      }),
    );
    return {
      success: true,
      shopId,
      connected: false,
      keyLast4: null,
      lastVerifiedAt: null,
      lastVerificationStatus: 'NOT_VERIFIED',
      lastVerificationError: null,
      mode: this.syncMode(),
    };
  }

  async verifyCredentials(
    shopId: string,
    user: AuthenticatedUser,
  ): Promise<WbConnectionVerifyResult> {
    await this.assertApprovedSellerForShop(shopId, user);
    if (this.syncMode() !== 'real') {
      const safeError =
        'WB_MOCK_MODE_ACTIVE: Mock mode active. Real Wildberries verification is disabled.';
      this.logger.warn(
        JSON.stringify({
          event: 'wb_credentials_verify_blocked',
          shopId,
          userId: user.userId,
          mode: this.syncMode(),
          status: 'FAILED',
          errorCode: this.safeErrorCode(safeError),
        }),
      );
      throw new BadRequestException(safeError);
    }

    const credentialRecord = await this.requireCredentialRecord(shopId);
    const credential = await this.decryptStoredCredential(
      shopId,
      this.normalizeCredentialRecord(credentialRecord) as CredentialRecord,
    );

    try {
      const result = await this.apiClient.verifyConnection(credential.apiKey);
      await this.prisma.shopWbCredential.update({
        where: { shopId },
        data: {
          lastVerifiedAt: new Date(),
          lastVerificationStatus: 'SUCCESS',
          lastVerificationError: null,
        },
      });
      this.logger.log(
        JSON.stringify({
          event: 'wb_credentials_verified',
          shopId,
          userId: user.userId,
          mode: this.syncMode(),
          connected: true,
          keyLast4: credential.keyLast4,
          status: 'SUCCESS',
          fetched: result.fetched,
        }),
      );
      return result;
    } catch (error) {
      const safeError = this.safeErrorMessage(error);
      await this.prisma.shopWbCredential.update({
        where: { shopId },
        data: {
          lastVerifiedAt: new Date(),
          lastVerificationStatus: 'FAILED',
          lastVerificationError: safeError,
        },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'wb_credentials_verify_failed',
          shopId,
          userId: user.userId,
          mode: this.syncMode(),
          connected: true,
          keyLast4: credential.keyLast4,
          status: 'FAILED',
          errorCode: this.safeErrorCode(safeError),
          httpStatus: this.safeHttpStatus(safeError),
        }),
      );
      throw new BadRequestException(safeError);
    }
  }

  async syncAll(
    shopId: string,
    user: AuthenticatedUser,
    dto: SyncAllProductsDto,
  ) {
    return this.sync(shopId, user, 'ALL_PRODUCTS', {
      mode: dto.mode ?? 'PREVIEW',
      limit: dto.limit ?? this.defaultLimit(),
      article: undefined,
      publishMode: dto.publishMode ?? 'DRAFT',
      imageMode: dto.imageMode ?? 'REMOTE_URL',
    });
  }

  async syncByArticle(
    shopId: string,
    user: AuthenticatedUser,
    dto: SyncProductByArticleDto,
  ) {
    const article = dto.article.trim();
    if (!article) {
      throw new BadRequestException('Article / APT / vendorCode is required.');
    }

    return this.sync(shopId, user, 'BY_ARTICLE', {
      mode: dto.mode ?? 'PREVIEW',
      limit: this.defaultLimit(),
      article,
      publishMode: dto.publishMode ?? 'DRAFT',
      imageMode: dto.imageMode ?? 'REMOTE_URL',
    });
  }

  async syncByCodes(
    shopId: string,
    user: AuthenticatedUser,
    dto: SyncProductsByCodesDto,
  ) {
    const requestedCodes = parseManualProductCodes(dto.codes);
    const run = await this.sync(shopId, user, 'BY_CODES', {
      mode: dto.mode ?? 'PREVIEW',
      limit: this.defaultLimit(),
      articles: requestedCodes,
      publishMode: dto.publishMode ?? 'DRAFT',
      imageMode: dto.imageMode ?? 'REMOTE_URL',
    });
    const matchedCodes = new Set(
      (run.rawSummary?.products ?? [])
        .map((product) => product.sellerSku)
        .filter((code): code is string => Boolean(code))
        .map(normalizeManualProductCode),
    );
    const syncedCodes = requestedCodes.filter((code) =>
      matchedCodes.has(normalizeManualProductCode(code)),
    );

    return {
      requestedCodes,
      requestedCount: requestedCodes.length,
      syncedCount: run.totalProducts,
      syncedCodes,
      notFound: requestedCodes.filter(
        (code) => !matchedCodes.has(normalizeManualProductCode(code)),
      ),
      invalid: [],
      skipped: [],
      errors: Array.isArray(run.errors) ? run.errors : [],
      run,
    };
  }

  async getRun(shopId: string, user: AuthenticatedUser, syncRunId: string) {
    await this.assertApprovedSellerForShop(shopId, user);
    const run = await this.prisma.wbSyncRun.findFirst({
      where: { id: syncRunId, shopId, sellerId: user.userId },
    });
    if (!run) {
      throw new NotFoundException('WB sync run was not found.');
    }
    return this.mapRun(run);
  }

  private async sync(
    shopId: string,
    user: AuthenticatedUser,
    syncType: WbSyncType,
    options: {
      mode: 'PREVIEW' | 'IMPORT';
      limit: number;
      article?: string;
      articles?: string[];
      publishMode: 'DRAFT' | 'ACTIVE_IF_VALID';
      imageMode: 'REMOTE_URL';
    },
  ) {
    await this.assertApprovedSellerForShop(shopId, user);
    const startedAt = new Date();
    const sourceMode = this.syncMode();
    const credential = await this.getCredential(shopId);

    const run = await this.prisma.wbSyncRun.create({
      data: {
        shopId,
        sellerId: user.userId,
        mode: options.mode,
        status: 'RUNNING',
        syncType,
        article: options.article,
        warningsJson: [],
        errorsJson: [],
        rawSummaryJson: {
          sourceMode,
          credentialKeyLast4: credential?.keyLast4 ?? null,
          imageMode: options.imageMode,
          publishMode: options.publishMode,
          ...(options.articles ? { requestedCodes: options.articles } : {}),
        },
        startedAt,
      },
    });

    try {
      const cardsResponse = await this.apiClient.fetchCards({
        apiKey: credential?.apiKey ?? null,
        limit: options.limit,
        article: options.article,
        ...(options.articles ? { articles: options.articles } : {}),
      });

      const mapped = await Promise.all(
        cardsResponse.cards.map(async (card) => {
          const product = this.mapper.mapCard(card);
          const mapping = await this.categoryMappingService.mapSourceCategory(
            SOURCE,
            product.categoryName,
          );
          product.sourceCategoryName = mapping.sourceCategoryName;
          product.categoryId = mapping.categoryId?.toString() ?? null;
          product.mappedCategoryName = mapping.categoryName;
          if (mapping.categoryName) {
            product.categoryName = mapping.categoryName;
          }
          if (mapping.warning) {
            product.warnings.push(mapping.warning);
          }
          return product;
        }),
      );

      const warnings = mapped.flatMap((product) => product.warnings);
      const errors = mapped.flatMap((product) => product.errors);

      if (options.article && mapped.length === 0) {
        warnings.push({
          level: 'WARNING',
          code: 'ARTICLE_NOT_FOUND',
          message: `No Wildberries card matched article "${options.article}".`,
          article: options.article,
        });
      }

      const importResult =
        options.mode === 'IMPORT'
          ? await this.prisma.$transaction(
              (tx) =>
                this.importProducts(tx, shopId, mapped, options.publishMode),
              {
                maxWait: WB_IMPORT_TRANSACTION_MAX_WAIT_MS,
                timeout: WB_IMPORT_TRANSACTION_TIMEOUT_MS,
              },
            )
          : {
              createdProducts: 0,
              updatedProducts: 0,
              createdVariants: 0,
              updatedVariants: 0,
            };

      const updated = await this.prisma.wbSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          totalFetched: cardsResponse.fetchedCount,
          totalProducts: mapped.length,
          totalVariants: mapped.reduce(
            (sum, product) => sum + product.variants.length,
            0,
          ),
          totalImages: mapped.reduce(
            (sum, product) => sum + product.images.length,
            0,
          ),
          ...importResult,
          warningsJson: warnings,
          errorsJson: errors,
          rawSummaryJson: {
            sourceMode: cardsResponse.mode,
            credentialKeyLast4: credential?.keyLast4 ?? null,
            fetchedCount: cardsResponse.fetchedCount,
            pagesFetched: cardsResponse.pagesFetched,
            cursor: cardsResponse.cursor ?? null,
            imageMode: options.imageMode,
            publishMode: options.publishMode,
            ...(options.articles ? { requestedCodes: options.articles } : {}),
            products: mapped.map((product) => ({
              sellerSku: product.sellerSku,
              externalProductId: product.externalProductId,
              name: product.name,
              brand: product.brand,
              categoryId: product.categoryId,
              categoryName: product.categoryName,
              sourceCategoryName: product.sourceCategoryName,
              variantsCount: product.variants.length,
              imagesCount: product.images.length,
              warnings: product.warnings,
              errors: product.errors,
            })),
          },
          completedAt: new Date(),
        },
      });
      return this.mapRun(updated);
    } catch (error) {
      const safeError = this.safeErrorMessage(error);
      const updated = await this.prisma.wbSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorsJson: [
            {
              level: 'ERROR',
              code: 'SYNC_FAILED',
              message: safeError,
              article: options.article ?? null,
            },
          ],
          rawSummaryJson: {
            sourceMode,
            credentialKeyLast4: credential?.keyLast4 ?? null,
            imageMode: options.imageMode,
            publishMode: options.publishMode,
            ...(options.articles ? { requestedCodes: options.articles } : {}),
          },
          completedAt: new Date(),
        },
      });

      if (sourceMode === 'real') {
        throw new BadRequestException(safeError);
      }

      return this.mapRun(updated);
    }
  }

  private async importProducts(
    tx: Prisma.TransactionClient,
    shopId: string,
    products: WbMappedProduct[],
    publishMode: 'DRAFT' | 'ACTIVE_IF_VALID',
  ) {
    void publishMode;
    const result = {
      createdProducts: 0,
      updatedProducts: 0,
      importedProducts: 0,
      createdVariants: 0,
      updatedVariants: 0,
      alreadyPublished: 0,
      needsReview: 0,
      missingPrice: 0,
      missingStock: 0,
      missingCategory: 0,
    };

    for (const mapped of products) {
      const existing = await this.findExistingProduct(tx, shopId, mapped);
      const resolvedCategory =
        await this.categoriesService.resolveCategoryAssignment(
          {
            categoryId: mapped.categoryId ? BigInt(mapped.categoryId) : null,
            categoryName: mapped.mappedCategoryName ?? mapped.categoryName,
            sourceCategoryName:
              mapped.sourceCategoryName ?? mapped.categoryName,
            sourceCategorySource: SOURCE,
          },
          tx,
        );
      const productData = {
        externalSource: SOURCE,
        externalProductId: mapped.externalProductId,
        sellerSku: mapped.sellerSku,
        wbNmId: mapped.wbNmId,
        wbImtId: mapped.wbImtId,
        wbNmUuid: mapped.wbNmUuid,
        brand: mapped.brand,
        wbTitle: mapped.name,
        localTitle: mapped.name,
        wbDescription: mapped.description,
        localDescription: mapped.description,
        categoryName: resolvedCategory.categoryName,
        categoryId: resolvedCategory.categoryId,
        sourceCategoryName: resolvedCategory.sourceCategoryName,
        sourceCategorySource: SOURCE,
        subjectId: mapped.subjectId,
        wbVendorCode: mapped.sellerSku,
        wbVideoUrl: mapped.videoUrl,
        wbNeedKiz: mapped.needKiz ?? undefined,
        gender: mapped.characteristics.gender,
        composition: mapped.characteristics.composition,
        color: mapped.characteristics.color,
        weightBrutto: mapped.dimensions.weightBrutto,
        height: mapped.dimensions.height,
        length: mapped.dimensions.length,
        width: mapped.dimensions.width,
        dimensionsValid: mapped.dimensions.isValid ?? false,
        visibility: existing ? undefined : 'ACTIVE',
        source: SOURCE,
        seoSlug: this.slug(
          `${mapped.sellerSku ?? mapped.externalProductId ?? mapped.name}-${mapped.name}`,
        ),
      };

      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: productData,
          })
        : await tx.product.create({
            data: {
              id: randomUUID(),
              shopId,
              catalogStatus: 'IMPORTED',
              ...productData,
            },
          });

      if (existing) {
        result.updatedProducts += 1;
        if (existing.catalogStatus === 'PUBLISHED') {
          result.alreadyPublished += 1;
        }
      } else {
        result.createdProducts += 1;
        result.importedProducts += 1;
      }

      for (const variant of mapped.variants) {
        const created = await this.upsertVariant(
          tx,
          product.id,
          mapped,
          variant,
        );
        if (created) {
          result.createdVariants += 1;
        } else {
          result.updatedVariants += 1;
        }
      }

      for (const image of mapped.images) {
        const exists = await tx.productImage.findFirst({
          where: { productId: product.id, wbUrl: image.url },
          select: { id: true },
        });
        if (!exists) {
          await tx.productImage.create({
            data: {
              id: randomUUID(),
              productId: product.id,
              wbUrl: image.url,
              localUrl: image.url,
              imageType: 'ORIGINAL',
              isMain: image.isMain,
              sortOrder: image.sortOrder,
            },
          });
        }
      }

      const hasMissingCategory = !resolvedCategory.categoryId;
      const hasMissingPrice = true;
      const hasMissingStock = true;
      if (hasMissingCategory) {
        result.missingCategory += 1;
      }
      if (hasMissingPrice) {
        result.missingPrice += 1;
      }
      if (hasMissingStock) {
        result.missingStock += 1;
      }
      result.needsReview += 1;
    }

    return result;
  }

  private async upsertVariant(
    tx: Prisma.TransactionClient,
    productId: string,
    product: WbMappedProduct,
    variant: WbMappedProduct['variants'][number],
  ) {
    const existing = await tx.productVariant.findFirst({
      where: {
        productId,
        OR: [
          ...(variant.wbBarcode ? [{ wbBarcode: variant.wbBarcode }] : []),
          { chrtId: variant.chrtId },
          {
            sellerSku: variant.sellerSku ?? product.sellerSku,
            sizeName: variant.sizeName,
            russianSize: variant.russianSize,
          },
        ],
      },
      select: {
        id: true,
        isActive: true,
        basePrice: true,
        discountPrice: true,
        stockQuantity: true,
        reservedStock: true,
        lowStockThreshold: true,
        trackInventory: true,
      },
    });

    if (existing) {
      await tx.productVariant.update({
        where: { id: existing.id },
        data: {
          externalSource: SOURCE,
          sellerSku: variant.sellerSku ?? product.sellerSku,
          wbBarcode: variant.wbBarcode,
          sizeName: variant.sizeName,
          russianSize: variant.russianSize,
          techSize: variant.sizeName,
          wbSize: variant.russianSize ?? variant.sizeName,
          isActive: existing.isActive,
          basePrice: existing.basePrice,
          discountPrice: existing.discountPrice,
          stockQuantity: existing.stockQuantity,
          reservedStock: existing.reservedStock,
          lowStockThreshold: existing.lowStockThreshold,
          trackInventory: existing.trackInventory,
        },
      });
      return false;
    }

    await tx.productVariant.create({
      data: {
        id: randomUUID(),
        productId,
        chrtId: variant.chrtId,
        externalSource: SOURCE,
        sellerSku: variant.sellerSku ?? product.sellerSku,
        wbBarcode: variant.wbBarcode,
        sizeName: variant.sizeName,
        russianSize: variant.russianSize,
        techSize: variant.sizeName,
        wbSize: variant.russianSize ?? variant.sizeName,
        isActive: true,
        basePrice: 0,
        discountPrice: 0,
        stockQuantity: 0,
        reservedStock: 0,
        lowStockThreshold: 5,
        trackInventory: true,
      },
    });
    return true;
  }

  private async findExistingProduct(
    tx: Prisma.TransactionClient,
    shopId: string,
    product: WbMappedProduct,
  ) {
    return tx.product.findFirst({
      where: {
        shopId,
        OR: [
          ...(product.sellerSku ? [{ sellerSku: product.sellerSku }] : []),
          { wbNmId: product.wbNmId },
          ...(product.externalProductId
            ? [
                {
                  externalProductId: product.externalProductId,
                  externalSource: SOURCE,
                },
              ]
            : []),
        ],
      },
      select: { id: true, catalogStatus: true },
    });
  }

  private async getCredential(
    shopId: string,
  ): Promise<LoadedCredential | null> {
    const mode = this.syncMode();
    if (mode === 'mock') {
      return null;
    }

    const credentialRecord = await this.requireCredentialRecord(shopId);
    return this.decryptStoredCredential(
      shopId,
      this.normalizeCredentialRecord(credentialRecord) as CredentialRecord,
    );
  }

  private async requireCredentialRecord(
    shopId: string,
  ): Promise<CredentialRecord> {
    const credentials = await this.prisma.shopWbCredential.findUnique({
      where: { shopId },
      select: {
        encryptedApiKey: true,
        keyLast4: true,
        lastVerifiedAt: true,
        lastVerificationStatus: true,
        lastVerificationError: true,
        updatedAt: true,
      },
    });

    if (!credentials) {
      throw new BadRequestException(
        'WB_CREDENTIAL_MISSING: Real mode active, this shop needs its own WB API key.',
      );
    }

    return this.normalizeCredentialRecord(credentials) as CredentialRecord;
  }

  private async decryptStoredCredential(
    shopId: string,
    credentials: CredentialRecord,
  ): Promise<LoadedCredential> {
    try {
      return {
        apiKey: this.decryptApiKey(credentials.encryptedApiKey),
        keyLast4: credentials.keyLast4,
      };
    } catch (error) {
      const safeError = this.safeCredentialDecryptError(error);
      await this.prisma.shopWbCredential.update({
        where: { shopId },
        data: {
          lastVerifiedAt: new Date(),
          lastVerificationStatus: 'FAILED',
          lastVerificationError: safeError,
        },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'wb_credentials_decrypt_failed',
          shopId,
          mode: this.syncMode(),
          connected: true,
          keyLast4: credentials.keyLast4,
          encryptedLength: credentials.encryptedApiKey.length,
          status: 'FAILED',
          errorCode: this.safeErrorCode(safeError),
        }),
      );
      throw new BadRequestException(safeError);
    }
  }

  private async loadStoredCredential(
    shopId: string,
  ): Promise<LoadedCredential> {
    const credentialRecord = await this.requireCredentialRecord(shopId);
    return {
      apiKey: this.decryptApiKey(credentialRecord.encryptedApiKey),
      keyLast4: credentialRecord.keyLast4,
    };
  }

  private async assertApprovedSellerForShop(
    shopId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role !== USER_ROLES.SELLER && user.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenException(
        'Only sellers or admins can sync WB products.',
      );
    }
    const shop = await this.prisma.shop.findFirst({
      where:
        user.role === USER_ROLES.ADMIN
          ? { id: shopId }
          : { id: shopId, sellerProfile: { userId: user.userId } },
      select: { id: true, sellerProfile: { select: { approvalStatus: true } } },
    });
    if (!shop) {
      throw new ForbiddenException('You do not have access to this shop.');
    }
    if (
      user.role === USER_ROLES.SELLER &&
      shop.sellerProfile.approvalStatus !== 'APPROVED'
    ) {
      throw new ForbiddenException(
        'Only APPROVED sellers can sync WB products.',
      );
    }
  }

  private mapRun(run: {
    id: string;
    status: string;
    mode: string;
    syncType: string;
    article: string | null;
    totalFetched: number;
    totalProducts: number;
    totalVariants: number;
    totalImages: number;
    createdProducts: number;
    updatedProducts: number;
    importedProducts: number;
    createdVariants: number;
    updatedVariants: number;
    alreadyPublished: number;
    needsReview: number;
    missingPrice: number;
    missingStock: number;
    missingCategory: number;
    warningsJson: Prisma.JsonValue;
    errorsJson: Prisma.JsonValue;
    rawSummaryJson: Prisma.JsonValue | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }) {
    const rawSummary = (run.rawSummaryJson ?? null) as {
      sourceMode?: WbApiSourceMode;
      fetchedCount?: number;
      pagesFetched?: number;
      cursor?: unknown;
      imageMode?: string;
      publishMode?: string;
      credentialKeyLast4?: string | null;
      requestedCodes?: string[];
      products?: Array<{
        sellerSku: string | null;
        externalProductId: string | null;
        name: string;
        brand?: string | null;
        variantsCount: number;
        imagesCount: number;
        warnings: WbSyncIssue[];
        errors: WbSyncIssue[];
      }>;
    } | null;

    return {
      syncRunId: run.id,
      status: run.status,
      mode: run.mode,
      syncType: run.syncType,
      article: run.article,
      sourceMode: rawSummary?.sourceMode ?? this.syncMode(),
      totalFetched: run.totalFetched,
      totalProducts: run.totalProducts,
      totalVariants: run.totalVariants,
      totalImages: run.totalImages,
      createdProducts: run.createdProducts,
      updatedProducts: run.updatedProducts,
      importedProducts: run.importedProducts,
      createdVariants: run.createdVariants,
      updatedVariants: run.updatedVariants,
      alreadyPublished: run.alreadyPublished,
      needsReview: run.needsReview,
      missingPrice: run.missingPrice,
      missingStock: run.missingStock,
      missingCategory: run.missingCategory,
      warnings: run.warningsJson,
      errors: run.errorsJson,
      rawSummary,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  private mapCredentialsStatus(
    shopId: string,
    credentials: CredentialRecord | null,
  ) {
    const mode = this.syncMode();
    const missingConfig = this.missingConfig(mode);
    return {
      shopId,
      connected: Boolean(credentials),
      hasCredentials: Boolean(credentials),
      keyLast4: credentials?.keyLast4 ?? null,
      updatedAt: credentials?.updatedAt.toISOString() ?? null,
      mode,
      lastVerifiedAt: credentials?.lastVerifiedAt?.toISOString() ?? null,
      lastVerificationStatus:
        credentials?.lastVerificationStatus ?? 'NOT_VERIFIED',
      lastVerificationError: credentials?.lastVerificationError ?? null,
      canAttemptRealVerify:
        mode === 'real' && Boolean(credentials) && missingConfig.length === 0,
      missingConfig,
    };
  }

  private mapDiagnostics(shopId: string, credentials: CredentialRecord | null) {
    const status = this.mapCredentialsStatus(shopId, credentials);
    return {
      mode: status.mode,
      shopId,
      hasCredential: status.hasCredentials,
      connected: status.connected,
      keyLast4: status.keyLast4,
      lastVerifiedAt: status.lastVerifiedAt,
      lastVerificationStatus: status.lastVerificationStatus,
      lastVerificationError: status.lastVerificationError,
      canAttemptRealVerify: status.canAttemptRealVerify,
      missingConfig: status.missingConfig,
    };
  }

  private encryptApiKey(apiKey: string) {
    const key = this.encryptionKey();
    if (!key) {
      throw new BadRequestException(
        'WB_CREDENTIAL_ENCRYPTION_KEY is required to store WB credentials.',
      );
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(apiKey, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  private decryptApiKey(encrypted: string) {
    const key = this.encryptionKey();
    if (!key) {
      throw new BadRequestException(
        'WB_CREDENTIAL_ENCRYPTION_KEY is required to read WB credentials.',
      );
    }
    const [version, ivRaw, tagRaw, dataRaw] = encrypted.split(':');
    if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) {
      throw new BadRequestException('Stored WB credentials are invalid.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivRaw, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private encryptionKey() {
    const raw =
      this.config.get<string>('WB_CREDENTIAL_ENCRYPTION_KEY') ??
      this.config.get<string>('WB_CREDENTIALS_ENCRYPTION_KEY');
    if (!raw) {
      return null;
    }
    return createHash('sha256').update(raw).digest();
  }

  private syncMode(): WbApiSourceMode {
    return this.apiClient.getMode();
  }

  private defaultLimit() {
    return Math.min(
      100,
      Math.max(1, Number(this.config.get<string>('WB_SYNC_PAGE_LIMIT') ?? 100)),
    );
  }

  private safeErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
        .replace(/[A-Za-z0-9_-]{24,}/g, '***');
    }
    return 'WB sync failed.';
  }

  private safeCredentialDecryptError(error: unknown) {
    const message = this.safeErrorMessage(error);
    if (
      message.includes(
        'WB_CREDENTIAL_ENCRYPTION_KEY is required to read WB credentials.',
      )
    ) {
      return 'WB_CONFIG_MISSING: WB_CREDENTIAL_ENCRYPTION_KEY is required to read WB credentials.';
    }
    return 'WB_CREDENTIAL_DECRYPT_FAILED: Stored Wildberries API key could not be decrypted. Check WB_CREDENTIAL_ENCRYPTION_KEY.';
  }

  private missingConfig(mode: WbApiSourceMode) {
    const missing: string[] = [];
    if (
      mode === 'real' &&
      !this.config.get<string>('WB_CREDENTIAL_ENCRYPTION_KEY') &&
      !this.config.get<string>('WB_CREDENTIALS_ENCRYPTION_KEY')
    ) {
      missing.push('WB_CREDENTIAL_ENCRYPTION_KEY');
    }
    return missing;
  }

  private safeErrorCode(message: string) {
    return message.split(':', 1)[0] ?? 'UNKNOWN';
  }

  private safeHttpStatus(message: string) {
    const match = message.match(/_(\d{3})/);
    return match ? Number(match[1]) : null;
  }

  private normalizeCredentialRecord(
    credentials: {
      encryptedApiKey: string;
      keyLast4: string | null;
      lastVerifiedAt: Date | null;
      lastVerificationStatus: string;
      lastVerificationError: string | null;
      updatedAt: Date;
    } | null,
  ): CredentialRecord | null {
    if (!credentials) {
      return null;
    }

    return {
      ...credentials,
      lastVerificationStatus:
        credentials.lastVerificationStatus === 'SUCCESS' ||
        credentials.lastVerificationStatus === 'FAILED'
          ? credentials.lastVerificationStatus
          : 'NOT_VERIFIED',
    };
  }

  private slug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-я]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 500);
  }
}
