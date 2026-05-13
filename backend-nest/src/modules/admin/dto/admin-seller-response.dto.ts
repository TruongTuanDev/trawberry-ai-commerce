import { ApiProperty } from '@nestjs/swagger';

export class AdminSellerResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  sellerApprovalStatus!: string;

  @ApiProperty({ nullable: true })
  sellerApprovedAt!: string | null;

  @ApiProperty({ nullable: true })
  sellerRejectedAt!: string | null;

  @ApiProperty({ nullable: true })
  sellerRejectionReason!: string | null;
}
