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
  color: string | null;
  gender: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  visibility: string | null;
  updatedAt: Date;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  category: {
    id: bigint;
    name: string;
    slug: string | null;
  } | null;
};

type FacetProductRecord = Pick<
  PublicProductRecord,
  'brand' | 'color' | 'gender' | 'categoryName' | 'category' | 'variants'
>;

@Injectable()
export class PublicProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPublicProductsQueryDto) {
    const search = (query.q ?? query.search)?.trim();
    const priceRange = this.resolvePriceRange(query);
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
          ...(query.inStock === true
            ? {
                stockQuantity: {
                  gt: 0,
                },
              }
            : {}),
          ...priceRange,
        },
      },
      ...(query.inStock === false
        ? {
            variants: {
              none: {
                isActive: true,
                stockQuantity: {
                  gt: 0,
                },
              },
            },
          }
        : {}),
      ...(query.categoryId
        ? { categoryId: BigInt(query.categoryId) }
        : query.categorySlug
          ? { category: { slug: query.categorySlug, isActive: true } }
          : {}),
      ...(query.brand?.trim()
        ? { brand: { contains: query.brand.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.color?.trim()
        ? { color: { contains: query.color.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.gender?.trim()
        ? { gender: { contains: query.gender.trim(), mode: 'insensitive' } }
        : {}),
      ...(search
        ? {
            OR: [
              {
                localTitle: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                wbTitle: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                brand: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                categoryName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                sourceCategoryName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                wbVendorCode: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                sellerSku: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                wbDescription: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                localDescription: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                color: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                gender: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [products, total, facetProducts] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          images: {
            orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            where: {
              isActive: true,
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
          category: true,
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where: {
          visibility: 'ACTIVE',
          images: { some: {} },
          shop: {
            status: 'ACTIVE',
            sellerProfile: { approvalStatus: 'APPROVED' },
          },
          variants: {
            some: {
              isActive: true,
              OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
            },
          },
        },
        include: { category: true, variants: true },
        take: 500,
      }),
    ]);

    const sorted = this.sortProducts(products, query.sort ?? 'newest');
    const items = sorted.slice(
      (query.page - 1) * query.size,
      (query.page - 1) * query.size + query.size,
    );

    return {
      items: items.map((item) => this.mapProduct(item)),
      meta: {
        page: query.page,
        size: query.size,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.size),
      },
      filters: this.buildFacets(facetProducts),
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
        category: true,
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
      color: product.color,
      gender: product.gender,
      seoSlug: product.seoSlug,
      categoryId: product.category?.id.toString() ?? null,
      categorySlug: product.category?.slug ?? null,
      categoryName: product.category?.name ?? product.categoryName,
      sourceCategoryName: product.sourceCategoryName,
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

    return pricedVariants.sort((a, b) => a.comparedTo(b))[0] ?? null;
  }

  private resolveAvailableQuantity(variants: ProductVariant[]) {
    return variants.reduce(
      (sum, variant) => sum + Math.max(0, variant.stockQuantity),
      0,
    );
  }

  private resolvePriceRange(query: ListPublicProductsQueryDto) {
    const range: Prisma.DecimalFilter = {};
    if (query.minPrice !== undefined) range.gte = query.minPrice;
    if (query.maxPrice !== undefined) range.lte = query.maxPrice;
    if (Object.keys(range).length === 0) return {};
    return {
      OR: [{ discountPrice: range }, { basePrice: range }],
    };
  }

  private sortProducts(products: PublicProductRecord[], sort: string) {
    return [...products].sort((a, b) => {
      if (sort === 'name_asc') {
        return (a.localTitle ?? a.wbTitle).localeCompare(
          b.localTitle ?? b.wbTitle,
        );
      }
      if (sort === 'stock_desc') {
        return (
          this.resolveAvailableQuantity(b.variants) -
          this.resolveAvailableQuantity(a.variants)
        );
      }
      if (sort === 'price_asc' || sort === 'price_desc') {
        const left = this.resolvePrice(a.variants) ?? new Prisma.Decimal(0);
        const right = this.resolvePrice(b.variants) ?? new Prisma.Decimal(0);
        return sort === 'price_asc'
          ? left.comparedTo(right)
          : right.comparedTo(left);
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  private buildFacets(products: FacetProductRecord[]) {
    const categories = new Map<
      string,
      { id: string; name: string; slug: string | null; count: number }
    >();
    const brands = new Map<string, number>();
    const colors = new Map<string, number>();
    const genders = new Map<string, number>();
    let priceMin: Prisma.Decimal | null = null;
    let priceMax: Prisma.Decimal | null = null;

    for (const product of products) {
      const categoryName = product.category?.name ?? product.categoryName;
      const categoryId =
        product.category?.id.toString() ?? product.categoryName ?? null;
      if (categoryName && categoryId) {
        const existing = categories.get(categoryId);
        categories.set(categoryId, {
          id: product.category?.id.toString() ?? '',
          name: categoryName,
          slug: product.category?.slug ?? null,
          count: (existing?.count ?? 0) + 1,
        });
      }
      if (product.brand)
        brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1);
      if (product.color)
        colors.set(product.color, (colors.get(product.color) ?? 0) + 1);
      if (product.gender)
        genders.set(product.gender, (genders.get(product.gender) ?? 0) + 1);
      const price = this.resolvePrice(product.variants);
      if (price) {
        priceMin = priceMin && priceMin.lessThan(price) ? priceMin : price;
        priceMax = priceMax && priceMax.greaterThan(price) ? priceMax : price;
      }
    }

    const toFacet = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));

    return {
      categories: [...categories.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      brands: toFacet(brands),
      colors: toFacet(colors),
      genders: toFacet(genders),
      priceMin: priceMin?.toString() ?? null,
      priceMax: priceMax?.toString() ?? null,
    };
  }
}
