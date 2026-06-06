import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { RecommendationQaCompareQueryDto } from './dto/recommendation-qa-compare-query.dto';
import {
  RecommendationQaCompareResponseDto,
  RecommendationQaSnapshotResponseDto,
} from './dto/recommendation-qa-compare-response.dto';
import {
  RecommendationQaDiffRequestDto,
  RecommendationQaDiffResponseDto,
} from './dto/recommendation-qa-diff.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('internal-recommendations-qa')
@ApiExtraModels(
  RecommendationQaCompareResponseDto,
  RecommendationQaSnapshotResponseDto,
  RecommendationQaDiffResponseDto,
)
@Controller('api/internal/recommendations')
export class RecommendationsQaController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('compare')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Compare internal recommendation ranking output for QA only, with optional snapshot export.',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(RecommendationQaCompareResponseDto) },
        { $ref: getSchemaPath(RecommendationQaSnapshotResponseDto) },
      ],
    },
  })
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

  @Post('diff')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Diff two exported recommendation QA snapshots for internal review only.',
  })
  @ApiOkResponse({ type: RecommendationQaDiffResponseDto })
  diffRankingSnapshots(@Body() body: RecommendationQaDiffRequestDto) {
    return this.recommendationsService.diffRankingSnapshots(body);
  }
}
