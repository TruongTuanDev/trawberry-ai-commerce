import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateProductInventoryDto {
  @ApiPropertyOptional({
    description:
      'Optional variant id. When omitted, the first active variant is used for this MVP.',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({
    example: 5,
    description: 'Absolute stock quantity for the selected variant.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiPropertyOptional({
    example: 'Restocked after receiving supplier shipment.',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
