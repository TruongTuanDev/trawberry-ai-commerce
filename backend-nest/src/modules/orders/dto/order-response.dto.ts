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

  @ApiProperty({ nullable: true })
  sellerSku!: string | null;
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

  @ApiProperty({ nullable: true })
  courierPhone!: string | null;

  @ApiProperty({ nullable: true })
  estimatedDeliveryAt!: string | null;

  @ApiProperty({ nullable: true })
  deliveryNote!: string | null;
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

class OrderReturnRefundCaseSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  requestedAmount!: string;

  @ApiProperty({ nullable: true })
  approvedAmount!: string | null;

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

  @ApiProperty({ nullable: true })
  paymentMethod!: string | null;

  @ApiProperty({ nullable: true })
  paymentMethodLabel!: string | null;

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

  @ApiProperty()
  itemsCount!: number;

  @ApiProperty()
  sellerDisplayStatus!: string;

  @ApiProperty()
  sellerDisplayLabel!: string;

  @ApiProperty()
  sellerStatusBucket!: string;

  @ApiProperty({ nullable: true })
  nextAction!: string | null;

  @ApiProperty({ nullable: true })
  sellerArchivedAt!: string | null;

  @ApiProperty({ nullable: true })
  sellerArchiveSourceStatus!: string | null;

  @ApiProperty({ type: OrderItemResponseDto, isArray: true })
  items!: OrderItemResponseDto[];

  @ApiProperty({ type: OrderDeliveryResponseDto, nullable: true })
  delivery!: OrderDeliveryResponseDto | null;

  @ApiProperty({ nullable: true })
  paymentDetails!: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  finance!: {
    ledgerStatus: string | null;
    commissionAmount: string | null;
    invoiceStatus: string | null;
  } | null;

  @ApiProperty({ type: OrderSupportCaseSummaryDto, isArray: true })
  supportCases!: OrderSupportCaseSummaryDto[];

  @ApiProperty({ type: OrderReturnRefundCaseSummaryDto, isArray: true })
  returnRefundCases!: OrderReturnRefundCaseSummaryDto[];
}
