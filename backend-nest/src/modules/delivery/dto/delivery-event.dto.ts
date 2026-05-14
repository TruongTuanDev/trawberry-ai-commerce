import { ApiProperty } from '@nestjs/swagger';

export class DeliveryEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true })
  actorRole!: string | null;

  @ApiProperty({ nullable: true })
  action!: string | null;

  @ApiProperty({ nullable: true })
  oldStatus!: string | null;

  @ApiProperty({ nullable: true })
  newStatus!: string | null;

  @ApiProperty({ nullable: true })
  providerStatus!: string | null;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty()
  createdAt!: string;
}
