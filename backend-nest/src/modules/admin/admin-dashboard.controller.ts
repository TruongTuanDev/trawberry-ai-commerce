import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';

@ApiTags('admin dashboard')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get marketplace operations dashboard summary.' })
  getSummary(@Query() query: AdminDashboardQueryDto) {
    return this.dashboardService.getSummary(query);
  }
}
