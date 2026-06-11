/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AdsMonitoringService } from '../src/modules/ads-monitoring/ads-monitoring.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

describe('AdsMonitoringService', () => {
  const now = new Date();
  const prismaMock = {
    sellerWallet: { findMany: jest.fn() },
    billingLedgerEntry: { groupBy: jest.fn(), findMany: jest.fn() },
    adsWalletTopUpRequest: { findMany: jest.fn() },
    sponsoredCampaign: { findMany: jest.fn() },
    recommendationEvent: { findMany: jest.fn() },
  };
  const configServiceMock = { get: jest.fn() };
  let service: AdsMonitoringService;

  beforeEach(() => {
    prismaMock.sellerWallet.findMany.mockResolvedValue([
      {
        id: 'wallet-negative',
        shopId: 'shop-negative',
        balance: new Prisma.Decimal('-1'),
        reservedBalance: new Prisma.Decimal('0'),
        currency: 'RUB',
        status: 'active',
      },
      {
        id: 'wallet-ok',
        shopId: 'shop-ok',
        balance: new Prisma.Decimal('90'),
        reservedBalance: new Prisma.Decimal('0'),
        currency: 'RUB',
        status: 'active',
      },
    ]);
    prismaMock.billingLedgerEntry.groupBy
      .mockResolvedValueOnce([
        {
          walletId: 'wallet-ok',
          type: 'credit',
          _sum: { amount: new Prisma.Decimal('100') },
        },
        {
          walletId: 'wallet-ok',
          type: 'debit',
          _sum: { amount: new Prisma.Decimal('10') },
        },
      ])
      .mockResolvedValueOnce([
        {
          referenceType: 'recommendation_click',
          referenceId: 'event-duplicate',
          _count: { id: 2 },
        },
        {
          referenceType: 'manual_top_up',
          referenceId: 'top-up-duplicate',
          _count: { id: 2 },
        },
      ]);
    prismaMock.billingLedgerEntry.findMany.mockResolvedValue([
      ledger({
        id: 'debit-without-campaign',
        walletId: 'wallet-ok',
        shopId: 'shop-ok',
        type: 'debit',
        amount: '1',
        campaignId: null,
        referenceType: 'recommendation_click',
        referenceId: 'event-no-campaign',
      }),
      ledger({
        id: 'orphan-top-up-credit',
        walletId: 'wallet-ok',
        shopId: 'shop-ok',
        type: 'credit',
        amount: '20',
        campaignId: null,
        referenceType: 'manual_top_up',
        referenceId: 'top-up-orphan',
      }),
      ledger({
        id: 'campaign-spend',
        walletId: 'wallet-ok',
        shopId: 'shop-ok',
        type: 'debit',
        amount: '6000',
        campaignId: 'campaign-1',
        referenceType: 'recommendation_click',
        referenceId: 'event-spend',
      }),
    ]);
    prismaMock.adsWalletTopUpRequest.findMany.mockResolvedValue([
      {
        id: 'top-up-missing-ledger',
        shopId: 'shop-ok',
        amount: new Prisma.Decimal('100'),
        status: 'confirmed',
        confirmedLedgerId: null,
        confirmedLedger: null,
        createdAt: now,
        confirmedAt: now,
        rejectedAt: null,
      },
      {
        id: 'top-up-pending',
        shopId: 'shop-ok',
        amount: new Prisma.Decimal('50'),
        status: 'pending',
        confirmedLedgerId: null,
        confirmedLedger: null,
        createdAt: now,
        confirmedAt: null,
        rejectedAt: null,
      },
    ]);
    prismaMock.sponsoredCampaign.findMany.mockResolvedValue([
      {
        id: 'campaign-1',
        shopId: 'shop-ok',
        name: 'Spend watch',
        status: 'active',
        moderationStatus: 'approved',
        budgetLimit: new Prisma.Decimal('10000'),
      },
    ]);
    prismaMock.recommendationEvent.findMany.mockResolvedValue([
      click({
        id: 'event-valid',
        charged: true,
        chargeStatus: 'charged',
        validityStatus: 'valid',
        ledgerEntryId: 'ledger-valid',
      }),
      click({
        id: 'event-invalid-ledger',
        charged: false,
        chargeStatus: 'invalid_token',
        validityStatus: 'invalid',
        invalidReason: 'invalid_token',
        ledgerEntryId: 'ledger-invalid',
      }),
      click({
        id: 'event-invalid-2',
        chargeStatus: 'invalid_token',
        validityStatus: 'invalid',
        invalidReason: 'invalid_token',
      }),
      click({
        id: 'event-invalid-3',
        chargeStatus: 'duplicate_token',
        validityStatus: 'invalid',
        invalidReason: 'duplicate_token',
      }),
      click({
        id: 'event-insufficient-charged',
        charged: true,
        chargeStatus: 'insufficient_wallet',
        validityStatus: 'ineligible',
        ledgerEntryId: 'ledger-insufficient',
      }),
      click({
        id: 'event-charged-no-ledger',
        charged: true,
        chargeStatus: 'charged',
        validityStatus: 'valid',
      }),
    ]);
    configServiceMock.get.mockImplementation((name: string) => {
      const flags: Record<string, string> = {
        NODE_ENV: 'production',
        ADS_MONITORING_ENABLED: 'true',
        RECOMMENDATION_SPONSORED_RANKING_ENABLED: 'true',
        RECOMMENDATION_SPONSORED_PRESET_ID: 'balanced',
        RECOMMENDATION_SPONSORED_ROLLOUT_MODE: 'internal',
        ADS_CAMPAIGN_MODERATION_ENABLED: 'true',
        ADS_MODERATION_REQUIRED_FOR_SERVING: 'false',
        ADS_INVALID_CLICK_PROTECTION_ENABLED: 'true',
        ADS_SELF_CLICK_BLOCK_ENABLED: 'true',
        ADS_MANUAL_TOP_UP_ENABLED: 'true',
        ADS_DEMO_FUNDING_ENABLED: 'true',
        ADS_INVALID_CLICK_RATE_ALERT_THRESHOLD: '0.30',
        ADS_SPEND_SPIKE_ALERT_THRESHOLD_MINOR: '5000',
        ADS_SPEND_SPIKE_ALERT_THRESHOLD_MAJOR: '20000',
      };
      return flags[name];
    });
    service = new AdsMonitoringService(
      prismaMock as never,
      configServiceMock as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates wallet, top-up, campaign, ledger, and click metrics', async () => {
    const summary = await service.getSummary('24h');

    expect(summary.wallet).toEqual(
      expect.objectContaining({
        walletCount: 2,
        negativeWalletCount: 1,
        ledgerMismatchCount: 1,
      }),
    );
    expect(summary.topUps).toEqual(
      expect.objectContaining({
        pendingCount: 1,
        confirmedCount: 1,
        confirmedWithoutLedgerCount: 1,
      }),
    );
    expect(summary.campaigns).toEqual(
      expect.objectContaining({
        activeCount: 1,
        approvedCount: 1,
        spendingAboveMinorThresholdCount: 1,
      }),
    );
    expect(summary.clicks).toEqual(
      expect.objectContaining({
        totalSponsoredClicks: 6,
        invalidClicks: 3,
        chargedClicks: 3,
      }),
    );
    expect(summary.ledger).toEqual(
      expect.objectContaining({
        debitWithoutCampaignCount: 1,
        orphanManualTopUpCreditCount: 1,
        duplicateReferenceCount: 2,
      }),
    );
  });

  it('shares a short-lived snapshot across parallel summary and anomaly reads', async () => {
    await Promise.all([service.getSummary('24h'), service.getAnomalies('24h')]);

    expect(prismaMock.sellerWallet.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.billingLedgerEntry.groupBy).toHaveBeenCalledTimes(2);
    expect(prismaMock.recommendationEvent.findMany).toHaveBeenCalledTimes(1);
  });

  it('detects critical financial anomalies and unsafe runtime configuration', async () => {
    const response = await service.getAnomalies('24h');
    const types = response.items.map((item) => item.type);

    expect(types).toEqual(
      expect.arrayContaining([
        'wallet_negative',
        'wallet_ledger_mismatch',
        'invalid_click_with_ledger',
        'charged_click_without_ledger',
        'insufficient_wallet_click_charged',
        'duplicate_ledger_reference',
        'confirmed_top_up_without_ledger',
        'debit_without_campaign',
        'credit_without_confirmed_top_up',
        'invalid_click_rate_high',
        'campaign_spend_spike_minor',
        'sponsored_without_required_moderation',
        'demo_funding_enabled_non_dev',
      ]),
    );
  });

  it('returns only safe runtime config and aggregated fraud metadata', async () => {
    const runtime = service.getRuntimeConfig();
    const anomalies = await service.getAnomalies('24h');
    const serialized = JSON.stringify({ runtime, anomalies });

    expect(runtime.privacy).toEqual({
      aggregatedOnly: true,
      rawTokensExposed: false,
      rawIpExposed: false,
      rawUserAgentExposed: false,
      secretsExposed: false,
    });
    expect(serialized).not.toContain('ADS_CLICK_HASH_SALT');
    expect(serialized).not.toContain('RECOMMENDATION_TRACKING_TOKEN_SECRET');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('ipHash');
    expect(serialized).not.toContain('userAgentHash');
  });
});

describe('AdminAdsMonitoringController access', () => {
  let app: INestApplication<App>;
  const users = [
    user('admin@example.com', 'ADMIN'),
    user('seller@example.com', 'SELLER'),
    user('customer@example.com', 'CUSTOMER'),
  ];
  const prismaMock = {
    user: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(
          users.find((item) =>
            where.email ? item.email === where.email : item.id === where.id,
          ) ?? null,
        ),
      ),
    },
  };
  const monitoringMock = {
    getSummary: jest.fn(() => ({ health: { status: 'healthy' } })),
    getAnomalies: jest.fn(() => ({ items: [] })),
    getRuntimeConfig: jest.fn(() => ({
      monitoringEnabled: true,
      privacy: { secretsExposed: false },
    })),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(AdsMonitoringService)
      .useValue(monitoringMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('allows admin to read all monitoring endpoints', async () => {
    const token = await login(app, 'admin@example.com');

    await request(app.getHttpServer())
      .get('/api/admin/ads/monitoring/summary?window=1h')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/admin/ads/monitoring/anomalies?window=7d')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const runtime = await request(app.getHttpServer())
      .get('/api/admin/ads/monitoring/runtime-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const serialized = JSON.stringify(runtime.body);
    expect(serialized).not.toContain('ADS_CLICK_HASH_SALT');
    expect(serialized).not.toContain('RECOMMENDATION_TRACKING_TOKEN_SECRET');
  }, 15_000);

  it.each(['seller@example.com', 'customer@example.com'])(
    'blocks non-admin account %s from monitoring',
    async (email) => {
      const token = await login(app, email);
      await request(app.getHttpServer())
        .get('/api/admin/ads/monitoring/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    },
    15_000,
  );
});

function ledger(input: {
  id: string;
  walletId: string;
  shopId: string;
  type: string;
  amount: string;
  campaignId: string | null;
  referenceType: string;
  referenceId: string;
}) {
  return {
    ...input,
    amount: new Prisma.Decimal(input.amount),
    createdAt: new Date(),
  };
}

function click(input: {
  id: string;
  charged?: boolean;
  chargeStatus: string;
  validityStatus: string;
  invalidReason?: string | null;
  ledgerEntryId?: string | null;
}) {
  return {
    shopId: 'shop-ok',
    campaignId: 'campaign-1',
    charged: false,
    invalidReason: null,
    ledgerEntryId: null,
    cost: new Prisma.Decimal('1'),
    createdAt: new Date(),
    ...input,
  };
}

function user(email: string, role: string) {
  return {
    id: `${role.toLowerCase()}-1`,
    email,
    passwordHash: bcrypt.hashSync('password123', 10),
    role,
    status: 'ACTIVE',
    fullName: role,
    phone: null,
    createdAt: new Date(),
  };
}

async function login(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);
  return readBody<AuthResponseDto>(response).accessToken;
}
