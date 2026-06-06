import { ApiProperty } from '@nestjs/swagger';
import { PublicProductResponseDto } from '../../public-products/dto/public-product-response.dto';

class RecommendationScoreBreakdownDto {
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

class RecommendationSponsoredPresetDto {
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

class RecommendationSponsoredCampaignDto {
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

class RecommendationCampaignReadinessDto {
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

class RecommendationScoreExplanationDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty({ nullable: true })
  finalScore!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];

  @ApiProperty({
    type: RecommendationScoreBreakdownDto,
    nullable: true,
    required: false,
  })
  scoreBreakdown?: RecommendationScoreBreakdownDto | null;

  @ApiProperty({ nullable: true, required: false })
  sponsoredReason?: string | null;

  @ApiProperty({
    type: RecommendationSponsoredPresetDto,
    nullable: true,
    required: false,
  })
  sponsoredPreset?: RecommendationSponsoredPresetDto | null;

  @ApiProperty({
    type: RecommendationCampaignReadinessDto,
    nullable: true,
    required: false,
  })
  campaignReadiness?: RecommendationCampaignReadinessDto | null;

  @ApiProperty({
    type: RecommendationSponsoredCampaignDto,
    nullable: true,
    required: false,
  })
  sponsoredCampaign?: RecommendationSponsoredCampaignDto | null;
}

class RecommendationResponseItemDto {
  @ApiProperty({ type: PublicProductResponseDto })
  product!: PublicProductResponseDto;

  @ApiProperty()
  rank!: number;

  @ApiProperty({ nullable: true })
  score!: number | null;

  @ApiProperty({ type: String, isArray: true })
  reasonCodes!: string[];

  @ApiProperty({ required: false, nullable: true })
  sponsored?: boolean;

  @ApiProperty({ required: false, nullable: true })
  trackingToken?: string | null;

  @ApiProperty({
    type: RecommendationScoreExplanationDto,
    required: false,
    nullable: true,
  })
  scoreExplanation?: RecommendationScoreExplanationDto;
}

export class RecommendationProductsResponseDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  placement!: string;

  @ApiProperty({ type: RecommendationResponseItemDto, isArray: true })
  items!: RecommendationResponseItemDto[];

  @ApiProperty({ type: PublicProductResponseDto, isArray: true })
  products!: PublicProductResponseDto[];
}
