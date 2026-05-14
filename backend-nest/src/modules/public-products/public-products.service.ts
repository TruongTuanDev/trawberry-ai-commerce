import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListPublicProductsQueryDto } from './dto/list-public-products-query.dto';

type PublicProductRecord = {
  id: string;
  shopId: string;
  wbTitle: string;
  localTitle: string | null;
  wbDescription: string | null;
  localDescription: string | null;
  brand: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  visibility: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
};

@Injectable()
export class PublicProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPublicProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      visibility: 'ACTIVE',
      images: {
        some: {},
      },
      shop: {
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      variants: {
        some: {
          isActive: true,
          stockQuantity: {
            gt: 0,
          },
          OR: [
            {
              discountPrice: {
                gt: 0,
              },
            },
            {
              basePrice: {
                gt: 0,
              },
            },
          ],
        },
      },
      ...(query.search?.trim()
        ? {
            OR: [
              {
                localTitle: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                wbTitle: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                brand: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          images: {
            orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            where: {
              isActive: true,
              stockQuantity: {
                gt: 0,
              },
              OR: [
                {
                  discountPrice: {
                    gt: 0,
                  },
                },
                {
                  basePrice: {
                    gt: 0,
                  },
                },
              ],
            },
            orderBy: { createdAt: 'asc' },
          },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapProduct(item)),
      meta: {
        page: query.page,
        size: query.size,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.size),
      },
    };
  }

  async findOne(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        visibility: 'ACTIVE',
        images: {
          some: {},
        },
        shop: {
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        variants: {
          some: {
            isActive: true,
            stockQuantity: {
              gt: 0,
            },
            OR: [
              {
                discountPrice: {
                  gt: 0,
                },
              },
              {
                basePrice: {
                  gt: 0,
                },
              },
            ],
          },
        },
      },
      include: {
        images: {
          orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          where: {
            isActive: true,
            stockQuantity: {
              gt: 0,
            },
            OR: [
              {
                discountPrice: {
                  gt: 0,
                },
              },
              {
                basePrice: {
                  gt: 0,
                },
              },
            ],
          },
          orderBy: { createdAt: 'asc' },
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Public product ${productId} was not found.`);
    }

    return this.mapProduct(product);
  }

  private mapProduct(product: PublicProductRecord) {
    const price = this.resolvePrice(product.variants);
    const availableQuantity = this.resolveAvailableQuantity(product.variants);

    return {
      id: product.id,
      shopId: product.shopId,
      name: product.localTitle ?? product.wbTitle,
      description: product.localDescription ?? product.wbDescription,
      brand: product.brand,
      seoSlug: product.seoSlug,
      categoryName: product.categoryName,
      price: price?.toString() ?? null,
      inStock: availableQuantity > 0,
      availableQuantity,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.localUrl ?? image.wbUrl,
        isMain: image.isMain ?? false,
      })),
      shop: product.shop,
    };
  }

  private resolvePrice(variants: ProductVariant[]) {
    const pricedVariants = variants
      .map((variant) => variant.discountPrice ?? variant.basePrice)
      .filter((value): value is Prisma.Decimal => value !== null);

    return pricedVariants[0] ?? null;
  }

  private resolveAvailableQuantity(variants: ProductVariant[]) {
    return variants.reduce(
      (sum, variant) => sum + Math.max(0, variant.stockQuantity),
      0,
    );
  }
}
