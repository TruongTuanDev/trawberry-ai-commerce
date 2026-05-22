import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  REFUND_REASONS,
  RETURN_REFUND_STATUSES,
} from '../return-refunds.constants';

export class ListReturnRefundCasesQueryDto {
  @ApiPropertyOptional({ enum: RETURN_REFUND_STATUSES })
  @IsOptional()
  @IsIn(RETURN_REFUND_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: REFUND_REASONS })
  @IsOptional()
  @IsIn(REFUND_REASONS)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shopId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
