import { ApiProperty } from '@nestjs/swagger';

export class SponsoredCampaignPerformanceSummaryDto {
  @ApiProperty()
  spentAmount!: string;

  @ApiProperty({ nullable: true })
  budgetLimit!: string | null;

  @ApiProperty({ nullable: true })
  remainingBudget!: string | null;

  @ApiProperty()
  billableImpressions!: number;

  @ApiProperty()
  billableClicks!: number;

  @ApiProperty()
  totalClicks!: number;

  @ApiProperty()
  chargedClicks!: number;

  @ApiProperty()
  invalidClicks!: number;

  @ApiProperty()
  totalChargedEvents!: number;

  @ApiProperty()
  totalEvents!: number;

  @ApiProperty()
  servedAsSponsored!: boolean;

  @ApiProperty()
  budgetExhausted!: boolean;

  @ApiProperty()
  walletBlocked!: boolean;

  @ApiProperty()
  cpcAmount!: string;
}

export class SponsoredCampaignEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  placement!: string;

  @ApiProperty({ nullable: true })
  scenarioType!: string | null;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true })
  algorithm!: string | null;

  @ApiProperty()
  sponsored!: boolean;

  @ApiProperty()
  charged!: boolean;

  @ApiProperty()
  chargeStatus!: string;

  @ApiProperty({ nullable: true })
  cost!: string | null;

  @ApiProperty({ nullable: true })
  ledgerEntryId!: string | null;

  @ApiProperty({ nullable: true })
  createdAt!: string;
}

export class SponsoredCampaignPerformanceResponseDto {
  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty({ type: SponsoredCampaignPerformanceSummaryDto })
  summary!: SponsoredCampaignPerformanceSummaryDto;

  @ApiProperty({ type: [SponsoredCampaignEventResponseDto] })
  recentEvents!: SponsoredCampaignEventResponseDto[];
}
