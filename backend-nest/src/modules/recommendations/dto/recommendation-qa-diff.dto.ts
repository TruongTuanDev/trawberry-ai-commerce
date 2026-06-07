import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class RecommendationQaDiffScoreBreakdownDto {
  @ApiProperty()
  @IsNumber()
  categoryScore!: number;

  @ApiProperty()
  @IsNumber()
  textScore!: number;

  @ApiProperty()
  @IsNumber()
  popularityScore!: number;

  @ApiProperty()
  @IsNumber()
  freshnessScore!: number;

  @ApiProperty()
  @IsNumber()
  ratingScore!: number;

  @ApiProperty()
  @IsNumber()
  stockScore!: number;

  @ApiProperty()
  @IsNumber()
  shopScore!: number;

  @ApiProperty()
  @IsNumber()
  penaltyScore!: number;

  @ApiProperty()
  @IsNumber()
  personalizationScore!: number;

  @ApiProperty()
  @IsNumber()
  recentViewScore!: number;

  @ApiProperty()
  @IsNumber()
  categoryAffinityScore!: number;

  @ApiProperty()
  @IsNumber()
  searchIntentScore!: number;

  @ApiProperty()
  @IsNumber()
  clickAffinityScore!: number;

  @ApiProperty()
  @IsNumber()
  analyticsPerformanceScore!: number;

  @ApiProperty()
  @IsNumber()
  ctrScore!: number;

  @ApiProperty()
  @IsNumber()
  productEngagementScore!: number;

  @ApiProperty()
  @IsNumber()
  engagementScore!: number;

  @ApiProperty()
  @IsNumber()
  algorithmPerformanceHint!: number;

  @ApiProperty()
  @IsNumber()
  scenarioPerformanceHint!: number;

  @ApiProperty()
  @IsNumber()
  sponsoredBoostScore!: number;

  @ApiProperty()
  @IsNumber()
  businessBoostScore!: number;

  @ApiProperty()
  @IsNumber()
  maxSponsoredBoost!: number;
}

class RecommendationQaDiffSponsoredPresetDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  version!: string;

  @ApiProperty({ enum: ['experimental', 'stable', 'deprecated'] })
  @IsString()
  stability!: 'experimental' | 'stable' | 'deprecated';

  @ApiProperty()
  @IsNumber()
  maxSponsoredBoost!: number;

  @ApiProperty()
  @IsNumber()
  maxBusinessBoost!: number;

  @ApiProperty({ enum: ['home', 'similar', 'search'], isArray: true })
  @IsArray()
  @IsString({ each: true })
  allowedScenarioTypes!: Array<'home' | 'similar' | 'search'>;

  @ApiProperty()
  @IsString()
  notes!: string;
}

class RecommendationQaDiffSponsoredCampaignDto {
  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  campaignId!: string | null;

  @ApiProperty({ enum: ['none', 'campaign', 'business_boost', 'hybrid'] })
  @IsString()
  sponsorType!: 'none' | 'campaign' | 'business_boost' | 'hybrid';

  @ApiProperty()
  @IsNumber()
  maxBoost!: number;

  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  @IsString()
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ enum: ['none', 'cpc', 'cpm', 'fixed'] })
  @IsString()
  billingMode!: 'none' | 'cpc' | 'cpm' | 'fixed';

  @ApiProperty({ enum: ['disabled', 'internal', 'limited', 'public'] })
  @IsString()
  rolloutMode!: 'disabled' | 'internal' | 'limited' | 'public';
}

class RecommendationQaDiffCampaignReadinessDto {
  @ApiProperty()
  @IsBoolean()
  sponsoredEligible!: boolean;

  @ApiProperty()
  @IsBoolean()
  sponsoredBoostApplied!: boolean;

  @ApiProperty()
  @IsNumber()
  sponsoredBoostScore!: number;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  sponsoredReason!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  sponsoredPresetId!: string | null;

  @ApiProperty({
    enum: ['disabled', 'not_targeted', 'ineligible', 'eligible', 'boosted'],
  })
  @IsString()
  campaignReadinessStatus!:
    | 'disabled'
    | 'not_targeted'
    | 'ineligible'
    | 'eligible'
    | 'boosted';

  @ApiProperty({ enum: ['none', 'cpc', 'cpm', 'fixed'] })
  @IsString()
  billingMode!: 'none' | 'cpc' | 'cpm' | 'fixed';

  @ApiProperty({ enum: ['disabled', 'internal', 'limited', 'public'] })
  @IsString()
  rolloutMode!: 'disabled' | 'internal' | 'limited' | 'public';
}

class RecommendationQaDiffSponsoredRankingDto {
  @ApiProperty()
  @IsBoolean()
  sponsoredRankingEnabled!: boolean;

  @ApiProperty({
    type: RecommendationQaDiffSponsoredPresetDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffSponsoredPresetDto)
  activePreset!: RecommendationQaDiffSponsoredPresetDto | null;
}

class RecommendationQaDiffAlgorithmSnapshotDto {
  @ApiProperty()
  @IsString()
  algorithm!: string;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsInt()
  rank!: number | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsNumber()
  finalScore!: number | null;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @IsString({ each: true })
  reasons!: string[];

  @ApiProperty({
    type: RecommendationQaDiffScoreBreakdownDto,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffScoreBreakdownDto)
  scoreBreakdown!: RecommendationQaDiffScoreBreakdownDto | null;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @Allow()
  sponsoredReason!: string | null;

  @ApiProperty({
    type: RecommendationQaDiffSponsoredPresetDto,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffSponsoredPresetDto)
  sponsoredPreset!: RecommendationQaDiffSponsoredPresetDto | null;

  @ApiProperty({
    type: RecommendationQaDiffCampaignReadinessDto,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffCampaignReadinessDto)
  campaignReadiness!: RecommendationQaDiffCampaignReadinessDto | null;

  @ApiProperty({
    type: RecommendationQaDiffSponsoredCampaignDto,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffSponsoredCampaignDto)
  sponsoredCampaign!: RecommendationQaDiffSponsoredCampaignDto | null;
}

class RecommendationQaDiffSnapshotProductDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  seoSlug!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  categoryName!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  brand!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  color!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  price!: string | null;

  @ApiProperty()
  @IsBoolean()
  inStock!: boolean;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  imageUrl!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  shopName!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  shopSlug!: string | null;
}

class RecommendationQaDiffSnapshotItemDto {
  @ApiProperty({ type: RecommendationQaDiffSnapshotProductDto })
  @ValidateNested()
  @Type(() => RecommendationQaDiffSnapshotProductDto)
  product!: RecommendationQaDiffSnapshotProductDto;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  rankMovement!: number | null;

  @ApiProperty({
    type: RecommendationQaDiffAlgorithmSnapshotDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffAlgorithmSnapshotDto)
  ruleBasedV1!: RecommendationQaDiffAlgorithmSnapshotDto | null;

  @ApiProperty({
    type: RecommendationQaDiffAlgorithmSnapshotDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffAlgorithmSnapshotDto)
  ruleBasedV2!: RecommendationQaDiffAlgorithmSnapshotDto | null;
}

export class RecommendationQaSnapshotDto {
  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  @IsString()
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty({ enum: ['home', 'product_detail', 'search'] })
  @IsString()
  placement!: 'home' | 'product_detail' | 'search';

  @ApiProperty({
    type: RecommendationQaDiffSponsoredRankingDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecommendationQaDiffSponsoredRankingDto)
  sponsoredRanking!: RecommendationQaDiffSponsoredRankingDto | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  productId!: string | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @Allow()
  query!: string | null;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(24)
  limit!: number;

  @ApiProperty()
  @IsString()
  generatedAt!: string;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @IsString({ each: true })
  comparedAlgorithms!: string[];

  @ApiProperty({ type: RecommendationQaDiffSnapshotItemDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationQaDiffSnapshotItemDto)
  items!: RecommendationQaDiffSnapshotItemDto[];
}

export class RecommendationQaDiffRequestDto {
  @ApiProperty({ type: RecommendationQaSnapshotDto })
  @ValidateNested()
  @Type(() => RecommendationQaSnapshotDto)
  baseline!: RecommendationQaSnapshotDto;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  @ValidateNested()
  @Type(() => RecommendationQaSnapshotDto)
  candidate!: RecommendationQaSnapshotDto;
}

class RecommendationQaDiffScoreBreakdownDeltaDto {
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
  personalizationScore!: number;

  @ApiProperty()
  recentViewScore!: number;

  @ApiProperty()
  categoryAffinityScore!: number;

  @ApiProperty()
  searchIntentScore!: number;

  @ApiProperty()
  clickAffinityScore!: number;

  @ApiProperty()
  analyticsPerformanceScore!: number;

  @ApiProperty()
  ctrScore!: number;

  @ApiProperty()
  productEngagementScore!: number;

  @ApiProperty()
  engagementScore!: number;

  @ApiProperty()
  algorithmPerformanceHint!: number;

  @ApiProperty()
  scenarioPerformanceHint!: number;

  @ApiProperty()
  sponsoredBoostScore!: number;

  @ApiProperty()
  businessBoostScore!: number;

  @ApiProperty()
  maxSponsoredBoost!: number;
}

class RecommendationQaDiffReasonDeltaDto {
  @ApiProperty({ type: String, isArray: true })
  added!: string[];

  @ApiProperty({ type: String, isArray: true })
  removed!: string[];
}

class RecommendationQaDiffItemDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({
    enum: ['unchanged', 'moved_up', 'moved_down', 'added', 'removed'],
  })
  status!: 'unchanged' | 'moved_up' | 'moved_down' | 'added' | 'removed';

  @ApiProperty({ nullable: true })
  oldRank!: number | null;

  @ApiProperty({ nullable: true })
  newRank!: number | null;

  @ApiProperty({ nullable: true })
  rankMovement!: number | null;

  @ApiProperty({ nullable: true })
  oldScore!: number | null;

  @ApiProperty({ nullable: true })
  newScore!: number | null;

  @ApiProperty({ nullable: true })
  scoreDelta!: number | null;

  @ApiProperty({
    type: RecommendationQaDiffReasonDeltaDto,
    nullable: true,
  })
  reasonDelta!: RecommendationQaDiffReasonDeltaDto | null;

  @ApiProperty({
    type: RecommendationQaDiffScoreBreakdownDeltaDto,
    nullable: true,
  })
  scoreBreakdownDelta!: RecommendationQaDiffScoreBreakdownDeltaDto | null;
}

class RecommendationQaDiffSummaryDto {
  @ApiProperty()
  totalItemsCompared!: number;

  @ApiProperty()
  movedUpCount!: number;

  @ApiProperty()
  movedDownCount!: number;

  @ApiProperty()
  addedCount!: number;

  @ApiProperty()
  removedCount!: number;

  @ApiProperty()
  unchangedCount!: number;
}

class RecommendationQaDiffScenarioMetaDto {
  @ApiProperty({ type: RecommendationQaSnapshotDto })
  baseline!: RecommendationQaSnapshotDto;

  @ApiProperty({ type: RecommendationQaSnapshotDto })
  candidate!: RecommendationQaSnapshotDto;
}

export class RecommendationQaDiffResponseDto {
  @ApiProperty({ type: RecommendationQaDiffScenarioMetaDto })
  scenario!: RecommendationQaDiffScenarioMetaDto;

  @ApiProperty({ type: RecommendationQaDiffSummaryDto })
  summary!: RecommendationQaDiffSummaryDto;

  @ApiProperty({ type: RecommendationQaDiffItemDto, isArray: true })
  items!: RecommendationQaDiffItemDto[];
}
