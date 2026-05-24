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

  @ApiProperty({ nullable: true, enum: ['en', 'ru', 'vi'] })
  preferredLocale!: 'en' | 'ru' | 'vi' | null;

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

  @ApiProperty({ nullable: true })
  sellerRejectionReason!: string | null;

  @ApiProperty({ nullable: true, example: 'WAIT_FOR_APPROVAL' })
  sellerNextStep!: string | null;

  @ApiProperty({ nullable: true })
  sellerOnboardingComplete!: boolean | null;

  @ApiProperty()
  isSyntheticEmail!: boolean;
}
