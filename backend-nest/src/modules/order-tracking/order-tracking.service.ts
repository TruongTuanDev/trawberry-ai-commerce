import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from '../files/files.service';
import type { ProductImageUploadFile } from '../product-images/product-image-file.type';
import { TrackPublicOrderQueryDto } from './dto/track-public-order-query.dto';

const PAYMENT_PROOF_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

type TrackableOrderRecord = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  shippingAddress: string;
  shippingMethodName: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  customerId: string;
  paymentProofUrl: string | null;
  paymentProofStorageKey: string | null;
  paymentProofOriginalName: string | null;
  paymentProofMimeType: string | null;
  paymentProofSize: number | null;
  paymentProofUploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shop: {
    id: string;
    paymentInstructions: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    priceAtPurchase: Prisma.Decimal;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
  paymentReviewLogs: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: Date;
    reviewer: {
      fullName: string | null;
    };
  }>;
};

@Injectable()
export class OrderTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly configService: ConfigService,
  ) {}

  async trackByQuery(query: TrackPublicOrderQueryDto) {
    const orderCode = query.orderCode?.trim();
    const phone = query.phone?.trim();

    if (!orderCode || !phone) {
      throw new BadRequestException('orderCode and phone are required.');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderCode,
      },
      include: this.orderInclude,
    });

    return this.assertTrackableOrder(order, phone);
  }

  async trackByOrderId(orderId: string, phone: string) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('phone is required.');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });

    return this.assertTrackableOrder(order, normalizedPhone);
  }

  async uploadPaymentProof(
    orderId: string,
    phone: string,
    file?: ProductImageUploadFile | null,
  ) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('phone is required.');
    }

    if (!file) {
      throw new BadRequestException('payment proof file is required.');
    }

    this.assertValidFile(file);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });
    const trackableOrder = this.assertMatchingOrder(order, normalizedPhone);

    const stored = await this.filesService.storePaymentProof(file, {
      shopId: trackableOrder.shop.id,
      orderId: trackableOrder.id,
    });

    if (
      trackableOrder.paymentProofStorageKey ||
      trackableOrder.paymentProofUrl
    ) {
      await this.filesService.deleteProductImageFile({
        storageKey: trackableOrder.paymentProofStorageKey,
        fileUrl: trackableOrder.paymentProofUrl,
      });
    }

    await this.prisma.order.update({
      where: { id: trackableOrder.id },
      data: {
        paymentProofUrl: stored.publicUrl,
        paymentProofStorageKey: stored.storageKey,
        paymentProofOriginalName: stored.originalName,
        paymentProofMimeType: stored.mimeType,
        paymentProofSize: stored.size,
        paymentProofUploadedAt: new Date(),
        paymentReviewLogs: {
          create: {
            id: randomUUID(),
            action: 'UPLOAD_PROOF',
            fromStatus: trackableOrder.paymentStatus,
            toStatus: trackableOrder.paymentStatus,
            note: `Customer uploaded payment proof: ${stored.originalName}`,
            shop: {
              connect: { id: trackableOrder.shop.id },
            },
            reviewer: {
              connect: { id: trackableOrder.customerId },
            },
          },
        },
      },
    });

    const refreshed = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });

    return this.toTrackingResponse(
      this.assertMatchingOrder(refreshed, normalizedPhone),
    );
  }

  private assertTrackableOrder(
    order: TrackableOrderRecord | null,
    phone: string,
  ) {
    return this.toTrackingResponse(this.assertMatchingOrder(order, phone));
  }

  private assertMatchingOrder(
    order: TrackableOrderRecord | null,
    phone: string,
  ) {
    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    if (order.customerPhone.trim() !== phone) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  private assertValidFile(file: ProductImageUploadFile) {
    if (!PAYMENT_PROOF_ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(
        `Unsupported payment proof type for ${file.originalname}. Allowed: ${PAYMENT_PROOF_ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }

    const maxSizeMb = Number(
      this.configService.get<string>(
        'PAYMENT_PROOF_MAX_SIZE_MB',
        this.configService.get<string>('MAX_INPUT_IMAGE_SIZE_MB', '15'),
      ),
    );
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `${file.originalname} exceeds the maximum file size of ${maxSizeMb} MB.`,
      );
    }
  }

  private toTrackingResponse(order: TrackableOrderRecord) {
    return {
      orderId: order.id,
      orderCode: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      paymentMethod: order.shippingMethodName,
      paymentInstructions: order.shop.paymentInstructions,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        address: order.shippingAddress,
      },
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase.toString(),
        productTitleSnapshot: item.productTitleSnapshot,
        productSlugSnapshot: item.productSlugSnapshot,
        productImageSnapshot: item.productImageSnapshot,
      })),
      paymentProof: order.paymentProofUrl
        ? {
            url: order.paymentProofUrl,
            originalName: order.paymentProofOriginalName,
            mimeType: order.paymentProofMimeType,
            size: order.paymentProofSize,
            uploadedAt: order.paymentProofUploadedAt?.toISOString() ?? null,
          }
        : null,
      paymentLogs: order.paymentReviewLogs.map((log) => ({
        id: log.id,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        note: log.note,
        reviewerName: log.reviewer.fullName,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private get orderInclude() {
    return {
      shop: {
        select: {
          id: true,
          paymentInstructions: true,
        },
      },
      items: {
        orderBy: { productTitleSnapshot: 'asc' as const },
      },
      paymentReviewLogs: {
        where: {
          action: {
            in: ['UPLOAD_PROOF', 'MARK_PAID', 'REJECT_PAYMENT', 'ADD_NOTE'],
          },
        },
        orderBy: { createdAt: 'desc' as const },
        include: {
          reviewer: {
            select: {
              fullName: true,
            },
          },
        },
      },
    };
  }
}
