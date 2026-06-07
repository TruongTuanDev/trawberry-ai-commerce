import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SellerJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShopAccessGuard } from '../../common/guards/shop-access.guard';
import { RecommendationAnalyticsQueryDto } from './dto/recommendation-analytics-query.dto';
import { SellerRecommendationAnalyticsOverviewResponseDto } from './dto/recommendation-analytics-response.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('seller-recommendation-analytics')
@ApiBearerAuth()
@UseGuards(SellerJwtAuthGuard, ShopAccessGuard)
@Controller('api/seller/shops/:shopId/recommendations/analytics')
export class SellerRecommendationsAnalyticsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get seller-scoped recommendation analytics for one shop.',
  })
  @ApiOkResponse({ type: SellerRecommendationAnalyticsOverviewResponseDto })
  getOverview(
    @Param('shopId') shopId: string,
    @Query() query: RecommendationAnalyticsQueryDto,
  ) {
    return this.recommendationsService.getSellerRecommendationAnalyticsOverview(
      shopId,
      query,
    );
  }
}
