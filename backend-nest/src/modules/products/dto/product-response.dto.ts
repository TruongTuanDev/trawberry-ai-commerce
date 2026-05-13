import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  wbNmId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true })
  wbTitle!: string | null;

  @ApiProperty({ nullable: true })
  localTitle!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  visibility!: string | null;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  wbVendorCode!: string | null;

  @ApiProperty({ nullable: true })
  mainImage!: string | null;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty()
  trackInventory!: boolean;

  @ApiProperty({
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NOT_TRACKED'],
  })
  stockStatus!: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

  @ApiProperty()
  variantCount!: number;

  @ApiProperty({ nullable: true })
  primaryVariantId!: string | null;
}
