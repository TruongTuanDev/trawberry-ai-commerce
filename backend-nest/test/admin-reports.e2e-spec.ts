import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AdminReportsController } from '../src/modules/admin/admin-reports.controller';
import { AdminReportsService } from '../src/modules/admin/admin-reports.service';
import { AdminJwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { readBody } from './test-helpers';

describe('AdminReportsController (e2e)', () => {
  let app: INestApplication<App>;

  const reportService = {
    opsSummary: jest.fn(),
    slaBreaches: jest.fn(),
    workload: jest.fn(),
    deliveryExceptions: jest.fn(),
    paymentAging: jest.fn(),
    toCsv: jest.fn(
      (rows: Array<Record<string, unknown>>, columns: string[]) => {
        const escape = (value: unknown) => {
          const text =
            value === null || value === undefined
              ? ''
              : typeof value === 'string' ||
                  typeof value === 'number' ||
                  typeof value === 'boolean'
                ? String(value)
                : JSON.stringify(value);
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        };
        return `\uFEFF${[
          columns.join(','),
          ...rows.map((row) =>
            columns.map((column) => escape(row[column])).join(','),
          ),
        ].join('\r\n')}\r\n`;
      },
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    reportService.opsSummary.mockResolvedValue({
      totalTasks: 3,
      openTasks: 1,
      inProgressTasks: 1,
      escalatedTasks: 1,
      resolvedTasks: 1,
      breachedTasks: 1,
      averageResolutionHours: 2.5,
      pendingPayments: 1,
      paidWithoutDelivery: 1,
      deliveryExceptions: 1,
      lowStockProducts: 1,
      outOfStockProducts: 1,
    });
    reportService.slaBreaches.mockResolvedValue({
      items: [
        {
          id: 'task-1',
          entityType: 'DELIVERY',
          title: 'Breached task',
          status: 'ESCALATED',
          priority: 'URGENT',
          slaStatus: 'BREACHED',
          assignedToEmail: 'admin@example.com',
          ageHours: 30,
        },
      ],
      total: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      filters: {},
    });
    reportService.workload.mockResolvedValue({
      items: [
        {
          adminUserId: 'admin-1',
          adminEmail: 'admin@example.com',
          assignedTasks: 2,
          openTasks: 0,
          inProgressTasks: 1,
          escalatedTasks: 1,
          resolvedTasks: 1,
          averageResolutionHours: 1.5,
        },
      ],
    });
    reportService.deliveryExceptions.mockResolvedValue({
      items: [
        {
          id: 'shipment-1',
          orderNumber: 'ORD-1',
          status: 'FAILED',
          reasonCode: 'CUSTOMER_UNAVAILABLE',
          reasonText: 'Value with, comma and "quote"',
          ageHours: 5,
        },
      ],
      total: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      filters: {},
    });
    reportService.paymentAging.mockResolvedValue({
      items: [
        {
          id: 'order-1',
          orderNumber: 'ORD-2',
          paymentStatus: 'PENDING',
          ageHours: 6,
          ageBucket: '4-24h',
        },
      ],
      total: 1,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      filters: {},
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [{ provide: AdminReportsService, useValue: reportService }],
    })
      .overrideGuard(AdminJwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              user?: { userId: string; email: string; role: string };
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            userId: 'admin-1',
            email: 'admin@example.com',
            role: req.headers['x-test-role'] ?? 'ADMIN',
          };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns admin ops summary and blocks non-admin users', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/reports/ops-summary')
      .expect(200);
    expect(readBody<{ breachedTasks: number }>(response).breachedTasks).toBe(1);
    await request(app.getHttpServer())
      .get('/api/admin/reports/ops-summary')
      .set('x-test-role', 'SELLER')
      .expect(403);
  });

  it('returns SLA breaches, workload, delivery exceptions, and payment aging', async () => {
    const sla = await request(app.getHttpServer())
      .get('/api/admin/reports/sla-breaches')
      .expect(200);
    expect(
      readBody<{ items: Array<{ slaStatus: string }> }>(sla).items[0].slaStatus,
    ).toBe('BREACHED');

    const workload = await request(app.getHttpServer())
      .get('/api/admin/reports/workload')
      .expect(200);
    expect(
      readBody<{ items: Array<{ adminEmail: string }> }>(workload).items[0]
        .adminEmail,
    ).toBe('admin@example.com');

    const delivery = await request(app.getHttpServer())
      .get('/api/admin/reports/delivery-exceptions')
      .expect(200);
    expect(
      readBody<{ items: Array<{ status: string }> }>(delivery).items[0].status,
    ).toBe('FAILED');

    const payments = await request(app.getHttpServer())
      .get('/api/admin/reports/payment-aging')
      .expect(200);
    expect(
      readBody<{ items: Array<{ ageBucket: string }> }>(payments).items[0]
        .ageBucket,
    ).toBe('4-24h');
  });

  it('exports valid escaped CSV', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/reports/delivery-exceptions.csv')
      .expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('orderNumber');
    expect(response.text).toContain('"Value with, comma and ""quote"""');
  });
});
