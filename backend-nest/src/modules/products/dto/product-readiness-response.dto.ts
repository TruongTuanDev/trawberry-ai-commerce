import { ApiProperty } from '@nestjs/swagger';

export class ProductReadinessResponseDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  ready!: boolean;

  @ApiProperty({
    isArray: true,
    enum: [
      'SELLER_NOT_APPROVED',
      'SHOP_INACTIVE',
      'PRODUCT_ARCHIVED',
      'MISSING_NAME',
      'MISSING_IMAGE',
      'MISSING_CATEGORY',
      'NO_ACTIVE_VARIANT',
      'MISSING_PRICE',
      'MISSING_STOCK',
    ],
  })
  blockingReasons!: string[];

  @ApiProperty({
    enum: [
      'IMPORTED',
      'DRAFT',
      'READY',
      'PUBLISHED',
      'UNPUBLISHED',
      'ARCHIVED',
    ],
  })
  catalogStatus!: string;
}
