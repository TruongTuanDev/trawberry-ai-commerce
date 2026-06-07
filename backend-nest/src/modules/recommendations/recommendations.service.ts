import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ProductVariant } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from '../billing/billing.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { ProductReadinessService } from '../products/product-readiness.service';
import { RecommendationQaCompareQueryDto } from './dto/recommendation-qa-compare-query.dto';
import {
  RecommendationAnalyticsRangePreset,
  RecommendationAnalyticsQueryDto,
} from './dto/recommendation-analytics-query.dto';
import {
  RecommendationQaDiffRequestDto,
  RecommendationQaSnapshotDto,
} from './dto/recommendation-qa-diff.dto';
import {
  type RecommendationAnalyticsOverviewResponseDto,
  type RecommendationAnalyticsProductsResponseDto,
  type RecommendationAnalyticsAlgorithmsResponseDto,
  type RecommendationAnalyticsScenariosResponseDto,
  type SellerRecommendationAnalyticsOverviewResponseDto,
} from './dto/recommendation-analytics-response.dto';
import {
  RecommendationQaPackDto,
  RecommendationQaPackThresholdsDto,
} from './dto/recommendation-qa-pack.dto';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import {
  RECOMMENDATION_QA_BASELINE_CATALOG,
  RECOMMENDATION_QA_THRESHOLD_PRESETS,
  type RecommendationQaBaselineCatalogEntry,
  type RecommendationQaThresholdPreset,
} from './recommendation-qa-config';
import {
  DEFAULT_RECOMMENDATION_SPONSORED_PRESET_ID,
  RECOMMENDATION_SPONSORED_PRESETS,
  toSafeSponsoredCampaignMetadata,
  toSafeSponsoredPresetMetadata,
  type RecommendationCampaignReadinessMetadata,
  type RecommendationSponsoredBillingMode,
  type RecommendationSponsoredCampaignContract,
  type RecommendationSponsoredCampaignMetadata,
  type RecommendationSponsoredPresetDefinition,
  type RecommendationSponsoredPresetId,
  type RecommendationSponsoredPresetMetadata,
  type RecommendationSponsoredRolloutMode,
  type RecommendationSponsoredSponsorType,
  type RecommendationSponsoredScenarioType,
} from './recommendation-sponsored-config';
import { TrackProductViewDto } from './dto/track-product-view.dto';
import { TrackRecommendationEventDto } from './dto/track-recommendation-event.dto';
import { TrackSearchDto } from './dto/track-search.dto';
import {
  RECOMMENDATION_REASON_LABELS,
  type RecommendationAnalyticsSignalKey,
  type RecommendationAnalyticsTuningConfig,
  RecommendationPreferenceProfile,
  RecommendationProductRecord,
  type RecommendationReasonCode,
  RecommendationScoringService,
  type RecommendationScoreBreakdown,
  type RecommendationVariantRecord,
  type RecommendationPlacement,
  RECOMMENDATION_SPONSORED_RANKING_LIMITS,
  type RecommendationSponsoredRankingConfig,
  type RecommendationSponsoredTargetConfig,
} from './recommendation-scoring.service';

type RecommendationApiItem = {
  product: ReturnType<RecommendationsService['mapProduct']>;
  rank: number;
  score: number | null;
  reasonCodes: string[];
  sponsored?: boolean;
  trackingToken?: string | null;
  scoreExplanation?: {
    algorithm: string;
    finalScore: number | null;
    reasons: string[];
    scoreBreakdown: RecommendationScoreBreakdown | null;
    analyticsSignalsUsed?: RecommendationAnalyticsSignalKey[];
    analyticsTuningEnabled?: boolean;
    sponsoredReason?: string | null;
    sponsoredPreset?: RecommendationSponsoredPresetMetadata | null;
    campaignReadiness?: RecommendationCampaignReadinessMetadata | null;
    sponsoredCampaign?: RecommendationSponsoredCampaignMetadata | null;
  };
};

type RecommendationTrackingTokenPayload = {
  campaignId: string;
  shopId: string;
  productId: string;
  placement: RecommendationPlacement;
  scenarioType: RecommendationSponsoredScenarioType;
  billingMode: RecommendationSponsoredBillingMode;
  algorithm: string;
};

type RecommendationRankedItem = {
  product: RecommendationProductRecord;
  scored: {
    score: number | null;
    reasonCodes: RecommendationReasonCode[];
    scoreBreakdown: RecommendationScoreBreakdown | null;
    analyticsSignalsUsed: RecommendationAnalyticsSignalKey[];
    analyticsTuningEnabled: boolean;
    sponsoredReason: string | null;
    sponsoredPreset: RecommendationSponsoredPresetMetadata | null;
    campaignReadiness: RecommendationCampaignReadinessMetadata;
    sponsoredCampaign: RecommendationSponsoredCampaignMetadata | null;
    sponsored: boolean;
  };
};

type RecommendationAlgorithmSnapshot = {
  algorithm: 'rule_based_v1' | 'rule_based_v2';
  rank: number | null;
  finalScore: number | null;
  reasons: string[];
  scoreBreakdown: RecommendationScoreBreakdown | null;
  analyticsSignalsUsed?: RecommendationAnalyticsSignalKey[];
  analyticsTuningEnabled?: boolean;
  sponsoredReason: string | null;
  sponsoredPreset: RecommendationSponsoredPresetMetadata | null;
  campaignReadiness: RecommendationCampaignReadinessMetadata | null;
  sponsoredCampaign: RecommendationSponsoredCampaignMetadata | null;
};

type RecommendationQaProductSummary = {
  id: string;
  name: string;
  seoSlug: string | null;
  categoryName: string | null;
  brand: string | null;
  color: string | null;
  price: string | null;
  inStock: boolean;
  imageUrl: string | null;
  shopName: string | null;
  shopSlug: string | null;
};

type RecommendationQaComparisonRow = {
  productId: string;
  productName: string;
  rankMovement: number | null;
  ruleBasedV1: RecommendationAlgorithmSnapshot | null;
  ruleBasedV2: RecommendationAlgorithmSnapshot | null;
};

type RecommendationSponsoredQaSummary = {
  sponsoredRankingEnabled: boolean;
  activePreset: RecommendationSponsoredPresetMetadata | null;
};

type RecommendationQaSnapshotItemLike =
  RecommendationQaSnapshotDto['items'][number];

type RecommendationQaDiffResult = {
  scenario: {
    baseline: RecommendationQaDiffRequestDto['baseline'];
    candidate: RecommendationQaDiffRequestDto['candidate'];
  };
  summary: {
    totalItemsCompared: number;
    movedUpCount: number;
    movedDownCount: number;
    addedCount: number;
    removedCount: number;
    unchangedCount: number;
  };
  items: Array<{
    productId: string;
    productName: string;
    status: 'unchanged' | 'moved_up' | 'moved_down' | 'added' | 'removed';
    oldRank: number | null;
    newRank: number | null;
    rankMovement: number | null;
    oldScore: number | null;
    newScore: number | null;
    scoreDelta: number | null;
    reasonDelta: {
      added: string[];
      removed: string[];
    } | null;
    scoreBreakdownDelta: {
      categoryScore: number;
      textScore: number;
      popularityScore: number;
      freshnessScore: number;
      ratingScore: number;
      stockScore: number;
      shopScore: number;
      penaltyScore: number;
      personalizationScore: number;
      recentViewScore: number;
      categoryAffinityScore: number;
      searchIntentScore: number;
      clickAffinityScore: number;
      analyticsPerformanceScore: number;
      ctrScore: number;
      productEngagementScore: number;
      engagementScore: number;
      algorithmPerformanceHint: number;
      scenarioPerformanceHint: number;
      sponsoredBoostScore: number;
      businessBoostScore: number;
      maxSponsoredBoost: number;
    } | null;
  }>;
};

type RecommendationQaPackThresholdKey =
  | 'maxMovedDownCount'
  | 'maxMovedUpCount'
  | 'maxAddedCount'
  | 'maxRemovedCount'
  | 'maxScoreDelta'
  | 'maxAbsoluteRankMovement'
  | 'minUnchangedCount'
  | 'maxTotalChangedCount';

type RecommendationAnalyticsEventRecord = {
  id: string;
  type: string;
  placement: string;
  productId: string;
  shopId: string | null;
  campaignId: string | null;
  algorithm: string;
  scenarioType: string | null;
  sponsored: boolean;
  charged: boolean;
  cost: Prisma.Decimal | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type RecommendationAnalyticsProductSummary = {
  productId: string;
  productName: string;
  shopId: string;
  shopName: string;
};

type RecommendationAnalyticsRow = {
  impressions: number;
  clicks: number;
  sponsoredImpressions: number;
  sponsoredClicks: number;
  chargedAmount: Prisma.Decimal;
  trackedPersonalizedImpressions: number;
  trackedPersonalizedClicks: number;
  personalizedImpressions: number;
  personalizedClicks: number;
  nonPersonalizedImpressions: number;
  nonPersonalizedClicks: number;
};

type RecommendationAnalyticsDateRange = {
  range: RecommendationAnalyticsRangePreset;
  from: Date;
  to: Date;
  limit: number;
};

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly productReadiness: ProductReadinessService,
    private readonly scoring: RecommendationScoringService,
    private readonly campaignsService: CampaignsService,
    private readonly billingService: BillingService,
  ) {}

  async getHomeRecommendations(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isPublicRecommendationsEnabled()) {
      return this.emptyResponse('home');
    }

    try {
      if (!this.isSmartRankingEnabled()) {
        const items = await this.loadHomeRecommendationsV1(query);
        return this.buildResponse('home', 'rule_based_v1', items, query.debug, {
          hideScores: true,
        });
      }

      const items = await this.loadHomeRecommendationsV2(query, request, user);
      return this.buildResponse('home', 'rule_based_v2', items, query.debug);
    } catch {
      return this.emptyResponse('home');
    }
  }

  async getSimilarProducts(
    productId: string,
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isPublicRecommendationsEnabled()) {
      return this.emptyResponse('product_detail');
    }

    try {
      if (!this.isSmartRankingEnabled()) {
        const items = await this.loadSimilarRecommendationsV1(productId, query);
        return this.buildResponse(
          'product_detail',
          'rule_based_v1',
          items,
          query.debug,
          { hideScores: true },
        );
      }

      const items = await this.loadSimilarRecommendationsV2(
        productId,
        query,
        request,
        user,
      );
      return this.buildResponse(
        'product_detail',
        'rule_based_v2',
        items,
        query.debug,
      );
    } catch {
      return this.emptyResponse('product_detail');
    }
  }

  async getSearchRecommendations(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const searchQuery = query.q?.trim() ?? '';
    if (!this.isPublicRecommendationsEnabled() || !searchQuery) {
      return this.emptyResponse('search');
    }

    if (!this.isSmartRankingEnabled()) {
      return this.emptyResponse('search');
    }

    try {
      const items = await this.loadSearchRecommendationsV2(
        query,
        request,
        user,
      );
      return this.buildResponse('search', 'rule_based_v2', items, query.debug);
    } catch {
      return this.emptyResponse('search');
    }
  }

  async getRankingComparison(
    query: RecommendationQaCompareQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    const debug = query.debug ?? false;
    const normalizedQuery: RecommendationQueryDto = {
      limit: query.limit,
      guestSessionId: query.guestSessionId,
      q: query.q,
      debug,
    };

    let v1Items: RecommendationRankedItem[] = [];
    let v2Items: RecommendationRankedItem[] = [];
    let sponsoredQaSummary: RecommendationSponsoredQaSummary | null = null;

    switch (query.placement) {
      case 'home':
        [v1Items, v2Items] = await Promise.all([
          this.loadHomeRecommendationsV1(normalizedQuery),
          this.loadHomeRecommendationsV2(normalizedQuery, request, user),
        ]);
        sponsoredQaSummary = await this.buildSponsoredQaSummary('home');
        break;
      case 'product_detail':
        [v1Items, v2Items] = await Promise.all([
          this.loadSimilarRecommendationsV1(query.productId!, normalizedQuery),
          this.loadSimilarRecommendationsV2(
            query.productId!,
            normalizedQuery,
            request,
            user,
          ),
        ]);
        sponsoredQaSummary = await this.buildSponsoredQaSummary('similar');
        break;
      case 'search':
        v1Items = [];
        v2Items = await this.loadSearchRecommendationsV2(
          normalizedQuery,
          request,
          user,
        );
        sponsoredQaSummary = await this.buildSponsoredQaSummary('search');
        break;
    }

    const items = this.buildComparisonItems(v1Items, v2Items, debug);
    if (query.export && (!query.format || query.format === 'json')) {
      return this.buildComparisonSnapshotExport(query, items, v1Items, v2Items);
    }

    return {
      placement: query.placement,
      sponsoredRanking: sponsoredQaSummary,
      items,
    };
  }

  getQaThresholdPresets() {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    return {
      presets: RECOMMENDATION_QA_THRESHOLD_PRESETS.map((preset) => ({
        ...preset,
        thresholds: { ...preset.thresholds },
      })),
    };
  }

  getQaBaselineCatalog() {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    return {
      catalog: RECOMMENDATION_QA_BASELINE_CATALOG.map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        version: entry.version,
        updatedAt: entry.updatedAt,
        owner: entry.owner,
        notes: entry.notes,
        stability: entry.stability,
        scenarioType: entry.scenarioType,
        query: entry.query,
        productId: entry.productId,
        defaultLimit: entry.defaultLimit,
        recommendedThresholdPresetId: entry.recommendedThresholdPresetId,
        mockPack: entry.mockPack
          ? {
              packName: entry.mockPack.packName,
              description: entry.mockPack.description,
              thresholdPresetId: entry.mockPack.thresholdPresetId,
              baselineSnapshot: entry.mockPack.baselineSnapshot,
              candidateSnapshot: entry.mockPack.candidateSnapshot,
            }
          : null,
      })),
    };
  }

  getSponsoredRankingPresets() {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    const resolvedPreset = this.resolveSponsoredPreset(
      this.configService.get<string>('RECOMMENDATION_SPONSORED_PRESET_ID'),
    );

    return {
      sponsoredRankingEnabled: this.readFlag(
        'RECOMMENDATION_SPONSORED_RANKING_ENABLED',
        false,
      ),
      activePreset: resolvedPreset
        ? toSafeSponsoredPresetMetadata(resolvedPreset)
        : null,
      presets: RECOMMENDATION_SPONSORED_PRESETS.map((preset) =>
        toSafeSponsoredPresetMetadata(preset),
      ),
    };
  }

  diffRankingSnapshots(body: RecommendationQaDiffRequestDto) {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    return this.buildSnapshotDiffResult(body);
  }

  validateQaPack(body: RecommendationQaPackDto) {
    if (!this.isQaToolsEnabled()) {
      throw new NotFoundException();
    }

    const notices: string[] = [];
    if (body.scenarioType === 'search' && !body.query?.trim()) {
      notices.push('Search QA packs should include a query string.');
    }
    if (body.scenarioType === 'similar' && !body.productId?.trim()) {
      notices.push('Similar-product QA packs should include a productId.');
    }
    if (body.baselineSnapshot.limit !== body.limit) {
      notices.push('Baseline snapshot limit differs from the QA pack limit.');
    }
    if (body.candidateSnapshot.limit !== body.limit) {
      notices.push('Candidate snapshot limit differs from the QA pack limit.');
    }
    if (body.baselineSnapshot.scenarioType !== body.scenarioType) {
      notices.push(
        'Baseline snapshot scenarioType differs from the QA pack scenarioType.',
      );
    }
    if (body.candidateSnapshot.scenarioType !== body.scenarioType) {
      notices.push(
        'Candidate snapshot scenarioType differs from the QA pack scenarioType.',
      );
    }
    const appliedThresholdPreset = this.resolveQaThresholdPreset(
      body.thresholdPresetId,
    );
    if (body.thresholdPresetId && !appliedThresholdPreset) {
      notices.push('Threshold preset id is unknown and was ignored.');
    }
    const catalogEntry = this.resolveQaBaselineCatalogEntry(body.catalogId);
    if (body.catalogId && !catalogEntry) {
      notices.push('Baseline catalog id is unknown and was ignored.');
    }
    if (catalogEntry && catalogEntry.scenarioType !== body.scenarioType) {
      notices.push(
        'Baseline catalog scenarioType differs from the QA pack scenarioType.',
      );
    }

    const diff = this.buildSnapshotDiffResult({
      baseline: body.baselineSnapshot,
      candidate: body.candidateSnapshot,
    });
    const resolvedThresholds = this.resolveQaPackThresholds(
      appliedThresholdPreset,
      body.expectedSummaryThresholds,
    );
    const evaluation = this.evaluateQaPackThresholds(diff, resolvedThresholds);

    return {
      valid: true,
      pack: body,
      notices,
      appliedThresholdPreset: appliedThresholdPreset
        ? {
            ...appliedThresholdPreset,
            thresholds: { ...appliedThresholdPreset.thresholds },
          }
        : null,
      resolvedThresholds,
      evaluation,
    };
  }

  async getAdminRecommendationAnalyticsOverview(
    query: RecommendationAnalyticsQueryDto,
  ): Promise<RecommendationAnalyticsOverviewResponseDto> {
    const analytics = await this.buildRecommendationAnalytics(query);
    return {
      range: this.mapAnalyticsRange(analytics.range),
      summary: this.buildAnalyticsOverviewSummary(analytics.events),
    };
  }

  async getAdminRecommendationAnalyticsProducts(
    query: RecommendationAnalyticsQueryDto,
  ): Promise<RecommendationAnalyticsProductsResponseDto> {
    const analytics = await this.buildRecommendationAnalytics(query);
    return {
      range: this.mapAnalyticsRange(analytics.range),
      topRecommendedProducts: this.buildTopProductRows(
        analytics.events,
        analytics.productSummaries,
        analytics.range.limit,
        'impressions',
      ),
      topClickedProducts: this.buildTopProductRows(
        analytics.events,
        analytics.productSummaries,
        analytics.range.limit,
        'clicks',
      ),
    };
  }

  async getAdminRecommendationAnalyticsAlgorithms(
    query: RecommendationAnalyticsQueryDto,
  ): Promise<RecommendationAnalyticsAlgorithmsResponseDto> {
    const analytics = await this.buildRecommendationAnalytics(query);
    return {
      range: this.mapAnalyticsRange(analytics.range),
      items: this.buildAlgorithmRows(analytics.events),
    };
  }

  async getAdminRecommendationAnalyticsScenarios(
    query: RecommendationAnalyticsQueryDto,
  ): Promise<RecommendationAnalyticsScenariosResponseDto> {
    const analytics = await this.buildRecommendationAnalytics(query);
    return {
      range: this.mapAnalyticsRange(analytics.range),
      items: this.buildScenarioRows(analytics.events),
    };
  }

  async getSellerRecommendationAnalyticsOverview(
    shopId: string,
    query: RecommendationAnalyticsQueryDto,
  ): Promise<SellerRecommendationAnalyticsOverviewResponseDto> {
    const analytics = await this.buildRecommendationAnalytics(query, {
      shopId,
    });
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true },
    });

    return {
      shopId,
      shopName: shop?.name ?? 'Unknown shop',
      range: this.mapAnalyticsRange(analytics.range),
      summary: this.buildAnalyticsOverviewSummary(analytics.events),
      algorithms: this.buildAlgorithmRows(analytics.events),
      scenarios: this.buildScenarioRows(analytics.events),
      topRecommendedProducts: this.buildTopProductRows(
        analytics.events,
        analytics.productSummaries,
        analytics.range.limit,
        'impressions',
      ),
      topClickedProducts: this.buildTopProductRows(
        analytics.events,
        analytics.productSummaries,
        analytics.range.limit,
        'clicks',
      ),
    };
  }

  private async buildAnalyticsTuningConfig(
    scenarioType: 'home' | 'similar' | 'search',
    candidates: RecommendationProductRecord[],
    algorithm: string,
  ): Promise<RecommendationAnalyticsTuningConfig | undefined> {
    if (!this.isAnalyticsTuningEnabled() || candidates.length < 1) {
      return undefined;
    }

    const candidateIds = [
      ...new Set(candidates.map((candidate) => candidate.id)),
    ];
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - 30);
    lookbackStart.setHours(0, 0, 0, 0);

    const events = (await this.prisma.recommendationEvent.findMany({
      where: {
        createdAt: {
          gte: lookbackStart,
        },
        type: {
          in: ['impression', 'click'],
        },
      },
      select: {
        id: true,
        type: true,
        placement: true,
        productId: true,
        shopId: true,
        campaignId: true,
        algorithm: true,
        scenarioType: true,
        sponsored: true,
        charged: true,
        cost: true,
        metadata: true,
        createdAt: true,
      },
    })) as RecommendationAnalyticsEventRecord[];

    const scenarioEvents = events.filter(
      (event) => this.resolveAnalyticsScenarioType(event) === scenarioType,
    );
    const algorithmEvents = scenarioEvents.filter(
      (event) => (event.algorithm?.trim() || 'unknown') === algorithm,
    );

    const productSignalsById = new Map<
      string,
      {
        impressions: number;
        clicks: number;
        ctr: number;
      }
    >();

    candidateIds.forEach((candidateId) => {
      const productEvents = scenarioEvents.filter(
        (event) => event.productId === candidateId,
      );
      const metrics = this.accumulateAnalyticsRows(productEvents);
      productSignalsById.set(candidateId, {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: this.calculateCtr(metrics.impressions, metrics.clicks),
      });
    });

    const scenarioMetrics = this.accumulateAnalyticsRows(scenarioEvents);
    const algorithmMetrics = this.accumulateAnalyticsRows(algorithmEvents);

    return {
      enabled: true,
      minEventsForCtrBoost: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_MIN_EVENTS_FOR_CTR_BOOST',
        5,
        3,
        50,
      ),
      minClicksForEngagementBoost: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_MIN_CLICKS_FOR_ENGAGEMENT_BOOST',
        2,
        1,
        20,
      ),
      maxAnalyticsBoost: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_MAX_BOOST',
        3,
        0,
        6,
      ),
      maxCtrBoost: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_MAX_CTR_BOOST',
        2,
        0,
        4,
      ),
      maxLowCtrPenalty: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_LOW_CTR_PENALTY',
        0.5,
        0,
        2,
      ),
      maxEngagementBoost: this.readNumberFlag(
        'RECOMMENDATION_ANALYTICS_MAX_ENGAGEMENT_BOOST',
        1.25,
        0,
        3,
      ),
      algorithmPerformanceHint: this.calculateCtr(
        algorithmMetrics.impressions,
        algorithmMetrics.clicks,
      ),
      scenarioPerformanceHint: this.calculateCtr(
        scenarioMetrics.impressions,
        scenarioMetrics.clicks,
      ),
      productSignalsById,
    };
  }

  async trackProductView(
    dto: TrackProductViewDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    try {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { shopId: true },
      });

      await this.prisma.productViewLog.create({
        data: {
          productId: dto.productId,
          customerId: user?.userId ?? null,
          guestSessionId: this.resolveGuestSessionId(
            dto.guestSessionId,
            request,
          ),
          shopId: product?.shopId ?? null,
          source: dto.source?.trim() || null,
          referrer: dto.referrer?.trim() || request.get('referer') || null,
          userAgent: request.get('user-agent') ?? null,
          ipHash: this.hashRequestIp(request),
        },
      });
    } catch {
      return;
    }
  }

  async trackSearch(
    dto: TrackSearchDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    const query = dto.query.trim();
    if (!query) {
      return;
    }

    try {
      await this.prisma.searchLog.create({
        data: {
          query,
          normalizedQuery: this.normalizeQuery(query),
          customerId: user?.userId ?? null,
          guestSessionId: this.resolveGuestSessionId(
            dto.guestSessionId,
            request,
          ),
          resultCount: dto.resultCount ?? 0,
          locale: dto.locale?.trim() || null,
        },
      });
    } catch {
      return;
    }
  }

  async trackRecommendationEvent(
    dto: TrackRecommendationEventDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    if (!this.isTrackingEnabled()) {
      return;
    }

    const placement = dto.placement.trim() as RecommendationPlacement;
    const algorithm = dto.algorithm?.trim() || 'rule_based_v2';
    const guestSessionId = this.resolveGuestSessionId(
      dto.guestSessionId,
      request,
    );
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { shopId: true },
    });
    const tracking = this.verifyRecommendationTrackingToken(dto.trackingToken, {
      productId: dto.productId,
      placement,
      algorithm,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.recommendationEvent.create({
          data: {
            type: dto.type,
            placement,
            productId: dto.productId,
            sourceProductId: dto.sourceProductId ?? null,
            customerId: user?.userId ?? null,
            guestSessionId,
            shopId: tracking?.shopId ?? product?.shopId ?? null,
            campaignId: tracking?.campaignId ?? null,
            algorithm,
            scenarioType:
              tracking?.scenarioType ??
              this.mapPlacementToScenarioType(placement),
            billingMode: tracking?.billingMode ?? null,
            sponsored: Boolean(tracking),
            charged: false,
            chargeStatus: tracking
              ? tracking.billingMode === 'cpc' && dto.type === 'click'
                ? 'pending_charge'
                : 'tracked_only'
              : 'not_billable',
            cost: null,
            ledgerEntryId: null,
            idempotencyKey: dto.idempotencyKey?.trim() || null,
            metadata:
              tracking || typeof dto.personalized === 'boolean'
                ? {
                    ...(tracking
                      ? {
                          trackingTokenVersion: 'v1',
                          sponsored: true,
                        }
                      : {}),
                    ...(typeof dto.personalized === 'boolean'
                      ? {
                          personalized: dto.personalized,
                        }
                      : {}),
                  }
                : undefined,
            rank: dto.rank ?? null,
            score:
              typeof dto.score === 'number'
                ? new Prisma.Decimal(dto.score)
                : null,
          },
        });

        if (
          !tracking ||
          dto.type !== 'click' ||
          tracking.billingMode !== 'cpc'
        ) {
          return;
        }

        const cpcAmount = this.getSponsoredCpcAmount();
        const campaign = await tx.sponsoredCampaign.findFirst({
          where: {
            id: tracking.campaignId,
            shopId: tracking.shopId,
          },
          select: {
            id: true,
            shopId: true,
            status: true,
            startAt: true,
            endAt: true,
            budgetLimit: true,
            billingMode: true,
          },
        });

        if (
          !campaign ||
          campaign.status !== 'active' ||
          this.normalizeBillingMode(campaign.billingMode) !== 'cpc' ||
          !this.isCampaignWithinDateWindow(campaign.startAt, campaign.endAt)
        ) {
          await tx.recommendationEvent.update({
            where: { id: created.id },
            data: {
              chargeStatus: 'campaign_inactive',
              cost: cpcAmount,
            },
          });
          return;
        }

        const spentAmount = await this.sumCampaignSpend(
          tracking.campaignId,
          tx,
        );
        if (
          campaign.budgetLimit &&
          (spentAmount.gte(campaign.budgetLimit) ||
            campaign.budgetLimit.minus(spentAmount).lt(cpcAmount))
        ) {
          await tx.recommendationEvent.update({
            where: { id: created.id },
            data: {
              chargeStatus: 'budget_exhausted',
              cost: cpcAmount,
            },
          });
          return;
        }

        try {
          const charge = await this.billingService.applyMutationInTransaction(
            tx,
            tracking.shopId,
            {
              type: 'debit',
              amount: cpcAmount,
              campaignId: tracking.campaignId,
              referenceType: 'recommendation_click',
              referenceId: created.id,
              description: `Sponsored recommendation click for ${dto.productId}`,
              metadata: {
                placement,
                productId: dto.productId,
                algorithm,
              },
            },
          );

          await tx.recommendationEvent.update({
            where: { id: created.id },
            data: {
              charged: true,
              chargeStatus: 'charged',
              cost: cpcAmount,
              ledgerEntryId: charge.entry.id,
            },
          });
        } catch {
          await tx.recommendationEvent.update({
            where: { id: created.id },
            data: {
              chargeStatus: 'insufficient_wallet',
              cost: cpcAmount,
            },
          });
        }
      });
    } catch (error) {
      if (this.isUniqueIdempotencyConflict(error)) {
        return;
      }
      return;
    }
  }

  private async loadHomeRecommendationsV1(query: RecommendationQueryDto) {
    const products = await this.prisma.product.findMany({
      where: this.buildPublicVisibilityWhere(),
      include: this.getProductInclude(),
      take: 120,
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return products
      .filter((product) => this.isPublicVisible(product))
      .sort(
        (left, right) =>
          this.scoreHomeProductV1(right) - this.scoreHomeProductV1(left),
      )
      .slice(0, query.limit)
      .map((product) => ({
        product,
        scored: {
          score: this.scoreHomeProductV1(product),
          reasonCodes: [] as RecommendationReasonCode[],
          scoreBreakdown: null,
          analyticsSignalsUsed: [],
          analyticsTuningEnabled: false,
          sponsoredReason: null,
          sponsoredPreset: null,
          campaignReadiness: {
            sponsoredEligible: false,
            sponsoredBoostApplied: false,
            sponsoredBoostScore: 0,
            sponsoredReason: null,
            sponsoredPresetId: null,
            campaignReadinessStatus: 'disabled',
            billingMode: 'none',
            rolloutMode: 'disabled',
          } as const,
          sponsoredCampaign: null,
          sponsored: false,
        },
      }));
  }

  private async loadHomeRecommendationsV2(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const [products, preferenceProfile] = await Promise.all([
      this.prisma.product.findMany({
        where: this.buildPublicVisibilityWhere(),
        include: this.getProductInclude(),
        take: 150,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.buildPreferenceProfile(query, request, user),
    ]);

    const sponsoredRanking = await this.getSponsoredRankingConfig('home');
    const analyticsTuning = await this.buildAnalyticsTuningConfig(
      'home',
      products,
      'rule_based_v2',
    );

    return products
      .filter((product) => this.isPublicVisible(product))
      .map((product) => ({
        product,
        scored: {
          ...this.scoring.scoreHomeProduct(
            product,
            preferenceProfile,
            sponsoredRanking,
            analyticsTuning,
          ),
        },
      }))
      .sort((left, right) => right.scored.score - left.scored.score)
      .slice(0, query.limit);
  }

  private async loadSimilarRecommendationsV1(
    productId: string,
    query: RecommendationQueryDto,
  ) {
    const sourceProduct = await this.prisma.product.findFirst({
      where: {
        id: productId,
        ...this.buildPublicVisibilityWhere(),
      },
      include: this.getProductInclude(),
    });

    if (!sourceProduct || !this.isPublicVisible(sourceProduct)) {
      return [] as RecommendationRankedItem[];
    }

    const candidates = await this.loadSimilarCandidates(
      sourceProduct,
      query.limit,
    );

    return candidates
      .filter(
        (product) => this.isPublicVisible(product) && product.id !== productId,
      )
      .sort(
        (left, right) =>
          this.scoreSimilarProductV1(sourceProduct, right) -
          this.scoreSimilarProductV1(sourceProduct, left),
      )
      .slice(0, query.limit)
      .map((product) => ({
        product,
        scored: {
          score: this.scoreSimilarProductV1(sourceProduct, product),
          reasonCodes: [] as RecommendationReasonCode[],
          scoreBreakdown: null,
          analyticsSignalsUsed: [],
          analyticsTuningEnabled: false,
          sponsoredReason: null,
          sponsoredPreset: null,
          campaignReadiness: {
            sponsoredEligible: false,
            sponsoredBoostApplied: false,
            sponsoredBoostScore: 0,
            sponsoredReason: null,
            sponsoredPresetId: null,
            campaignReadinessStatus: 'disabled',
            billingMode: 'none',
            rolloutMode: 'disabled',
          } as const,
          sponsoredCampaign: null,
          sponsored: false,
        },
      }));
  }

  private async loadSimilarRecommendationsV2(
    productId: string,
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const sourceProduct = await this.prisma.product.findFirst({
      where: {
        id: productId,
        ...this.buildPublicVisibilityWhere(),
      },
      include: this.getProductInclude(),
    });

    if (!sourceProduct || !this.isPublicVisible(sourceProduct)) {
      return [] as RecommendationRankedItem[];
    }

    const candidates = await this.loadSimilarCandidates(
      sourceProduct,
      query.limit,
    );
    const preferenceProfile = await this.buildPreferenceProfile(
      query,
      request,
      user,
    );

    const sponsoredRanking = await this.getSponsoredRankingConfig('similar');
    const analyticsTuning = await this.buildAnalyticsTuningConfig(
      'similar',
      candidates,
      'rule_based_v2',
    );

    return candidates
      .filter(
        (product) => this.isPublicVisible(product) && product.id !== productId,
      )
      .map((product) => ({
        product,
        scored: {
          ...this.scoring.scoreSimilarProduct(
            sourceProduct,
            product,
            preferenceProfile,
            sponsoredRanking,
            analyticsTuning,
          ),
        },
      }))
      .sort((left, right) => right.scored.score - left.scored.score)
      .slice(0, query.limit);
  }

  private async loadSearchRecommendationsV2(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ) {
    const searchQuery = query.q?.trim() ?? '';
    if (!searchQuery) {
      return [] as RecommendationRankedItem[];
    }

    const tokens = this.normalizeQuery(searchQuery)
      .split(' ')
      .filter((token) => token.length >= 2);
    const or: Prisma.ProductWhereInput[] = [
      { wbTitle: { contains: searchQuery, mode: 'insensitive' } },
      { localTitle: { contains: searchQuery, mode: 'insensitive' } },
      { wbDescription: { contains: searchQuery, mode: 'insensitive' } },
      { localDescription: { contains: searchQuery, mode: 'insensitive' } },
      { categoryName: { contains: searchQuery, mode: 'insensitive' } },
      { sourceCategoryName: { contains: searchQuery, mode: 'insensitive' } },
      { brand: { contains: searchQuery, mode: 'insensitive' } },
      { color: { contains: searchQuery, mode: 'insensitive' } },
    ];

    for (const token of tokens) {
      or.push(
        { wbTitle: { contains: token, mode: 'insensitive' } },
        { localTitle: { contains: token, mode: 'insensitive' } },
        { wbDescription: { contains: token, mode: 'insensitive' } },
        { localDescription: { contains: token, mode: 'insensitive' } },
        { categoryName: { contains: token, mode: 'insensitive' } },
        { sourceCategoryName: { contains: token, mode: 'insensitive' } },
        { brand: { contains: token, mode: 'insensitive' } },
        { color: { contains: token, mode: 'insensitive' } },
      );
    }

    const candidates = await this.prisma.product.findMany({
      where: {
        ...this.buildPublicVisibilityWhere(),
        OR: or,
      },
      include: this.getProductInclude(),
      take: 150,
      orderBy: [{ updatedAt: 'desc' }, { publishedAt: 'desc' }],
    });
    const preferenceProfile = await this.buildPreferenceProfile(
      query,
      request,
      user,
    );

    const sponsoredRanking = await this.getSponsoredRankingConfig('search');
    const analyticsTuning = await this.buildAnalyticsTuningConfig(
      'search',
      candidates,
      'rule_based_v2',
    );

    return candidates
      .filter((product) => this.isPublicVisible(product))
      .map((product) => ({
        product,
        scored: {
          ...this.scoring.scoreSearchProduct(
            searchQuery,
            product,
            preferenceProfile,
            sponsoredRanking,
            analyticsTuning,
          ),
        },
      }))
      .filter((item) => (item.scored.score ?? 0) > 0)
      .sort((left, right) => right.scored.score - left.scored.score)
      .slice(0, query.limit);
  }

  private async loadSimilarCandidates(
    sourceProduct: RecommendationProductRecord,
    limit: number,
  ) {
    const candidateWhere: Prisma.ProductWhereInput = {
      ...this.buildPublicVisibilityWhere(),
      id: {
        not: sourceProduct.id,
      },
    };

    const or: Prisma.ProductWhereInput[] = [];
    if (sourceProduct.categoryId) {
      or.push({ categoryId: sourceProduct.categoryId });
    }
    if (sourceProduct.categoryName?.trim()) {
      or.push({ categoryName: sourceProduct.categoryName.trim() });
    }
    if (sourceProduct.sourceCategoryName?.trim()) {
      or.push({
        sourceCategoryName: sourceProduct.sourceCategoryName.trim(),
      });
    }
    if (sourceProduct.brand?.trim()) {
      or.push({ brand: sourceProduct.brand.trim() });
    }
    if (sourceProduct.color?.trim()) {
      or.push({ color: sourceProduct.color.trim() });
    }

    const primaryCandidates = await this.prisma.product.findMany({
      where: or.length ? { ...candidateWhere, OR: or } : candidateWhere,
      include: this.getProductInclude(),
      take: 120,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (primaryCandidates.length >= limit) {
      return primaryCandidates;
    }

    const fallbackCandidates = await this.prisma.product.findMany({
      where: candidateWhere,
      include: this.getProductInclude(),
      take: 120,
      orderBy: [
        { feedbackCount: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const seen = new Set(primaryCandidates.map((item) => item.id));
    return [
      ...primaryCandidates,
      ...fallbackCandidates.filter((item) => !seen.has(item.id)),
    ];
  }

  private buildResponse(
    placement: RecommendationPlacement,
    algorithm: string,
    items: RecommendationRankedItem[],
    debug = false,
    options?: {
      hideScores?: boolean;
    },
  ) {
    const includeExplainability = this.shouldIncludeExplainability(debug);
    const mappedItems: RecommendationApiItem[] = items.map((item, index) => {
      const sponsored =
        item.scored.sponsored === true &&
        item.scored.campaignReadiness.sponsoredBoostApplied === true &&
        Boolean(item.scored.sponsoredCampaign?.campaignId);
      const mappedItem: RecommendationApiItem = {
        product: this.mapProduct(item.product),
        rank: index + 1,
        score: options?.hideScores ? null : item.scored.score,
        reasonCodes: item.scored.reasonCodes,
        sponsored,
        trackingToken: sponsored
          ? this.createRecommendationTrackingToken({
              campaignId: item.scored.sponsoredCampaign!.campaignId!,
              shopId: item.product.shopId,
              productId: item.product.id,
              placement,
              scenarioType: this.mapPlacementToScenarioType(placement),
              billingMode: item.scored.sponsoredCampaign!.billingMode,
              algorithm,
            })
          : null,
      };

      if (includeExplainability) {
        mappedItem.scoreExplanation = {
          algorithm,
          finalScore: item.scored.score,
          reasons: this.buildExplainabilityReasons(item.scored),
          analyticsSignalsUsed: item.scored.analyticsSignalsUsed,
          analyticsTuningEnabled: item.scored.analyticsTuningEnabled,
          scoreBreakdown: item.scored.scoreBreakdown ?? null,
          sponsoredReason: item.scored.sponsoredReason,
          sponsoredPreset: item.scored.sponsoredPreset,
          campaignReadiness: item.scored.campaignReadiness,
          sponsoredCampaign: item.scored.sponsoredCampaign,
        };
      }

      return mappedItem;
    });

    return {
      algorithm,
      placement,
      items: mappedItems,
      products: mappedItems.map((item) => item.product),
    };
  }

  private buildComparisonItems(
    v1Items: RecommendationRankedItem[],
    v2Items: RecommendationRankedItem[],
    debug = false,
  ) {
    const includeExplainability = this.shouldIncludeExplainability(debug);
    const byProductId = new Map<
      string,
      {
        productId: string;
        productName: string;
        ruleBasedV1: RecommendationAlgorithmSnapshot | null;
        ruleBasedV2: RecommendationAlgorithmSnapshot | null;
        sortRank: number;
      }
    >();

    v1Items.forEach((item, index) => {
      const mappedProduct = this.mapProduct(item.product);
      const existing = byProductId.get(mappedProduct.id);
      byProductId.set(mappedProduct.id, {
        productId: mappedProduct.id,
        productName: mappedProduct.name,
        ruleBasedV1: this.buildComparisonSnapshot(
          'rule_based_v1',
          index + 1,
          item,
          includeExplainability,
        ),
        ruleBasedV2: existing?.ruleBasedV2 ?? null,
        sortRank: Math.min(
          existing?.sortRank ?? Number.MAX_SAFE_INTEGER,
          index + 1,
        ),
      });
    });

    v2Items.forEach((item, index) => {
      const mappedProduct = this.mapProduct(item.product);
      const existing = byProductId.get(mappedProduct.id);
      byProductId.set(mappedProduct.id, {
        productId: mappedProduct.id,
        productName: mappedProduct.name,
        ruleBasedV1: existing?.ruleBasedV1 ?? null,
        ruleBasedV2: this.buildComparisonSnapshot(
          'rule_based_v2',
          index + 1,
          item,
          includeExplainability,
        ),
        sortRank: Math.min(
          existing?.sortRank ?? Number.MAX_SAFE_INTEGER,
          index + 1,
        ),
      });
    });

    return [...byProductId.values()]
      .sort((left, right) => left.sortRank - right.sortRank)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        rankMovement:
          item.ruleBasedV1?.rank !== null &&
          item.ruleBasedV1?.rank !== undefined &&
          item.ruleBasedV2?.rank !== null &&
          item.ruleBasedV2?.rank !== undefined
            ? item.ruleBasedV1.rank - item.ruleBasedV2.rank
            : null,
        ruleBasedV1: item.ruleBasedV1,
        ruleBasedV2: item.ruleBasedV2,
      }));
  }

  private async buildComparisonSnapshotExport(
    query: RecommendationQaCompareQueryDto,
    comparisonItems: RecommendationQaComparisonRow[],
    v1Items: RecommendationRankedItem[],
    v2Items: RecommendationRankedItem[],
  ) {
    const productSummaries = new Map<string, RecommendationQaProductSummary>();
    [...v1Items, ...v2Items].forEach((item) => {
      if (!productSummaries.has(item.product.id)) {
        productSummaries.set(
          item.product.id,
          this.buildQaProductSummary(item.product),
        );
      }
    });

    return {
      scenarioType:
        query.placement === 'product_detail' ? 'similar' : query.placement,
      placement: query.placement,
      sponsoredRanking: await this.buildSponsoredQaSummary(
        query.placement === 'product_detail' ? 'similar' : query.placement,
      ),
      productId:
        query.placement === 'product_detail' ? (query.productId ?? null) : null,
      query: query.placement === 'search' ? (query.q?.trim() ?? null) : null,
      limit: query.limit,
      generatedAt: new Date().toISOString(),
      comparedAlgorithms: ['rule_based_v1', 'rule_based_v2'],
      items: comparisonItems.map((item) => ({
        product: productSummaries.get(item.productId) ?? {
          id: item.productId,
          name: item.productName,
          seoSlug: null,
          categoryName: null,
          brand: null,
          color: null,
          price: null,
          inStock: false,
          imageUrl: null,
          shopName: null,
          shopSlug: null,
        },
        rankMovement: item.rankMovement,
        ruleBasedV1: item.ruleBasedV1,
        ruleBasedV2: item.ruleBasedV2,
      })),
    };
  }

  private buildComparisonSnapshot(
    algorithm: 'rule_based_v1' | 'rule_based_v2',
    rank: number,
    item: RecommendationRankedItem,
    includeExplainability: boolean,
  ): RecommendationAlgorithmSnapshot {
    return {
      algorithm,
      rank,
      finalScore: item.scored.score,
      reasons: includeExplainability
        ? this.buildExplainabilityReasons(item.scored)
        : [],
      analyticsSignalsUsed: includeExplainability
        ? item.scored.analyticsSignalsUsed
        : [],
      analyticsTuningEnabled: includeExplainability
        ? item.scored.analyticsTuningEnabled
        : false,
      scoreBreakdown: includeExplainability ? item.scored.scoreBreakdown : null,
      sponsoredReason: includeExplainability
        ? item.scored.sponsoredReason
        : null,
      sponsoredPreset: includeExplainability
        ? item.scored.sponsoredPreset
        : null,
      campaignReadiness: includeExplainability
        ? item.scored.campaignReadiness
        : null,
      sponsoredCampaign: includeExplainability
        ? item.scored.sponsoredCampaign
        : null,
    };
  }

  private buildExplainabilityReasons(item: RecommendationRankedItem['scored']) {
    const reasons = item.reasonCodes.map(
      (reasonCode) => RECOMMENDATION_REASON_LABELS[reasonCode],
    );
    if (item.sponsoredReason) {
      reasons.push(item.sponsoredReason);
    }
    return reasons;
  }

  private buildQaProductSummary(
    product: RecommendationProductRecord,
  ): RecommendationQaProductSummary {
    const mappedProduct = this.mapProduct(product);
    return {
      id: mappedProduct.id,
      name: mappedProduct.name,
      seoSlug: mappedProduct.seoSlug,
      categoryName: mappedProduct.categoryName,
      brand: mappedProduct.brand,
      color: mappedProduct.color,
      price: mappedProduct.price,
      inStock: mappedProduct.inStock,
      imageUrl: mappedProduct.images[0]?.url ?? null,
      shopName: mappedProduct.shop.name,
      shopSlug: mappedProduct.shop.slug,
    };
  }

  private resolvePreferredSnapshot(
    item: RecommendationQaSnapshotItemLike | null,
  ) {
    return item?.ruleBasedV2 ?? item?.ruleBasedV1 ?? null;
  }

  private buildReasonDelta(oldReasons: string[], newReasons: string[]) {
    const oldSet = new Set(oldReasons);
    const newSet = new Set(newReasons);
    return {
      added: newReasons.filter((reason) => !oldSet.has(reason)),
      removed: oldReasons.filter((reason) => !newSet.has(reason)),
    };
  }

  private buildScoreBreakdownDelta(
    oldBreakdown: RecommendationScoreBreakdown | null,
    newBreakdown: RecommendationScoreBreakdown | null,
  ) {
    if (!oldBreakdown && !newBreakdown) {
      return null;
    }

    return {
      categoryScore:
        (newBreakdown?.categoryScore ?? 0) - (oldBreakdown?.categoryScore ?? 0),
      textScore:
        (newBreakdown?.textScore ?? 0) - (oldBreakdown?.textScore ?? 0),
      popularityScore:
        (newBreakdown?.popularityScore ?? 0) -
        (oldBreakdown?.popularityScore ?? 0),
      freshnessScore:
        (newBreakdown?.freshnessScore ?? 0) -
        (oldBreakdown?.freshnessScore ?? 0),
      ratingScore:
        (newBreakdown?.ratingScore ?? 0) - (oldBreakdown?.ratingScore ?? 0),
      stockScore:
        (newBreakdown?.stockScore ?? 0) - (oldBreakdown?.stockScore ?? 0),
      shopScore:
        (newBreakdown?.shopScore ?? 0) - (oldBreakdown?.shopScore ?? 0),
      penaltyScore:
        (newBreakdown?.penaltyScore ?? 0) - (oldBreakdown?.penaltyScore ?? 0),
      personalizationScore:
        (newBreakdown?.personalizationScore ?? 0) -
        (oldBreakdown?.personalizationScore ?? 0),
      recentViewScore:
        (newBreakdown?.recentViewScore ?? 0) -
        (oldBreakdown?.recentViewScore ?? 0),
      categoryAffinityScore:
        (newBreakdown?.categoryAffinityScore ?? 0) -
        (oldBreakdown?.categoryAffinityScore ?? 0),
      searchIntentScore:
        (newBreakdown?.searchIntentScore ?? 0) -
        (oldBreakdown?.searchIntentScore ?? 0),
      clickAffinityScore:
        (newBreakdown?.clickAffinityScore ?? 0) -
        (oldBreakdown?.clickAffinityScore ?? 0),
      analyticsPerformanceScore:
        (newBreakdown?.analyticsPerformanceScore ?? 0) -
        (oldBreakdown?.analyticsPerformanceScore ?? 0),
      ctrScore: (newBreakdown?.ctrScore ?? 0) - (oldBreakdown?.ctrScore ?? 0),
      productEngagementScore:
        (newBreakdown?.productEngagementScore ?? 0) -
        (oldBreakdown?.productEngagementScore ?? 0),
      engagementScore:
        (newBreakdown?.engagementScore ?? 0) -
        (oldBreakdown?.engagementScore ?? 0),
      algorithmPerformanceHint:
        (newBreakdown?.algorithmPerformanceHint ?? 0) -
        (oldBreakdown?.algorithmPerformanceHint ?? 0),
      scenarioPerformanceHint:
        (newBreakdown?.scenarioPerformanceHint ?? 0) -
        (oldBreakdown?.scenarioPerformanceHint ?? 0),
      sponsoredBoostScore:
        (newBreakdown?.sponsoredBoostScore ?? 0) -
        (oldBreakdown?.sponsoredBoostScore ?? 0),
      businessBoostScore:
        (newBreakdown?.businessBoostScore ?? 0) -
        (oldBreakdown?.businessBoostScore ?? 0),
      maxSponsoredBoost:
        (newBreakdown?.maxSponsoredBoost ?? 0) -
        (oldBreakdown?.maxSponsoredBoost ?? 0),
    };
  }

  private buildSnapshotDiffResult(
    body: RecommendationQaDiffRequestDto,
  ): RecommendationQaDiffResult {
    const baselineItems = new Map(
      body.baseline.items.map((item) => [item.product.id, item]),
    );
    const candidateItems = new Map(
      body.candidate.items.map((item) => [item.product.id, item]),
    );
    const orderedIds = [
      ...body.baseline.items.map((item) => item.product.id),
      ...body.candidate.items
        .map((item) => item.product.id)
        .filter((id) => !baselineItems.has(id)),
    ];

    const items = orderedIds.map((productId) => {
      const baselineItem = baselineItems.get(productId) ?? null;
      const candidateItem = candidateItems.get(productId) ?? null;
      const oldSnapshot = this.resolvePreferredSnapshot(baselineItem);
      const newSnapshot = this.resolvePreferredSnapshot(candidateItem);
      const oldRank = oldSnapshot?.rank ?? null;
      const newRank = newSnapshot?.rank ?? null;
      const rankMovement =
        oldRank !== null && newRank !== null ? oldRank - newRank : null;
      const oldScore = oldSnapshot?.finalScore ?? null;
      const newScore = newSnapshot?.finalScore ?? null;
      const productName =
        candidateItem?.product.name ?? baselineItem?.product.name ?? productId;

      let status:
        | 'unchanged'
        | 'moved_up'
        | 'moved_down'
        | 'added'
        | 'removed' = 'unchanged';
      if (!baselineItem && candidateItem) {
        status = 'added';
      } else if (baselineItem && !candidateItem) {
        status = 'removed';
      } else if (rankMovement !== null && rankMovement > 0) {
        status = 'moved_up';
      } else if (rankMovement !== null && rankMovement < 0) {
        status = 'moved_down';
      }

      return {
        productId,
        productName,
        status,
        oldRank,
        newRank,
        rankMovement,
        oldScore,
        newScore,
        scoreDelta:
          oldScore !== null && newScore !== null ? newScore - oldScore : null,
        reasonDelta:
          baselineItem || candidateItem
            ? this.buildReasonDelta(
                oldSnapshot?.reasons ?? [],
                newSnapshot?.reasons ?? [],
              )
            : null,
        scoreBreakdownDelta: this.buildScoreBreakdownDelta(
          oldSnapshot?.scoreBreakdown ?? null,
          newSnapshot?.scoreBreakdown ?? null,
        ),
      };
    });

    return {
      scenario: {
        baseline: body.baseline,
        candidate: body.candidate,
      },
      summary: {
        totalItemsCompared: items.length,
        movedUpCount: items.filter((item) => item.status === 'moved_up').length,
        movedDownCount: items.filter((item) => item.status === 'moved_down')
          .length,
        addedCount: items.filter((item) => item.status === 'added').length,
        removedCount: items.filter((item) => item.status === 'removed').length,
        unchangedCount: items.filter((item) => item.status === 'unchanged')
          .length,
      },
      items,
    };
  }

  private async buildRecommendationAnalytics(
    query: RecommendationAnalyticsQueryDto,
    options?: { shopId?: string },
  ) {
    const range = this.resolveRecommendationAnalyticsRange(query);
    const sellerProducts = options?.shopId
      ? await this.prisma.product.findMany({
          where: { shopId: options.shopId },
          select: {
            id: true,
            shopId: true,
            localTitle: true,
            wbTitle: true,
            shop: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];
    const sellerProductIds = options?.shopId
      ? sellerProducts.map((product) => product.id)
      : null;

    const events = (await this.prisma.recommendationEvent.findMany({
      where: {
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
        ...(sellerProductIds
          ? {
              productId: {
                in: sellerProductIds,
              },
            }
          : {}),
      },
      select: {
        id: true,
        type: true,
        placement: true,
        productId: true,
        shopId: true,
        campaignId: true,
        algorithm: true,
        scenarioType: true,
        sponsored: true,
        charged: true,
        cost: true,
        metadata: true,
        createdAt: true,
      },
    })) as RecommendationAnalyticsEventRecord[];

    const productIds = [...new Set(events.map((event) => event.productId))];
    const productSummaries = new Map<
      string,
      RecommendationAnalyticsProductSummary
    >();

    if (sellerProducts.length) {
      sellerProducts.forEach((product) => {
        productSummaries.set(product.id, {
          productId: product.id,
          productName: product.localTitle ?? product.wbTitle,
          shopId: product.shopId,
          shopName: product.shop.name,
        });
      });
    }

    const missingProductIds = productIds.filter(
      (productId) => !productSummaries.has(productId),
    );
    if (missingProductIds.length) {
      const products = await this.prisma.product.findMany({
        where: {
          id: {
            in: missingProductIds,
          },
        },
        select: {
          id: true,
          shopId: true,
          localTitle: true,
          wbTitle: true,
          shop: {
            select: {
              name: true,
            },
          },
        },
      });
      products.forEach((product) => {
        productSummaries.set(product.id, {
          productId: product.id,
          productName: product.localTitle ?? product.wbTitle,
          shopId: product.shopId,
          shopName: product.shop.name,
        });
      });
    }

    return {
      range,
      events,
      productSummaries,
    };
  }

  private resolveRecommendationAnalyticsRange(
    query: RecommendationAnalyticsQueryDto,
  ): RecommendationAnalyticsDateRange {
    const range = query.range ?? 'last7d';
    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);

    switch (range) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case 'last30d':
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (query.from) {
          from.setTime(new Date(query.from).getTime());
        } else {
          from.setHours(0, 0, 0, 0);
        }
        if (query.to) {
          to.setTime(new Date(query.to).getTime());
          to.setHours(23, 59, 59, 999);
        }
        break;
      case 'last7d':
      default:
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        break;
    }

    return {
      range,
      from,
      to,
      limit: Math.max(1, Math.min(query.limit ?? 10, 25)),
    };
  }

  private mapAnalyticsRange(range: RecommendationAnalyticsDateRange) {
    return {
      range: range.range,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    };
  }

  private buildAnalyticsOverviewSummary(
    events: RecommendationAnalyticsEventRecord[],
  ) {
    const metrics = this.accumulateAnalyticsRows(events);
    return {
      overall: {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: this.calculateCtr(metrics.impressions, metrics.clicks),
      },
      sponsored: {
        impressions: metrics.sponsoredImpressions,
        clicks: metrics.sponsoredClicks,
        ctr: this.calculateCtr(
          metrics.sponsoredImpressions,
          metrics.sponsoredClicks,
        ),
        chargedAmount: metrics.chargedAmount.toFixed(2),
      },
      personalization: {
        trackedImpressions:
          metrics.personalizedImpressions + metrics.nonPersonalizedImpressions,
        trackedClicks:
          metrics.personalizedClicks + metrics.nonPersonalizedClicks,
        personalizedImpressions: metrics.personalizedImpressions,
        personalizedClicks: metrics.personalizedClicks,
        personalizedCtr: this.calculateCtr(
          metrics.personalizedImpressions,
          metrics.personalizedClicks,
        ),
        nonPersonalizedImpressions: metrics.nonPersonalizedImpressions,
        nonPersonalizedClicks: metrics.nonPersonalizedClicks,
        nonPersonalizedCtr: this.calculateCtr(
          metrics.nonPersonalizedImpressions,
          metrics.nonPersonalizedClicks,
        ),
      },
    };
  }

  private buildAlgorithmRows(events: RecommendationAnalyticsEventRecord[]) {
    const rows = new Map<string, RecommendationAnalyticsRow>();
    events.forEach((event) => {
      this.consumeAnalyticsEvent(
        rows,
        event.algorithm?.trim() || 'unknown',
        event,
      );
    });

    return [...rows.entries()]
      .map(([algorithm, metrics]) => ({
        algorithm,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: this.calculateCtr(metrics.impressions, metrics.clicks),
        sponsoredImpressions: metrics.sponsoredImpressions,
        sponsoredClicks: metrics.sponsoredClicks,
        sponsoredCtr: this.calculateCtr(
          metrics.sponsoredImpressions,
          metrics.sponsoredClicks,
        ),
        chargedAmount: metrics.chargedAmount.toFixed(2),
        trackedPersonalizedImpressions: metrics.personalizedImpressions,
        trackedPersonalizedClicks: metrics.personalizedClicks,
        trackedPersonalizedCtr: this.calculateCtr(
          metrics.personalizedImpressions,
          metrics.personalizedClicks,
        ),
      }))
      .sort((left, right) => right.impressions - left.impressions);
  }

  private buildScenarioRows(events: RecommendationAnalyticsEventRecord[]) {
    const rows = new Map<
      'home' | 'similar' | 'search',
      RecommendationAnalyticsRow
    >();
    events.forEach((event) => {
      const scenarioType = this.resolveAnalyticsScenarioType(event);
      if (!scenarioType) {
        return;
      }
      this.consumeAnalyticsEvent(rows, scenarioType, event);
    });

    return (['home', 'similar', 'search'] as const).map((scenarioType) => {
      const metrics = rows.get(scenarioType) ?? this.createEmptyAnalyticsRow();
      return {
        scenarioType,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: this.calculateCtr(metrics.impressions, metrics.clicks),
        sponsoredImpressions: metrics.sponsoredImpressions,
        sponsoredClicks: metrics.sponsoredClicks,
        sponsoredCtr: this.calculateCtr(
          metrics.sponsoredImpressions,
          metrics.sponsoredClicks,
        ),
        chargedAmount: metrics.chargedAmount.toFixed(2),
      };
    });
  }

  private buildTopProductRows(
    events: RecommendationAnalyticsEventRecord[],
    productSummaries: Map<string, RecommendationAnalyticsProductSummary>,
    limit: number,
    sortBy: 'impressions' | 'clicks',
  ) {
    const rows = new Map<string, RecommendationAnalyticsRow>();
    events.forEach((event) => {
      this.consumeAnalyticsEvent(rows, event.productId, event);
    });

    return [...rows.entries()]
      .map(([productId, metrics]) => {
        const product = productSummaries.get(productId);
        return {
          productId,
          productName: product?.productName ?? 'Unknown product',
          shopId: product?.shopId ?? '',
          shopName: product?.shopName ?? 'Unknown shop',
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr: this.calculateCtr(metrics.impressions, metrics.clicks),
          sponsoredImpressions: metrics.sponsoredImpressions,
          sponsoredClicks: metrics.sponsoredClicks,
          sponsoredCtr: this.calculateCtr(
            metrics.sponsoredImpressions,
            metrics.sponsoredClicks,
          ),
          chargedAmount: metrics.chargedAmount.toFixed(2),
        };
      })
      .sort((left, right) => {
        if (sortBy === 'clicks') {
          return (
            right.clicks - left.clicks ||
            right.impressions - left.impressions ||
            right.ctr - left.ctr
          );
        }
        return (
          right.impressions - left.impressions ||
          right.clicks - left.clicks ||
          right.ctr - left.ctr
        );
      })
      .slice(0, limit);
  }

  private accumulateAnalyticsRows(
    events: RecommendationAnalyticsEventRecord[],
  ) {
    return events.reduce((accumulator, event) => {
      this.applyAnalyticsEventToRow(accumulator, event);
      return accumulator;
    }, this.createEmptyAnalyticsRow());
  }

  private consumeAnalyticsEvent<TKey>(
    rows: Map<TKey, RecommendationAnalyticsRow>,
    key: TKey,
    event: RecommendationAnalyticsEventRecord,
  ) {
    const current = rows.get(key) ?? this.createEmptyAnalyticsRow();
    this.applyAnalyticsEventToRow(current, event);
    rows.set(key, current);
  }

  private createEmptyAnalyticsRow(): RecommendationAnalyticsRow {
    return {
      impressions: 0,
      clicks: 0,
      sponsoredImpressions: 0,
      sponsoredClicks: 0,
      chargedAmount: new Prisma.Decimal(0),
      trackedPersonalizedImpressions: 0,
      trackedPersonalizedClicks: 0,
      personalizedImpressions: 0,
      personalizedClicks: 0,
      nonPersonalizedImpressions: 0,
      nonPersonalizedClicks: 0,
    };
  }

  private applyAnalyticsEventToRow(
    row: RecommendationAnalyticsRow,
    event: RecommendationAnalyticsEventRecord,
  ) {
    const isImpression = event.type === 'impression';
    const isClick = event.type === 'click';
    if (!isImpression && !isClick) {
      return;
    }

    if (isImpression) {
      row.impressions += 1;
    }
    if (isClick) {
      row.clicks += 1;
    }
    if (event.sponsored) {
      if (isImpression) {
        row.sponsoredImpressions += 1;
      }
      if (isClick) {
        row.sponsoredClicks += 1;
      }
    }
    if (event.charged && event.cost) {
      row.chargedAmount = row.chargedAmount.plus(event.cost);
    }

    const personalized = this.readPersonalizedMetadata(event.metadata);
    if (personalized === true) {
      if (isImpression) {
        row.trackedPersonalizedImpressions += 1;
        row.personalizedImpressions += 1;
      }
      if (isClick) {
        row.trackedPersonalizedClicks += 1;
        row.personalizedClicks += 1;
      }
    } else if (personalized === false) {
      if (isImpression) {
        row.nonPersonalizedImpressions += 1;
      }
      if (isClick) {
        row.nonPersonalizedClicks += 1;
      }
    }
  }

  private readPersonalizedMetadata(metadata: Prisma.JsonValue | null) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }
    const value = (metadata as { personalized?: unknown }).personalized;
    return typeof value === 'boolean' ? value : null;
  }

  private calculateCtr(impressions: number, clicks: number) {
    if (impressions <= 0 || clicks <= 0) {
      return 0;
    }
    return Number(((clicks / impressions) * 100).toFixed(2));
  }

  private resolveAnalyticsScenarioType(
    event: RecommendationAnalyticsEventRecord,
  ): 'home' | 'similar' | 'search' | null {
    if (event.scenarioType === 'home') {
      return 'home';
    }
    if (event.scenarioType === 'similar') {
      return 'similar';
    }
    if (event.scenarioType === 'search') {
      return 'search';
    }
    if (event.placement === 'home') {
      return 'home';
    }
    if (event.placement === 'product_detail') {
      return 'similar';
    }
    if (event.placement === 'search') {
      return 'search';
    }
    return null;
  }

  private evaluateQaPackThresholds(
    diff: RecommendationQaDiffResult,
    thresholds?: RecommendationQaPackDto['expectedSummaryThresholds'],
  ) {
    const summary = {
      ...diff.summary,
      totalChangedCount:
        diff.summary.movedUpCount +
        diff.summary.movedDownCount +
        diff.summary.addedCount +
        diff.summary.removedCount,
      maxScoreDelta: Math.max(
        0,
        ...diff.items.map((item) => Math.abs(item.scoreDelta ?? 0)),
      ),
      maxAbsoluteRankMovement: Math.max(
        0,
        ...diff.items.map((item) => Math.abs(item.rankMovement ?? 0)),
      ),
    };

    if (!thresholds || !Object.keys(thresholds).length) {
      return {
        overallStatus: 'not_evaluated' as const,
        summary,
        thresholds: [],
      };
    }

    const evaluations: Array<{
      key: RecommendationQaPackThresholdKey;
      status: 'pass' | 'fail';
      operator: '<=' | '>=';
      actualValue: number;
      expectedValue: number;
      message: string;
    }> = [];
    const evaluateMaxThreshold = (
      key: RecommendationQaPackThresholdKey,
      label: string,
      actualValue: number,
      expectedValue: number | undefined,
    ) => {
      if (expectedValue === undefined) {
        return;
      }

      evaluations.push({
        key,
        status: actualValue <= expectedValue ? 'pass' : 'fail',
        operator: '<=',
        actualValue,
        expectedValue,
        message:
          actualValue <= expectedValue
            ? `${label} stayed within the threshold.`
            : `${label} exceeded the threshold.`,
      });
    };
    const evaluateMinThreshold = (
      key: RecommendationQaPackThresholdKey,
      label: string,
      actualValue: number,
      expectedValue: number | undefined,
    ) => {
      if (expectedValue === undefined) {
        return;
      }

      evaluations.push({
        key,
        status: actualValue >= expectedValue ? 'pass' : 'fail',
        operator: '>=',
        actualValue,
        expectedValue,
        message:
          actualValue >= expectedValue
            ? `${label} met the minimum threshold.`
            : `${label} fell below the minimum threshold.`,
      });
    };

    evaluateMaxThreshold(
      'maxMovedDownCount',
      'Moved-down count',
      summary.movedDownCount,
      thresholds.maxMovedDownCount,
    );
    evaluateMaxThreshold(
      'maxMovedUpCount',
      'Moved-up count',
      summary.movedUpCount,
      thresholds.maxMovedUpCount,
    );
    evaluateMaxThreshold(
      'maxAddedCount',
      'Added count',
      summary.addedCount,
      thresholds.maxAddedCount,
    );
    evaluateMaxThreshold(
      'maxRemovedCount',
      'Removed count',
      summary.removedCount,
      thresholds.maxRemovedCount,
    );
    evaluateMaxThreshold(
      'maxScoreDelta',
      'Maximum absolute score delta',
      summary.maxScoreDelta,
      thresholds.maxScoreDelta,
    );
    evaluateMaxThreshold(
      'maxAbsoluteRankMovement',
      'Maximum absolute rank movement',
      summary.maxAbsoluteRankMovement,
      thresholds.maxAbsoluteRankMovement,
    );
    evaluateMinThreshold(
      'minUnchangedCount',
      'Unchanged count',
      summary.unchangedCount,
      thresholds.minUnchangedCount,
    );
    evaluateMaxThreshold(
      'maxTotalChangedCount',
      'Total changed count',
      summary.totalChangedCount,
      thresholds.maxTotalChangedCount,
    );

    return {
      overallStatus: evaluations.every((item) => item.status === 'pass')
        ? ('pass' as const)
        : ('fail' as const),
      summary,
      thresholds: evaluations,
    };
  }

  private resolveQaThresholdPreset(
    presetId?: string | null,
  ): RecommendationQaThresholdPreset | null {
    if (!presetId?.trim()) {
      return null;
    }

    return (
      RECOMMENDATION_QA_THRESHOLD_PRESETS.find(
        (preset) => preset.id === presetId.trim(),
      ) ?? null
    );
  }

  private resolveQaBaselineCatalogEntry(
    catalogId?: string | null,
  ): RecommendationQaBaselineCatalogEntry | null {
    if (!catalogId?.trim()) {
      return null;
    }

    return (
      RECOMMENDATION_QA_BASELINE_CATALOG.find(
        (entry) => entry.id === catalogId.trim(),
      ) ?? null
    );
  }

  private resolveQaPackThresholds(
    preset: RecommendationQaThresholdPreset | null,
    explicitThresholds?: RecommendationQaPackDto['expectedSummaryThresholds'],
  ): RecommendationQaPackThresholdsDto {
    return {
      ...(preset?.thresholds ?? {}),
      ...(explicitThresholds ?? {}),
    };
  }

  private emptyResponse(placement: RecommendationPlacement) {
    return {
      algorithm: this.isSmartRankingEnabled()
        ? 'rule_based_v2'
        : 'rule_based_v1',
      placement,
      items: [] as RecommendationApiItem[],
      products: [] as ReturnType<RecommendationsService['mapProduct']>[],
    };
  }

  private createEmptyPreferenceProfile(): RecommendationPreferenceProfile {
    return {
      categoryIds: new Set<string>(),
      categoryTerms: new Set<string>(),
      brands: new Set<string>(),
      colors: new Set<string>(),
      searchTerms: [],
      recentViewProductScores: new Map<string, number>(),
      recentViewBrandScores: new Map<string, number>(),
      recentViewColorScores: new Map<string, number>(),
      categoryAffinityScores: new Map<string, number>(),
      categoryTermAffinityScores: new Map<string, number>(),
      searchIntentScores: new Map<string, number>(),
      clickAffinityProductScores: new Map<string, number>(),
      clickAffinityCategoryScores: new Map<string, number>(),
      clickAffinityCategoryTermScores: new Map<string, number>(),
      clickAffinityBrandScores: new Map<string, number>(),
      clickAffinityColorScores: new Map<string, number>(),
    };
  }

  private addWeightedSignal(
    target: Map<string, number>,
    key: string | null | undefined,
    value: number,
  ) {
    const normalizedKey = key?.trim();
    if (!normalizedKey || value <= 0) {
      return;
    }

    target.set(
      normalizedKey,
      Number(((target.get(normalizedKey) ?? 0) + value).toFixed(4)),
    );
  }

  private calculateBehaviorWeight(
    createdAt: Date | null | undefined,
    index: number,
    multiplier: number,
  ) {
    const ageDays = createdAt
      ? Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const recencyWeight = Math.pow(0.72, ageDays / 7);
    const indexWeight = Math.max(0.45, 1 - index * 0.08);
    return Number((recencyWeight * indexWeight * multiplier).toFixed(4));
  }

  private async buildPreferenceProfile(
    query: RecommendationQueryDto,
    request: Request,
    user?: AuthenticatedUser | null,
  ): Promise<RecommendationPreferenceProfile> {
    const customerId = user?.userId ?? null;
    const guestSessionId = this.resolveGuestSessionId(
      query.guestSessionId,
      request,
    );

    if (!customerId && !guestSessionId) {
      return this.createEmptyPreferenceProfile();
    }

    const actorWhere = customerId ? { customerId } : { guestSessionId };
    const personalizationEnabled = this.isPersonalizationEnabled();

    const [views, searches, clicks] = await Promise.all([
      this.prisma.productViewLog.findMany({
        where: actorWhere,
        orderBy: { createdAt: 'desc' },
        take: personalizationEnabled ? 24 : 20,
        select: {
          productId: true,
          createdAt: true,
        },
      }),
      this.prisma.searchLog.findMany({
        where: actorWhere,
        orderBy: { createdAt: 'desc' },
        take: personalizationEnabled ? 16 : 12,
        select: {
          query: true,
          normalizedQuery: true,
          createdAt: true,
        },
      }),
      personalizationEnabled
        ? this.prisma.recommendationEvent.findMany({
            where: {
              ...actorWhere,
              type: 'click',
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              productId: true,
              createdAt: true,
            },
          })
        : Promise.resolve(
            [] as Array<{ productId: string; createdAt: Date | null }>,
          ),
    ]);

    const profile = this.createEmptyPreferenceProfile();

    const behaviorProductIds = [...views, ...clicks]
      .map((event) => event.productId)
      .filter((value): value is string => Boolean(value));
    const behaviorProducts = behaviorProductIds.length
      ? await this.prisma.product.findMany({
          where: {
            id: {
              in: [...new Set(behaviorProductIds)],
            },
          },
          select: {
            id: true,
            categoryId: true,
            categoryName: true,
            sourceCategoryName: true,
            brand: true,
            color: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        })
      : [];
    const behaviorProductsById = new Map(
      behaviorProducts.map((product) => [product.id, product]),
    );

    for (const product of behaviorProducts) {
      if (!product) {
        continue;
      }
      if (product.categoryId) {
        profile.categoryIds.add(product.categoryId.toString());
      }
      [product.category?.name, product.categoryName, product.sourceCategoryName]
        .map((value) => this.normalizeQuery(value ?? ''))
        .filter(Boolean)
        .forEach((value) => profile.categoryTerms.add(value));
      if (product.brand?.trim()) {
        profile.brands.add(this.normalizeQuery(product.brand));
      }
      if (product.color?.trim()) {
        profile.colors.add(this.normalizeQuery(product.color));
      }
    }

    views.forEach((view, index) => {
      if (!view.productId) {
        return;
      }
      const product = behaviorProductsById.get(view.productId);
      if (!product || !personalizationEnabled) {
        return;
      }

      const weight = this.calculateBehaviorWeight(view.createdAt, index, 1);
      this.addWeightedSignal(
        profile.recentViewProductScores,
        product.id,
        Math.min(1, weight),
      );

      if (product.brand?.trim()) {
        this.addWeightedSignal(
          profile.recentViewBrandScores,
          this.normalizeQuery(product.brand),
          weight,
        );
      }
      if (product.color?.trim()) {
        this.addWeightedSignal(
          profile.recentViewColorScores,
          this.normalizeQuery(product.color),
          weight * 0.85,
        );
      }
      if (product.categoryId) {
        this.addWeightedSignal(
          profile.categoryAffinityScores,
          product.categoryId.toString(),
          weight,
        );
      }
      [product.category?.name, product.categoryName, product.sourceCategoryName]
        .map((value) => this.normalizeQuery(value ?? ''))
        .filter(Boolean)
        .forEach((value) =>
          this.addWeightedSignal(
            profile.categoryTermAffinityScores,
            value,
            weight * 0.95,
          ),
        );
    });

    searches.forEach((search, index) => {
      const normalized =
        search.normalizedQuery ?? this.normalizeQuery(search.query);
      normalized
        .split(' ')
        .filter((token) => token.length >= 2)
        .forEach((token) => {
          profile.searchTerms.push(token);
          if (personalizationEnabled) {
            this.addWeightedSignal(
              profile.searchIntentScores,
              token,
              this.calculateBehaviorWeight(search.createdAt, index, 0.9),
            );
          }
        });
    });

    profile.searchTerms = [...new Set(profile.searchTerms)];

    clicks.forEach((click, index) => {
      if (!click.productId) {
        return;
      }
      const product = behaviorProductsById.get(click.productId);
      if (!product) {
        return;
      }

      const weight = this.calculateBehaviorWeight(click.createdAt, index, 1.1);
      this.addWeightedSignal(
        profile.clickAffinityProductScores,
        product.id,
        Math.min(1, weight),
      );
      if (product.categoryId) {
        this.addWeightedSignal(
          profile.clickAffinityCategoryScores,
          product.categoryId.toString(),
          weight,
        );
      }
      [product.category?.name, product.categoryName, product.sourceCategoryName]
        .map((value) => this.normalizeQuery(value ?? ''))
        .filter(Boolean)
        .forEach((value) =>
          this.addWeightedSignal(
            profile.clickAffinityCategoryTermScores,
            value,
            weight,
          ),
        );
      if (product.brand?.trim()) {
        this.addWeightedSignal(
          profile.clickAffinityBrandScores,
          this.normalizeQuery(product.brand),
          weight,
        );
      }
      if (product.color?.trim()) {
        this.addWeightedSignal(
          profile.clickAffinityColorScores,
          this.normalizeQuery(product.color),
          weight * 0.8,
        );
      }
    });

    return profile;
  }

  private isPublicRecommendationsEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('PUBLIC_RECOMMENDATIONS_ENABLED', true)
    );
  }

  private isSmartRankingEnabled() {
    return this.readFlag('RECOMMENDATION_SMART_RANKING_ENABLED', true);
  }

  private isTrackingEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('RECOMMENDATION_TRACKING_ENABLED', true)
    );
  }

  private shouldIncludeExplainability(debug = false) {
    return (
      debug && this.readFlag('RECOMMENDATION_EXPLAINABILITY_ENABLED', false)
    );
  }

  private isQaToolsEnabled() {
    return this.readFlag('RECOMMENDATION_QA_TOOLS_ENABLED', false);
  }

  private isPersonalizationEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('RECOMMENDATION_PERSONALIZATION_ENABLED', false)
    );
  }

  private isAnalyticsTuningEnabled() {
    return (
      this.readFlag('RECOMMENDATIONS_ENABLED', true) &&
      this.readFlag('RECOMMENDATION_ANALYTICS_TUNING_ENABLED', false)
    );
  }

  private async buildSponsoredQaSummary(
    scenarioType: RecommendationSponsoredScenarioType,
  ): Promise<RecommendationSponsoredQaSummary> {
    const config = await this.getSponsoredRankingConfig(scenarioType);
    return {
      sponsoredRankingEnabled: config.enabled,
      activePreset: config.preset,
    };
  }

  private async getSponsoredRankingConfig(
    scenarioType: RecommendationSponsoredScenarioType,
  ): Promise<RecommendationSponsoredRankingConfig> {
    const rankingEnabled = this.readFlag(
      'RECOMMENDATION_SPONSORED_RANKING_ENABLED',
      false,
    );
    const preset = this.resolveSponsoredPreset(
      this.configService.get<string>('RECOMMENDATION_SPONSORED_PRESET_ID'),
    );
    const scenarioAllowed =
      preset?.allowedScenarioTypes.includes(scenarioType) ?? false;
    const enabled = rankingEnabled && scenarioAllowed;
    const rolloutMode = this.resolveSponsoredRolloutMode(rankingEnabled);
    const maxSponsoredBoost = this.readNumberFlag(
      'RECOMMENDATION_SPONSORED_MAX_BOOST',
      preset?.maxSponsoredBoost ??
        RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxSponsoredBoostDefault,
      0,
      Math.min(
        preset?.maxSponsoredBoost ??
          RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxSponsoredBoostDefault,
        RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxConfiguredBoost,
      ),
    );
    const maxBusinessBoost =
      preset?.maxBusinessBoost ??
      RECOMMENDATION_SPONSORED_RANKING_LIMITS.businessBoostDefault;
    const sponsoredProductIds = rankingEnabled
      ? this.readStringListFlag('RECOMMENDATION_SPONSORED_PRODUCT_IDS')
      : [];
    const activeCampaignTargets = enabled
      ? await this.campaignsService.getActiveRecommendationTargets(scenarioType)
      : [];
    const sponsoredTargetsByProductId = new Map<
      string,
      RecommendationSponsoredTargetConfig
    >();
    for (const target of activeCampaignTargets) {
      if (!sponsoredTargetsByProductId.has(target.productId)) {
        sponsoredTargetsByProductId.set(target.productId, {
          campaignId: target.campaignId,
          shopId: target.shopId,
          productId: target.productId,
          boost: Math.min(target.boost, target.maxBoost),
          billingMode: target.billingMode,
          scenarioType,
        });
      }
    }
    const campaign: RecommendationSponsoredCampaignContract = {
      campaignId:
        (activeCampaignTargets[0]?.campaignId ??
          this.configService
            .get<string>('RECOMMENDATION_SPONSORED_CAMPAIGN_ID')
            ?.trim()) ||
        null,
      sponsorType: this.readEnumFlag<RecommendationSponsoredSponsorType>(
        'RECOMMENDATION_SPONSORED_SPONSOR_TYPE',
        ['none', 'campaign', 'business_boost', 'hybrid'],
        sponsoredTargetsByProductId.size > 0 || sponsoredProductIds.length > 0
          ? 'campaign'
          : 'none',
      ),
      sponsoredProductIds: [
        ...new Set([
          ...sponsoredProductIds,
          ...activeCampaignTargets.map((target) => target.productId),
        ]),
      ],
      maxBoost: maxSponsoredBoost,
      scenarioType,
      billingMode:
        activeCampaignTargets[0]?.billingMode ??
        this.readEnumFlag<RecommendationSponsoredBillingMode>(
          'RECOMMENDATION_SPONSORED_BILLING_MODE',
          ['none', 'cpc', 'cpm', 'fixed'],
          'none',
        ),
      rolloutMode,
    };

    return {
      enabled,
      sponsoredProductIds: new Set(sponsoredProductIds),
      sponsoredTargetsByProductId,
      businessBoostShopIds: new Set(
        rankingEnabled
          ? this.readStringListFlag('RECOMMENDATION_BUSINESS_BOOST_SHOP_IDS')
          : [],
      ),
      sponsoredBoost: this.readNumberFlag(
        'RECOMMENDATION_SPONSORED_PRODUCT_BOOST',
        preset?.sponsoredBoost ??
          RECOMMENDATION_SPONSORED_RANKING_LIMITS.sponsoredBoostDefault,
        0,
        maxSponsoredBoost,
      ),
      businessBoost: this.readNumberFlag(
        'RECOMMENDATION_BUSINESS_SHOP_BOOST',
        preset?.businessBoost ??
          RECOMMENDATION_SPONSORED_RANKING_LIMITS.businessBoostDefault,
        0,
        Math.min(
          maxBusinessBoost,
          RECOMMENDATION_SPONSORED_RANKING_LIMITS.maxConfiguredBoost,
        ),
      ),
      maxSponsoredBoost,
      maxBusinessBoost,
      preset: preset ? toSafeSponsoredPresetMetadata(preset) : null,
      campaign: toSafeSponsoredCampaignMetadata(campaign),
    };
  }

  private resolveSponsoredPreset(
    presetId: string | undefined,
  ): RecommendationSponsoredPresetDefinition | null {
    const normalizedPresetId = presetId?.trim() as
      | RecommendationSponsoredPresetId
      | undefined;

    return (
      RECOMMENDATION_SPONSORED_PRESETS.find(
        (preset) => preset.id === normalizedPresetId,
      ) ??
      RECOMMENDATION_SPONSORED_PRESETS.find(
        (preset) => preset.id === DEFAULT_RECOMMENDATION_SPONSORED_PRESET_ID,
      ) ??
      null
    );
  }

  private resolveSponsoredRolloutMode(
    rankingEnabled: boolean,
  ): RecommendationSponsoredRolloutMode {
    if (!rankingEnabled) {
      return 'disabled';
    }

    return this.readEnumFlag<RecommendationSponsoredRolloutMode>(
      'RECOMMENDATION_SPONSORED_ROLLOUT_MODE',
      ['disabled', 'internal', 'limited', 'public'],
      'internal',
    );
  }

  private readFlag(name: string, fallback: boolean) {
    const raw = this.configService.get<string>(name);
    if (raw === undefined) {
      return fallback;
    }
    return !['0', 'false', 'off', 'no'].includes(raw.toLowerCase());
  }

  private readStringListFlag(name: string) {
    const raw = this.configService.get<string>(name) ?? '';
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private readEnumFlag<T extends string>(
    name: string,
    allowed: readonly T[],
    fallback: T,
  ) {
    const raw = this.configService.get<string>(name)?.trim().toLowerCase();
    if (!raw) {
      return fallback;
    }

    return allowed.find((item) => item === raw) ?? fallback;
  }

  private readNumberFlag(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const raw = this.configService.get<string>(name);
    if (raw === undefined) {
      return fallback;
    }

    const value = Number(raw);
    if (Number.isNaN(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  private buildPublicVisibilityWhere(): Prisma.ProductWhereInput {
    return {
      visibility: 'ACTIVE',
      catalogStatus: 'PUBLISHED',
      archivedAt: null,
      unpublishedAt: null,
      images: {
        some: {},
      },
      shop: {
        status: 'ACTIVE',
        sellerProfile: {
          approvalStatus: 'APPROVED',
        },
      },
      variants: {
        some: {
          isActive: true,
          OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
        },
      },
    };
  }

  private getProductInclude() {
    return {
      images: {
        orderBy: [{ isMain: 'desc' as const }, { sortOrder: 'asc' as const }],
      },
      variants: {
        where: {
          isActive: true,
          OR: [{ discountPrice: { gt: 0 } }, { basePrice: { gt: 0 } }],
        },
        orderBy: { createdAt: 'asc' as const },
      },
      category: true,
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          paymentInstructions: true,
          status: true,
          sellerProfile: {
            select: {
              approvalStatus: true,
            },
          },
        },
      },
    };
  }

  private isPublicVisible(product: RecommendationProductRecord) {
    return this.productReadiness.getReadiness(product).publicVisible;
  }

  private mapProduct(product: RecommendationProductRecord) {
    const price = this.resolvePrice(product.variants);
    const availableQuantity = this.resolveAvailableQuantity(product.variants);

    return {
      id: product.id,
      shopId: product.shopId,
      name: product.localTitle ?? product.wbTitle,
      description: product.localDescription ?? product.wbDescription,
      brand: product.brand,
      color: product.color,
      gender: product.gender,
      composition: product.composition,
      sellerSku: product.sellerSku,
      seoSlug: product.seoSlug,
      categoryId: product.category?.id.toString() ?? null,
      categorySlug: product.category?.slug ?? null,
      categoryName: product.category?.name ?? product.categoryName,
      sourceCategoryName: product.sourceCategoryName,
      price: price?.toString() ?? null,
      oldPrice: this.resolveOriginalPrice(product.variants)?.toString() ?? null,
      inStock: availableQuantity > 0,
      availableQuantity,
      averageRating: product.averageRating?.toString() ?? null,
      feedbackCount: product.feedbackCount ?? 0,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.localUrl ?? image.wbUrl,
        isMain: image.isMain ?? false,
      })),
      variants: product.variants.map((variant) => {
        const variantPrice = this.resolveVariantPrice(variant);
        const variantAvailableQuantity =
          this.resolveVariantAvailableQuantity(variant);

        return {
          id: variant.id,
          sizeName: variant.sizeName,
          russianSize: variant.russianSize,
          techSize: variant.techSize,
          wbSize: variant.wbSize,
          sellerSku: variant.sellerSku,
          price: variantPrice?.toString() ?? null,
          originalPrice:
            (variant.basePrice ?? variant.discountPrice)?.toString() ?? null,
          stockQuantity: variant.stockQuantity,
          lowStockThreshold: variant.lowStockThreshold,
          trackInventory: variant.trackInventory,
          inStock: !variant.trackInventory || variantAvailableQuantity > 0,
          availableQuantity: variantAvailableQuantity,
        };
      }),
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
        logoUrl: product.shop.logoUrl,
        paymentInstructions: product.shop.paymentInstructions,
      },
      aiTryOn: {
        enabled: product.aiTryOnEnabled,
      },
    };
  }

  private resolveVariantPrice(
    variant: ProductVariant | RecommendationVariantRecord,
  ) {
    return variant.discountPrice ?? variant.basePrice ?? null;
  }

  private resolveVariantAvailableQuantity(
    variant: ProductVariant | RecommendationVariantRecord,
  ) {
    return variant.trackInventory ? Math.max(0, variant.stockQuantity) : 999999;
  }

  private resolveAvailableQuantity(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    return variants.reduce(
      (sum, variant) => sum + this.resolveVariantAvailableQuantity(variant),
      0,
    );
  }

  private resolvePrice(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    const pricedVariants = variants
      .map((variant) => this.resolveVariantPrice(variant))
      .filter((value): value is Prisma.Decimal => value !== null);
    if (!pricedVariants.length) {
      return null;
    }

    return pricedVariants.sort((left, right) => left.comparedTo(right))[0];
  }

  private resolveOriginalPrice(
    variants: Array<ProductVariant | RecommendationVariantRecord>,
  ) {
    const originalPrices = variants
      .map((variant) => variant.basePrice ?? null)
      .filter((value): value is Prisma.Decimal => value !== null);
    if (!originalPrices.length) {
      return null;
    }

    return originalPrices.sort((left, right) => left.comparedTo(right))[0];
  }

  private scoreSimilarProductV1(
    source: RecommendationProductRecord,
    candidate: RecommendationProductRecord,
  ) {
    let score = 0;

    if (source.categoryId && candidate.categoryId === source.categoryId) {
      score += 50;
    }
    if (
      source.categoryName &&
      candidate.categoryName &&
      source.categoryName.localeCompare(candidate.categoryName, undefined, {
        sensitivity: 'accent',
      }) === 0
    ) {
      score += 30;
    }
    if (
      source.sourceCategoryName &&
      candidate.sourceCategoryName &&
      source.sourceCategoryName.localeCompare(
        candidate.sourceCategoryName,
        undefined,
        {
          sensitivity: 'accent',
        },
      ) === 0
    ) {
      score += 20;
    }
    if (source.brand && candidate.brand === source.brand) {
      score += 12;
    }
    if (source.color && candidate.color === source.color) {
      score += 8;
    }
    if (this.resolveAvailableQuantity(candidate.variants) > 0) {
      score += 6;
    }

    score += Number(candidate.averageRating?.toString() ?? '0') * 4;
    score += candidate.feedbackCount ?? 0;
    score += this.recencyScoreV1(candidate);

    return score;
  }

  private scoreHomeProductV1(product: RecommendationProductRecord) {
    let score = 0;

    if (this.resolveAvailableQuantity(product.variants) > 0) {
      score += 50;
    }
    if (product.publishedAt) {
      score += 25;
    }
    score += Number(product.averageRating?.toString() ?? '0') * 5;
    score += Math.min(product.feedbackCount ?? 0, 25);
    score += this.recencyScoreV1(product);

    return score;
  }

  private recencyScoreV1(product: RecommendationProductRecord) {
    const reference =
      product.publishedAt ?? product.updatedAt ?? product.createdAt;
    const ageDays = Math.max(
      0,
      (Date.now() - reference.getTime()) / (1000 * 60 * 60 * 24),
    );

    return Math.max(0, 20 - ageDays);
  }

  private normalizeQuery(query: string) {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private createRecommendationTrackingToken(
    payload: RecommendationTrackingTokenPayload,
  ) {
    const serialized = JSON.stringify(payload);
    const encodedPayload = Buffer.from(serialized).toString('base64url');
    const signature = createHmac(
      'sha256',
      this.getRecommendationTrackingSecret(),
    )
      .update(serialized)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  private verifyRecommendationTrackingToken(
    token: string | undefined,
    expected: Pick<
      RecommendationTrackingTokenPayload,
      'productId' | 'placement' | 'algorithm'
    >,
  ): RecommendationTrackingTokenPayload | null {
    if (!token?.trim()) {
      return null;
    }

    const [encodedPayload, signature] = token.trim().split('.');
    if (!encodedPayload || !signature) {
      return null;
    }

    try {
      const payloadString = Buffer.from(encodedPayload, 'base64url').toString(
        'utf8',
      );
      const expectedSignature = createHmac(
        'sha256',
        this.getRecommendationTrackingSecret(),
      )
        .update(payloadString)
        .digest();
      const actualSignature = Buffer.from(signature, 'base64url');
      if (
        actualSignature.length !== expectedSignature.length ||
        !timingSafeEqual(actualSignature, expectedSignature)
      ) {
        return null;
      }

      const payload = JSON.parse(
        payloadString,
      ) as RecommendationTrackingTokenPayload;
      if (
        payload.productId !== expected.productId ||
        payload.placement !== expected.placement ||
        payload.algorithm !== expected.algorithm
      ) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private getRecommendationTrackingSecret() {
    return (
      this.configService.get<string>('RECOMMENDATION_TRACKING_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'recommendation-tracking-v1'
    );
  }

  private getSponsoredCpcAmount() {
    const configured = this.configService.get<string>(
      'RECOMMENDATION_SPONSORED_CPC_AMOUNT',
    );
    const decimal = configured
      ? new Prisma.Decimal(configured)
      : new Prisma.Decimal('1.00');
    return new Prisma.Decimal(decimal.toDecimalPlaces(2).toString());
  }

  private async sumCampaignSpend(
    campaignId: string,
    prisma: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const events = await prisma.recommendationEvent.findMany({
      where: {
        campaignId,
        charged: true,
      },
      select: {
        cost: true,
      },
    });

    return events.reduce(
      (sum, event) => (event.cost ? sum.plus(event.cost) : sum),
      new Prisma.Decimal(0),
    );
  }

  private normalizeBillingMode(
    billingMode: string | null | undefined,
  ): RecommendationSponsoredBillingMode {
    return (['none', 'cpc', 'cpm', 'fixed'].find(
      (mode) => mode === billingMode,
    ) ?? 'none') as RecommendationSponsoredBillingMode;
  }

  private isCampaignWithinDateWindow(startAt: Date | null, endAt: Date | null) {
    const now = new Date();
    if (startAt && startAt > now) {
      return false;
    }
    if (endAt && endAt < now) {
      return false;
    }
    return true;
  }

  private mapPlacementToScenarioType(
    placement: RecommendationPlacement,
  ): RecommendationSponsoredScenarioType {
    if (placement === 'product_detail') {
      return 'similar';
    }
    return placement === 'search' ? 'search' : 'home';
  }

  private isUniqueIdempotencyConflict(error: unknown) {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private resolveGuestSessionId(
    guestSessionId: string | undefined,
    request: Request,
  ) {
    return guestSessionId?.trim() || request.get('x-guest-session-id') || null;
  }

  private hashRequestIp(request: Request) {
    const forwarded = request.headers['x-forwarded-for'];
    const rawIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        ?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      '';

    if (!rawIp) {
      return null;
    }

    return createHash('sha256').update(rawIp).digest('hex');
  }
}
