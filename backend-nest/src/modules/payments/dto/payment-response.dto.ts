import { ApiProperty } from '@nestjs/swagger';
import { PaymentReviewLogResponseDto } from './payment-review-log-response.dto';

class PaymentCustomerDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;
}

class PaymentItemDto {
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

class PaymentProofDto {
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

class PaymentDetailsDto {
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

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  shopName!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty({ nullable: true })
  paymentMethod!: string | null;

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;

  @ApiProperty({ type: PaymentDetailsDto })
  paymentDetails!: PaymentDetailsDto;

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  shippingAddress!: string;

  @ApiProperty({ type: PaymentCustomerDto })
  customer!: PaymentCustomerDto;

  @ApiProperty({ nullable: true })
  customerNote!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: PaymentItemDto, isArray: true })
  items!: PaymentItemDto[];

  @ApiProperty({ type: PaymentProofDto, nullable: true })
  paymentProof!: PaymentProofDto | null;

  @ApiProperty()
  paymentProofStatus!: string;

  @ApiProperty({ nullable: true })
  buyerPaymentNote!: string | null;

  @ApiProperty({ type: PaymentReviewLogResponseDto, isArray: true })
  reviewLogs!: PaymentReviewLogResponseDto[];
}
