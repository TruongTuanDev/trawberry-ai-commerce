import { ApiProperty } from '@nestjs/swagger';

export class DeliveryShipmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty({ nullable: true })
  providerShipmentId!: string | null;

  @ApiProperty({ nullable: true })
  providerOrderNumber!: string | null;

  @ApiProperty()
  providerStatus!: string;

  @ApiProperty()
  internalStatus!: string;

  @ApiProperty({ nullable: true })
  priceAmount!: string | null;

  @ApiProperty()
  priceCurrency!: string;

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
  deliveryNote!: string | null;

  @ApiProperty({ nullable: true })
  failureReasonCode!: string | null;

  @ApiProperty({ nullable: true })
  failureReasonText!: string | null;

  @ApiProperty({ nullable: true })
  failedAt!: string | null;

  @ApiProperty({ nullable: true })
  customerVisibleMessage!: string | null;

  @ApiProperty({ nullable: true })
  lastAdminNote!: string | null;

  @ApiProperty({ nullable: true })
  lastSellerNote!: string | null;

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty({ nullable: true })
  pickupLatitude!: string | null;

  @ApiProperty({ nullable: true })
  pickupLongitude!: string | null;

  @ApiProperty({ nullable: true })
  pickupAddressFullName!: string | null;

  @ApiProperty()
  dropoffAddress!: string;

  @ApiProperty({ nullable: true })
  dropoffAddressFullName!: string | null;

  @ApiProperty({ nullable: true })
  dropoffCity!: string | null;

  @ApiProperty({ nullable: true })
  dropoffStreet!: string | null;

  @ApiProperty({ nullable: true })
  dropoffBuilding!: string | null;

  @ApiProperty({ nullable: true })
  dropoffEntrance!: string | null;

  @ApiProperty({ nullable: true })
  dropoffIntercom!: string | null;

  @ApiProperty({ nullable: true })
  dropoffFloor!: string | null;

  @ApiProperty({ nullable: true })
  dropoffApartment!: string | null;

  @ApiProperty({ nullable: true })
  dropoffGeoPrecision!: string | null;

  @ApiProperty({ nullable: true })
  dropoffComment!: string | null;

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

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ nullable: true })
  deliveredAt!: string | null;
}
