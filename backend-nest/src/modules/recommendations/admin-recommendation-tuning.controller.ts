import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import {
  CreateRecommendationTuningPresetDto,
  RecommendationTuningPreviewDto,
  RecommendationTuningRollbackDto,
  UpdateRecommendationTuningPresetDto,
} from './dto/recommendation-tuning.dto';
import { RecommendationTuningService } from './recommendation-tuning.service';
import { RecommendationsService } from './recommendations.service';

@ApiTags('admin-recommendation-tuning')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/recommendations/tuning-presets')
export class AdminRecommendationTuningController {
  constructor(
    private readonly tuningService: RecommendationTuningService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List controlled recommendation tuning presets.' })
  listPresets() {
    return this.tuningService.listPresets();
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft recommendation tuning preset.' })
  createPreset(
    @Body() dto: CreateRecommendationTuningPresetDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tuningService.createPreset(dto, admin.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tuning preset with versions and audit.' })
  getPreset(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tuningService.getPreset(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Create a new draft version from a tuning preset.' })
  updatePreset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRecommendationTuningPresetDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tuningService.updatePreset(id, dto, admin.userId);
  }

  @Post(':id/preview')
  @ApiOperation({
    summary: 'Preview a tuning preset without tracking or billing writes.',
  })
  previewPreset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecommendationTuningPreviewDto,
    @Req() request: Request,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.recommendationsService.previewTuningPreset(
      id,
      dto,
      request,
      admin,
    );
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Explicitly activate one tuning preset version.' })
  activatePreset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tuningService.activatePreset(id, admin.userId);
  }

  @Post(':id/rollback')
  @ApiOperation({ summary: 'Rollback to a previous version of the preset.' })
  rollbackPreset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RecommendationTuningRollbackDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tuningService.rollbackPreset(
      id,
      dto.targetVersion,
      admin.userId,
    );
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a tuning preset version.' })
  archivePreset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.tuningService.archivePreset(id, admin.userId);
  }
}
