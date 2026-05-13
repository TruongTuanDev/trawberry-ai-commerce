import { ApiProperty } from '@nestjs/swagger';

export class DeliverySettingsResponseDto {
  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  pickupCountry!: string;

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  pickupCity!: string;

  @ApiProperty({ nullable: true })
  pickupPostalCode!: string | null;

  @ApiProperty()
  pickupContactPhone!: string;

  @ApiProperty({ nullable: true })
  pickupLatitude!: string | null;

  @ApiProperty({ nullable: true })
  pickupLongitude!: string | null;

  @ApiProperty()
  pickupContactName!: string;

  @ApiProperty({ type: [String] })
  enabledCarriers!: string[];

  @ApiProperty()
  defaultCarrier!: string;

  @ApiProperty()
  sameCityPreferredCarrier!: string;

  @ApiProperty()
  interCityPreferredCarrier!: string;

  @ApiProperty()
  fallbackCarrier!: string;

  @ApiProperty()
  defaultWeightGram!: number;

  @ApiProperty()
  defaultLengthCm!: number;

  @ApiProperty()
  defaultWidthCm!: number;

  @ApiProperty()
  defaultHeightCm!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
