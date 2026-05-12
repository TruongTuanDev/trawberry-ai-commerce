import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  fullName!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  sellerProfileId!: string | null;

  @ApiProperty({ nullable: true })
  currentShopId!: string | null;

  @ApiProperty({ nullable: true })
  sellerApprovalStatus!: string | null;
}
