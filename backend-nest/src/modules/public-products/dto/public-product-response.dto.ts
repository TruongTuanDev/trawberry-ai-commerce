import { ApiProperty } from '@nestjs/swagger';

class PublicProductImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  isMain!: boolean;
}

class PublicProductShopDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;
}

export class PublicProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  price!: string | null;

  @ApiProperty({ type: PublicProductImageDto, isArray: true })
  images!: PublicProductImageDto[];

  @ApiProperty({ type: PublicProductShopDto })
  shop!: PublicProductShopDto;
}
