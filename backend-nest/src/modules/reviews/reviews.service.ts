import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type ProductReview,
  type ProductReviewImage,
} from '@prisma/client';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { FilesService } from '../files/files.service';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { ProductReadinessService } from '../products/product-readiness.service';
import { CreateCustomerReviewDto } from './dto/create-customer-review.dto';
import { ListPublicReviewsQueryDto } from './dto/list-public-reviews-query.dto';
import { ListShopReviewsQueryDto } from './dto/list-shop-reviews-query.dto';
import { UpdateCustomerReviewDto } from './dto/update-customer-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productReadiness: ProductReadinessService,
    private readonly filesService: FilesService,
  ) {}

  async listCustomerReviews(user: AuthenticatedUser) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');

    const items = await this.prisma.productReview.findMany({
      where: { customerId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: this.reviewInclude,
    });

    return { items: items.map((item) => this.mapReview(item)) };
  }

  async createCustomerReview(
    user: AuthenticatedUser,
    dto: CreateCustomerReviewDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    this.assertRating(dto.rating);
    this.assertComment(dto.comment);

    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        id: dto.orderItemId,
        orderId: dto.orderId,
      },
      include: {
        order: {
          include: {
            shop: {
              include: {
                sellerProfile: true,
              },
            },
            deliveryShipments: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                internalStatus: true,
              },
            },
          },
        },
        product: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException({
        code: 'REVIEW_PRODUCT_NOT_IN_ORDER',
        message: 'Order item was not found for this review.',
      });
    }

    if (orderItem.order.customerId !== user.userId) {
      throw new ForbiddenException({
        code: 'REVIEW_NOT_VERIFIED_PURCHASE',
        message: 'Only the purchasing customer can review this order item.',
      });
    }

    if (dto.productId && orderItem.productId !== dto.productId) {
      throw new BadRequestException({
        code: 'REVIEW_PRODUCT_NOT_IN_ORDER',
        message:
          'The selected product does not match the purchased order item.',
      });
    }

    const latestDeliveryStatus =
      orderItem.order.deliveryShipments?.[0]?.internalStatus ?? null;

    if (
      orderItem.order.status !== 'DELIVERED' &&
      latestDeliveryStatus !== 'DELIVERED' &&
      !orderItem.order.customerCompletedAt
    ) {
      throw new BadRequestException({
        code: 'REVIEW_ORDER_NOT_COMPLETED',
        message: 'Only delivered or completed orders can be reviewed.',
      });
    }

    const existing = await this.prisma.productReview.findFirst({
      where: {
        orderItemId: dto.orderItemId,
        customerId: user.userId,
      },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'REVIEW_ALREADY_EXISTS',
        message: 'A review for this purchased item already exists.',
      });
    }
    const sellerId = orderItem.order.shop.sellerProfile?.userId;
    const productId = orderItem.productId ?? dto.productId ?? null;
    if (!sellerId || !productId) {
      throw new BadRequestException({
        code: 'REVIEW_NOT_VERIFIED_PURCHASE',
        message: 'This order item cannot be reviewed.',
      });
    }

    const created = await this.prisma.productReview.create({
      data: {
        productId,
        shopId: orderItem.order.shopId,
        sellerId,
        customerId: user.userId,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        fitFeedback: dto.fitFeedback?.trim() || null,
        status: 'PUBLISHED',
      },
      include: this.reviewInclude,
    });

    await this.refreshProductReviewSummary(productId);

    return this.mapReview(created);
  }

  async updateCustomerReview(
    reviewId: string,
    user: AuthenticatedUser,
    dto: UpdateCustomerReviewDto,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    if (dto.rating !== undefined) {
      this.assertRating(dto.rating);
    }
    if (dto.comment !== undefined) {
      this.assertComment(dto.comment);
    }

    const existing = await this.prisma.productReview.findFirst({
      where: { id: reviewId, customerId: user.userId },
      include: this.reviewInclude,
    });

    if (!existing) {
      throw new NotFoundException('Review was not found.');
    }

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        rating: dto.rating ?? existing.rating,
        comment:
          dto.comment !== undefined
            ? dto.comment.trim() || null
            : existing.comment,
        fitFeedback:
          dto.fitFeedback !== undefined
            ? dto.fitFeedback.trim() || null
            : existing.fitFeedback,
      },
      include: this.reviewInclude,
    });

    await this.refreshProductReviewSummary(existing.productId);
    return this.mapReview(updated);
  }

  async uploadCustomerReviewImage(
    reviewId: string,
    user: AuthenticatedUser,
    file: ProductImageUploadFile,
  ) {
    this.assertRole(user, USER_ROLES.CUSTOMER, 'Customer account is required.');
    this.assertReviewImageFile(file);

    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, customerId: user.userId },
      include: {
        images: true,
      },
    });

    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    if (review.images.length >= 5) {
      throw new BadRequestException({
        code: 'REVIEW_IMAGE_LIMIT_EXCEEDED',
        message: 'A review can include up to 5 images.',
      });
    }

    const stored = await this.filesService.storeReviewImage(file, {
      shopId: review.shopId,
      reviewId: review.id,
    });

    try {
      const updated = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: {
          images: {
            create: {
              url: stored.publicUrl,
              storageKey: stored.storageKey,
              mimeType: stored.mimeType ?? 'application/octet-stream',
              sizeBytes: stored.size,
            },
          },
        },
        include: this.reviewInclude,
      });

      return this.mapReview(updated);
    } catch {
      await this.filesService.deleteStoredFile({
        storageKey: stored.storageKey,
        fileUrl: stored.publicUrl,
      });
      throw new BadRequestException({
        code: 'REVIEW_IMAGE_UPLOAD_FAILED',
        message: 'Review image upload failed.',
      });
    }
  }

  async listPublicReviews(productId: string, query: ListPublicReviewsQueryDto) {
    await this.assertPublicProduct(productId);

    const where: Prisma.ProductReviewWhereInput = {
      productId,
      status: 'PUBLISHED',
      ...(query.rating ? { rating: query.rating } : {}),
    };

    const [total, items, countsByRating, average] = await Promise.all([
      this.prisma.productReview.count({ where }),
      this.prisma.productReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: this.reviewInclude,
      }),
      this.prisma.productReview.groupBy({
        by: ['rating'],
        where: {
          productId,
          status: 'PUBLISHED',
        },
        _count: {
          rating: true,
        },
      }),
      this.prisma.productReview.aggregate({
        where: {
          productId,
          status: 'PUBLISHED',
        },
        _avg: {
          rating: true,
        },
      }),
    ]);

    const summaryCounts = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const row of countsByRating) {
      summaryCounts[String(row.rating) as keyof typeof summaryCounts] =
        row._count.rating;
    }

    return {
      items: items.map((item) => this.mapPublicReview(item)),
      summary: {
        averageRating:
          average._avg.rating === null
            ? null
            : Number(average._avg.rating).toFixed(1),
        ratingCount: total,
        countsByRating: summaryCounts,
      },
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async listShopReviews(
    shopId: string,
    user: AuthenticatedUser,
    query: ListShopReviewsQueryDto,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);

    const items = await this.prisma.productReview.findMany({
      where: {
        shopId,
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.rating ? { rating: query.rating } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                {
                  product: {
                    localTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  product: {
                    wbTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  customer: {
                    fullName: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.reviewInclude,
    });

    return { items: items.map((item) => this.mapReview(item)) };
  }

  async replyToReview(
    shopId: string,
    reviewId: string,
    user: AuthenticatedUser,
    reply: string,
  ) {
    this.assertRole(user, USER_ROLES.SELLER, 'Seller account is required.');
    await this.assertSellerOwnsShop(shopId, user.userId);

    const review = await this.prisma.productReview.findFirst({
      where: { id: reviewId, shopId },
      include: this.reviewInclude,
    });

    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        sellerReply: reply.trim(),
        sellerRepliedAt: new Date(),
      },
      include: this.reviewInclude,
    });

    return this.mapReview(updated);
  }

  async listAdminReviews(query: ListShopReviewsQueryDto) {
    const items = await this.prisma.productReview.findMany({
      where: {
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.rating ? { rating: query.rating } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim()
          ? {
              OR: [
                {
                  product: {
                    localTitle: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  shop: {
                    name: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  customer: {
                    fullName: {
                      contains: query.q.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: this.reviewInclude,
    });

    return { items: items.map((item) => this.mapReview(item)) };
  }

  async hideReview(reviewId: string, reason?: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        status: 'HIDDEN',
        hiddenReason: reason?.trim() || 'Hidden by admin moderation.',
      },
      include: this.reviewInclude,
    });
    await this.refreshProductReviewSummary(review.productId);
    return this.mapReview(updated);
  }

  async restoreReview(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({
      where: { id: reviewId },
    });
    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    const updated = await this.prisma.productReview.update({
      where: { id: reviewId },
      data: {
        status: 'PUBLISHED',
        hiddenReason: null,
      },
      include: this.reviewInclude,
    });
    await this.refreshProductReviewSummary(review.productId);
    return this.mapReview(updated);
  }

  private async refreshProductReviewSummary(productId: string) {
    const aggregate = await this.prisma.productReview.aggregate({
      where: {
        productId,
        status: 'PUBLISHED',
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        averageRating:
          aggregate._avg.rating === null
            ? new Prisma.Decimal(0)
            : new Prisma.Decimal(aggregate._avg.rating.toFixed(2)),
        feedbackCount: aggregate._count.rating,
      },
    });
  }

  private async assertPublicProduct(productId: string) {
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
            stockQuantity: {
              gt: 0,
            },
            OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
          },
        },
      },
      include: {
        images: true,
        variants: true,
        shop: {
          include: {
            sellerProfile: true,
          },
        },
      },
    });

    if (!product || !this.productReadiness.getReadiness(product).ready) {
      throw new NotFoundException('Public product was not found.');
    }
  }

  private async assertSellerOwnsShop(shopId: string, sellerUserId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        id: shopId,
        sellerProfile: {
          userId: sellerUserId,
        },
      },
      select: { id: true },
    });

    if (!shop) {
      throw new ForbiddenException('Seller does not have access to this shop.');
    }
  }

  private assertRole(user: AuthenticatedUser, role: string, message: string) {
    if (user.role !== role) {
      throw new ForbiddenException(message);
    }
  }

  private assertRating(rating: number) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException({
        code: 'REVIEW_RATING_INVALID',
        message: 'Review rating must be between 1 and 5.',
      });
    }
  }

  private assertComment(comment: string | null | undefined) {
    if (!comment?.trim()) {
      throw new BadRequestException({
        code: 'REVIEW_COMMENT_REQUIRED',
        message: 'Review text is required.',
      });
    }
  }

  private assertReviewImageFile(file: ProductImageUploadFile) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'REVIEW_IMAGE_TYPE_INVALID',
        message: 'Review images must be JPG, PNG, or WEBP.',
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'REVIEW_IMAGE_TOO_LARGE',
        message: 'Review images must be 5 MB or smaller.',
      });
    }
  }

  private maskCustomerName(name: string | null | undefined) {
    const trimmed = name?.trim();
    if (!trimmed) return 'Customer';
    const [first, second] = trimmed.split(/\s+/);
    if (!second) {
      return `${first[0]}***`;
    }
    return `${first} ${second[0]}.`;
  }

  private get reviewInclude() {
    return {
      images: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      product: {
        select: {
          id: true,
          localTitle: true,
          wbTitle: true,
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
        },
      },
      customer: {
        select: {
          id: true,
          fullName: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
        },
      },
      orderItem: {
        select: {
          id: true,
          productTitleSnapshot: true,
          productImageSnapshot: true,
          variantNameSnapshot: true,
          quantity: true,
        },
      },
    } satisfies Prisma.ProductReviewInclude;
  }

  private mapReview(
    review: ProductReview & {
      images?: ProductReviewImage[];
      product?: { id: string; localTitle: string | null; wbTitle: string };
      shop?: { id: string; name: string };
      customer?: { id: string; fullName: string | null };
      order?: {
        id: string;
        orderNumber: string;
        status: string;
        paymentStatus: string;
      };
      orderItem?: {
        id: string;
        productTitleSnapshot: string;
        productImageSnapshot: string | null;
        variantNameSnapshot: string | null;
        quantity: number;
      };
    },
  ) {
    return {
      id: review.id,
      productId: review.productId,
      shopId: review.shopId,
      sellerId: review.sellerId,
      customerId: review.customerId,
      orderId: review.orderId,
      orderItemId: review.orderItemId,
      rating: review.rating,
      comment: review.comment,
      fitFeedback: review.fitFeedback,
      status: review.status,
      sellerReply: review.sellerReply,
      sellerRepliedAt: review.sellerRepliedAt?.toISOString() ?? null,
      hiddenReason: review.hiddenReason,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      product: review.product
        ? {
            id: review.product.id,
            title: review.product.localTitle ?? review.product.wbTitle,
          }
        : null,
      shop: review.shop ?? null,
      customer: review.customer
        ? {
            id: review.customer.id,
            name: review.customer.fullName,
            maskedName: this.maskCustomerName(review.customer.fullName),
          }
        : null,
      order: review.order ?? null,
      orderItem: review.orderItem ?? null,
      images: (review.images ?? []).map((image) => this.mapReviewImage(image)),
    };
  }

  private mapPublicReview(
    review: ProductReview & {
      images?: ProductReviewImage[];
      customer?: { id: string; fullName: string | null };
      order?: { orderNumber: string };
    },
  ) {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      fitFeedback: review.fitFeedback,
      status: review.status,
      sellerReply: review.sellerReply,
      sellerRepliedAt: review.sellerRepliedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
      verifiedPurchase: true,
      customerName: this.maskCustomerName(review.customer?.fullName),
      orderCode: review.order?.orderNumber ?? null,
      images: (review.images ?? []).map((image) => this.mapReviewImage(image)),
    };
  }

  private mapReviewImage(image: ProductReviewImage) {
    return {
      id: image.id,
      url: image.url,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt.toISOString(),
    };
  }
}
