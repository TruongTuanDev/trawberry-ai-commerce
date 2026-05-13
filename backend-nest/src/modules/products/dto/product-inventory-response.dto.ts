import { ApiProperty } from '@nestjs/swagger';

class ProductInventoryVariantResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  chrtId!: string;

  @ApiProperty({ nullable: true })
  techSize!: string | null;

  @ApiProperty({ nullable: true })
  wbSize!: string | null;

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
  availableQuantity!: number;

  @ApiProperty()
  inStock!: boolean;
}

export class ProductInventoryResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  totalStockQuantity!: number;

  @ApiProperty()
  totalReservedStock!: number;

  @ApiProperty()
  totalLowStockThreshold!: number;

  @ApiProperty()
  trackInventory!: boolean;

  @ApiProperty({
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NOT_TRACKED'],
  })
  stockStatus!: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NOT_TRACKED';

  @ApiProperty()
  totalAvailableQuantity!: number;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty({ type: ProductInventoryVariantResponseDto, isArray: true })
  variants!: ProductInventoryVariantResponseDto[];
}
