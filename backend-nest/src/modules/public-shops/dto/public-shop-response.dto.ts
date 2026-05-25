import { ApiProperty } from '@nestjs/swagger';

class PublicShopProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true })
  bannerUrl!: string | null;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ nullable: true })
  approvedAt!: string | null;

  @ApiProperty()
  productCount!: number;

  @ApiProperty({ nullable: true })
  ratingAverage!: string | null;

  @ApiProperty()
  ratingCount!: number;

  @ApiProperty({ nullable: true })
  joinedAt!: string | null;

  @ApiProperty({ nullable: true })
  locationLabel!: string | null;
}

export class PublicShopResponseDto {
  @ApiProperty({ type: PublicShopProfileDto })
  shop!: PublicShopProfileDto;
}
