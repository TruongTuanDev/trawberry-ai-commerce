import { ApiProperty } from '@nestjs/swagger';

class AdminFulfillmentCustomerDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;
}

class AdminFulfillmentItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productTitleSnapshot!: string;

  @ApiProperty()
  quantity!: number;
}

class AdminFulfillmentSummaryDto {
  @ApiProperty()
  ALL!: number;

  @ApiProperty()
  NEW!: number;

  @ApiProperty()
  ASSEMBLING!: number;

  @ApiProperty()
  IN_TRANSIT!: number;

  @ApiProperty()
  COMPLETED!: number;

  @ApiProperty()
  CANCELLED!: number;

  @ApiProperty()
  ARCHIVED!: number;
}

class AdminFulfillmentMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AdminFulfillmentOrderResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

  @ApiProperty()
  sellerId!: string;

  @ApiProperty({ nullable: true })
  sellerName!: string | null;

  @ApiProperty()
  sellerEmail!: string;

  @ApiProperty({ nullable: true })
  sellerPhone!: string | null;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  shopName!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ type: AdminFulfillmentCustomerDto })
  customer!: AdminFulfillmentCustomerDto;

  @ApiProperty({ nullable: true })
  paymentMethod!: string | null;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  fulfillmentBucket!: string;

  @ApiProperty()
  fulfillmentLabel!: string;

  @ApiProperty({ nullable: true })
  deliveryStatus!: string | null;

  @ApiProperty({ nullable: true })
  deliveryShipmentId!: string | null;

  @ApiProperty({ nullable: true })
  manualYandexOrderId!: string | null;

  @ApiProperty({ nullable: true })
  yandexTrackingUrl!: string | null;

  @ApiProperty({ nullable: true })
  provider!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  sellerArchivedAt!: string | null;

  @ApiProperty()
  isOverdue!: boolean;

  @ApiProperty()
  ageMinutes!: number;

  @ApiProperty({ type: String, isArray: true })
  nextAdminActions!: string[];

  @ApiProperty({ type: AdminFulfillmentItemDto, isArray: true })
  items!: AdminFulfillmentItemDto[];
}

export class AdminFulfillmentOrdersResponseDto {
  @ApiProperty({ type: AdminFulfillmentOrderResponseDto, isArray: true })
  items!: AdminFulfillmentOrderResponseDto[];

  @ApiProperty({ type: AdminFulfillmentMetaDto })
  meta!: AdminFulfillmentMetaDto;

  @ApiProperty({ type: AdminFulfillmentSummaryDto })
  summary!: AdminFulfillmentSummaryDto;
}
