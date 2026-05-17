import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BulkProductActionDto } from './dto/bulk-product-action.dto';
import { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListShopProductsQueryDto } from './dto/list-shop-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductInventoryDto } from './dto/update-product-inventory.dto';
import {
  ProductCatalogStatus,
  ProductReadinessReason,
  ProductSource,
} from './product-catalog.constants';
import {
  ProductReadinessResult,
  ProductReadinessService,
} from './product-readiness.service';

type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    images: {
      orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }];
    };
    category: true;
    shop: {
      select: {
        id: true;
        name: true;
        slug: true;
        status: true;
        sellerProfile: {
          select: {
            approvalStatus: true;
          };
        };
      };
    };
    variants: true;
  };
}>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async listByShop(shopId: string, query: ListShopProductsQueryDto) {
    const search = query.q ?? query.search;
    const pageSize = query.limit ?? query.size;
    const where: Prisma.ProductWhereInput = {
      shopId,
      ...(search
        ? {
            OR: this.buildSearchPredicates(search),
          }
        : {}),
      ...(this.resolveVisibilityFilter(query)
        ? {
            visibility: this.resolveVisibilityFilter(query),
          }
        : {}),
      ...(query.catalogStatus
        ? { catalogStatus: query.catalogStatus }
        : query.published
          ? { catalogStatus: 'PUBLISHED' }
          : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.categoryId
        ? {
            categoryId: BigInt(query.categoryId),
          }
        : {}),
      ...(query.inStock === undefined
        ? {}
        : query.inStock
          ? {
              variants: {
                some: {
                  stockQuantity: {
                    gt: 0,
                  },
                },
              },
            }
          : {
              variants: {
                none: {
                  stockQuantity: {
                    gt: 0,
                  },
                },
              },
            }),
    };

    const products = (await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        category: true,
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            sellerProfile: {
              select: {
                approvalStatus: true,
              },
            },
          },
        },
        variants: true,
      },
    })) as ProductWithRelations[];

    const filteredItems = products.filter((product) => {
      const readiness = this.productReadiness.getReadiness(product);
      const warnings = readiness.blockingReasons;
      const inventory = this.getProductInventorySummary(product.variants);

      if (query.stockStatus && inventory.stockStatus !== query.stockStatus) {
        return false;
      }
      if (query.missingPrice && !warnings.includes('MISSING_PRICE')) {
        return false;
      }
      if (query.missingStock && !warnings.includes('MISSING_STOCK')) {
        return false;
      }
      if (query.missingCategory && !warnings.includes('MISSING_CATEGORY')) {
        return false;
      }
      if (query.readyToPublish && !readiness.ready) {
        return false;
      }
      if (query.needsReview && readiness.ready) {
        return false;
      }
      return true;
    });

    const sorted = this.sortProducts(filteredItems, query.sort);
    const total = sorted.length;
    const items = sorted.slice(
      (query.page - 1) * pageSize,
      (query.page - 1) * pageSize + pageSize,
    );

    return {
      items: items.map((product) => this.mapProductSummary(product)),
      meta: {
        page: query.page,
        size: pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async findOneByShop(shopId: string, productId: string) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    return this.mapProductDetail(product);
  }

  async getReadiness(shopId: string, productId: string) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    const readiness = this.productReadiness.getReadiness(product);
    return {
      productId: product.id,
      shopId: product.shopId,
      ready: readiness.ready,
      blockingReasons: readiness.blockingReasons,
      catalogStatus: this.effectiveCatalogStatus(product, readiness),
    };
  }

  async create(shopId: string, dto: CreateProductDto) {
    await this.ensureShopExists(shopId);
    await this.ensureUniqueWbNmId(shopId, dto.wbNmId);
    await this.ensureCategoryExists(dto.categoryId);

    const lifecycle = this.resolveManualLifecycleForCreate(dto.visibility);

    const createdProduct = await this.prisma.product.create({
      data: {
        shopId,
        wbNmId: BigInt(dto.wbNmId),
        wbImtId: dto.wbImtId !== undefined ? BigInt(dto.wbImtId) : undefined,
        wbNmUuid: dto.wbNmUuid,
        brand: dto.brand,
        wbTitle: dto.wbTitle,
        wbDescription: dto.wbDescription,
        categoryId:
          dto.categoryId !== undefined ? BigInt(dto.categoryId) : undefined,
        categoryName: dto.categoryName,
        sourceCategoryName: dto.categoryName,
        sourceCategorySource: 'MANUAL',
        wbVendorCode: dto.wbVendorCode,
        wbVideoUrl: dto.wbVideoUrl,
        wbNeedKiz: dto.wbNeedKiz,
        subjectId:
          dto.subjectId !== undefined ? BigInt(dto.subjectId) : undefined,
        wholesaleEnabled: dto.wholesaleEnabled,
        wholesaleQuantum: dto.wholesaleQuantum,
        length: dto.length,
        width: dto.width,
        height: dto.height,
        weightBrutto: dto.weightBrutto,
        dimensionsValid: dto.dimensionsValid,
        localTitle: dto.localTitle,
        localDescription: dto.localDescription,
        seoSlug: dto.seoSlug,
        visibility: dto.visibility ?? 'ACTIVE',
        catalogStatus: lifecycle.catalogStatus,
        publishedAt: lifecycle.publishedAt,
        unpublishedAt: lifecycle.unpublishedAt,
        archivedAt: lifecycle.archivedAt,
        source: 'MANUAL',
        localTags: dto.localTags,
        images: dto.images?.length
          ? {
              create: dto.images.map((image, index) => ({
                id: randomUUID(),
                wbUrl: image.wbUrl,
                localUrl: image.localUrl,
                isMain: image.isMain ?? index === 0,
                sortOrder: image.sortOrder ?? index,
              })),
            }
          : undefined,
        variants: dto.variants?.length
          ? {
              create: dto.variants.map((variant) => ({
                chrtId: BigInt(variant.chrtId),
                techSize: variant.techSize,
                wbSize: variant.wbSize,
                isActive: variant.isActive ?? true,
                basePrice: variant.basePrice ?? 0,
                discountPrice: variant.discountPrice,
                stockQuantity: variant.stockQuantity ?? 0,
                lowStockThreshold: variant.lowStockThreshold ?? 5,
                trackInventory: variant.trackInventory ?? true,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    const product = await this.findShopProductOrThrow(
      shopId,
      createdProduct.id,
    );
    const reviewWarnings = this.productReadiness.getProductWarnings(product);
    if (reviewWarnings.length > 0 || lifecycle.catalogStatus !== 'PUBLISHED') {
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          reviewWarningsJson: reviewWarnings,
          catalogStatus:
            lifecycle.catalogStatus === 'PUBLISHED' && reviewWarnings.length > 0
              ? 'DRAFT'
              : undefined,
          unpublishedAt:
            lifecycle.catalogStatus === 'PUBLISHED' && reviewWarnings.length > 0
              ? new Date()
              : undefined,
          publishedAt:
            lifecycle.catalogStatus === 'PUBLISHED' && reviewWarnings.length > 0
              ? null
              : undefined,
        },
      });
      return this.findOneByShop(shopId, product.id);
    }

    return this.mapProductDetail(product);
  }

  async update(shopId: string, productId: string, dto: UpdateProductDto) {
    const existingProduct = await this.findShopProductOrThrow(
      shopId,
      productId,
    );
    await this.ensureCategoryExists(dto.categoryId);

    if (dto.wbNmId !== undefined) {
      const existing = await this.prisma.product.findFirst({
        where: {
          shopId,
          wbNmId: BigInt(dto.wbNmId),
          NOT: { id: productId },
        },
        select: { id: true },
      });

      if (existing) {
        throw new BadRequestException(
          `Product with wbNmId ${dto.wbNmId} already exists in this shop.`,
        );
      }
    }

    const lifecycle = this.resolveManualLifecycleForUpdate(
      existingProduct.catalogStatus as ProductCatalogStatus,
      dto.visibility,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: {
          wbNmId: dto.wbNmId !== undefined ? BigInt(dto.wbNmId) : undefined,
          wbImtId: dto.wbImtId !== undefined ? BigInt(dto.wbImtId) : undefined,
          wbNmUuid: dto.wbNmUuid,
          brand: dto.brand,
          wbTitle: dto.wbTitle,
          wbDescription: dto.wbDescription,
          categoryId:
            dto.categoryId !== undefined ? BigInt(dto.categoryId) : undefined,
          categoryName: dto.categoryName,
          sourceCategoryName: dto.categoryName,
          sourceCategorySource:
            dto.categoryName !== undefined || dto.categoryId !== undefined
              ? 'MANUAL'
              : undefined,
          wbVendorCode: dto.wbVendorCode,
          wbVideoUrl: dto.wbVideoUrl,
          wbNeedKiz: dto.wbNeedKiz,
          subjectId:
            dto.subjectId !== undefined ? BigInt(dto.subjectId) : undefined,
          wholesaleEnabled: dto.wholesaleEnabled,
          wholesaleQuantum: dto.wholesaleQuantum,
          length: dto.length,
          width: dto.width,
          height: dto.height,
          weightBrutto: dto.weightBrutto,
          dimensionsValid: dto.dimensionsValid,
          localTitle: dto.localTitle,
          localDescription: dto.localDescription,
          seoSlug: dto.seoSlug,
          visibility: dto.visibility,
          catalogStatus: lifecycle.catalogStatus,
          publishedAt: lifecycle.publishedAt,
          unpublishedAt: lifecycle.unpublishedAt,
          archivedAt: lifecycle.archivedAt,
          localTags: dto.localTags,
        },
      });

      for (const variant of dto.variants ?? []) {
        const updated = await tx.productVariant.updateMany({
          where: {
            productId,
            chrtId: BigInt(variant.chrtId),
          },
          data: {
            isActive: variant.isActive,
            basePrice:
              variant.basePrice !== undefined
                ? new Prisma.Decimal(variant.basePrice)
                : undefined,
            discountPrice:
              variant.discountPrice !== undefined
                ? new Prisma.Decimal(variant.discountPrice)
                : undefined,
            stockQuantity: variant.stockQuantity,
            lowStockThreshold: variant.lowStockThreshold,
            trackInventory: variant.trackInventory,
          },
        });

        if (updated.count !== 1) {
          throw new BadRequestException(
            `Variant ${variant.chrtId} was not found in product ${productId}.`,
          );
        }
      }
    });

    const product = await this.findShopProductOrThrow(shopId, productId);
    await this.persistReviewWarnings(product);
    return this.findOneByShop(shopId, productId);
  }

  async getInventory(shopId: string, productId: string) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    return this.mapInventory(product);
  }

  async updateInventory(
    shopId: string,
    productId: string,
    dto: UpdateProductInventoryDto,
  ) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    const variants: ProductWithRelations['variants'] = product.variants.slice();
    variants.sort((left, right) => this.compareVariants(left, right));
    const targetVariant =
      (dto.variantId
        ? variants.find((variant) => variant.id === dto.variantId)
        : variants[0]) ?? null;

    if (!targetVariant) {
      throw new BadRequestException(
        `Product ${productId} does not have any variants to update inventory for.`,
      );
    }

    await this.prisma.productVariant.update({
      where: { id: targetVariant.id },
      data: {
        stockQuantity: dto.stockQuantity,
      },
    });

    const refreshedProduct = await this.findShopProductOrThrow(
      shopId,
      productId,
    );
    await this.persistReviewWarnings(refreshedProduct);
    return this.mapInventory(refreshedProduct);
  }

  async publish(shopId: string, productId: string) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    const readiness = this.productReadiness.getReadiness(product);
    if (!readiness.ready) {
      throw new BadRequestException({
        message: 'Product is not ready to publish.',
        blockingReasons: readiness.blockingReasons,
      });
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        catalogStatus: 'PUBLISHED',
        visibility: 'ACTIVE',
        publishedAt: new Date(),
        unpublishedAt: null,
        archivedAt: null,
        reviewWarningsJson: [],
      },
    });

    return this.findOneByShop(shopId, productId);
  }

  async unpublish(shopId: string, productId: string) {
    await this.findShopProductOrThrow(shopId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        catalogStatus: 'UNPUBLISHED',
        unpublishedAt: new Date(),
      },
    });
    return this.findOneByShop(shopId, productId);
  }

  async archive(shopId: string, productId: string) {
    await this.findShopProductOrThrow(shopId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        catalogStatus: 'ARCHIVED',
        visibility: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });
    return this.findOneByShop(shopId, productId);
  }

  async bulkAction(shopId: string, dto: BulkProductActionDto) {
    const results: Array<{
      productId: string;
      success: boolean;
      action: string;
      blockingReasons?: ProductReadinessReason[];
      error?: string;
    }> = [];

    for (const productId of dto.productIds) {
      try {
        if (dto.updates) {
          await this.applyBulkUpdates(shopId, productId, dto.updates);
        }

        if (dto.action === 'PUBLISH') {
          const product = await this.findShopProductOrThrow(shopId, productId);
          const readiness = this.productReadiness.getReadiness(product);
          if (!readiness.ready) {
            results.push({
              productId,
              success: false,
              action: dto.action,
              blockingReasons: readiness.blockingReasons,
            });
            continue;
          }
          await this.publish(shopId, productId);
        } else if (dto.action === 'UNPUBLISH') {
          await this.unpublish(shopId, productId);
        } else if (dto.action === 'ARCHIVE') {
          await this.archive(shopId, productId);
        }

        results.push({
          productId,
          success: true,
          action: dto.action,
        });
      } catch (error) {
        results.push({
          productId,
          success: false,
          action: dto.action,
          error: error instanceof Error ? error.message : 'Bulk action failed.',
        });
      }
    }

    return {
      action: dto.action,
      total: dto.productIds.length,
      successCount: results.filter((result) => result.success).length,
      failureCount: results.filter((result) => !result.success).length,
      results,
    };
  }

  async bulkUpdate(shopId: string, dto: BulkUpdateProductsDto) {
    await this.ensureShopExists(shopId);
    const category =
      dto.updates.categoryId !== undefined
        ? await this.requireCategory(dto.updates.categoryId)
        : null;
    const variantMode = dto.scope?.variantMode ?? 'ALL_VARIANTS';
    const items: Array<{
      productId: string;
      success: boolean;
      error: string | null;
      readiness: {
        ready: boolean;
        blockingReasons: ProductReadinessReason[];
        catalogStatus: ProductCatalogStatus;
      } | null;
    }> = [];

    for (const productId of dto.productIds) {
      try {
        const refreshed = await this.prisma.$transaction(async (tx) => {
          const product = await this.findShopProductOrThrowWithClient(
            tx,
            shopId,
            productId,
          );
          if (product.catalogStatus === 'ARCHIVED') {
            throw new BadRequestException(
              `Archived product ${productId} cannot be bulk edited.`,
            );
          }

          if (category) {
            await tx.product.update({
              where: { id: product.id },
              data: {
                categoryId: category.id,
                categoryName: category.name,
                sourceCategorySource: 'MANUAL',
              },
            });
          }

          const variants = product.variants
            .slice()
            .sort((left, right) => this.compareVariants(left, right));
          const targetVariants = this.resolveBulkUpdateVariants(
            variants,
            variantMode,
            dto.updates,
          );

          if (
            dto.updates.price !== undefined ||
            dto.updates.stockQuantity !== undefined ||
            dto.updates.trackInventory !== undefined
          ) {
            for (const variant of targetVariants) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: {
                  ...(dto.updates.price !== undefined
                    ? {
                        basePrice: new Prisma.Decimal(dto.updates.price),
                        discountPrice: new Prisma.Decimal(dto.updates.price),
                      }
                    : {}),
                  ...(dto.updates.stockQuantity !== undefined
                    ? {
                        stockQuantity: dto.updates.stockQuantity,
                      }
                    : {}),
                  ...(dto.updates.trackInventory !== undefined
                    ? {
                        trackInventory: dto.updates.trackInventory,
                      }
                    : {}),
                },
              });
            }
          }

          const updated = await this.findShopProductOrThrowWithClient(
            tx,
            shopId,
            productId,
          );
          const readiness = this.productReadiness.getReadiness(updated);
          if (dto.publishIfReady && readiness.ready) {
            await tx.product.update({
              where: { id: updated.id },
              data: {
                catalogStatus: 'PUBLISHED',
                visibility: 'ACTIVE',
                publishedAt: new Date(),
                unpublishedAt: null,
                archivedAt: null,
                reviewWarningsJson: [],
              },
            });
          } else {
            await this.persistReviewWarningsWithClient(tx, updated);
          }

          return this.findShopProductOrThrowWithClient(tx, shopId, productId);
        });

        const readiness = this.productReadiness.getReadiness(refreshed);
        items.push({
          productId,
          success: true,
          error: null,
          readiness: {
            ready: readiness.ready,
            blockingReasons: readiness.blockingReasons,
            catalogStatus: this.effectiveCatalogStatus(refreshed, readiness),
          },
        });
      } catch (error) {
        items.push({
          productId,
          success: false,
          error: error instanceof Error ? error.message : 'Bulk update failed.',
          readiness: null,
        });
      }
    }

    return {
      updated: items.filter((item) => item.success).length,
      failed: items.filter((item) => !item.success).length,
      items,
    };
  }

  async remove(shopId: string, productId: string) {
    await this.findShopProductOrThrow(shopId, productId);
    await this.prisma.product.delete({
      where: { id: productId },
    });
  }

  private async applyBulkUpdates(
    shopId: string,
    productId: string,
    updates: NonNullable<BulkProductActionDto['updates']>,
  ) {
    const payload: UpdateProductDto = {};
    if (updates.categoryId !== undefined) {
      payload.categoryId = updates.categoryId;
    }
    if (updates.categoryName !== undefined) {
      payload.categoryName = updates.categoryName;
    }
    if (updates.variants) {
      payload.variants = updates.variants.map((variant) => ({
        chrtId: variant.chrtId,
        basePrice: variant.basePrice,
        discountPrice: variant.discountPrice,
        stockQuantity: variant.stockQuantity,
      }));
    }

    if (Object.keys(payload).length > 0) {
      await this.update(shopId, productId, payload);
    }
  }

  private async ensureShopExists(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });

    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }
  }

  private async ensureUniqueWbNmId(shopId: string, wbNmId: number) {
    const existing = await this.prisma.product.findFirst({
      where: {
        shopId,
        wbNmId: BigInt(wbNmId),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Product with wbNmId ${wbNmId} already exists in this shop.`,
      );
    }
  }

  private async ensureCategoryExists(categoryId?: number) {
    if (categoryId === undefined) {
      return;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(categoryId) },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException(`Category ${categoryId} does not exist.`);
    }
  }

  private async requireCategory(categoryId: number) {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(categoryId) },
      select: { id: true, name: true },
    });

    if (!category) {
      throw new BadRequestException(`Category ${categoryId} does not exist.`);
    }

    return category;
  }

  private async findShopProductOrThrow(
    shopId: string,
    productId: string,
  ): Promise<ProductWithRelations> {
    const product = (await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      include: this.productInclude(),
    })) as ProductWithRelations | null;

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} was not found in shop ${shopId}.`,
      );
    }

    return product;
  }

  private async findShopProductOrThrowWithClient(
    client: Prisma.TransactionClient,
    shopId: string,
    productId: string,
  ): Promise<ProductWithRelations> {
    const product = (await client.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      include: this.productInclude(),
    })) as ProductWithRelations | null;

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} was not found in shop ${shopId}.`,
      );
    }

    return product;
  }

  private productInclude(): Prisma.ProductInclude {
    return {
      images: {
        orderBy: [
          { isMain: Prisma.SortOrder.desc },
          { sortOrder: Prisma.SortOrder.asc },
        ],
      },
      category: true,
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          sellerProfile: {
            select: {
              approvalStatus: true,
            },
          },
        },
      },
      variants: true,
    };
  }

  private buildSearchPredicates(search: string): Prisma.ProductWhereInput[] {
    const normalized = search.trim();
    const contains = {
      contains: normalized,
      mode: 'insensitive' as const,
    };

    const predicates: Prisma.ProductWhereInput[] = [
      { localTitle: contains },
      { wbTitle: contains },
      { brand: contains },
      { wbVendorCode: contains },
      { seoSlug: contains },
      {
        variants: {
          some: {
            sellerSku: contains,
          },
        },
      },
      {
        variants: {
          some: {
            wbBarcode: contains,
          },
        },
      },
    ];

    if (/^\d+$/.test(normalized)) {
      predicates.push({
        wbNmId: BigInt(normalized),
      });
    }

    return predicates;
  }

  private resolveVisibilityFilter(query: ListShopProductsQueryDto) {
    return query.status ?? query.visibility;
  }

  private resolveManualLifecycleForCreate(visibility?: string) {
    if (visibility === 'ARCHIVED') {
      return {
        catalogStatus: 'ARCHIVED' as ProductCatalogStatus,
        publishedAt: null,
        unpublishedAt: null,
        archivedAt: new Date(),
      };
    }

    if (visibility === 'ACTIVE' || visibility === undefined) {
      return {
        catalogStatus: 'PUBLISHED' as ProductCatalogStatus,
        publishedAt: new Date(),
        unpublishedAt: null,
        archivedAt: null,
      };
    }

    return {
      catalogStatus: 'DRAFT' as ProductCatalogStatus,
      publishedAt: null,
      unpublishedAt: null,
      archivedAt: null,
    };
  }

  private resolveManualLifecycleForUpdate(
    currentStatus: ProductCatalogStatus,
    visibility?: string,
  ) {
    if (visibility === undefined) {
      return {
        catalogStatus: currentStatus,
        publishedAt: undefined,
        unpublishedAt: undefined,
        archivedAt: undefined,
      };
    }

    if (visibility === 'ARCHIVED') {
      return {
        catalogStatus: 'ARCHIVED' as ProductCatalogStatus,
        publishedAt: undefined,
        unpublishedAt: undefined,
        archivedAt: new Date(),
      };
    }

    if (visibility === 'ACTIVE') {
      return {
        catalogStatus:
          currentStatus === 'UNPUBLISHED' ? currentStatus : currentStatus,
        publishedAt: currentStatus === 'PUBLISHED' ? undefined : undefined,
        unpublishedAt: currentStatus === 'UNPUBLISHED' ? undefined : null,
        archivedAt: null,
      };
    }

    if (currentStatus === 'PUBLISHED') {
      return {
        catalogStatus: 'UNPUBLISHED' as ProductCatalogStatus,
        publishedAt: undefined,
        unpublishedAt: new Date(),
        archivedAt: null,
      };
    }

    return {
      catalogStatus: currentStatus === 'IMPORTED' ? 'IMPORTED' : 'DRAFT',
      publishedAt: undefined,
      unpublishedAt: undefined,
      archivedAt: null,
    };
  }

  private async persistReviewWarnings(product: ProductWithRelations) {
    await this.persistReviewWarningsWithClient(this.prisma, product);
  }

  private async persistReviewWarningsWithClient(
    client: Pick<Prisma.TransactionClient, 'product'>,
    product: ProductWithRelations,
  ) {
    const readiness = this.productReadiness.getReadiness(product);
    const nextStatus = this.effectiveCatalogStatus(product, readiness);

    await client.product.update({
      where: { id: product.id },
      data: {
        catalogStatus: nextStatus,
        reviewWarningsJson: readiness.blockingReasons,
      },
    });
  }

  private effectiveCatalogStatus(
    product: Pick<
      ProductWithRelations,
      'catalogStatus' | 'archivedAt' | 'publishedAt' | 'unpublishedAt'
    >,
    readiness: ProductReadinessResult,
  ): ProductCatalogStatus {
    const currentStatus =
      (product.catalogStatus as ProductCatalogStatus | null) ?? 'DRAFT';

    if (currentStatus === 'ARCHIVED' || product.archivedAt) {
      return 'ARCHIVED';
    }

    if (currentStatus === 'PUBLISHED') {
      return 'PUBLISHED';
    }

    if (currentStatus === 'UNPUBLISHED') {
      return 'UNPUBLISHED';
    }

    if (currentStatus === 'IMPORTED' && !readiness.ready) {
      return 'IMPORTED';
    }

    return readiness.ready ? 'READY' : 'DRAFT';
  }

  private mapProductSummary(product: ProductWithRelations) {
    const mainImage = product.images[0];
    const inventory = this.getProductInventorySummary(product.variants);
    const readiness = this.productReadiness.getReadiness(product);
    const catalogStatus = this.effectiveCatalogStatus(product, readiness);
    const prices = this.getPriceSummary(product.variants);

    return {
      id: product.id,
      shopId: product.shopId,
      wbNmId: product.wbNmId.toString(),
      title: product.localTitle ?? product.wbTitle,
      wbTitle: product.wbTitle,
      localTitle: product.localTitle,
      brand: product.brand,
      visibility: product.visibility,
      catalogStatus,
      source: (product.source ?? 'MANUAL') as ProductSource,
      seoSlug: product.seoSlug,
      categoryName: product.category?.name ?? product.categoryName,
      categoryId: product.category?.id.toString() ?? null,
      categorySlug: product.category?.slug ?? null,
      sourceCategoryName: product.sourceCategoryName,
      sourceCategorySource: product.sourceCategorySource,
      wbVendorCode: product.wbVendorCode,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      archivedAt: product.archivedAt?.toISOString() ?? null,
      reviewWarnings: readiness.blockingReasons,
      readyToPublish: readiness.ready,
      mainImage: mainImage?.localUrl ?? mainImage?.wbUrl ?? null,
      inStock: inventory.inStock,
      stockQuantity: inventory.totalAvailableQuantity,
      lowStockThreshold: inventory.totalLowStockThreshold,
      trackInventory: inventory.trackInventory,
      stockStatus: inventory.stockStatus,
      variantCount: product.variants.length,
      primaryVariantId: product.variants[0]?.id ?? null,
      minPrice: prices.minPrice,
      maxPrice: prices.maxPrice,
    };
  }

  private mapProductDetail(product: ProductWithRelations) {
    const readiness = this.productReadiness.getReadiness(product);
    const catalogStatus = this.effectiveCatalogStatus(product, readiness);

    return {
      id: product.id,
      shopId: product.shopId,
      wbNmId: product.wbNmId.toString(),
      wbImtId: product.wbImtId?.toString() ?? null,
      wbTitle: product.wbTitle,
      localTitle: product.localTitle,
      title: product.localTitle ?? product.wbTitle,
      wbDescription: product.wbDescription,
      localDescription: product.localDescription,
      description: product.localDescription ?? product.wbDescription,
      brand: product.brand,
      visibility: product.visibility,
      catalogStatus,
      source: (product.source ?? 'MANUAL') as ProductSource,
      publishedAt: product.publishedAt?.toISOString() ?? null,
      unpublishedAt: product.unpublishedAt?.toISOString() ?? null,
      archivedAt: product.archivedAt?.toISOString() ?? null,
      seoSlug: product.seoSlug,
      wbVendorCode: product.wbVendorCode,
      categoryName: product.category?.name ?? product.categoryName,
      sourceCategoryName: product.sourceCategoryName,
      sourceCategorySource: product.sourceCategorySource,
      reviewWarnings: readiness.blockingReasons,
      category: product.category
        ? {
            id: Number(product.category.id),
            name: product.category.name,
          }
        : null,
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
      },
      images: product.images.map((image) => ({
        id: image.id,
        wbUrl: image.wbUrl,
        localUrl: image.localUrl,
        isMain: image.isMain ?? false,
        sortOrder: image.sortOrder,
      })),
      variants: product.variants.map((variant) => {
        const status = this.getVariantStockStatus(variant);

        return {
          id: variant.id,
          chrtId: variant.chrtId.toString(),
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          basePrice: variant.basePrice?.toString() ?? null,
          discountPrice: variant.discountPrice?.toString() ?? null,
          stockQuantity: variant.stockQuantity,
          reservedStock: variant.reservedStock,
          lowStockThreshold: variant.lowStockThreshold,
          trackInventory: variant.trackInventory,
          stockStatus: status,
          inStock: status !== 'OUT_OF_STOCK',
        };
      }),
    };
  }

  private mapInventory(product: ProductWithRelations) {
    const variants = product.variants
      .slice()
      .sort((left, right) => Number(left.chrtId - right.chrtId))
      .map((variant) => {
        const stockStatus = this.getVariantStockStatus(variant);
        const availableQuantity = Math.max(0, variant.stockQuantity);

        return {
          id: variant.id,
          chrtId: variant.chrtId.toString(),
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          stockQuantity: variant.stockQuantity,
          reservedStock: variant.reservedStock,
          lowStockThreshold: variant.lowStockThreshold,
          trackInventory: variant.trackInventory,
          stockStatus,
          availableQuantity,
          inStock: stockStatus !== 'OUT_OF_STOCK',
        };
      });

    const inventory = this.getProductInventorySummary(product.variants);

    return {
      productId: product.id,
      shopId: product.shopId,
      title: product.localTitle ?? product.wbTitle,
      totalStockQuantity: inventory.totalStockQuantity,
      totalReservedStock: inventory.totalReservedStock,
      totalLowStockThreshold: inventory.totalLowStockThreshold,
      trackInventory: inventory.trackInventory,
      stockStatus: inventory.stockStatus,
      totalAvailableQuantity: inventory.totalAvailableQuantity,
      inStock: inventory.inStock,
      variants,
    };
  }

  private getProductInventorySummary(
    variants: Array<{
      stockQuantity: number;
      reservedStock: number;
      lowStockThreshold?: number;
      trackInventory?: boolean;
    }>,
  ) {
    const trackedVariants = variants.filter(
      (variant) => variant.trackInventory !== false,
    );
    const hasTrackedVariants = trackedVariants.length > 0;
    const hasUntrackedVariants = variants.some(
      (variant) => variant.trackInventory === false,
    );
    const totalStockQuantity = trackedVariants.reduce(
      (sum, variant) => sum + Math.max(0, variant.stockQuantity),
      0,
    );
    const totalReservedStock = trackedVariants.reduce(
      (sum, variant) => sum + Math.max(0, variant.reservedStock),
      0,
    );
    const totalLowStockThreshold = trackedVariants.reduce(
      (sum, variant) => sum + Math.max(0, variant.lowStockThreshold ?? 5),
      0,
    );
    const totalAvailableQuantity = totalStockQuantity;

    let stockStatus: StockStatus;
    if (!hasTrackedVariants && hasUntrackedVariants) {
      stockStatus = 'NOT_TRACKED';
    } else if (hasUntrackedVariants) {
      stockStatus = 'IN_STOCK';
    } else if (totalAvailableQuantity <= 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (totalAvailableQuantity <= totalLowStockThreshold) {
      stockStatus = 'LOW_STOCK';
    } else {
      stockStatus = 'IN_STOCK';
    }

    return {
      totalStockQuantity,
      totalReservedStock,
      totalLowStockThreshold,
      totalAvailableQuantity,
      trackInventory: hasTrackedVariants,
      inStock: stockStatus !== 'OUT_OF_STOCK',
      stockStatus,
    };
  }

  private getVariantStockStatus(variant: {
    stockQuantity: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
  }): StockStatus {
    if (variant.trackInventory === false) {
      return 'NOT_TRACKED';
    }

    if (variant.stockQuantity <= 0) {
      return 'OUT_OF_STOCK';
    }

    if (variant.stockQuantity <= (variant.lowStockThreshold ?? 5)) {
      return 'LOW_STOCK';
    }

    return 'IN_STOCK';
  }

  private sortProducts(products: ProductWithRelations[], sort?: string) {
    const items = [...products];
    if (sort === 'updatedAt_asc') {
      return items.sort(
        (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
      );
    }
    if (sort === 'title_asc') {
      return items.sort((left, right) =>
        (left.localTitle ?? left.wbTitle).localeCompare(
          right.localTitle ?? right.wbTitle,
        ),
      );
    }
    if (sort === 'title_desc') {
      return items.sort((left, right) =>
        (right.localTitle ?? right.wbTitle).localeCompare(
          left.localTitle ?? left.wbTitle,
        ),
      );
    }
    return items.sort(
      (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
    );
  }

  private getPriceSummary(
    variants: Array<{
      basePrice: Prisma.Decimal | null;
      discountPrice: Prisma.Decimal | null;
    }>,
  ) {
    const prices = variants
      .map((variant) => this.resolveVariantPrice(variant))
      .filter((price): price is Prisma.Decimal => price !== null)
      .sort((left, right) => left.comparedTo(right));

    return {
      minPrice: prices[0]?.toString() ?? null,
      maxPrice: prices.at(-1)?.toString() ?? null,
    };
  }

  private resolveVariantPrice(variant: {
    basePrice: Prisma.Decimal | null;
    discountPrice: Prisma.Decimal | null;
  }) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveBulkUpdateVariants(
    variants: ProductWithRelations['variants'],
    variantMode: 'ALL_VARIANTS' | 'MISSING_ONLY' | 'FIRST_VARIANT_ONLY',
    updates: BulkUpdateProductsDto['updates'],
  ) {
    if (variantMode === 'FIRST_VARIANT_ONLY') {
      return variants[0] ? [variants[0]] : [];
    }

    if (variantMode === 'ALL_VARIANTS') {
      return variants;
    }

    const onlyTrackInventoryChange =
      updates.price === undefined && updates.stockQuantity === undefined;
    if (onlyTrackInventoryChange) {
      return variants;
    }

    return variants.filter((variant) => {
      let shouldUpdate = false;
      if (updates.price !== undefined) {
        shouldUpdate ||=
          (Number(this.resolveVariantPrice(variant)?.toString() ?? 0) || 0) <=
          0;
      }
      if (updates.stockQuantity !== undefined) {
        shouldUpdate ||=
          variant.trackInventory !== false && variant.stockQuantity <= 0;
      }
      return shouldUpdate;
    });
  }

  private compareVariants(
    left: {
      chrtId: bigint;
      createdAt?: Date;
    },
    right: {
      chrtId: bigint;
      createdAt?: Date;
    },
  ) {
    const leftCreatedAt = left.createdAt?.getTime() ?? null;
    const rightCreatedAt = right.createdAt?.getTime() ?? null;
    if (leftCreatedAt !== null && rightCreatedAt !== null) {
      return leftCreatedAt - rightCreatedAt;
    }

    return Number(left.chrtId - right.chrtId);
  }
}
