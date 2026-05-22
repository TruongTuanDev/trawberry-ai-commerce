import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ADMIN_RETURN_DECISIONS } from '../return-refunds.constants';

export class AdminReturnRefundDecisionDto {
  @ApiProperty({ enum: ADMIN_RETURN_DECISIONS })
  @IsIn(ADMIN_RETURN_DECISIONS)
  decision!: (typeof ADMIN_RETURN_DECISIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmount?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  adminNote!: string;
}
