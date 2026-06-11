import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CampaignsService } from './campaigns.service';
import {
  CampaignModerationOptionalReasonDto,
  CampaignModerationReasonDto,
  ListCampaignModerationQueryDto,
} from './dto/campaign-moderation.dto';

@ApiTags('admin-campaign-moderation')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/campaigns')
export class AdminCampaignModerationController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('moderation')
  @ApiOperation({ summary: 'List sponsored campaigns awaiting admin review.' })
  list(@Query() query: ListCampaignModerationQueryDto) {
    return this.campaignsService.listForModeration(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one sponsored campaign moderation record.' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.campaignsService.findOneForAdmin(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CampaignModerationOptionalReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.campaignsService.moderateCampaign(
      id,
      'approved',
      dto.reason,
      admin.userId,
    );
  }

  @Post(':id/reject')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CampaignModerationReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.campaignsService.moderateCampaign(
      id,
      'rejected',
      dto.reason,
      admin.userId,
    );
  }

  @Post(':id/request-changes')
  requestChanges(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CampaignModerationReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.campaignsService.moderateCampaign(
      id,
      'changes_requested',
      dto.reason,
      admin.userId,
    );
  }

  @Post(':id/suspend')
  suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CampaignModerationReasonDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.campaignsService.moderateCampaign(
      id,
      'suspended',
      dto.reason,
      admin.userId,
    );
  }
}
