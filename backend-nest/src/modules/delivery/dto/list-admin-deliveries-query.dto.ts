import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  DELIVERY_CARRIERS,
  MANUAL_DELIVERY_STATUSES,
} from '../delivery.constants';

export class ListAdminDeliveriesQueryDto {
  @ApiPropertyOptional({ enum: MANUAL_DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(MANUAL_DELIVERY_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: DELIVERY_CARRIERS })
  @IsOptional()
  @IsIn(DELIVERY_CARRIERS)
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  paidWithoutDelivery?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
