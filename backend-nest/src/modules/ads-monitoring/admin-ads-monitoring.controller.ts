import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdsMonitoringService } from './ads-monitoring.service';
import { AdsMonitoringQueryDto } from './dto/ads-monitoring-query.dto';

@ApiTags('admin-ads-monitoring')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/ads/monitoring')
export class AdminAdsMonitoringController {
  constructor(private readonly adsMonitoringService: AdsMonitoringService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregated Ads runtime health metrics.' })
  getSummary(@Query() query: AdsMonitoringQueryDto) {
    return this.adsMonitoringService.getSummary(query.window);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Get read-only Ads runtime anomaly signals.' })
  getAnomalies(@Query() query: AdsMonitoringQueryDto) {
    return this.adsMonitoringService.getAnomalies(query.window);
  }

  @Get('runtime-config')
  @ApiOperation({ summary: 'Get safe Ads runtime feature flag visibility.' })
  getRuntimeConfig() {
    return this.adsMonitoringService.getRuntimeConfig();
  }
}
