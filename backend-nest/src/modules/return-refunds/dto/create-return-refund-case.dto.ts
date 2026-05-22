import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  REFUND_REASONS,
  RETURN_REFUND_TYPES,
} from '../return-refunds.constants';

export class CreateReturnRefundCaseDto {
  @ApiProperty({ enum: RETURN_REFUND_TYPES })
  @IsIn(RETURN_REFUND_TYPES)
  type!: (typeof RETURN_REFUND_TYPES)[number];

  @ApiProperty({ enum: REFUND_REASONS })
  @IsIn(REFUND_REASONS)
  reason!: (typeof REFUND_REASONS)[number];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  requestedAmount!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  buyerComment!: string;

  @ApiProperty({ isArray: true, required: false, type: String })
  @IsOptional()
  evidenceIds?: string[];
}
