import { ApiProperty } from '@nestjs/swagger';

class CustomerAddressGeoReadinessDto {
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

export class CustomerAddressResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  region!: string;

  @ApiProperty({ nullable: true })
  federalSubject!: string | null;

  @ApiProperty({ nullable: true })
  cityType!: string | null;

  @ApiProperty({ nullable: true })
  district!: string | null;

  @ApiProperty({ nullable: true })
  settlement!: string | null;

  @ApiProperty()
  street!: string;

  @ApiProperty()
  building!: string;

  @ApiProperty({ nullable: true })
  streetType!: string | null;

  @ApiProperty({ nullable: true })
  buildingBlock!: string | null;

  @ApiProperty({ nullable: true })
  entrance!: string | null;

  @ApiProperty({ nullable: true })
  intercom!: string | null;

  @ApiProperty({ nullable: true })
  floor!: string | null;

  @ApiProperty({ nullable: true })
  apartment!: string | null;

  @ApiProperty({ nullable: true })
  postalCode!: string | null;

  @ApiProperty({ nullable: true })
  comment!: string | null;

  @ApiProperty({ nullable: true })
  latitude!: string | null;

  @ApiProperty({ nullable: true })
  longitude!: string | null;

  @ApiProperty()
  geoPrecision!: string;

  @ApiProperty()
  geoProvider!: string;

  @ApiProperty({ nullable: true })
  geoProviderUri!: string | null;

  @ApiProperty({ nullable: true })
  addressFullName!: string | null;

  @ApiProperty({ nullable: true })
  addressShortName!: string | null;

  @ApiProperty({ type: CustomerAddressGeoReadinessDto })
  geoReadiness!: CustomerAddressGeoReadinessDto;

  @ApiProperty({ type: String, isArray: true })
  missingYandexFields!: string[];

  @ApiProperty()
  yandexManualReady!: boolean;

  @ApiProperty()
  yandexApiReady!: boolean;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
