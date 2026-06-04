import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ProductImage, type ProductVariant } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductReadinessService } from '../products/product-readiness.service';

type PublicShopProductRecord = {
  catalogStatus: string;
  visibility: string | null;
  wbTitle: string;
  localTitle: string | null;
  categoryId: bigint | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number | null;
  images: ProductImage[];
  variants: ProductVariant[];
  shop: {
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
};

@Injectable()
export class PublicShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
  ) {}

  async findBySlug(slug: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        sellerProfile: {
          select: {
            approvalStatus: true,
            approvedAt: true,
            user: {
              select: {
                createdAt: true,
              },
            },
          },
        },
        deliverySettings: {
          select: {
            pickupCity: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Public shop ${slug} was not found.`);
    }

    const products = await this.prisma.product.findMany({
      where: {
        visibility: 'ACTIVE',
        shopId: shop.id,
        images: {
          some: {},
        },
        variants: {
          some: {
            isActive: true,
            OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
          },
        },
      },
      select: {
        catalogStatus: true,
        visibility: true,
        wbTitle: true,
        localTitle: true,
        categoryId: true,
        categoryName: true,
        sourceCategoryName: true,
        averageRating: true,
        feedbackCount: true,
        images: true,
        variants: true,
        shop: {
          select: {
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

    const visibleProducts = products.filter(
      (product) => this.productReadiness.getReadiness(product).ready,
    );

    const ratingSummary = this.computeRatingSummary(visibleProducts);

    return {
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        displayName: shop.name,
        description: null,
        logoUrl: shop.logoUrl,
        bannerUrl: null,
        isVerified: shop.sellerProfile.approvalStatus === 'APPROVED',
        approvedAt: shop.sellerProfile.approvedAt?.toISOString() ?? null,
        productCount: visibleProducts.length,
        ratingAverage: ratingSummary.average,
        ratingCount: ratingSummary.count,
        joinedAt: shop.sellerProfile.user.createdAt.toISOString(),
        locationLabel: shop.deliverySettings?.pickupCity ?? null,
      },
    };
  }

  private computeRatingSummary(products: PublicShopProductRecord[]) {
    let count = 0;
    let weightedTotal = 0;

    for (const product of products) {
      const feedbackCount = product.feedbackCount ?? 0;
      const averageRating = product.averageRating;
      if (!averageRating || feedbackCount <= 0) {
        continue;
      }
      count += feedbackCount;
      weightedTotal += Number(averageRating) * feedbackCount;
    }

    if (count === 0) {
      return {
        average: null,
        count: 0,
      };
    }

    return {
      average: (weightedTotal / count).toFixed(1),
      count,
    };
  }
}
