import { ApiProperty } from '@nestjs/swagger';

export class ShopPaymentSettingsResponseDto {
  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  paymentMode!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  bankName!: string | null;

  @ApiProperty({ nullable: true })
  recipientName!: string | null;

  @ApiProperty({ nullable: true })
  recipientPhone!: string | null;

  @ApiProperty({ nullable: true })
  recipientAccount!: string | null;

  @ApiProperty({ nullable: true })
  sbpPhone!: string | null;

  @ApiProperty({ nullable: true })
  staticQrImageUrl!: string | null;

  @ApiProperty({ nullable: true })
  paymentInstruction!: string | null;

  @ApiProperty()
  isReady!: boolean;

  @ApiProperty()
  usesLegacyInstructions!: boolean;
}
