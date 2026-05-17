import { ApiProperty } from '@nestjs/swagger';

class BulkUpdatedProductReadinessDto {
  @ApiProperty()
  ready!: boolean;

  @ApiProperty({ isArray: true, type: String })
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

class BulkUpdateProductsItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  success!: boolean;

  @ApiProperty({ nullable: true })
  error!: string | null;

  @ApiProperty({ type: BulkUpdatedProductReadinessDto, nullable: true })
  readiness!: BulkUpdatedProductReadinessDto | null;
}

export class BulkUpdateProductsResponseDto {
  @ApiProperty()
  updated!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty({ type: BulkUpdateProductsItemDto, isArray: true })
  items!: BulkUpdateProductsItemDto[];
}
