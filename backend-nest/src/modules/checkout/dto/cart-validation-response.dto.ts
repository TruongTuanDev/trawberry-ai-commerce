import { ApiProperty } from '@nestjs/swagger';

export class CartValidationItemResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty({ nullable: true })
  variantId!: string | null;

  @ApiProperty()
  requestedQuantity!: number;

  @ApiProperty()
  available!: boolean;

  @ApiProperty({
    enum: [
      'OK',
      'PRODUCT_NOT_FOUND',
      'PRODUCT_NOT_PUBLIC',
      'PRODUCT_ARCHIVED',
      'VARIANT_NOT_FOUND',
      'OUT_OF_STOCK',
      'QUANTITY_EXCEEDS_STOCK',
      'MISSING_PRICE',
      'PRICE_CHANGED',
    ],
  })
  status!:
    | 'OK'
    | 'PRODUCT_NOT_FOUND'
    | 'PRODUCT_NOT_PUBLIC'
    | 'PRODUCT_ARCHIVED'
    | 'VARIANT_NOT_FOUND'
    | 'OUT_OF_STOCK'
    | 'QUANTITY_EXCEEDS_STOCK'
    | 'MISSING_PRICE'
    | 'PRICE_CHANGED';

  @ApiProperty({ nullable: true })
  productName!: string | null;

  @ApiProperty({ nullable: true })
  variantName!: string | null;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  unitPrice!: number | null;

  @ApiProperty()
  currentStock!: number;

  @ApiProperty()
  maxQuantity!: number;

  @ApiProperty()
  trackInventory!: boolean;

  @ApiProperty()
  lineTotal!: number;

  @ApiProperty({ nullable: true })
  shopId!: string | null;

  @ApiProperty({ nullable: true })
  shopName!: string | null;
}

export class CartValidationSummaryResponseDto {
  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  invalidCount!: number;

  @ApiProperty()
  changedCount!: number;
}

export class CartValidationResponseDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty({ type: [CartValidationItemResponseDto] })
  items!: CartValidationItemResponseDto[];

  @ApiProperty({ type: CartValidationSummaryResponseDto })
  summary!: CartValidationSummaryResponseDto;
}
