import { ApiProperty } from '@nestjs/swagger';

class ProductCategoryDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

class ProductShopDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

class ProductImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  wbUrl!: string;

  @ApiProperty({ nullable: true })
  localUrl!: string | null;

  @ApiProperty()
  isMain!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

class ProductVariantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  chrtId!: string;

  @ApiProperty({ nullable: true })
  techSize!: string | null;

  @ApiProperty({ nullable: true })
  wbSize!: string | null;

  @ApiProperty({ nullable: true })
  basePrice!: string | null;

  @ApiProperty({ nullable: true })
  discountPrice!: string | null;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  reservedStock!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty()
  trackInventory!: boolean;

  @ApiProperty({
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NOT_TRACKED'],
  })
  stockStatus!: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

  @ApiProperty()
  inStock!: boolean;
}

export class ProductDetailResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  wbNmId!: string;

  @ApiProperty({ nullable: true })
  wbImtId!: string | null;

  @ApiProperty()
  wbTitle!: string;

  @ApiProperty({ nullable: true })
  localTitle!: string | null;

  @ApiProperty({ nullable: true })
  title!: string | null;

  @ApiProperty({ nullable: true })
  wbDescription!: string | null;

  @ApiProperty({ nullable: true })
  localDescription!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  visibility!: string | null;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  wbVendorCode!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  sourceCategoryName!: string | null;

  @ApiProperty({ nullable: true })
  sourceCategorySource!: string | null;

  @ApiProperty({ nullable: true, type: ProductCategoryDto })
  category!: ProductCategoryDto | null;

  @ApiProperty({ type: ProductShopDto })
  shop!: ProductShopDto;

  @ApiProperty({ type: ProductImageDto, isArray: true })
  images!: ProductImageDto[];

  @ApiProperty({ type: ProductVariantDto, isArray: true })
  variants!: ProductVariantDto[];
}
