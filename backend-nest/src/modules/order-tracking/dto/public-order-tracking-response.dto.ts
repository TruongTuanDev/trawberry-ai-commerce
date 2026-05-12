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

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  priceAtPurchase!: string;

  @ApiProperty()
  productTitleSnapshot!: string;

  @ApiProperty()
  productSlugSnapshot!: string;

  @ApiProperty({ nullable: true })
  productImageSnapshot!: string | null;
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
  paymentInstructions!: string | null;

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

  @ApiProperty({ type: PublicOrderReviewLogDto, isArray: true })
  paymentLogs!: PublicOrderReviewLogDto[];
}
