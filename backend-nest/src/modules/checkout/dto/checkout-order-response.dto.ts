import { ApiProperty } from '@nestjs/swagger';

class CheckoutAddressGeoReadinessDto {
  @ApiProperty()
  hasStructuredAddress!: boolean;

  @ApiProperty()
  hasCoordinates!: boolean;

  @ApiProperty({ nullable: true })
  geoPrecision!: string | null;

  @ApiProperty()
  isYandexManualReady!: boolean;

  @ApiProperty()
  isYandexApiReady!: boolean;

  @ApiProperty({ type: String, isArray: true })
  missingFields!: string[];
}

class CheckoutPaymentDetailsDto {
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

  @ApiProperty({ type: CheckoutPaymentDetailsDto })
  paymentDetails!: CheckoutPaymentDetailsDto;

  @ApiProperty()
  trackingPath!: string;

  @ApiProperty()
  itemsCount!: number;

  @ApiProperty({ type: CheckoutAddressGeoReadinessDto })
  addressGeoReadiness!: CheckoutAddressGeoReadinessDto;

  @ApiProperty({ type: String, isArray: true })
  addressWarnings!: string[];
}

export class CheckoutOrderResponseDto {
  @ApiProperty()
  checkoutId!: string;

  @ApiProperty()
  checkoutCode!: string;

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

  @ApiProperty({ type: CheckoutPaymentDetailsDto })
  paymentDetails!: CheckoutPaymentDetailsDto;

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

  @ApiProperty({ type: CheckoutAddressGeoReadinessDto })
  addressGeoReadiness!: CheckoutAddressGeoReadinessDto;

  @ApiProperty({ type: String, isArray: true })
  addressWarnings!: string[];
}
