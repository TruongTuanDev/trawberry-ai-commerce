import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RecommendationAnalyticsQueryDto } from './dto/recommendation-analytics-query.dto';
import {
  RecommendationAnalyticsAlgorithmsResponseDto,
  RecommendationAnalyticsOverviewResponseDto,
  RecommendationAnalyticsProductsResponseDto,
  RecommendationAnalyticsScenariosResponseDto,
} from './dto/recommendation-analytics-response.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('admin-recommendation-analytics')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/recommendations/analytics')
export class AdminRecommendationsAnalyticsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get platform-level recommendation analytics.' })
  @ApiOkResponse({ type: RecommendationAnalyticsOverviewResponseDto })
  getOverview(@Query() query: RecommendationAnalyticsQueryDto) {
    return this.recommendationsService.getAdminRecommendationAnalyticsOverview(
      query,
    );
  }

  @Get('products')
  @ApiOperation({
    summary:
      'Get top recommended and clicked products from recommendation analytics.',
  })
  @ApiOkResponse({ type: RecommendationAnalyticsProductsResponseDto })
  getProducts(@Query() query: RecommendationAnalyticsQueryDto) {
    return this.recommendationsService.getAdminRecommendationAnalyticsProducts(
      query,
    );
  }

  @Get('algorithms')
  @ApiOperation({
    summary: 'Get recommendation analytics grouped by algorithm.',
  })
  @ApiOkResponse({ type: RecommendationAnalyticsAlgorithmsResponseDto })
  getAlgorithms(@Query() query: RecommendationAnalyticsQueryDto) {
    return this.recommendationsService.getAdminRecommendationAnalyticsAlgorithms(
      query,
    );
  }

  @Get('scenarios')
  @ApiOperation({
    summary: 'Get recommendation analytics grouped by scenario.',
  })
  @ApiOkResponse({ type: RecommendationAnalyticsScenariosResponseDto })
  getScenarios(@Query() query: RecommendationAnalyticsQueryDto) {
    return this.recommendationsService.getAdminRecommendationAnalyticsScenarios(
      query,
    );
  }
}
