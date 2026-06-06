import { ApiProperty } from '@nestjs/swagger';

export class SponsoredCampaignTargetProductSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty()
  catalogStatus!: string;

  @ApiProperty({ nullable: true })
  visibility!: string | null;
}

export class SponsoredCampaignTargetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  campaignId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  boost!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: SponsoredCampaignTargetProductSummaryDto })
  product!: SponsoredCampaignTargetProductSummaryDto;
}

export class SponsoredCampaignBillingSummaryDto {
  @ApiProperty()
  mode!: string;

  @ApiProperty({ nullable: true })
  budgetLimit!: string | null;

  @ApiProperty()
  chargingEnabled!: boolean;

  @ApiProperty()
  spendTracked!: boolean;

  @ApiProperty({ type: [String] })
  notes!: string[];
}

export class SponsoredCampaignSummaryDto {
  @ApiProperty()
  totalTargets!: number;

  @ApiProperty()
  activeTargets!: number;

  @ApiProperty()
  pausedTargets!: number;

  @ApiProperty()
  removedTargets!: number;
}

export class SponsoredCampaignResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [String] })
  scenarioTypes!: string[];

  @ApiProperty({ nullable: true })
  startAt!: string | null;

  @ApiProperty({ nullable: true })
  endAt!: string | null;

  @ApiProperty({ nullable: true })
  budgetLimit!: string | null;

  @ApiProperty()
  billingMode!: string;

  @ApiProperty()
  maxBoost!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: SponsoredCampaignBillingSummaryDto })
  billing!: SponsoredCampaignBillingSummaryDto;

  @ApiProperty({ type: SponsoredCampaignSummaryDto })
  summary!: SponsoredCampaignSummaryDto;

  @ApiProperty({ type: [SponsoredCampaignTargetResponseDto] })
  targets!: SponsoredCampaignTargetResponseDto[];
}
