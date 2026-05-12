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

  @ApiProperty({ type: PaymentReviewLogResponseDto, isArray: true })
  reviewLogs!: PaymentReviewLogResponseDto[];
}
