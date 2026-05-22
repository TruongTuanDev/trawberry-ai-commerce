import { ApiProperty } from '@nestjs/swagger';

class PublicOrderCustomerDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  address!: string;
}

class PublicOrderItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  productId!: string | null;

  @ApiProperty({ nullable: true })
  variantId!: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  priceAtPurchase!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  lineTotal!: string;

  @ApiProperty()
  productTitleSnapshot!: string;

  @ApiProperty()
  productSlugSnapshot!: string;

  @ApiProperty({ nullable: true })
  productImageSnapshot!: string | null;

  @ApiProperty({ nullable: true })
  variantNameSnapshot!: string | null;
}

class PublicOrderPaymentProofDto {
  @ApiProperty()
  url!: string;

  @ApiProperty({ nullable: true })
  originalName!: string | null;

  @ApiProperty({ nullable: true })
  mimeType!: string | null;

  @ApiProperty({ nullable: true })
  size!: number | null;

  @ApiProperty({ nullable: true })
  uploadedAt!: string | null;
}

class PublicOrderReviewLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  fromStatus!: string | null;

  @ApiProperty({ nullable: true })
  toStatus!: string | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty({ nullable: true })
  reviewerName!: string | null;

  @ApiProperty()
  createdAt!: string;
}

class PublicOrderPaymentDetailsDto {
  @ApiProperty({ nullable: true })
  mode!: string | null;

  @ApiProperty({ nullable: true })
  bankName!: string | null;

  @ApiProperty({ nullable: true })
  recipientName!: string | null;

  @ApiProperty({ nullable: true })
  recipientPhone!: string | null;

  @ApiProperty({ nullable: true })
  recipientAccount!: string | null;

  @ApiProperty({ nullable: true })
  sbpPhone!: string | null;

  @ApiProperty({ nullable: true })
  staticQrImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  paymentInstruction!: string | null;
}

class PublicOrderDeliveryDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  statusLabel!: string;

  @ApiProperty()
  statusMessage!: string;

  @ApiProperty()
  internalStatus!: string;

  @ApiProperty()
  providerStatus!: string;

  @ApiProperty({ nullable: true })
  providerShipmentId!: string | null;

  @ApiProperty({ nullable: true })
  trackingNumber!: string | null;

  @ApiProperty({ nullable: true })
  trackingUrl!: string | null;

  @ApiProperty({ nullable: true })
  courierName!: string | null;

  @ApiProperty({ nullable: true })
  courierPhone!: string | null;

  @ApiProperty({ nullable: true })
  estimatedDeliveryAt!: string | null;

  @ApiProperty({ nullable: true })
  packagePreset!: string | null;

  @ApiProperty({ nullable: true })
  packageWeightGram!: number | null;

  @ApiProperty({ nullable: true })
  packageLengthCm!: number | null;

  @ApiProperty({ nullable: true })
  packageWidthCm!: number | null;

  @ApiProperty({ nullable: true })
  packageHeightCm!: number | null;

  @ApiProperty({ nullable: true })
  pickupAddress!: string | null;

  @ApiProperty({ nullable: true })
  pickupLatitude!: string | null;

  @ApiProperty({ nullable: true })
  pickupLongitude!: string | null;

  @ApiProperty({ nullable: true })
  dropoffLatitude!: string | null;

  @ApiProperty({ nullable: true })
  dropoffLongitude!: string | null;

  @ApiProperty({ nullable: true })
  recipientName!: string | null;

  @ApiProperty({ nullable: true })
  recipientPhone!: string | null;

  @ApiProperty({ nullable: true })
  manualYandexOrderId!: string | null;

  @ApiProperty({ nullable: true })
  yandexClaimId!: string | null;

  @ApiProperty({ nullable: true })
  yandexStatus!: string | null;

  @ApiProperty({ nullable: true })
  yandexPrice!: string | null;

  @ApiProperty({ nullable: true })
  yandexTrackingLink!: string | null;

  @ApiProperty({ nullable: true })
  deliveryNote!: string | null;
}

export class PublicOrderTrackingResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty({ nullable: true })
  paymentMethod!: string | null;

  @ApiProperty({ nullable: true })
  paymentMethodLabel!: string | null;

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;

  @ApiProperty({ type: PublicOrderPaymentDetailsDto })
  paymentDetails!: PublicOrderPaymentDetailsDto;

  @ApiProperty({ type: PublicOrderCustomerDto })
  customer!: PublicOrderCustomerDto;

  @ApiProperty({ nullable: true })
  customerNote!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: PublicOrderItemDto, isArray: true })
  items!: PublicOrderItemDto[];

  @ApiProperty({ type: PublicOrderPaymentProofDto, nullable: true })
  paymentProof!: PublicOrderPaymentProofDto | null;

  @ApiProperty()
  paymentProofStatus!: string;

  @ApiProperty({ nullable: true })
  buyerPaymentNote!: string | null;

  @ApiProperty({ type: PublicOrderReviewLogDto, isArray: true })
  paymentLogs!: PublicOrderReviewLogDto[];

  @ApiProperty({ type: PublicOrderDeliveryDto, nullable: true })
  delivery!: PublicOrderDeliveryDto | null;
}
