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

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.size,
        take: query.size,
        include: {
          images: {
            orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
          },
          category: true,
          variants: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

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
    variants: Array<{ stockQuantity: number; reservedStock: number }>;
  }) {
    const mainImage = product.images[0];
    const availableQuantity = product.variants.reduce(
      (sum, variant) => sum + Math.max(0, variant.stockQuantity),
      0,
    );

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
      inStock: availableQuantity > 0,
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
      variants: product.variants.map((variant) => ({
        id: variant.id,
        chrtId: variant.chrtId.toString(),
        techSize: variant.techSize,
        wbSize: variant.wbSize,
        basePrice: variant.basePrice?.toString() ?? null,
        discountPrice: variant.discountPrice?.toString() ?? null,
        stockQuantity: variant.stockQuantity,
        reservedStock: variant.reservedStock,
        inStock: variant.stockQuantity > 0,
      })),
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
    }>;
  }) {
    const variants = product.variants
      .slice()
      .sort((left, right) => Number(left.chrtId - right.chrtId))
      .map((variant) => {
        const availableQuantity = Math.max(0, variant.stockQuantity);

        return {
          id: variant.id,
          chrtId: variant.chrtId.toString(),
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          stockQuantity: variant.stockQuantity,
          reservedStock: variant.reservedStock,
          availableQuantity,
          inStock: availableQuantity > 0,
        };
      });

    return {
      productId: product.id,
      shopId: product.shopId,
      title: product.localTitle ?? product.wbTitle,
      totalStockQuantity: variants.reduce(
        (sum, variant) => sum + variant.stockQuantity,
        0,
      ),
      totalReservedStock: variants.reduce(
        (sum, variant) => sum + variant.reservedStock,
        0,
      ),
      totalAvailableQuantity: variants.reduce(
        (sum, variant) => sum + variant.availableQuantity,
        0,
      ),
      inStock: variants.some((variant) => variant.inStock),
      variants,
    };
  }
}
