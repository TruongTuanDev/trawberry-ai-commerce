import { ApiProperty } from '@nestjs/swagger';

class CheckoutSplitOrderResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  orderCode!: string;

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

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;

  @ApiProperty()
  trackingPath!: string;

  @ApiProperty()
  itemsCount!: number;
}

export class CheckoutOrderResponseDto {
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
  paymentInstructions!: string | null;

  @ApiProperty()
  trackingPath!: string;

  @ApiProperty()
  customerPhone!: string;

  @ApiProperty({ type: CheckoutSplitOrderResponseDto, isArray: true })
  orders!: CheckoutSplitOrderResponseDto[];

  @ApiProperty({ type: String, isArray: true })
  orderCodes!: string[];

  @ApiProperty()
  grandTotal!: string;
}
