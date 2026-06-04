import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  CreateVisualSearchDto,
  VisualSearchResponseDto,
} from './dto/create-visual-search.dto';
import { TrackVisualSearchEventDto } from './dto/track-visual-search-event.dto';
import { VisualSearchService } from './visual-search.service';

@ApiTags('public-visual-search')
@Controller('api/public/visual-search')
export class VisualSearchController {
  constructor(private readonly visualSearchService: VisualSearchService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({ type: VisualSearchResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
        categoryHint: { type: 'string' },
        cropX: { type: 'integer' },
        cropY: { type: 'integer' },
        cropWidth: { type: 'integer' },
        cropHeight: { type: 'integer' },
        guestSessionId: { type: 'string' },
      },
      required: ['image'],
    },
  })
  @ApiOperation({
    summary: 'Find similar public marketplace products from one image.',
  })
  create(
    @UploadedFile() image: Express.Multer.File,
    @Body() dto: CreateVisualSearchDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.visualSearchService.search(image, dto, request, user);
  }

  @Post('events')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Track one visual search impression or click safely.',
  })
  async trackEvent(
    @Body() dto: TrackVisualSearchEventDto,
    @Req() request: Request,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    await this.visualSearchService.trackEvent(dto, request, user);
  }
}
