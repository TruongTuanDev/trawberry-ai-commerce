import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListShopPaymentsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  size = 20;

  @ApiPropertyOptional({
    enum: ['PENDING', 'UNPAID', 'PAID', 'APPROVED', 'REJECTED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'UNPAID', 'PAID', 'APPROVED', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: [
      'NOT_SUBMITTED',
      'BUYER_MARKED_PAID',
      'SELLER_CONFIRMED',
      'SELLER_REJECTED',
      'ADMIN_REVIEW',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'NOT_SUBMITTED',
    'BUYER_MARKED_PAID',
    'SELLER_CONFIRMED',
    'SELLER_REJECTED',
    'ADMIN_REVIEW',
  ])
  proofStatus?: string;
}
