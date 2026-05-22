import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { computeAddressGeoReadiness } from '../../common/utils/customer-address.util';
import { resolveOrderPaymentPanel } from '../../common/utils/shop-payment.util';
import {
  PAYMENT_METHOD_LABELS,
  isPayOnDeliverySellerQrMethod,
} from '../../common/constants/payment-methods.constant';
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
  dropoffAddressFullName?: string | null;
  dropoffCity?: string | null;
  dropoffStreet?: string | null;
  dropoffBuilding?: string | null;
  dropoffEntrance?: string | null;
  dropoffNoEntrance?: boolean;
  dropoffIntercom?: string | null;
  dropoffFloor?: string | null;
  dropoffNoFloor?: boolean;
  dropoffApartment?: string | null;
  dropoffNoApartment?: boolean;
  dropoffGeoPrecision?: string | null;
  dropoffComment?: string | null;
  shippingMethodName: string | null;
  paymentMethod: string | null;
  paymentMethodLabel: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  customerId: string;
  paymentModeSnapshot: string | null;
  paymentBankNameSnapshot: string | null;
  paymentRecipientNameSnapshot: string | null;
  paymentRecipientPhoneSnapshot: string | null;
  paymentRecipientAccountSnapshot: string | null;
  paymentSbpPhoneSnapshot: string | null;
  paymentQrImageUrlSnapshot: string | null;
  paymentInstructionSnapshot: string | null;
  paymentProofUrl: string | null;
  paymentProofStorageKey: string | null;
  paymentProofOriginalName: string | null;
  paymentProofMimeType: string | null;
  paymentProofSize: number | null;
  paymentProofUploadedAt: Date | null;
  paymentProofStatus: string;
  paymentProofBuyerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  shop: {
    id: string;
    paymentInstructions: string | null;
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    recipientPhone: string | null;
    sbpPhone: string | null;
    staticQrImageUrl: string | null;
    paymentMode: string | null;
    paymentConfigStatus: string;
  };
  deliveryShipments?: Array<{
    provider: string;
    internalStatus: string;
    providerShipmentId: string | null;
    providerStatus: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    courierName: string | null;
    courierPhone: string | null;
    estimatedDeliveryAt: Date | null;
    packagePreset: string | null;
    packageWeightGram: number | null;
    packageLengthCm: number | null;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    pickupAddress: string;
    pickupAddressFullName: string | null;
    pickupLatitude: Prisma.Decimal | null;
    pickupLongitude: Prisma.Decimal | null;
    dropoffAddressFullName: string | null;
    dropoffCity: string | null;
    dropoffStreet: string | null;
    dropoffBuilding: string | null;
    dropoffEntrance: string | null;
    dropoffIntercom: string | null;
    dropoffFloor: string | null;
    dropoffApartment: string | null;
    dropoffGeoPrecision: string | null;
    dropoffComment: string | null;
    dropoffLatitude: Prisma.Decimal | null;
    dropoffLongitude: Prisma.Decimal | null;
    recipientName: string | null;
    recipientPhone: string | null;
    manualYandexOrderId: string | null;
    yandexClaimId: string | null;
    yandexStatus: string | null;
    yandexPrice: Prisma.Decimal | null;
    yandexTrackingLink: string | null;
    deliveryNote: string | null;
    failureReasonCode: string | null;
    customerVisibleMessage: string | null;
    comments: Array<{
      id: string;
      visibility: string;
      message: string;
      createdAt: Date;
    }>;
  }>;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: Prisma.Decimal;
    unitPrice: Prisma.Decimal | null;
    lineTotal: Prisma.Decimal | null;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
    variantNameSnapshot: string | null;
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
  returnRefundCases?: Array<{
    id: string;
    type: string;
    reason: string;
    status: string;
    requestedAmount: Prisma.Decimal;
    approvedAmount: Prisma.Decimal | null;
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
    buyerNote?: string | null,
    file?: ProductImageUploadFile | null,
  ) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('phone is required.');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId },
      include: this.orderInclude,
    });
    const trackableOrder = this.assertMatchingOrder(order, normalizedPhone);

    if (!file) {
      if (
        !isPayOnDeliverySellerQrMethod(
          trackableOrder.paymentMethod ?? trackableOrder.shippingMethodName,
        )
      ) {
        throw new BadRequestException('payment proof file is required.');
      }
    }

    if (file) {
      this.assertValidFile(file);
    }

    const stored = file
      ? await this.filesService.storePaymentProof(file, {
          shopId: trackableOrder.shop.id,
          orderId: trackableOrder.id,
        })
      : null;

    if (
      stored &&
      (trackableOrder.paymentProofStorageKey || trackableOrder.paymentProofUrl)
    ) {
      await this.filesService.deleteProductImageFile({
        storageKey: trackableOrder.paymentProofStorageKey,
        fileUrl: trackableOrder.paymentProofUrl,
      });
    }

    const isDeliveryPayment = isPayOnDeliverySellerQrMethod(
      trackableOrder.paymentMethod ?? trackableOrder.shippingMethodName,
    );
    await this.prisma.order.update({
      where: { id: trackableOrder.id },
      data: {
        paymentProofUrl: stored?.publicUrl ?? trackableOrder.paymentProofUrl,
        paymentProofStorageKey:
          stored?.storageKey ?? trackableOrder.paymentProofStorageKey,
        paymentProofOriginalName:
          stored?.originalName ?? trackableOrder.paymentProofOriginalName,
        paymentProofMimeType:
          stored?.mimeType ?? trackableOrder.paymentProofMimeType,
        paymentProofSize: stored?.size ?? trackableOrder.paymentProofSize,
        paymentProofUploadedAt: stored
          ? new Date()
          : trackableOrder.paymentProofUploadedAt,
        paymentProofStatus: 'BUYER_MARKED_PAID',
        paymentProofBuyerNote: buyerNote?.trim() || null,
        paymentProofAmount: trackableOrder.totalAmount,
        buyerMarkedPaidAt: new Date(),
        paymentStatus: isDeliveryPayment
          ? 'BUYER_MARKED_DELIVERY_PAID'
          : trackableOrder.paymentStatus,
        paymentFlowStage: isDeliveryPayment
          ? 'BUYER_MARKED_DELIVERY_PAID'
          : undefined,
        paymentReviewLogs: {
          create: {
            id: randomUUID(),
            action: isDeliveryPayment
              ? 'buyer_marked_delivery_paid'
              : 'BUYER_MARKED_PAID',
            fromStatus: trackableOrder.paymentStatus,
            toStatus: isDeliveryPayment
              ? 'BUYER_MARKED_DELIVERY_PAID'
              : trackableOrder.paymentStatus,
            note: buyerNote?.trim()
              ? stored
                ? `Customer marked as paid and uploaded proof: ${stored.originalName}. Note: ${buyerNote.trim()}`
                : `Customer marked as delivery paid. Note: ${buyerNote.trim()}`
              : stored
                ? `Customer marked as paid and uploaded proof: ${stored.originalName}`
                : 'Customer marked as delivery paid.',
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
    const latestShipment = order.deliveryShipments?.[0] ?? null;
    const paymentDetails = resolveOrderPaymentPanel(order, order.shop);
    const customerGeoReadiness = computeAddressGeoReadiness({
      country: 'Russia',
      city: order.dropoffCity ?? '',
      street: order.dropoffStreet ?? '',
      building: order.dropoffBuilding ?? '',
      entrance: order.dropoffEntrance ?? null,
      noEntrance: order.dropoffNoEntrance ?? false,
      intercom: order.dropoffIntercom ?? null,
      floor: order.dropoffFloor ?? null,
      noFloor: order.dropoffNoFloor ?? false,
      apartment: order.dropoffApartment ?? null,
      noApartment: order.dropoffNoApartment ?? false,
      comment: order.dropoffComment ?? null,
      geoPrecision: order.dropoffGeoPrecision ?? null,
      phone: order.customerPhone,
    });
    return {
      orderId: order.id,
      orderCode: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount.toString(),
      paymentMethod: order.paymentMethod ?? order.shippingMethodName,
      paymentMethodLabel:
        order.paymentMethodLabel ??
        (order.paymentMethod && order.paymentMethod in PAYMENT_METHOD_LABELS
          ? PAYMENT_METHOD_LABELS[
              order.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS
            ]
          : null),
      paymentInstructions: paymentDetails.paymentInstruction,
      paymentDetails,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        address: order.shippingAddress,
        addressFullName: order.dropoffAddressFullName ?? order.shippingAddress,
        city: order.dropoffCity ?? null,
        street: order.dropoffStreet ?? null,
        building: order.dropoffBuilding ?? null,
        entrance: order.dropoffEntrance ?? null,
        noEntrance: order.dropoffNoEntrance ?? false,
        intercom: order.dropoffIntercom ?? null,
        floor: order.dropoffFloor ?? null,
        noFloor: order.dropoffNoFloor ?? false,
        apartment: order.dropoffApartment ?? null,
        noApartment: order.dropoffNoApartment ?? false,
        geoPrecision: order.dropoffGeoPrecision ?? null,
        deliveryComment: order.dropoffComment ?? null,
        geoReadiness: customerGeoReadiness,
      },
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase.toString(),
        unitPrice: (item.unitPrice ?? item.priceAtPurchase).toString(),
        lineTotal: (
          item.lineTotal ??
          new Prisma.Decimal(item.priceAtPurchase.toString()).mul(item.quantity)
        ).toString(),
        productTitleSnapshot: item.productTitleSnapshot,
        productSlugSnapshot: item.productSlugSnapshot,
        productImageSnapshot: item.productImageSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
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
      paymentProofStatus: order.paymentProofStatus,
      buyerPaymentNote: order.paymentProofBuyerNote,
      paymentLogs: order.paymentReviewLogs.map((log) => ({
        id: log.id,
        action: log.action,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        note: log.note,
        reviewerName: log.reviewer.fullName,
        createdAt: log.createdAt.toISOString(),
      })),
      returnRefundCases:
        order.returnRefundCases?.map((entry) => ({
          id: entry.id,
          type: entry.type,
          reason: entry.reason,
          status: entry.status,
          requestedAmount: entry.requestedAmount.toString(),
          approvedAmount: entry.approvedAmount?.toString() ?? null,
        })) ?? [],
      delivery: latestShipment
        ? {
            provider: latestShipment.provider,
            status: latestShipment.internalStatus,
            statusLabel: this.deliveryStatusLabel(
              latestShipment.internalStatus,
            ),
            statusMessage: this.deliveryStatusMessage(
              latestShipment.internalStatus,
            ),
            internalStatus: latestShipment.internalStatus,
            providerStatus: latestShipment.providerStatus,
            providerShipmentId: latestShipment.providerShipmentId,
            trackingNumber: latestShipment.trackingNumber,
            trackingUrl: latestShipment.trackingUrl,
            courierName: latestShipment.courierName,
            courierPhone: latestShipment.courierPhone,
            estimatedDeliveryAt:
              latestShipment.estimatedDeliveryAt?.toISOString() ?? null,
            packagePreset: latestShipment.packagePreset,
            packageWeightGram: latestShipment.packageWeightGram,
            packageLengthCm: latestShipment.packageLengthCm,
            packageWidthCm: latestShipment.packageWidthCm,
            packageHeightCm: latestShipment.packageHeightCm,
            pickupAddress: latestShipment.pickupAddress,
            pickupAddressFullName:
              latestShipment.pickupAddressFullName ??
              latestShipment.pickupAddress,
            pickupLatitude: latestShipment.pickupLatitude?.toString() ?? null,
            pickupLongitude: latestShipment.pickupLongitude?.toString() ?? null,
            dropoffAddressFullName:
              latestShipment.dropoffAddressFullName ??
              order.dropoffAddressFullName ??
              order.shippingAddress,
            dropoffCity:
              latestShipment.dropoffCity ?? order.dropoffCity ?? null,
            dropoffStreet:
              latestShipment.dropoffStreet ?? order.dropoffStreet ?? null,
            dropoffBuilding:
              latestShipment.dropoffBuilding ?? order.dropoffBuilding ?? null,
            dropoffEntrance:
              latestShipment.dropoffEntrance ?? order.dropoffEntrance ?? null,
            dropoffNoEntrance: order.dropoffNoEntrance ?? false,
            dropoffIntercom:
              latestShipment.dropoffIntercom ?? order.dropoffIntercom ?? null,
            dropoffFloor:
              latestShipment.dropoffFloor ?? order.dropoffFloor ?? null,
            dropoffNoFloor: order.dropoffNoFloor ?? false,
            dropoffApartment:
              latestShipment.dropoffApartment ?? order.dropoffApartment ?? null,
            dropoffNoApartment: order.dropoffNoApartment ?? false,
            dropoffGeoPrecision:
              latestShipment.dropoffGeoPrecision ??
              order.dropoffGeoPrecision ??
              null,
            dropoffComment:
              latestShipment.dropoffComment ?? order.dropoffComment ?? null,
            dropoffLatitude: latestShipment.dropoffLatitude?.toString() ?? null,
            dropoffLongitude:
              latestShipment.dropoffLongitude?.toString() ?? null,
            dropoffGeoReadiness: computeAddressGeoReadiness({
              country: 'Russia',
              city: latestShipment.dropoffCity ?? order.dropoffCity ?? '',
              street: latestShipment.dropoffStreet ?? order.dropoffStreet ?? '',
              building:
                latestShipment.dropoffBuilding ?? order.dropoffBuilding ?? '',
              entrance:
                latestShipment.dropoffEntrance ?? order.dropoffEntrance ?? null,
              noEntrance: order.dropoffNoEntrance ?? false,
              intercom:
                latestShipment.dropoffIntercom ?? order.dropoffIntercom ?? null,
              floor: latestShipment.dropoffFloor ?? order.dropoffFloor ?? null,
              noFloor: order.dropoffNoFloor ?? false,
              apartment:
                latestShipment.dropoffApartment ??
                order.dropoffApartment ??
                null,
              noApartment: order.dropoffNoApartment ?? false,
              comment:
                latestShipment.dropoffComment ?? order.dropoffComment ?? null,
              latitude: latestShipment.dropoffLatitude,
              longitude: latestShipment.dropoffLongitude,
              geoPrecision:
                latestShipment.dropoffGeoPrecision ??
                order.dropoffGeoPrecision ??
                null,
              phone: latestShipment.recipientPhone ?? order.customerPhone,
            }),
            recipientName: latestShipment.recipientName,
            recipientPhone: latestShipment.recipientPhone,
            manualYandexOrderId: latestShipment.manualYandexOrderId,
            yandexClaimId: latestShipment.yandexClaimId,
            yandexStatus: latestShipment.yandexStatus,
            yandexPrice: latestShipment.yandexPrice?.toString() ?? null,
            yandexTrackingLink: latestShipment.yandexTrackingLink,
            deliveryNote: latestShipment.deliveryNote,
            failureReasonCode: this.customerSafeFailureReason(
              latestShipment.failureReasonCode,
            ),
            customerVisibleMessage:
              latestShipment.customerVisibleMessage ??
              this.deliveryStatusMessage(latestShipment.internalStatus),
            deliveryComments: latestShipment.comments
              .filter((comment) => comment.visibility === 'CUSTOMER_VISIBLE')
              .map((comment) => ({
                id: comment.id,
                message: comment.message,
                createdAt: comment.createdAt.toISOString(),
              })),
          }
        : null,
    };
  }

  private get orderInclude() {
    return {
      shop: {
        select: {
          id: true,
          paymentInstructions: true,
          bankName: true,
          accountHolderName: true,
          accountNumber: true,
          recipientPhone: true,
          sbpPhone: true,
          staticQrImageUrl: true,
          paymentMode: true,
          paymentConfigStatus: true,
          allowPrepaidQr: true,
          allowPayOnDeliverySellerQr: true,
          allowDepositPayment: true,
          depositPercent: true,
          depositRequiredAboveAmount: true,
          codMaxOrderAmount: true,
          yandexCardOnDeliveryStatus: true,
          cashCourierCollectionStatus: true,
        },
      },
      deliveryShipments: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        select: {
          provider: true,
          internalStatus: true,
          providerStatus: true,
          providerShipmentId: true,
          trackingNumber: true,
          trackingUrl: true,
          courierName: true,
          courierPhone: true,
          estimatedDeliveryAt: true,
          packagePreset: true,
          packageWeightGram: true,
          packageLengthCm: true,
          packageWidthCm: true,
          packageHeightCm: true,
          pickupAddress: true,
          pickupAddressFullName: true,
          pickupLatitude: true,
          pickupLongitude: true,
          dropoffAddressFullName: true,
          dropoffCity: true,
          dropoffStreet: true,
          dropoffBuilding: true,
          dropoffEntrance: true,
          dropoffIntercom: true,
          dropoffFloor: true,
          dropoffApartment: true,
          dropoffGeoPrecision: true,
          dropoffComment: true,
          dropoffLatitude: true,
          dropoffLongitude: true,
          recipientName: true,
          recipientPhone: true,
          manualYandexOrderId: true,
          yandexClaimId: true,
          yandexStatus: true,
          yandexPrice: true,
          yandexTrackingLink: true,
          deliveryNote: true,
          failureReasonCode: true,
          customerVisibleMessage: true,
          comments: {
            where: { visibility: 'CUSTOMER_VISIBLE' },
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              visibility: true,
              message: true,
              createdAt: true,
            },
          },
        },
      },
      items: {
        orderBy: { productTitleSnapshot: 'asc' as const },
      },
      paymentReviewLogs: {
        where: {
          action: {
            in: [
              'UPLOAD_PROOF',
              'BUYER_MARKED_PAID',
              'MARK_PAID',
              'SELLER_CONFIRMED',
              'REJECT_PAYMENT',
              'SELLER_REJECTED',
              'ADD_NOTE',
              'ADMIN_CONFIRMED',
              'ADMIN_REJECTED',
            ],
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
      returnRefundCases: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          type: true,
          reason: true,
          status: true,
          requestedAmount: true,
          approvedAmount: true,
        },
      },
    };
  }

  private deliveryStatusLabel(status: string) {
    const labels: Record<string, string> = {
      READY_TO_CREATE_YANDEX: 'Ready to create Yandex',
      CREATED_MANUALLY: 'Delivery created',
      YANDEX_MANUAL_CREATED: 'Created in Yandex manually',
      COURIER_ASSIGNED: 'Courier assigned',
      PICKED_UP: 'Picked up',
      ON_THE_WAY: 'On the way',
      CREATED: 'Delivery created',
      IN_TRANSIT: 'In transit',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      FAILED: 'Delivery failed',
    };
    return labels[status] ?? status;
  }

  private deliveryStatusMessage(status: string) {
    const messages: Record<string, string> = {
      READY_TO_CREATE_YANDEX:
        'Payment is confirmed. The seller is preparing manual Yandex delivery.',
      CREATED_MANUALLY:
        'The seller has created delivery in their carrier dashboard.',
      YANDEX_MANUAL_CREATED: 'The seller created the order manually in Yandex.',
      COURIER_ASSIGNED: 'A courier has been assigned to your order.',
      PICKED_UP: 'The courier picked up the package from the seller.',
      ON_THE_WAY: 'The order is on the way to you.',
      CREATED: 'The seller has created delivery.',
      IN_TRANSIT: 'The order is on the way.',
      DELIVERED: 'The order has been delivered.',
      CANCELLED: 'The delivery was cancelled.',
      FAILED: 'The delivery needs seller or admin attention.',
    };
    return messages[status] ?? 'Delivery status is available.';
  }

  private customerSafeFailureReason(reasonCode: string | null) {
    if (!reasonCode) return null;
    return reasonCode === 'OTHER' ? null : reasonCode;
  }
}
