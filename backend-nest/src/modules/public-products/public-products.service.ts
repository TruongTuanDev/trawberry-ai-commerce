import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductReadinessService } from '../products/product-readiness.service';
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
  composition: string | null;
  sellerSku: string | null;
  seoSlug: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  aiTryOnEnabled: boolean;
  visibility: string | null;
  catalogStatus: string;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number | null;
  categoryId: bigint | null;
  subjectId: bigint | null;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
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

type PublicCategoryFacet = {
  id: string;
  name: string;
  slug: string | null;
  count: number;
};

type SearchMatch = {
  id: string;
  score: number;
};

@Injectable()
export class PublicProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async list(query: ListPublicProductsQueryDto) {
    const search = (query.q ?? query.search)?.trim();
    const searchMatches = search
      ? await this.findFullTextSearchMatches(search)
      : null;
    const searchRankById = new Map(
      (searchMatches ?? []).map((match) => [match.id, Number(match.score)]),
    );
    const priceRange = this.resolvePriceRange(query);
    const where: Prisma.ProductWhereInput = {
      visibility: 'ACTIVE',
      catalogStatus: 'PUBLISHED',
      images: {
        some: {},
      },
      shop: {
        status: 'ACTIVE',
        ...(query.shopSlug
          ? {
              slug: query.shopSlug,
            }
          : {}),
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
      ...(query.categoryId ? { categoryId: BigInt(query.categoryId) } : {}),
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
        ? searchMatches
          ? { id: { in: searchMatches.map((match) => match.id) } }
          : { OR: this.buildFallbackSearchPredicates(search) }
        : {}),
    };

    const facetWhere: Prisma.ProductWhereInput = {
      ...where,
    };
    if (query.categoryId) {
      delete facetWhere.categoryId;
    }

    const [products, facetProducts] = await Promise.all([
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
              paymentInstructions: true,
              status: true,
              sellerProfile: {
                select: {
                  approvalStatus: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.product.findMany({
        where: facetWhere,
        include: { category: true, variants: true },
        take: 500,
      }),
    ]);

    const readinessVisibleProducts = products.filter(
      (product) => this.productReadiness.getReadiness(product).ready,
    );
    const visibleProducts = this.sortProducts(
      query.categorySlug
        ? readinessVisibleProducts.filter((product) =>
            this.matchesCategoryFilter(product, query.categorySlug!),
          )
        : readinessVisibleProducts,
      query.sort ?? (search ? 'relevance' : 'newest'),
      searchRankById,
    );
    const visibleFacetProducts = facetProducts.filter(
      (product) => this.productReadiness.getReadiness(product).ready,
    );
    const items = visibleProducts.slice(
      (query.page - 1) * query.size,
      (query.page - 1) * query.size + query.size,
    );

    return {
      items: items.map((item) => this.mapProduct(item)),
      meta: {
        page: query.page,
        size: query.size,
        total: visibleProducts.length,
        totalPages:
          visibleProducts.length === 0
            ? 0
            : Math.ceil(visibleProducts.length / query.size),
      },
      filters: this.buildFacets(visibleFacetProducts),
    };
  }

  async findOne(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        visibility: 'ACTIVE',
        catalogStatus: 'PUBLISHED',
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
            paymentInstructions: true,
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
      composition: product.composition,
      sellerSku: product.sellerSku,
      seoSlug: product.seoSlug,
      categoryId: product.category?.id.toString() ?? null,
      categorySlug: product.category?.slug ?? null,
      categoryName: product.category?.name ?? product.categoryName,
      sourceCategoryName: product.sourceCategoryName,
      price: price?.toString() ?? null,
      oldPrice: this.resolveOriginalPrice(product.variants)?.toString() ?? null,
      inStock: availableQuantity > 0,
      availableQuantity,
      averageRating: product.averageRating?.toString() ?? null,
      feedbackCount: product.feedbackCount ?? 0,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.localUrl ?? image.wbUrl,
        isMain: image.isMain ?? false,
      })),
      variants: product.variants.map((variant) => {
        const variantPrice = this.resolveVariantPrice(variant);
        const variantAvailableQuantity =
          this.resolveVariantAvailableQuantity(variant);
        return {
          id: variant.id,
          sizeName: variant.sizeName,
          russianSize: variant.russianSize,
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          sellerSku: variant.sellerSku,
          price: variantPrice?.toString() ?? null,
          originalPrice:
            (variant.basePrice ?? variant.discountPrice)?.toString() ?? null,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          trackInventory: variant.trackInventory,
          inStock: !variant.trackInventory || variantAvailableQuantity > 0,
          availableQuantity: variantAvailableQuantity,
        };
      }),
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
        logoUrl: product.shop.logoUrl,
        paymentInstructions: product.shop.paymentInstructions,
      },
      aiTryOn: {
        enabled: product.aiTryOnEnabled,
      },
    };
  }

  private resolveVariantPrice(variant: ProductVariant) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveVariantAvailableQuantity(variant: ProductVariant) {
    return variant.trackInventory ? Math.max(0, variant.stockQuantity) : 999999;
  }

  private resolvePrice(variants: ProductVariant[]) {
    const pricedVariants = variants
      .map((variant) => this.resolveVariantPrice(variant))
      .filter((value): value is Prisma.Decimal => value !== null);

    return pricedVariants.sort((a, b) => a.comparedTo(b))[0] ?? null;
  }

  private resolveOriginalPrice(variants: ProductVariant[]) {
    const prices = variants
      .map((variant) => variant.basePrice ?? variant.discountPrice)
      .filter((value): value is Prisma.Decimal => value !== null);

    return prices.sort((a, b) => a.comparedTo(b))[0] ?? null;
  }

  private resolveAvailableQuantity(variants: ProductVariant[]) {
    return variants.reduce(
      (sum, variant) => sum + this.resolveVariantAvailableQuantity(variant),
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

  private sortProducts(
    products: PublicProductRecord[],
    sort: string,
    searchRankById: Map<string, number> = new Map(),
  ) {
    return [...products].sort((a, b) => {
      if (sort === 'relevance' && searchRankById.size > 0) {
        const scoreDifference =
          (searchRankById.get(b.id) ?? 0) - (searchRankById.get(a.id) ?? 0);
        if (scoreDifference !== 0) return scoreDifference;
      }
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
      const leftFreshness = (
        b.publishedAt ??
        b.createdAt ??
        b.updatedAt
      ).getTime();
      const rightFreshness = (
        a.publishedAt ??
        a.createdAt ??
        a.updatedAt
      ).getTime();
      return leftFreshness - rightFreshness;
    });
  }

  private async findFullTextSearchMatches(
    search: string,
  ): Promise<SearchMatch[] | null> {
    try {
      return await this.prisma.$queryRaw<SearchMatch[]>(Prisma.sql`
        WITH search_input AS (
          SELECT
            websearch_to_tsquery('simple', ${search}) AS query,
            lower(${search}) AS term
        )
        SELECT
          p.id,
          (
            ts_rank_cd(
              setweight(to_tsvector('simple', coalesce(p.local_title, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.wb_title, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.brand, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.category_name, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.source_category_name, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.wb_vendor_code, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.seller_sku, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.color, '')), 'C') ||
              setweight(to_tsvector('simple', coalesce(p.gender, '')), 'C') ||
              setweight(to_tsvector('simple', coalesce(p.local_description, '')), 'D') ||
              setweight(to_tsvector('simple', coalesce(p.wb_description, '')), 'D'),
              search_input.query
            ) * 10 +
            greatest(
              similarity(lower(coalesce(p.local_title, '')), search_input.term) * 6,
              similarity(lower(coalesce(p.wb_title, '')), search_input.term) * 6,
              similarity(lower(coalesce(p.brand, '')), search_input.term) * 3,
              similarity(lower(coalesce(p.category_name, '')), search_input.term) * 3,
              similarity(lower(coalesce(p.source_category_name, '')), search_input.term) * 3,
              similarity(lower(coalesce(p.wb_vendor_code, '')), search_input.term) * 7,
              similarity(lower(coalesce(p.seller_sku, '')), search_input.term) * 7
            ) +
            CASE
              WHEN lower(coalesce(p.local_title, p.wb_title)) = search_input.term THEN 20
              WHEN lower(coalesce(p.local_title, p.wb_title)) LIKE search_input.term || '%' THEN 8
              ELSE 0
            END
          )::double precision AS score
        FROM products p
        CROSS JOIN search_input
        WHERE p.visibility = 'ACTIVE'
          AND p.catalog_status = 'PUBLISHED'
          AND (
            (
              setweight(to_tsvector('simple', coalesce(p.local_title, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.wb_title, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.brand, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.category_name, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.source_category_name, '')), 'B') ||
              setweight(to_tsvector('simple', coalesce(p.wb_vendor_code, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.seller_sku, '')), 'A') ||
              setweight(to_tsvector('simple', coalesce(p.color, '')), 'C') ||
              setweight(to_tsvector('simple', coalesce(p.gender, '')), 'C') ||
              setweight(to_tsvector('simple', coalesce(p.local_description, '')), 'D') ||
              setweight(to_tsvector('simple', coalesce(p.wb_description, '')), 'D')
            ) @@ search_input.query
            OR lower(coalesce(p.local_title, '')) % search_input.term
            OR lower(coalesce(p.wb_title, '')) % search_input.term
            OR lower(coalesce(p.brand, '')) % search_input.term
            OR lower(coalesce(p.category_name, '')) % search_input.term
            OR lower(coalesce(p.source_category_name, '')) % search_input.term
            OR lower(coalesce(p.wb_vendor_code, '')) % search_input.term
            OR lower(coalesce(p.seller_sku, '')) % search_input.term
          )
        ORDER BY score DESC, p.published_at DESC NULLS LAST, p.created_at DESC
        LIMIT 2000
      `);
    } catch {
      return null;
    }
  }

  private buildFallbackSearchPredicates(
    search: string,
  ): Prisma.ProductWhereInput[] {
    const contains = { contains: search, mode: Prisma.QueryMode.insensitive };
    return [
      { localTitle: contains },
      { wbTitle: contains },
      { brand: contains },
      { categoryName: contains },
      { category: { name: contains } },
      { sourceCategoryName: contains },
      { wbVendorCode: contains },
      { sellerSku: contains },
      { wbDescription: contains },
      { localDescription: contains },
      { color: contains },
      { gender: contains },
    ];
  }

  private buildFacets(products: FacetProductRecord[]) {
    const categories = new Map<string, PublicCategoryFacet>();
    const brands = new Map<string, number>();
    const colors = new Map<string, number>();
    const genders = new Map<string, number>();
    let priceMin: Prisma.Decimal | null = null;
    let priceMax: Prisma.Decimal | null = null;

    for (const product of products) {
      const categoryName = this.normalizeCategoryName(
        product.category?.name ?? product.categoryName,
      );
      if (categoryName) {
        const categoryKey = product.category?.id.toString() ?? categoryName;
        const existing = categories.get(categoryKey);
        categories.set(categoryKey, {
          id: product.category?.id.toString() ?? categoryName,
          name: categoryName,
          slug: product.category?.slug ?? categoryName,
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

  private matchesCategoryFilter(
    product: Pick<PublicProductRecord, 'category' | 'categoryName'>,
    categoryFilter: string,
  ) {
    const normalizedCategoryName = this.normalizeCategoryName(
      product.category?.name ?? product.categoryName,
    );
    const normalizedFilter = this.normalizeCategoryName(categoryFilter);

    return Boolean(
      normalizedCategoryName &&
      normalizedFilter &&
      (product.category?.id.toString() === categoryFilter ||
        normalizedCategoryName.localeCompare(normalizedFilter, undefined, {
          sensitivity: 'accent',
        }) === 0 ||
        this.normalizeCategoryName(product.category?.slug) ===
          normalizedFilter),
    );
  }

  private normalizeCategoryName(value: string | null | undefined) {
    const normalized = value?.normalize('NFKC').trim();
    return normalized ? normalized : null;
  }
}
