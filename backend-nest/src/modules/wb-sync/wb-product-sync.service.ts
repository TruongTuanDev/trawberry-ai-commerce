import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CategoryMappingService } from '../categories/category-mapping.service';
import { SyncAllProductsDto } from './dto/sync-all-products.dto';
import { SyncProductByArticleDto } from './dto/sync-product-by-article.dto';
import { WbApiClientService } from './wb-api-client.service';
import { WbProductMapperService } from './wb-product-mapper.service';
import { WbMappedProduct, WbSyncType } from './wb-sync.types';

const SOURCE = 'WILDBERRIES_API';

@Injectable()
export class WbProductSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: WbApiClientService,
    private readonly mapper: WbProductMapperService,
    private readonly categoryMappingService: CategoryMappingService,
    private readonly config: ConfigService,
  ) {}

  async saveCredentials(
    shopId: string,
    user: AuthenticatedUser,
    apiKey: string,
  ) {
    await this.assertApprovedSellerForShop(shopId, user);
    const encryptedApiKey = this.encryptApiKey(apiKey);
    const keyLast4 = apiKey.slice(-4);
    await this.prisma.shopWbCredential.upsert({
      where: { shopId },
      create: { shopId, encryptedApiKey, keyLast4 },
      update: { encryptedApiKey, keyLast4 },
    });
    return { shopId, hasCredentials: true, keyLast4 };
  }

  async credentialsStatus(shopId: string, user: AuthenticatedUser) {
    await this.assertApprovedSellerForShop(shopId, user);
    const credentials = await this.prisma.shopWbCredential.findUnique({
      where: { shopId },
      select: { keyLast4: true, updatedAt: true },
    });
    return {
      shopId,
      hasCredentials: Boolean(credentials),
      keyLast4: credentials?.keyLast4 ?? null,
      updatedAt: credentials?.updatedAt.toISOString() ?? null,
      mode: this.syncMode(),
    };
  }

  async syncAll(
    shopId: string,
    user: AuthenticatedUser,
    dto: SyncAllProductsDto,
  ) {
    return this.sync(shopId, user, 'ALL_PRODUCTS', {
      mode: dto.mode ?? 'PREVIEW',
      limit: dto.limit ?? this.defaultLimit(),
      cursor: dto.cursor,
      publishMode: dto.publishMode ?? 'DRAFT',
      imageMode: dto.imageMode ?? 'REMOTE_URL',
    });
  }

  async syncByArticle(
    shopId: string,
    user: AuthenticatedUser,
    dto: SyncProductByArticleDto,
  ) {
    return this.sync(shopId, user, 'BY_ARTICLE', {
      mode: dto.mode ?? 'PREVIEW',
      limit: this.defaultLimit(),
      article: dto.article.trim(),
      publishMode: dto.publishMode ?? 'DRAFT',
      imageMode: dto.imageMode ?? 'REMOTE_URL',
    });
  }

  async getRun(shopId: string, user: AuthenticatedUser, syncRunId: string) {
    await this.assertApprovedSellerForShop(shopId, user);
    const run = await this.prisma.wbSyncRun.findFirst({
      where: { id: syncRunId, shopId, sellerId: user.userId },
    });
    if (!run) throw new NotFoundException('WB sync run was not found.');
    return this.mapRun(run);
  }

  private async sync(
    shopId: string,
    user: AuthenticatedUser,
    syncType: WbSyncType,
    options: {
      mode: 'PREVIEW' | 'IMPORT';
      limit: number;
      cursor?: string;
      article?: string;
      publishMode: 'DRAFT' | 'ACTIVE_IF_VALID';
      imageMode: 'REMOTE_URL';
    },
  ) {
    await this.assertApprovedSellerForShop(shopId, user);
    const startedAt = new Date();
    const credentials = await this.getApiKey(shopId);
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
        startedAt,
      },
    });

    try {
      const cardsResponse = await this.apiClient.fetchCards({
        apiKey: credentials,
        limit: options.limit,
        cursor: options.cursor,
      });
      const cards = (cardsResponse.cards ?? []).filter((card) =>
        options.article
          ? card.vendorCode?.toLowerCase() === options.article.toLowerCase()
          : true,
      );
      const mapped = await Promise.all(
        cards.map(async (card) => {
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
      const importResult =
        options.mode === 'IMPORT'
          ? await this.prisma.$transaction((tx) =>
              this.importProducts(tx, shopId, mapped, options.publishMode),
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
          totalFetched: cardsResponse.cards?.length ?? 0,
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
            cursor: cardsResponse.cursor ?? null,
            products: mapped.map((product) => ({
              sellerSku: product.sellerSku,
              externalProductId: product.externalProductId,
              name: product.name,
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
      const updated = await this.prisma.wbSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorsJson: [
            {
              level: 'ERROR',
              code: 'SYNC_FAILED',
              message:
                error instanceof Error ? error.message : 'WB sync failed.',
            },
          ],
          completedAt: new Date(),
        },
      });
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
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
    const result = {
      createdProducts: 0,
      updatedProducts: 0,
      createdVariants: 0,
      updatedVariants: 0,
    };
    for (const mapped of products) {
      const existing = await this.findExistingProduct(tx, shopId, mapped);
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
        categoryName: mapped.mappedCategoryName ?? mapped.categoryName,
        categoryId: mapped.categoryId ? BigInt(mapped.categoryId) : null,
        sourceCategoryName: mapped.sourceCategoryName ?? mapped.categoryName,
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
        visibility: this.visibility(mapped, publishMode),
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
            data: { id: randomUUID(), shopId, ...productData },
          });
      if (existing) result.updatedProducts += 1;
      else result.createdProducts += 1;

      for (const variant of mapped.variants) {
        const created = await this.upsertVariant(
          tx,
          product.id,
          mapped,
          variant,
        );
        if (created) result.createdVariants += 1;
        else result.updatedVariants += 1;
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
      select: { id: true },
    });
    const data = {
      externalSource: SOURCE,
      sellerSku: variant.sellerSku ?? product.sellerSku,
      wbBarcode: variant.wbBarcode,
      sizeName: variant.sizeName,
      russianSize: variant.russianSize,
      techSize: variant.sizeName,
      wbSize: variant.russianSize ?? variant.sizeName,
      isActive: false,
      basePrice: 0,
      discountPrice: 0,
      stockQuantity: 0,
      reservedStock: 0,
      lowStockThreshold: 5,
      trackInventory: true,
    };
    if (existing) {
      await tx.productVariant.update({
        where: { id: existing.id },
        data: {
          ...data,
          basePrice: undefined,
          discountPrice: undefined,
          stockQuantity: undefined,
        },
      });
      return false;
    }
    await tx.productVariant.create({
      data: { id: randomUUID(), productId, chrtId: variant.chrtId, ...data },
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
      select: { id: true },
    });
  }

  private async getApiKey(shopId: string) {
    if (this.syncMode() === 'mock') return null;
    const credentials = await this.prisma.shopWbCredential.findUnique({
      where: { shopId },
    });
    if (!credentials)
      throw new BadRequestException('Wildberries credentials are required.');
    return this.decryptApiKey(credentials.encryptedApiKey);
  }

  private async assertApprovedSellerForShop(
    shopId: string,
    user: AuthenticatedUser,
  ) {
    if (user.role !== USER_ROLES.SELLER) {
      throw new ForbiddenException(
        'Only approved sellers can sync WB products.',
      );
    }
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, sellerProfile: { userId: user.userId } },
      select: { id: true, sellerProfile: { select: { approvalStatus: true } } },
    });
    if (!shop)
      throw new ForbiddenException('You do not have access to this shop.');
    if (shop.sellerProfile.approvalStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Only APPROVED sellers can sync WB products.',
      );
    }
  }

  private visibility(
    product: WbMappedProduct,
    publishMode: 'DRAFT' | 'ACTIVE_IF_VALID',
  ) {
    if (publishMode === 'DRAFT') return 'DRAFT';
    return product.images.length > 0 && product.variants.length > 0
      ? 'ACTIVE'
      : 'DRAFT';
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
    createdVariants: number;
    updatedVariants: number;
    warningsJson: Prisma.JsonValue;
    errorsJson: Prisma.JsonValue;
    rawSummaryJson: Prisma.JsonValue | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }) {
    return {
      syncRunId: run.id,
      status: run.status,
      mode: run.mode,
      syncType: run.syncType,
      article: run.article,
      totalFetched: run.totalFetched,
      totalProducts: run.totalProducts,
      totalVariants: run.totalVariants,
      totalImages: run.totalImages,
      createdProducts: run.createdProducts,
      updatedProducts: run.updatedProducts,
      createdVariants: run.createdVariants,
      updatedVariants: run.updatedVariants,
      warnings: run.warningsJson,
      errors: run.errorsJson,
      rawSummary: run.rawSummaryJson,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  private encryptApiKey(apiKey: string) {
    const key = this.encryptionKey();
    if (!key) {
      if (this.syncMode() === 'mock') return `mock:${apiKey.slice(-4)}`;
      throw new BadRequestException(
        'WB_CREDENTIALS_ENCRYPTION_KEY is required to store real WB credentials.',
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
    if (!key || encrypted.startsWith('mock:')) {
      throw new BadRequestException(
        'Valid encrypted Wildberries credentials are required.',
      );
    }
    const [, ivRaw, tagRaw, dataRaw] = encrypted.split(':');
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
    const raw = this.config.get<string>('WB_CREDENTIALS_ENCRYPTION_KEY');
    if (!raw) return null;
    return createHash('sha256').update(raw).digest();
  }

  private syncMode() {
    return this.config.get<string>('WB_SYNC_MODE') === 'real' ? 'real' : 'mock';
  }

  private defaultLimit() {
    return Math.min(
      100,
      Math.max(1, Number(this.config.get<string>('WB_SYNC_PAGE_LIMIT') ?? 100)),
    );
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
