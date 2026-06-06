import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { RecommendationProductsResponseDto } from './dto/recommendation-products-response.dto';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { TrackProductViewDto } from './dto/track-product-view.dto';
import { TrackRecommendationEventDto } from './dto/track-recommendation-event.dto';
import { TrackSearchDto } from './dto/track-search.dto';
import { RecommendationsService } from './recommendations.service';

@ApiTags('public-recommendations')
@Controller('api/public')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('recommendations/home')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get safe homepage recommendations.' })
  @ApiOkResponse({ type: RecommendationProductsResponseDto })
  getHomeRecommendations(
    @Query() query: RecommendationQueryDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.recommendationsService.getHomeRecommendations(
      query,
      request,
      user,
    );
  }

  @Get('recommendations/products/:productId/similar')
  @ApiOperation({
    summary: 'Get safe similar products for one public product.',
  })
  @ApiOkResponse({ type: RecommendationProductsResponseDto })
  getSimilarProducts(
    @Param('productId') productId: string,
    @Query() query: RecommendationQueryDto,
  ) {
    return this.recommendationsService.getSimilarProducts(productId, query);
  }

  @Get('recommendations/search')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get keyword-based recommendation suggestions.' })
  @ApiOkResponse({ type: RecommendationProductsResponseDto })
  getSearchRecommendations(@Query() query: RecommendationQueryDto) {
    return this.recommendationsService.getSearchRecommendations(query);
  }

  @Post('tracking/product-view')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Track one public product view without blocking UX.',
  })
  @ApiNoContentResponse()
  async trackProductView(
    @Body() dto: TrackProductViewDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    await this.recommendationsService.trackProductView(dto, request, user);
  }

  @Post('tracking/search')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Track one public search without blocking UX.' })
  @ApiNoContentResponse()
  async trackSearch(
    @Body() dto: TrackSearchDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    await this.recommendationsService.trackSearch(dto, request, user);
  }

  @Post('recommendations/events')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Track recommendation impressions or clicks safely.',
  })
  @ApiNoContentResponse()
  async trackRecommendationEvent(
    @Body() dto: TrackRecommendationEventDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    await this.recommendationsService.trackRecommendationEvent(
      dto,
      request,
      user,
    );
  }
}
