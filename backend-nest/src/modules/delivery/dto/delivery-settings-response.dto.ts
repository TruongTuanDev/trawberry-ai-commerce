import { ApiProperty } from '@nestjs/swagger';

export class DeliverySettingsResponseDto {
  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  pickupCity!: string;

  @ApiProperty({ nullable: true })
  pickupPostalCode!: string | null;

  @ApiProperty()
  pickupPhone!: string;

  @ApiProperty()
  pickupContactName!: string;

  @ApiProperty({ type: [String] })
  enabledCarriers!: string[];

  @ApiProperty()
  defaultCarrier!: string;

  @ApiProperty()
  defaultWeight!: string;

  @ApiProperty()
  defaultLength!: string;

  @ApiProperty()
  defaultWidth!: string;

  @ApiProperty()
  defaultHeight!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
