import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { RecommendationQaCompareQueryDto } from './dto/recommendation-qa-compare-query.dto';
import { RecommendationQaCompareResponseDto } from './dto/recommendation-qa-compare-response.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('internal-recommendations-qa')
@Controller('api/internal/recommendations')
export class RecommendationsQaController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('compare')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Compare internal recommendation ranking output for QA only.',
  })
  @ApiOkResponse({ type: RecommendationQaCompareResponseDto })
  getRankingComparison(
    @Query() query: RecommendationQaCompareQueryDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.recommendationsService.getRankingComparison(
      query,
      request,
      user,
    );
  }
}
