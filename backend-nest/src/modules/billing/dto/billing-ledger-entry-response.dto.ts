import { ApiProperty } from '@nestjs/swagger';

class BillingLedgerCampaignReferenceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class BillingLedgerEntryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  walletId!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  balanceBefore!: string;

  @ApiProperty()
  balanceAfter!: string;

  @ApiProperty()
  reservedBefore!: string;

  @ApiProperty()
  reservedAfter!: string;

  @ApiProperty({ nullable: true })
  referenceType!: string | null;

  @ApiProperty({ nullable: true })
  referenceId!: string | null;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ nullable: true, type: BillingLedgerCampaignReferenceDto })
  campaign!: BillingLedgerCampaignReferenceDto | null;

  @ApiProperty()
  createdAt!: string;
}
