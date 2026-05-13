import { ApiProperty } from '@nestjs/swagger';

export class DeliveryOfferDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  offerType!: string;

  @ApiProperty()
  priceAmount!: string;

  @ApiProperty()
  priceCurrency!: string;

  @ApiProperty({ nullable: true })
  estimatedMinMinutes!: number | null;

  @ApiProperty({ nullable: true })
  estimatedMaxMinutes!: number | null;

  @ApiProperty({ nullable: true })
  estimatedMinDays!: number | null;

  @ApiProperty({ nullable: true })
  estimatedMaxDays!: number | null;

  @ApiProperty({ nullable: true })
  pickupPointId!: string | null;

  @ApiProperty()
  isRecommended!: boolean;

  @ApiProperty({ nullable: true })
  expiresAt!: string | null;
}
