import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ required: false })
  success?: boolean;

  @ApiProperty({ required: false, example: 'REGISTERED' })
  message?: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  fullName!: string | null;

  @ApiProperty({ example: 'CUSTOMER' })
  role!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ nullable: true, example: 'PENDING' })
  approvalStatus!: string | null;

  @ApiProperty({ nullable: true, example: 'WAIT_FOR_APPROVAL' })
  sellerNextStep!: string | null;

  @ApiProperty({ nullable: true })
  sellerOnboardingComplete!: boolean | null;

  @ApiProperty()
  isSyntheticEmail!: boolean;
}
