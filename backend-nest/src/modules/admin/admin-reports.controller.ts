import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AdminOnlyGuard } from '../../common/guards/admin-only.guard';
import { AdminJwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminReportsService } from './admin-reports.service';
import {
  AdminDeliveryExceptionsReportQueryDto,
  AdminOpsSummaryReportQueryDto,
  AdminPaymentAgingReportQueryDto,
  AdminSlaBreachesReportQueryDto,
  AdminWorkloadReportQueryDto,
} from './dto/admin-reports-query.dto';

@UseGuards(AdminJwtAuthGuard, AdminOnlyGuard)
@Controller('api/admin/reports')
export class AdminReportsController {
  constructor(private readonly reportsService: AdminReportsService) {}

  @Get('ops-summary')
  opsSummary(@Query() query: AdminOpsSummaryReportQueryDto) {
    return this.reportsService.opsSummary(query);
  }

  @Get('sla-breaches')
  slaBreaches(@Query() query: AdminSlaBreachesReportQueryDto) {
    return this.reportsService.slaBreaches(query);
  }

  @Get('workload')
  workload(@Query() query: AdminWorkloadReportQueryDto) {
    return this.reportsService.workload(query);
  }

  @Get('delivery-exceptions')
  deliveryExceptions(@Query() query: AdminDeliveryExceptionsReportQueryDto) {
    return this.reportsService.deliveryExceptions(query);
  }

  @Get('payment-aging')
  paymentAging(@Query() query: AdminPaymentAgingReportQueryDto) {
    return this.reportsService.paymentAging(query);
  }

  @Get('sla-breaches.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sla-breaches.csv"')
  async slaBreachesCsv(@Query() query: AdminSlaBreachesReportQueryDto) {
    const report = await this.reportsService.slaBreaches(query, true);
    return this.reportsService.toCsv(
      report.items.map((item) => ({ ...item })),
      [
        'id',
        'entityType',
        'entityId',
        'title',
        'status',
        'priority',
        'slaStatus',
        'assignedToEmail',
        'ageHours',
        'createdAt',
        'updatedAt',
      ],
    );
  }

  @Get('workload.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="workload.csv"')
  async workloadCsv(@Query() query: AdminWorkloadReportQueryDto) {
    const report = await this.reportsService.workload(query);
    return this.reportsService.toCsv(
      report.items.map((item) => ({ ...item })),
      [
        'adminUserId',
        'adminEmail',
        'adminName',
        'assignedTasks',
        'openTasks',
        'inProgressTasks',
        'escalatedTasks',
        'resolvedTasks',
        'averageResolutionHours',
      ],
    );
  }

  @Get('delivery-exceptions.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="delivery-exceptions.csv"',
  )
  async deliveryExceptionsCsv(
    @Query() query: AdminDeliveryExceptionsReportQueryDto,
  ) {
    const report = await this.reportsService.deliveryExceptions(query, true);
    return this.reportsService.toCsv(
      report.items.map((item) => ({ ...item })),
      [
        'id',
        'orderNumber',
        'customerName',
        'shopName',
        'sellerEmail',
        'provider',
        'status',
        'reasonCode',
        'reasonText',
        'customerVisibleMessage',
        'ageHours',
        'updatedAt',
      ],
    );
  }

  @Get('payment-aging.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payment-aging.csv"')
  async paymentAgingCsv(@Query() query: AdminPaymentAgingReportQueryDto) {
    const report = await this.reportsService.paymentAging(query, true);
    return this.reportsService.toCsv(
      report.items.map((item) => ({ ...item })),
      [
        'id',
        'orderNumber',
        'customerName',
        'shopName',
        'sellerEmail',
        'totalAmount',
        'ageHours',
        'ageBucket',
        'createdAt',
        'updatedAt',
      ],
    );
  }
}
