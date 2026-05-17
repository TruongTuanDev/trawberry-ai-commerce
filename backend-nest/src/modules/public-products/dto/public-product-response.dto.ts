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

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;
}

class PublicProductVariantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  sizeName!: string | null;

  @ApiProperty({ nullable: true })
  russianSize!: string | null;

  @ApiProperty({ nullable: true })
  techSize!: string | null;

  @ApiProperty({ nullable: true })
  wbSize!: string | null;

  @ApiProperty({ nullable: true })
  sellerSku!: string | null;

  @ApiProperty({ nullable: true })
  price!: string | null;

  @ApiProperty({ nullable: true })
  originalPrice!: string | null;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty()
  trackInventory!: boolean;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty()
  availableQuantity!: number;
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
  color!: string | null;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ nullable: true })
  composition!: string | null;

  @ApiProperty({ nullable: true })
  sellerSku!: string | null;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryId!: string | null;

  @ApiProperty({ nullable: true })
  categorySlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  sourceCategoryName!: string | null;

  @ApiProperty({ nullable: true })
  price!: string | null;

  @ApiProperty({ nullable: true })
  oldPrice!: string | null;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty()
  availableQuantity!: number;

  @ApiProperty({ nullable: true })
  averageRating!: string | null;

  @ApiProperty()
  feedbackCount!: number;

  @ApiProperty({ type: PublicProductImageDto, isArray: true })
  images!: PublicProductImageDto[];

  @ApiProperty({ type: PublicProductVariantDto, isArray: true })
  variants!: PublicProductVariantDto[];

  @ApiProperty({ type: PublicProductShopDto })
  shop!: PublicProductShopDto;
}
