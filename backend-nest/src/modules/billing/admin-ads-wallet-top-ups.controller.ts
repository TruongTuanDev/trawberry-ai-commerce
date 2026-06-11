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
import { AdsWalletTopUpsService } from './ads-wallet-top-ups.service';
import {
  ConfirmAdsWalletTopUpDto,
  ListAdsWalletTopUpsQueryDto,
  RejectAdsWalletTopUpDto,
} from './dto/ads-wallet-top-up.dto';

@ApiTags('admin-ads-wallet-top-ups')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/ads-wallet/top-ups')
export class AdminAdsWalletTopUpsController {
  constructor(private readonly topUpsService: AdsWalletTopUpsService) {}

  @Get()
  @ApiOperation({ summary: 'List manual ads wallet top-up requests.' })
  list(@Query() query: ListAdsWalletTopUpsQueryDto) {
    return this.topUpsService.listForAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one manual ads wallet top-up request.' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.topUpsService.getForAdmin(id);
  }

  @Post(':id/confirm')
  @ApiOperation({
    summary: 'Confirm a top-up and credit the ads wallet exactly once.',
  })
  confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ConfirmAdsWalletTopUpDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.topUpsService.confirmForAdmin(id, admin.userId, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending manual ads wallet top-up.' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectAdsWalletTopUpDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.topUpsService.rejectForAdmin(id, admin.userId, dto);
  }
}
