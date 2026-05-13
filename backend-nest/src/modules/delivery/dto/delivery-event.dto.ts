import { ApiProperty } from '@nestjs/swagger';

export class DeliveryEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ nullable: true })
  providerStatus!: string | null;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty()
  createdAt!: string;
}
