import { ApiProperty } from '@nestjs/swagger';

export class PaymentReviewLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  fromStatus!: string | null;

  @ApiProperty({ nullable: true })
  toStatus!: string | null;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  reviewerUserId!: string;

  @ApiProperty({ nullable: true })
  reviewerName!: string | null;

  @ApiProperty()
  createdAt!: string;
}
