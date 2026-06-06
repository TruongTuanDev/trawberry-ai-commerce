import { ApiProperty } from '@nestjs/swagger';

class RecommendationQaScoreBreakdownDto {
  @ApiProperty()
  categoryScore!: number;

  @ApiProperty()
  textScore!: number;

  @ApiProperty()
  popularityScore!: number;

  @ApiProperty()
  freshnessScore!: number;

  @ApiProperty()
  ratingScore!: number;

  @ApiProperty()
  stockScore!: number;

  @ApiProperty()
  shopScore!: number;

  @ApiProperty()
  penaltyScore!: number;

  @ApiProperty()
  sponsoredBoostScore!: number;

  @ApiProperty()
  businessBoostScore!: number;

  @ApiProperty()
  maxSponsoredBoost!: number;
}

class RecommendationQaSponsoredPresetDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty({ enum: ['experimental', 'stable', 'deprecated'] })
  stability!: 'experimental' | 'stable' | 'deprecated';

  @ApiProperty()
  maxSponsoredBoost!: number;

  @ApiProperty()
  maxBusinessBoost!: number;

  @ApiProperty({ enum: ['home', 'similar', 'search'], isArray: true })
  allowedScenarioTypes!: Array<'home' | 'similar' | 'search'>;

  @ApiProperty()
  notes!: string;
}

class RecommendationQaSponsoredCampaignDto {
  @ApiProperty({ nullable: true })
  campaignId!: string | null;

  @ApiProperty({ enum: ['none', 'campaign', 'business_boost', 'hybrid'] })
  sponsorType!: 'none' | 'campaign' | 'business_boost' | 'hybrid';

  @ApiProperty()
  maxBoost!: number;

  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ enum: ['none', 'cpc', 'cpm', 'fixed'] })
  billingMode!: 'none' | 'cpc' | 'cpm' | 'fixed';

  @ApiProperty({ enum: ['disabled', 'internal', 'limited', 'public'] })
  rolloutMode!: 'disabled' | 'internal' | 'limited' | 'public';
}

class RecommendationQaCampaignReadinessDto {
  @ApiProperty()
  sponsoredEligible!: boolean;

  @ApiProperty()
  sponsoredBoostApplied!: boolean;

  @ApiProperty()
  sponsoredBoostScore!: number;

  @ApiProperty({ nullable: true })
  sponsoredReason!: string | null;

  @ApiProperty({ nullable: true })
  sponsoredPresetId!: string | null;

  @ApiProperty({
    enum: ['disabled', 'not_targeted', 'ineligible', 'eligible', 'boosted'],
  })
  campaignReadinessStatus!:
    | 'disabled'
    | 'not_targeted'
    | 'ineligible'
    | 'eligible'
    | 'boosted';

  @ApiProperty({ enum: ['none', 'cpc', 'cpm', 'fixed'] })
  billingMode!: 'none' | 'cpc' | 'cpm' | 'fixed';

  @ApiProperty({ enum: ['disabled', 'internal', 'limited', 'public'] })
  rolloutMode!: 'disabled' | 'internal' | 'limited' | 'public';
}

class RecommendationQaSponsoredRankingDto {
  @ApiProperty()
  sponsoredRankingEnabled!: boolean;

  @ApiProperty({
    type: RecommendationQaSponsoredPresetDto,
    nullable: true,
  })
  activePreset!: RecommendationQaSponsoredPresetDto | null;
}

class RecommendationQaAlgorithmSnapshotDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty({ nullable: true })
  rank!: number | null;

  @ApiProperty({ nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];

  @ApiProperty({
    type: RecommendationQaScoreBreakdownDto,
    nullable: true,
    required: false,
  })
  scoreBreakdown!: RecommendationQaScoreBreakdownDto | null;

  @ApiProperty({ nullable: true, required: false })
  sponsoredReason!: string | null;

  @ApiProperty({
    type: RecommendationQaSponsoredPresetDto,
    nullable: true,
    required: false,
  })
  sponsoredPreset!: RecommendationQaSponsoredPresetDto | null;

  @ApiProperty({
    type: RecommendationQaCampaignReadinessDto,
    nullable: true,
    required: false,
  })
  campaignReadiness!: RecommendationQaCampaignReadinessDto | null;

  @ApiProperty({
    type: RecommendationQaSponsoredCampaignDto,
    nullable: true,
    required: false,
  })
  sponsoredCampaign!: RecommendationQaSponsoredCampaignDto | null;
}

class RecommendationQaComparisonItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ nullable: true })
  rankMovement!: number | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV1!: RecommendationQaAlgorithmSnapshotDto | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV2!: RecommendationQaAlgorithmSnapshotDto | null;
}

class RecommendationQaSnapshotProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  brand!: string | null;

  @ApiProperty({ nullable: true })
  color!: string | null;

  @ApiProperty({ nullable: true })
  price!: string | null;

  @ApiProperty()
  inStock!: boolean;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  shopName!: string | null;

  @ApiProperty({ nullable: true })
  shopSlug!: string | null;
}

class RecommendationQaSnapshotItemDto {
  @ApiProperty({ type: RecommendationQaSnapshotProductDto })
  product!: RecommendationQaSnapshotProductDto;

  @ApiProperty({ nullable: true })
  rankMovement!: number | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV1!: RecommendationQaAlgorithmSnapshotDto | null;

  @ApiProperty({
    type: RecommendationQaAlgorithmSnapshotDto,
    nullable: true,
  })
  ruleBasedV2!: RecommendationQaAlgorithmSnapshotDto | null;
}

export class RecommendationQaCompareResponseDto {
  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  placement!: 'home' | 'product_detail' | 'search';

  @ApiProperty({
    type: RecommendationQaSponsoredRankingDto,
    nullable: true,
  })
  sponsoredRanking!: RecommendationQaSponsoredRankingDto | null;

  @ApiProperty({ type: RecommendationQaComparisonItemDto, isArray: true })
  items!: RecommendationQaComparisonItemDto[];
}

export class RecommendationQaSnapshotResponseDto {
  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  placement!: 'home' | 'product_detail' | 'search';

  @ApiProperty({
    type: RecommendationQaSponsoredRankingDto,
    nullable: true,
  })
  sponsoredRanking!: RecommendationQaSponsoredRankingDto | null;

  @ApiProperty({ nullable: true })
  productId!: string | null;

  @ApiProperty({ nullable: true })
  query!: string | null;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: String, isArray: true })
  comparedAlgorithms!: string[];

  @ApiProperty({ type: RecommendationQaSnapshotItemDto, isArray: true })
  items!: RecommendationQaSnapshotItemDto[];
}
