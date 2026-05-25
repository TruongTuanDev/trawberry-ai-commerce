import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { FilesService } from '../src/modules/files/files.service';
import { ProductReadinessService } from '../src/modules/products/product-readiness.service';
import { ReviewsService } from '../src/modules/reviews/reviews.service';

function createPrismaMock() {
  return {
    orderItem: {
      findFirst: jest.fn(),
    },
    productReview: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findUnique: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    shop: {
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
}

function createReadinessMock() {
  return {
    getReadiness: jest.fn(() => ({ ready: true })),
  } as unknown as ProductReadinessService;
}

function createFilesMock() {
  return {
    storeReviewImage: jest.fn(),
    deleteStoredFile: jest.fn(),
  } as unknown as FilesService;
}

function expectCode(error: unknown, code: string) {
  expect(error).toBeInstanceOf(Error);
  const response =
    error instanceof BadRequestException ||
    error instanceof ForbiddenException ||
    error instanceof NotFoundException
      ? error.getResponse()
      : null;
  expect(response).toMatchObject({ code });
}

async function expectRejectCode(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`Expected promise to reject with ${code}`);
  } catch (error) {
    expectCode(error, code);
  }
}

describe('ReviewsService', () => {
  it('allows a customer to review only delivered or completed order items', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    prisma.orderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      order: {
        customerId: 'customer-1',
        status: 'NEW',
        customerCompletedAt: null,
        shopId: 'shop-1',
        shop: {
          sellerProfile: {
            userId: 'seller-1',
          },
        },
      },
      product: {
        id: 'product-1',
      },
    });

    await expectRejectCode(
      service.createCustomerReview(
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          orderId: 'order-1',
          orderItemId: 'item-1',
          productId: 'product-1',
          rating: 5,
          comment: 'Great',
        },
      ),
      'REVIEW_ORDER_NOT_COMPLETED',
    );
  });

  it('blocks duplicate reviews for the same customer order item', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    prisma.orderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      order: {
        customerId: 'customer-1',
        status: 'DELIVERED',
        customerCompletedAt: null,
        shopId: 'shop-1',
        shop: {
          sellerProfile: {
            userId: 'seller-1',
          },
        },
      },
      product: {
        id: 'product-1',
      },
    });
    prisma.productReview.findFirst = jest.fn().mockResolvedValue({
      id: 'review-1',
    });

    await expectRejectCode(
      service.createCustomerReview(
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          orderId: 'order-1',
          orderItemId: 'item-1',
          productId: 'product-1',
          rating: 5,
          comment: 'Great',
        },
      ),
      'REVIEW_ALREADY_EXISTS',
    );
  });

  it('creates a verified review and refreshes the product summary', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);
    const updateProduct = jest.fn().mockResolvedValue({});

    prisma.orderItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      order: {
        customerId: 'customer-1',
        status: 'DELIVERED',
        customerCompletedAt: null,
        shopId: 'shop-1',
        shop: {
          sellerProfile: {
            userId: 'seller-1',
          },
        },
      },
      product: {
        id: 'product-1',
      },
    });
    prisma.productReview.findFirst = jest.fn().mockResolvedValue(null);
    prisma.productReview.create = jest.fn().mockResolvedValue({
      id: 'review-1',
      productId: 'product-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      orderId: 'order-1',
      orderItemId: 'item-1',
      rating: 5,
      comment: 'Excellent quality',
      fitFeedback: 'TRUE_TO_SIZE',
      status: 'PUBLISHED',
      sellerReply: null,
      sellerRepliedAt: null,
      hiddenReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      product: { id: 'product-1', localTitle: 'Jacket', wbTitle: 'Jacket' },
      shop: { id: 'shop-1', name: 'Shop 1' },
      customer: { id: 'customer-1', fullName: 'Alice Example' },
      order: {
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'DELIVERED',
        paymentStatus: 'PAID',
      },
      orderItem: {
        id: 'item-1',
        productTitleSnapshot: 'Jacket',
        productImageSnapshot: null,
        variantNameSnapshot: null,
        quantity: 1,
      },
    });
    prisma.productReview.aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _avg: { rating: 5 }, _count: { rating: 1 } });
    prisma.product.update = updateProduct;

    const result = await service.createCustomerReview(
      { userId: 'customer-1', role: 'CUSTOMER', email: 'customer@example.com' },
      {
        orderId: 'order-1',
        orderItemId: 'item-1',
        productId: 'product-1',
        rating: 5,
        comment: 'Excellent quality',
        fitFeedback: 'TRUE_TO_SIZE',
      },
    );

    expect(result).toMatchObject({
      id: 'review-1',
      rating: 5,
      status: 'PUBLISHED',
      customer: { maskedName: 'Alice E.' },
      product: { title: 'Jacket' },
    });
    expect(updateProduct).toHaveBeenCalledTimes(1);
    const [updateInput] = updateProduct.mock.calls[0] as [
      { where: { id: string }; data: { feedbackCount: number } },
    ];
    expect(updateInput.where.id).toBe('product-1');
    expect(updateInput.data.feedbackCount).toBe(1);
  });

  it('allows sellers to reply only to reviews in their own shop', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    prisma.shop.findFirst = jest.fn().mockResolvedValue(null);

    await expect(
      service.replyToReview(
        'shop-1',
        'review-1',
        { userId: 'seller-1', role: 'SELLER', email: 'seller@example.com' },
        'Thank you.',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets admin hide and restore reviews and recalculates the product summary', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);
    const updateProduct = jest.fn().mockResolvedValue({});

    prisma.productReview.findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 'review-1', productId: 'product-1' })
      .mockResolvedValueOnce({ id: 'review-1', productId: 'product-1' });
    prisma.productReview.update = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'review-1',
        productId: 'product-1',
        shopId: 'shop-1',
        sellerId: 'seller-1',
        customerId: 'customer-1',
        orderId: 'order-1',
        orderItemId: 'item-1',
        rating: 4,
        comment: 'Solid',
        fitFeedback: null,
        status: 'HIDDEN',
        sellerReply: null,
        sellerRepliedAt: null,
        hiddenReason: 'Hidden by admin moderation.',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        product: { id: 'product-1', localTitle: 'Boots', wbTitle: 'Boots' },
        shop: { id: 'shop-1', name: 'Shop 1' },
        customer: { id: 'customer-1', fullName: 'Bob Example' },
        order: {
          id: 'order-1',
          orderNumber: 'ORD-1',
          status: 'DELIVERED',
          paymentStatus: 'PAID',
        },
        orderItem: {
          id: 'item-1',
          productTitleSnapshot: 'Boots',
          productImageSnapshot: null,
          variantNameSnapshot: null,
          quantity: 1,
        },
      })
      .mockResolvedValueOnce({
        id: 'review-1',
        productId: 'product-1',
        shopId: 'shop-1',
        sellerId: 'seller-1',
        customerId: 'customer-1',
        orderId: 'order-1',
        orderItemId: 'item-1',
        rating: 4,
        comment: 'Solid',
        fitFeedback: null,
        status: 'PUBLISHED',
        sellerReply: null,
        sellerRepliedAt: null,
        hiddenReason: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        product: { id: 'product-1', localTitle: 'Boots', wbTitle: 'Boots' },
        shop: { id: 'shop-1', name: 'Shop 1' },
        customer: { id: 'customer-1', fullName: 'Bob Example' },
        order: {
          id: 'order-1',
          orderNumber: 'ORD-1',
          status: 'DELIVERED',
          paymentStatus: 'PAID',
        },
        orderItem: {
          id: 'item-1',
          productTitleSnapshot: 'Boots',
          productImageSnapshot: null,
          variantNameSnapshot: null,
          quantity: 1,
        },
      });
    prisma.productReview.aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _avg: { rating: null }, _count: { rating: 0 } })
      .mockResolvedValueOnce({ _avg: { rating: 4 }, _count: { rating: 1 } });
    prisma.product.update = updateProduct;

    const hidden = await service.hideReview('review-1');
    expect(hidden.status).toBe('HIDDEN');

    const restored = await service.restoreReview('review-1');
    expect(restored.status).toBe('PUBLISHED');
    expect(updateProduct).toHaveBeenCalledTimes(2);
  });

  it('requires non-empty review text', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    await expectRejectCode(
      service.createCustomerReview(
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          orderId: 'order-1',
          orderItemId: 'item-1',
          productId: 'product-1',
          rating: 4,
          comment: '   ',
        },
      ),
      'REVIEW_COMMENT_REQUIRED',
    );
  });

  it('validates review image type and size before upload', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    await expectRejectCode(
      service.uploadCustomerReviewImage(
        'review-1',
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          originalname: 'review.gif',
          mimetype: 'image/gif',
          size: 1024,
          buffer: Buffer.from('gif'),
        },
      ),
      'REVIEW_IMAGE_TYPE_INVALID',
    );

    await expectRejectCode(
      service.uploadCustomerReviewImage(
        'review-1',
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          originalname: 'review.png',
          mimetype: 'image/png',
          size: 6 * 1024 * 1024,
          buffer: Buffer.alloc(16),
        },
      ),
      'REVIEW_IMAGE_TOO_LARGE',
    );
  });

  it('enforces max 5 review images and maps uploaded images', async () => {
    const prisma = createPrismaMock();
    const readiness = createReadinessMock();
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    prisma.productReview.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'review-1',
        shopId: 'shop-1',
        customerId: 'customer-1',
        images: new Array(5)
          .fill(null)
          .map((_, index) => ({ id: `img-${index}` })),
      })
      .mockResolvedValueOnce({
        id: 'review-1',
        shopId: 'shop-1',
        customerId: 'customer-1',
        images: [],
      });

    await expectRejectCode(
      service.uploadCustomerReviewImage(
        'review-1',
        {
          userId: 'customer-1',
          role: 'CUSTOMER',
          email: 'customer@example.com',
        },
        {
          originalname: 'review.png',
          mimetype: 'image/png',
          size: 1024,
          buffer: Buffer.alloc(8),
        },
      ),
      'REVIEW_IMAGE_LIMIT_EXCEEDED',
    );

    (files.storeReviewImage as jest.Mock).mockResolvedValue({
      publicUrl: '/uploads/review-images/shop-1/review-1/review.png',
      storageKey: 'review-images/shop-1/review-1/review.png',
      originalName: 'review.png',
      mimeType: 'image/png',
      size: 1024,
    });
    prisma.productReview.update = jest.fn().mockResolvedValue({
      id: 'review-1',
      productId: 'product-1',
      shopId: 'shop-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      orderId: 'order-1',
      orderItemId: 'item-1',
      rating: 5,
      comment: 'Excellent quality',
      fitFeedback: null,
      status: 'PUBLISHED',
      sellerReply: null,
      sellerRepliedAt: null,
      hiddenReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      images: [
        {
          id: 'image-1',
          url: '/uploads/review-images/shop-1/review-1/review.png',
          storageKey: 'review-images/shop-1/review-1/review.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
          width: null,
          height: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      product: { id: 'product-1', localTitle: 'Jacket', wbTitle: 'Jacket' },
      shop: { id: 'shop-1', name: 'Shop 1' },
      customer: { id: 'customer-1', fullName: 'Alice Example' },
      order: {
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'DELIVERED',
        paymentStatus: 'PAID',
      },
      orderItem: {
        id: 'item-1',
        productTitleSnapshot: 'Jacket',
        productImageSnapshot: null,
        variantNameSnapshot: null,
        quantity: 1,
      },
    });

    const result = await service.uploadCustomerReviewImage(
      'review-1',
      { userId: 'customer-1', role: 'CUSTOMER', email: 'customer@example.com' },
      {
        originalname: 'review.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.alloc(8),
      },
    );

    expect(result.images).toEqual([
      expect.objectContaining({
        id: 'image-1',
        mimeType: 'image/png',
      }),
    ]);
  });

  it('public review listing excludes hidden review images from public output', async () => {
    const prisma = createPrismaMock();
    const readiness = {
      getReadiness: jest.fn(() => ({ ready: true })),
    } as unknown as ProductReadinessService;
    const files = createFilesMock();
    const service = new ReviewsService(prisma, readiness, files);

    prisma.product.findFirst = jest.fn().mockResolvedValue({
      id: 'product-1',
      visibility: 'ACTIVE',
      images: [{}],
      variants: [
        { isActive: true, stockQuantity: 1, discountPrice: 10, basePrice: 10 },
      ],
      shop: {
        status: 'ACTIVE',
        sellerProfile: { approvalStatus: 'APPROVED' },
      },
    });
    prisma.productReview.count = jest.fn().mockResolvedValue(1);
    prisma.productReview.findMany = jest.fn().mockResolvedValue([
      {
        id: 'review-1',
        productId: 'product-1',
        shopId: 'shop-1',
        sellerId: 'seller-1',
        customerId: 'customer-1',
        orderId: 'order-1',
        orderItemId: 'item-1',
        rating: 5,
        comment: 'Great',
        fitFeedback: null,
        status: 'PUBLISHED',
        sellerReply: null,
        sellerRepliedAt: null,
        hiddenReason: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        images: [
          {
            id: 'image-1',
            url: '/uploads/review-images/shop-1/review-1/review.png',
            storageKey: 'review-images/shop-1/review-1/review.png',
            mimeType: 'image/png',
            sizeBytes: 1024,
            width: null,
            height: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        customer: { id: 'customer-1', fullName: 'Alice Example' },
        order: { orderNumber: 'ORD-1' },
      },
    ]);
    prisma.productReview.groupBy = jest
      .fn()
      .mockResolvedValue([{ rating: 5, _count: { rating: 1 } }]);
    prisma.productReview.aggregate = jest.fn().mockResolvedValue({
      _avg: { rating: 5 },
    });

    const result = await service.listPublicReviews('product-1', {
      page: 1,
      limit: 20,
    });

    expect(result.items[0]?.images).toEqual([
      expect.objectContaining({ id: 'image-1' }),
    ]);
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
    expect(
      (prisma.productReview.findMany as jest.Mock).mock.calls[0]?.[0],
    ).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
        }),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  });
});
