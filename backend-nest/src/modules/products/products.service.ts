import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListShopProductsQueryDto } from './dto/list-shop-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductInventoryDto } from './dto/update-product-inventory.dto';

type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByShop(shopId: string, query: ListShopProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      shopId,
      ...(query.search
        ? {
            OR: this.buildSearchPredicates(query.search),
          }
        : {}),
      ...(this.resolveVisibilityFilter(query)
        ? {
            visibility: this.resolveVisibilityFilter(query),
          }
        : {}),
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

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        category: true,
        variants: true,
      },
    });

    const filteredItems = query.stockStatus
      ? products.filter(
          (product) =>
            this.getProductInventorySummary(product.variants).stockStatus ===
            query.stockStatus,
        )
      : products;

    const total = filteredItems.length;
    const items = filteredItems.slice(
      (query.page - 1) * query.size,
      (query.page - 1) * query.size + query.size,
    );

    return {
      items: items.map((product) => this.mapProductSummary(product)),
      meta: {
        page: query.page,
        size: query.size,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.size),
      },
    };
  }

  async findOneByShop(shopId: string, productId: string) {
    const product = await this.findShopProductOrThrow(shopId, productId);
    return this.mapProductDetail(product);
  }

  async create(shopId: string, dto: CreateProductDto) {
    await this.ensureShopExists(shopId);
    await this.ensureUniqueWbNmId(shopId, dto.wbNmId);
    await this.ensureCategoryExists(dto.categoryId);

    const product = await this.prisma.product.create({
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
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        category: true,
        variants: true,
        shop: true,
      },
    });

    return this.mapProductDetail(product);
  }

  async update(shopId: string, productId: string, dto: UpdateProductDto) {
    await this.findShopProductOrThrow(shopId, productId);
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

    const product = await this.prisma.product.update({
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
        localTags: dto.localTags,
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        category: true,
        variants: true,
        shop: true,
      },
    });

    return this.mapProductDetail(product);
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
    const variants = [...product.variants].sort(
      (left, right) => Number(left.createdAt) - Number(right.createdAt),
    );
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
    return this.mapInventory(refreshedProduct);
  }

  async remove(shopId: string, productId: string) {
    await this.findShopProductOrThrow(shopId, productId);
    await this.prisma.product.delete({
      where: { id: productId },
    });
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

  private async findShopProductOrThrow(shopId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        category: true,
        shop: true,
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} was not found in shop ${shopId}.`,
      );
    }

    return product;
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

  private mapProductSummary(product: {
    id: string;
    shopId: string;
    wbNmId: bigint;
    wbTitle: string;
    localTitle: string | null;
    brand: string | null;
    visibility: string | null;
    seoSlug: string | null;
    categoryName: string | null;
    wbVendorCode: string | null;
    images: Array<{ wbUrl: string; localUrl: string | null }>;
    category: { name: string } | null;
    variants: Array<{
      id: string;
      stockQuantity: number;
      reservedStock: number;
      lowStockThreshold: number;
      trackInventory: boolean;
    }>;
  }) {
    const mainImage = product.images[0];
    const inventory = this.getProductInventorySummary(product.variants);

    return {
      id: product.id,
      shopId: product.shopId,
      wbNmId: product.wbNmId.toString(),
      title: product.localTitle ?? product.wbTitle,
      wbTitle: product.wbTitle,
      localTitle: product.localTitle,
      brand: product.brand,
      visibility: product.visibility,
      seoSlug: product.seoSlug,
      categoryName: product.category?.name ?? product.categoryName,
      wbVendorCode: product.wbVendorCode,
      mainImage: mainImage?.localUrl ?? mainImage?.wbUrl ?? null,
      inStock: inventory.inStock,
      stockQuantity: inventory.totalAvailableQuantity,
      lowStockThreshold: inventory.totalLowStockThreshold,
      trackInventory: inventory.trackInventory,
      stockStatus: inventory.stockStatus,
      variantCount: product.variants.length,
      primaryVariantId: product.variants[0]?.id ?? null,
    };
  }

  private mapProductDetail(product: {
    id: string;
    shopId: string;
    wbNmId: bigint;
    wbImtId: bigint | null;
    wbTitle: string;
    localTitle: string | null;
    wbDescription: string | null;
    localDescription: string | null;
    brand: string | null;
    visibility: string | null;
    seoSlug: string | null;
    wbVendorCode: string | null;
    categoryName: string | null;
    category: { id: bigint; name: string } | null;
    shop: { id: string; name: string; slug: string };
    images: Array<{
      id: string;
      wbUrl: string;
      localUrl: string | null;
      isMain: boolean | null;
      sortOrder: number;
    }>;
    variants: Array<{
      id: string;
      chrtId: bigint;
      techSize: string | null;
      wbSize: string | null;
      basePrice: Prisma.Decimal | null;
      discountPrice: Prisma.Decimal | null;
      stockQuantity: number;
      reservedStock: number;
      lowStockThreshold: number;
      trackInventory: boolean;
    }>;
  }) {
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
      seoSlug: product.seoSlug,
      wbVendorCode: product.wbVendorCode,
      categoryName: product.category?.name ?? product.categoryName,
      category: product.category
        ? {
            id: Number(product.category.id),
            name: product.category.name,
          }
        : null,
      shop: product.shop,
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

  private mapInventory(product: {
    id: string;
    shopId: string;
    wbTitle: string;
    localTitle: string | null;
    variants: Array<{
      id: string;
      chrtId: bigint;
      techSize: string | null;
      wbSize: string | null;
      stockQuantity: number;
      reservedStock: number;
      lowStockThreshold: number;
      trackInventory: boolean;
    }>;
  }) {
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
}
