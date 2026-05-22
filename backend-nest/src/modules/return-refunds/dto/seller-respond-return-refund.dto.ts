import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SELLER_RETURN_ACTIONS } from '../return-refunds.constants';

export class SellerRespondReturnRefundDto {
  @ApiProperty({ enum: SELLER_RETURN_ACTIONS })
  @IsIn(SELLER_RETURN_ACTIONS)
  action!: (typeof SELLER_RETURN_ACTIONS)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  sellerComment?: string;
}
