import { ApiProperty } from '@nestjs/swagger';

export class SellerWalletResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  balance!: string;

  @ApiProperty()
  reservedBalance!: string;

  @ApiProperty()
  availableBalance!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
