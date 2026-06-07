import { ApiProperty } from '@nestjs/swagger';

class RecommendationAnalyticsRangeDto {
  @ApiProperty({ enum: ['today', 'last7d', 'last30d', 'custom'] })
  range!: 'today' | 'last7d' | 'last30d' | 'custom';

  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;
}

class RecommendationAnalyticsMetricDto {
  @ApiProperty()
  impressions!: number;

  @ApiProperty()
  clicks!: number;

  @ApiProperty()
  ctr!: number;
}

class RecommendationAnalyticsSponsoredMetricDto {
  @ApiProperty()
  impressions!: number;

  @ApiProperty()
  clicks!: number;

  @ApiProperty()
  ctr!: number;

  @ApiProperty()
  chargedAmount!: string;
}

class RecommendationAnalyticsPersonalizationMetricDto {
  @ApiProperty()
  trackedImpressions!: number;

  @ApiProperty()
  trackedClicks!: number;

  @ApiProperty()
  personalizedImpressions!: number;

  @ApiProperty()
  personalizedClicks!: number;

  @ApiProperty()
  personalizedCtr!: number;

  @ApiProperty()
  nonPersonalizedImpressions!: number;

  @ApiProperty()
  nonPersonalizedClicks!: number;

  @ApiProperty()
  nonPersonalizedCtr!: number;
}

class RecommendationAnalyticsOverviewSummaryDto {
  @ApiProperty({ type: RecommendationAnalyticsMetricDto })
  overall!: RecommendationAnalyticsMetricDto;

  @ApiProperty({ type: RecommendationAnalyticsSponsoredMetricDto })
  sponsored!: RecommendationAnalyticsSponsoredMetricDto;

  @ApiProperty({ type: RecommendationAnalyticsPersonalizationMetricDto })
  personalization!: RecommendationAnalyticsPersonalizationMetricDto;
}

class RecommendationAnalyticsAlgorithmRowDto {
  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  impressions!: number;

  @ApiProperty()
  clicks!: number;

  @ApiProperty()
  ctr!: number;

  @ApiProperty()
  sponsoredImpressions!: number;

  @ApiProperty()
  sponsoredClicks!: number;

  @ApiProperty()
  sponsoredCtr!: number;

  @ApiProperty()
  chargedAmount!: string;

  @ApiProperty()
  trackedPersonalizedImpressions!: number;

  @ApiProperty()
  trackedPersonalizedClicks!: number;

  @ApiProperty()
  trackedPersonalizedCtr!: number;
}

class RecommendationAnalyticsScenarioRowDto {
  @ApiProperty({ enum: ['home', 'similar', 'search'] })
  scenarioType!: 'home' | 'similar' | 'search';

  @ApiProperty()
  impressions!: number;

  @ApiProperty()
  clicks!: number;

  @ApiProperty()
  ctr!: number;

  @ApiProperty()
  sponsoredImpressions!: number;

  @ApiProperty()
  sponsoredClicks!: number;

  @ApiProperty()
  sponsoredCtr!: number;

  @ApiProperty()
  chargedAmount!: string;
}

class RecommendationAnalyticsProductRowDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  shopName!: string;

  @ApiProperty()
  impressions!: number;

  @ApiProperty()
  clicks!: number;

  @ApiProperty()
  ctr!: number;

  @ApiProperty()
  sponsoredImpressions!: number;

  @ApiProperty()
  sponsoredClicks!: number;

  @ApiProperty()
  sponsoredCtr!: number;

  @ApiProperty()
  chargedAmount!: string;
}

export class RecommendationAnalyticsOverviewResponseDto {
  @ApiProperty({ type: RecommendationAnalyticsRangeDto })
  range!: RecommendationAnalyticsRangeDto;

  @ApiProperty({ type: RecommendationAnalyticsOverviewSummaryDto })
  summary!: RecommendationAnalyticsOverviewSummaryDto;
}

export class RecommendationAnalyticsAlgorithmsResponseDto {
  @ApiProperty({ type: RecommendationAnalyticsRangeDto })
  range!: RecommendationAnalyticsRangeDto;

  @ApiProperty({ type: RecommendationAnalyticsAlgorithmRowDto, isArray: true })
  items!: RecommendationAnalyticsAlgorithmRowDto[];
}

export class RecommendationAnalyticsScenariosResponseDto {
  @ApiProperty({ type: RecommendationAnalyticsRangeDto })
  range!: RecommendationAnalyticsRangeDto;

  @ApiProperty({ type: RecommendationAnalyticsScenarioRowDto, isArray: true })
  items!: RecommendationAnalyticsScenarioRowDto[];
}

export class RecommendationAnalyticsProductsResponseDto {
  @ApiProperty({ type: RecommendationAnalyticsRangeDto })
  range!: RecommendationAnalyticsRangeDto;

  @ApiProperty({ type: RecommendationAnalyticsProductRowDto, isArray: true })
  topRecommendedProducts!: RecommendationAnalyticsProductRowDto[];

  @ApiProperty({ type: RecommendationAnalyticsProductRowDto, isArray: true })
  topClickedProducts!: RecommendationAnalyticsProductRowDto[];
}

export class SellerRecommendationAnalyticsOverviewResponseDto {
  @ApiProperty()
  shopId!: string;

  @ApiProperty()
  shopName!: string;

  @ApiProperty({ type: RecommendationAnalyticsRangeDto })
  range!: RecommendationAnalyticsRangeDto;

  @ApiProperty({ type: RecommendationAnalyticsOverviewSummaryDto })
  summary!: RecommendationAnalyticsOverviewSummaryDto;

  @ApiProperty({ type: RecommendationAnalyticsAlgorithmRowDto, isArray: true })
  algorithms!: RecommendationAnalyticsAlgorithmRowDto[];

  @ApiProperty({ type: RecommendationAnalyticsScenarioRowDto, isArray: true })
  scenarios!: RecommendationAnalyticsScenarioRowDto[];

  @ApiProperty({ type: RecommendationAnalyticsProductRowDto, isArray: true })
  topRecommendedProducts!: RecommendationAnalyticsProductRowDto[];

  @ApiProperty({ type: RecommendationAnalyticsProductRowDto, isArray: true })
  topClickedProducts!: RecommendationAnalyticsProductRowDto[];
}
