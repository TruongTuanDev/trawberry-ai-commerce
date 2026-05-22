import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { REFUND_TRANSFER_METHODS } from '../return-refunds.constants';

export class SellerRefundSentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ enum: REFUND_TRANSFER_METHODS })
  @IsIn(REFUND_TRANSFER_METHODS)
  method!: (typeof REFUND_TRANSFER_METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}
