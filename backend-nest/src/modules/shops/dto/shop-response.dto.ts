import { ApiProperty } from '@nestjs/swagger';

export class ShopResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  sellerProfileId!: string;

  @ApiProperty()
  productCount!: number;

  @ApiProperty({ nullable: true })
  contactInfo!: string | null;

  @ApiProperty({ nullable: true })
  bankName!: string | null;

  @ApiProperty({ nullable: true })
  accountNumber!: string | null;

  @ApiProperty({ nullable: true })
  accountHolderName!: string | null;

  @ApiProperty({ nullable: true })
  bik!: string | null;

  @ApiProperty({ nullable: true })
  correspondentAccount!: string | null;

  @ApiProperty({ nullable: true })
  paymentInstructions!: string | null;
}
