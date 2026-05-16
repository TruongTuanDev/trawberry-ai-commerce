import { ApiProperty } from '@nestjs/swagger';

class OrderItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  variantId!: string | null;

  @ApiProperty({ nullable: true })
  productId!: string | null;

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

class OrderCustomerResponseDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ nullable: true })
  email!: string | null;
}

class OrderDeliveryResponseDto {
  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  providerShipmentId!: string | null;

  @ApiProperty({ nullable: true })
  trackingNumber!: string | null;

  @ApiProperty({ nullable: true })
  trackingUrl!: string | null;
}

class OrderSupportCaseSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  issueType!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  createdAt!: string;
}

export class OrderResponseDto {
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

  @ApiProperty()
  totalAmount!: string;

  @ApiProperty()
  shippingCost!: string;

  @ApiProperty({ nullable: true })
  shippingMethodName!: string | null;

  @ApiProperty()
  shippingAddress!: string;

  @ApiProperty({ type: OrderCustomerResponseDto })
  customer!: OrderCustomerResponseDto;

  @ApiProperty({ nullable: true })
  customerNote!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  customerCompletedAt!: string | null;

  @ApiProperty({ type: OrderItemResponseDto, isArray: true })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: OrderDeliveryResponseDto, nullable: true })
  delivery!: OrderDeliveryResponseDto | null;

  @ApiProperty({ type: OrderSupportCaseSummaryDto, isArray: true })
  supportCases!: OrderSupportCaseSummaryDto[];
}
