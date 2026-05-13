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

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  dropoffAddress!: string;

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
