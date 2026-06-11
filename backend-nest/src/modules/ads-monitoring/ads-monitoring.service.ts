import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ADS_DEMO_FUNDING_ENABLED_FLAG } from '../billing/ads-wallet-top-ups.constants';
import {
  ADS_CAMPAIGN_MODERATION_ENABLED_FLAG,
  ADS_MODERATION_REQUIRED_FOR_SERVING_FLAG,
} from '../campaigns/campaigns.constants';
import {
  ADS_INVALID_CLICK_RATE_ALERT_THRESHOLD_FLAG,
  ADS_MONITORING_DEFAULTS,
  ADS_MONITORING_ENABLED_FLAG,
  ADS_SPEND_SPIKE_ALERT_THRESHOLD_MAJOR_FLAG,
  ADS_SPEND_SPIKE_ALERT_THRESHOLD_MINOR_FLAG,
  type AdsMonitoringWindow,
} from './ads-monitoring.constants';

type Severity = 'critical' | 'high' | 'medium';

type Anomaly = {
  id: string;
  severity: Severity;
  type: string;
  description: string;
  suggestedAction: string;
  detectedAt: string;
  related: {
    walletId?: string;
    shopId?: string;
    campaignId?: string;
    campaignName?: string;
    topUpId?: string;
    referenceId?: string;
  } | null;
};

type MonitoringSnapshot = Awaited<
  ReturnType<AdsMonitoringService['loadSnapshot']>
>;

const INVALID_CLICK_PROTECTION_FLAG = 'ADS_INVALID_CLICK_PROTECTION_ENABLED';
const SELF_CLICK_BLOCK_FLAG = 'ADS_SELF_CLICK_BLOCK_ENABLED';
const MANUAL_TOP_UP_FLAG = 'ADS_MANUAL_TOP_UP_ENABLED';
const SPONSORED_RANKING_FLAG = 'RECOMMENDATION_SPONSORED_RANKING_ENABLED';
const SPONSORED_PRESET_FLAG = 'RECOMMENDATION_SPONSORED_PRESET_ID';
const SPONSORED_ROLLOUT_FLAG = 'RECOMMENDATION_SPONSORED_ROLLOUT_MODE';
const SPONSORED_CPC_AMOUNT_FLAG = 'RECOMMENDATION_SPONSORED_CPC_AMOUNT';
const MANUAL_TOP_UP_REFERENCE_TYPE = 'manual_top_up';
const RECOMMENDATION_CLICK_REFERENCE_TYPE = 'recommendation_click';
const SNAPSHOT_CACHE_MS = 5_000;

@Injectable()
export class AdsMonitoringService {
  private readonly logger = new Logger(AdsMonitoringService.name);
  private readonly snapshotCache = new Map<
    AdsMonitoringWindow,
    { expiresAt: number; promise: Promise<MonitoringSnapshot> }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSummary(window: AdsMonitoringWindow = '24h') {
    this.assertEnabled();
    const snapshot = await this.getSnapshot(window);
    const anomalies = this.buildAnomalies(snapshot);
    const severityCounts = this.countBy(anomalies.map((item) => item.severity));

    return {
      window,
      since: snapshot.since.toISOString(),
      generatedAt: snapshot.generatedAt,
      health: {
        status:
          (severityCounts.critical ?? 0) > 0
            ? 'critical'
            : (severityCounts.high ?? 0) > 0
              ? 'attention'
              : 'healthy',
        anomalyCount: anomalies.length,
        criticalCount: severityCounts.critical ?? 0,
        highCount: severityCounts.high ?? 0,
        mediumCount: severityCounts.medium ?? 0,
      },
      wallet: snapshot.walletSummary,
      ledger: snapshot.ledgerSummary,
      topUps: snapshot.topUpSummary,
      campaigns: snapshot.campaignSummary,
      clicks: snapshot.clickSummary,
    };
  }

  async getAnomalies(window: AdsMonitoringWindow = '24h') {
    this.assertEnabled();
    const snapshot = await this.getSnapshot(window);
    const items = this.buildAnomalies(snapshot);
    const severityCounts = this.countBy(items.map((item) => item.severity));

    if ((severityCounts.critical ?? 0) + (severityCounts.high ?? 0) > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'ads_monitoring_anomalies_detected',
          window,
          total: items.length,
          critical: severityCounts.critical ?? 0,
          high: severityCounts.high ?? 0,
        }),
      );
    }

    return {
      window,
      since: snapshot.since.toISOString(),
      generatedAt: snapshot.generatedAt,
      thresholds: snapshot.runtimeConfig.thresholds,
      items,
    };
  }

  getRuntimeConfig() {
    this.assertEnabled();
    return this.buildRuntimeConfig();
  }

  private getSnapshot(window: AdsMonitoringWindow) {
    const now = Date.now();
    const cached = this.snapshotCache.get(window);
    if (cached && cached.expiresAt > now) return cached.promise;

    const promise = this.loadSnapshot(window);
    this.snapshotCache.set(window, {
      expiresAt: now + SNAPSHOT_CACHE_MS,
      promise,
    });
    void promise.catch(() => {
      if (this.snapshotCache.get(window)?.promise === promise) {
        this.snapshotCache.delete(window);
      }
    });
    return promise;
  }

  private async loadSnapshot(window: AdsMonitoringWindow) {
    const since = this.resolveSince(window);
    const generatedAt = new Date().toISOString();
    const runtimeConfig = this.buildRuntimeConfig();
    const [
      wallets,
      ledgerGroups,
      recentLedger,
      duplicateReferenceGroups,
      topUps,
      campaigns,
      clickEvents,
    ] = await Promise.all([
      this.prisma.sellerWallet.findMany({
        select: {
          id: true,
          shopId: true,
          balance: true,
          reservedBalance: true,
          currency: true,
          status: true,
        },
      }),
      this.prisma.billingLedgerEntry.groupBy({
        by: ['walletId', 'type'],
        _sum: { amount: true },
      }),
      this.prisma.billingLedgerEntry.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          walletId: true,
          shopId: true,
          campaignId: true,
          type: true,
          amount: true,
          referenceType: true,
          referenceId: true,
          createdAt: true,
        },
      }),
      this.prisma.billingLedgerEntry.groupBy({
        by: ['referenceType', 'referenceId'],
        where: {
          referenceType: {
            in: [
              MANUAL_TOP_UP_REFERENCE_TYPE,
              RECOMMENDATION_CLICK_REFERENCE_TYPE,
            ],
          },
          referenceId: { not: null },
        },
        _count: { id: true },
      }),
      this.prisma.adsWalletTopUpRequest.findMany({
        select: {
          id: true,
          shopId: true,
          amount: true,
          status: true,
          confirmedLedgerId: true,
          confirmedLedger: { select: { id: true } },
          createdAt: true,
          confirmedAt: true,
          rejectedAt: true,
        },
      }),
      this.prisma.sponsoredCampaign.findMany({
        select: {
          id: true,
          shopId: true,
          name: true,
          status: true,
          moderationStatus: true,
          budgetLimit: true,
        },
      }),
      this.prisma.recommendationEvent.findMany({
        where: {
          createdAt: { gte: since },
          type: 'click',
          sponsored: true,
        },
        select: {
          id: true,
          shopId: true,
          campaignId: true,
          charged: true,
          chargeStatus: true,
          validityStatus: true,
          invalidReason: true,
          ledgerEntryId: true,
          cost: true,
          createdAt: true,
        },
      }),
    ]);

    const ledgerExpectedByWallet = new Map<
      string,
      { balance: Prisma.Decimal; reserved: Prisma.Decimal }
    >();
    for (const group of ledgerGroups) {
      const current = ledgerExpectedByWallet.get(group.walletId) ?? {
        balance: new Prisma.Decimal(0),
        reserved: new Prisma.Decimal(0),
      };
      const amount = group._sum.amount ?? new Prisma.Decimal(0);
      if (['credit', 'refund', 'adjustment'].includes(group.type)) {
        current.balance = current.balance.plus(amount);
      } else if (group.type === 'debit') {
        current.balance = current.balance.minus(amount);
      } else if (group.type === 'reserve') {
        current.reserved = current.reserved.plus(amount);
      } else if (group.type === 'release') {
        current.reserved = current.reserved.minus(amount);
      }
      ledgerExpectedByWallet.set(group.walletId, current);
    }

    const walletMismatches = wallets.filter((wallet) => {
      const expected = ledgerExpectedByWallet.get(wallet.id) ?? {
        balance: new Prisma.Decimal(0),
        reserved: new Prisma.Decimal(0),
      };
      return (
        !wallet.balance.equals(expected.balance) ||
        !wallet.reservedBalance.equals(expected.reserved)
      );
    });
    const negativeWallets = wallets.filter(
      (wallet) =>
        wallet.balance.lt(0) ||
        wallet.reservedBalance.lt(0) ||
        wallet.balance.minus(wallet.reservedBalance).lt(0),
    );
    const totalBalance = this.sumDecimals(wallets.map((item) => item.balance));
    const totalReserved = this.sumDecimals(
      wallets.map((item) => item.reservedBalance),
    );

    const recentCredits = recentLedger.filter((item) =>
      ['credit', 'refund', 'adjustment'].includes(item.type),
    );
    const recentDebits = recentLedger.filter((item) => item.type === 'debit');
    const duplicateReferences = duplicateReferenceGroups.filter(
      (item) => item._count.id > 1,
    );
    const debitWithoutCampaign = recentDebits.filter(
      (item) => !item.campaignId,
    );
    const confirmedTopUpIds = new Set(
      topUps
        .filter((item) => item.status === 'confirmed')
        .map((item) => item.id),
    );
    const orphanManualTopUpCredits = recentCredits.filter(
      (item) =>
        item.referenceType === MANUAL_TOP_UP_REFERENCE_TYPE &&
        (!item.referenceId || !confirmedTopUpIds.has(item.referenceId)),
    );

    const windowTopUps = topUps.filter(
      (item) =>
        item.createdAt >= since ||
        (item.confirmedAt !== null && item.confirmedAt >= since) ||
        (item.rejectedAt !== null && item.rejectedAt >= since),
    );
    const pendingTopUps = topUps.filter((item) => item.status === 'pending');
    const confirmedTopUps = windowTopUps.filter(
      (item) =>
        item.status === 'confirmed' &&
        item.confirmedAt !== null &&
        item.confirmedAt >= since,
    );
    const rejectedTopUps = windowTopUps.filter(
      (item) =>
        item.status === 'rejected' &&
        item.rejectedAt !== null &&
        item.rejectedAt >= since,
    );
    const confirmedTopUpsWithoutLedger = topUps.filter(
      (item) =>
        item.status === 'confirmed' &&
        (!item.confirmedLedgerId || !item.confirmedLedger),
    );

    const campaignSpend = new Map<string, Prisma.Decimal>();
    for (const entry of recentDebits) {
      if (!entry.campaignId) continue;
      campaignSpend.set(
        entry.campaignId,
        (campaignSpend.get(entry.campaignId) ?? new Prisma.Decimal(0)).plus(
          entry.amount,
        ),
      );
    }
    const spendingCampaigns = campaigns
      .map((campaign) => ({
        ...campaign,
        spend: campaignSpend.get(campaign.id) ?? new Prisma.Decimal(0),
      }))
      .filter((campaign) => campaign.spend.gt(0));
    const budgetExhaustedCampaignIds = new Set(
      clickEvents
        .filter((item) => item.chargeStatus === 'budget_exhausted')
        .flatMap((item) => (item.campaignId ? [item.campaignId] : [])),
    );
    const walletInsufficientCampaignIds = new Set(
      clickEvents
        .filter((item) => item.chargeStatus === 'insufficient_wallet')
        .flatMap((item) => (item.campaignId ? [item.campaignId] : [])),
    );

    const chargedClicks = clickEvents.filter((item) => item.charged);
    const invalidClicks = clickEvents.filter(
      (item) => item.validityStatus === 'invalid',
    );
    const invalidReasons = this.countBy(
      invalidClicks.map((item) => item.invalidReason ?? 'unknown'),
    );
    const chargeFailureStatuses = this.countBy(
      clickEvents
        .filter(
          (item) =>
            !item.charged &&
            !['not_billable', 'tracked_only', 'pending_charge'].includes(
              item.chargeStatus,
            ),
        )
        .map((item) => item.chargeStatus),
    );
    const invalidClicksWithLedger = invalidClicks.filter(
      (item) => item.ledgerEntryId,
    );
    const chargedClicksWithoutLedger = chargedClicks.filter(
      (item) => !item.ledgerEntryId,
    );
    const insufficientWalletCharged = clickEvents.filter(
      (item) =>
        item.chargeStatus === 'insufficient_wallet' &&
        (item.charged || item.ledgerEntryId),
    );

    return {
      window,
      since,
      generatedAt,
      runtimeConfig,
      wallets,
      negativeWallets,
      walletMismatches,
      duplicateReferences,
      confirmedTopUpsWithoutLedger,
      invalidClicksWithLedger,
      chargedClicksWithoutLedger,
      insufficientWalletCharged,
      debitWithoutCampaign,
      orphanManualTopUpCredits,
      spendingCampaigns,
      walletSummary: {
        walletCount: wallets.length,
        totalBalance: totalBalance.toString(),
        totalReserved: totalReserved.toString(),
        totalAvailable: totalBalance.minus(totalReserved).toString(),
        negativeWalletCount: negativeWallets.length,
        ledgerMismatchCount: walletMismatches.length,
      },
      ledgerSummary: {
        creditsCount: recentCredits.length,
        creditsAmount: this.sumDecimals(
          recentCredits.map((item) => item.amount),
        ).toString(),
        debitsCount: recentDebits.length,
        debitsAmount: this.sumDecimals(
          recentDebits.map((item) => item.amount),
        ).toString(),
        failedChargeAttempts: Object.values(chargeFailureStatuses).reduce(
          (total, count) => total + count,
          0,
        ),
        debitWithoutCampaignCount: debitWithoutCampaign.length,
        orphanManualTopUpCreditCount: orphanManualTopUpCredits.length,
        duplicateReferenceCount: duplicateReferences.length,
      },
      topUpSummary: {
        pendingCount: pendingTopUps.length,
        pendingAmount: this.sumDecimals(
          pendingTopUps.map((item) => item.amount),
        ).toString(),
        confirmedCount: confirmedTopUps.length,
        confirmedAmount: this.sumDecimals(
          confirmedTopUps.map((item) => item.amount),
        ).toString(),
        rejectedCount: rejectedTopUps.length,
        confirmedWithoutLedgerCount: confirmedTopUpsWithoutLedger.length,
      },
      campaignSummary: {
        activeCount: campaigns.filter((item) => item.status === 'active')
          .length,
        approvedCount: campaigns.filter(
          (item) => item.moderationStatus === 'approved',
        ).length,
        pendingReviewCount: campaigns.filter(
          (item) => item.moderationStatus === 'pending_review',
        ).length,
        suspendedCount: campaigns.filter(
          (item) => item.moderationStatus === 'suspended',
        ).length,
        budgetExhaustedCount: budgetExhaustedCampaignIds.size,
        walletInsufficientCount: walletInsufficientCampaignIds.size,
        spendingAboveMinorThresholdCount: spendingCampaigns.filter((item) =>
          item.spend.gte(runtimeConfig.thresholds.spendSpikeMinor),
        ).length,
        spendAmount: this.sumDecimals(
          spendingCampaigns.map((item) => item.spend),
        ).toString(),
      },
      clickSummary: {
        totalSponsoredClicks: clickEvents.length,
        chargedClicks: chargedClicks.length,
        invalidClicks: invalidClicks.length,
        invalidClickRate:
          clickEvents.length > 0
            ? invalidClicks.length / clickEvents.length
            : 0,
        invalidReasons,
        chargeSuccessCount: chargedClicks.length,
        chargeFailureCount: Object.values(chargeFailureStatuses).reduce(
          (total, count) => total + count,
          0,
        ),
        chargeFailureStatuses,
      },
    };
  }

  private buildAnomalies(snapshot: MonitoringSnapshot): Anomaly[] {
    const items: Anomaly[] = [];
    const add = (
      severity: Severity,
      type: string,
      description: string,
      suggestedAction: string,
      related: Anomaly['related'] = null,
    ) => {
      items.push({
        id: `${type}:${related?.referenceId ?? related?.topUpId ?? related?.campaignId ?? related?.walletId ?? items.length}`,
        severity,
        type,
        description,
        suggestedAction,
        detectedAt: snapshot.generatedAt,
        related,
      });
    };

    for (const wallet of snapshot.negativeWallets) {
      add(
        'critical',
        'wallet_negative',
        `Wallet ${wallet.id} has a negative or over-reserved balance.`,
        'Freeze Ads charging for the shop and investigate ledger mutations.',
        { walletId: wallet.id, shopId: wallet.shopId },
      );
    }
    for (const wallet of snapshot.walletMismatches) {
      add(
        'critical',
        'wallet_ledger_mismatch',
        `Wallet ${wallet.id} does not match its ledger-derived balance.`,
        'Review the wallet ledger. Do not auto-correct financial records.',
        { walletId: wallet.id, shopId: wallet.shopId },
      );
    }
    for (const event of snapshot.invalidClicksWithLedger) {
      add(
        'critical',
        'invalid_click_with_ledger',
        'An invalid sponsored click is linked to a billing ledger entry.',
        'Review the click and ledger entry before any manual financial action.',
        {
          shopId: event.shopId ?? undefined,
          campaignId: event.campaignId ?? undefined,
          referenceId: event.id,
        },
      );
    }
    for (const event of snapshot.chargedClicksWithoutLedger) {
      add(
        'critical',
        'charged_click_without_ledger',
        'A charged sponsored click has no linked billing ledger entry.',
        'Investigate the click transaction and wallet history.',
        {
          shopId: event.shopId ?? undefined,
          campaignId: event.campaignId ?? undefined,
          referenceId: event.id,
        },
      );
    }
    for (const event of snapshot.insufficientWalletCharged) {
      add(
        'critical',
        'insufficient_wallet_click_charged',
        'An insufficient-wallet click is marked charged or linked to a ledger.',
        'Stop sponsored serving for the campaign and inspect the charge.',
        {
          shopId: event.shopId ?? undefined,
          campaignId: event.campaignId ?? undefined,
          referenceId: event.id,
        },
      );
    }
    for (const group of snapshot.duplicateReferences) {
      const referenceType = group.referenceType ?? 'unknown';
      const referenceId = group.referenceId ?? 'unknown';
      const isTopUp = referenceType === MANUAL_TOP_UP_REFERENCE_TYPE;
      add(
        'critical',
        isTopUp ? 'top_up_confirmed_twice' : 'duplicate_ledger_reference',
        `Ledger reference ${referenceType}/${referenceId} appears ${group._count.id} times.`,
        'Review duplicate entries and preserve evidence before manual action.',
        {
          topUpId: isTopUp ? referenceId : undefined,
          referenceId,
        },
      );
    }
    for (const topUp of snapshot.confirmedTopUpsWithoutLedger) {
      add(
        'critical',
        'confirmed_top_up_without_ledger',
        `Confirmed top-up ${topUp.id} has no linked ledger credit.`,
        'Review the confirmation transaction and do not confirm it again.',
        { topUpId: topUp.id, shopId: topUp.shopId },
      );
    }
    for (const entry of snapshot.debitWithoutCampaign) {
      add(
        'critical',
        'debit_without_campaign',
        `Ads ledger debit ${entry.id} is not linked to a campaign.`,
        'Review the ledger entry and associated recommendation event.',
        { shopId: entry.shopId, referenceId: entry.id },
      );
    }
    for (const entry of snapshot.orphanManualTopUpCredits) {
      add(
        'critical',
        'credit_without_confirmed_top_up',
        `Manual top-up credit ${entry.id} is not linked to a confirmed request.`,
        'Review the ledger reference and top-up audit trail.',
        {
          shopId: entry.shopId,
          topUpId: entry.referenceId ?? undefined,
          referenceId: entry.id,
        },
      );
    }

    const invalidClickRate = snapshot.clickSummary.invalidClickRate;
    if (
      snapshot.clickSummary.totalSponsoredClicks >=
        ADS_MONITORING_DEFAULTS.minimumClicksForRateAlert &&
      invalidClickRate >= snapshot.runtimeConfig.thresholds.invalidClickRate
    ) {
      add(
        'high',
        'invalid_click_rate_high',
        `Invalid sponsored click rate is ${(invalidClickRate * 100).toFixed(1)}%.`,
        'Review invalid-reason breakdown and campaign traffic sources.',
      );
    }
    for (const campaign of snapshot.spendingCampaigns) {
      if (
        campaign.spend.gte(snapshot.runtimeConfig.thresholds.spendSpikeMajor)
      ) {
        add(
          'critical',
          'campaign_spend_spike_major',
          `Campaign ${campaign.name} spent ${campaign.spend.toString()} in the selected window.`,
          'Pause and review the campaign if this spend is unexpected.',
          {
            campaignId: campaign.id,
            campaignName: campaign.name,
            shopId: campaign.shopId,
          },
        );
      } else if (
        campaign.spend.gte(snapshot.runtimeConfig.thresholds.spendSpikeMinor)
      ) {
        add(
          'high',
          'campaign_spend_spike_minor',
          `Campaign ${campaign.name} spent ${campaign.spend.toString()} in the selected window.`,
          'Review campaign performance and budget.',
          {
            campaignId: campaign.id,
            campaignName: campaign.name,
            shopId: campaign.shopId,
          },
        );
      }
    }
    if (
      snapshot.runtimeConfig.sponsoredRankingEnabled &&
      !snapshot.runtimeConfig.moderationRequiredForServing
    ) {
      add(
        'high',
        'sponsored_without_required_moderation',
        'Sponsored ranking is enabled while moderation is not required for serving.',
        'Enable ADS_MODERATION_REQUIRED_FOR_SERVING before public rollout.',
      );
    }
    if (
      snapshot.runtimeConfig.demoFundingEnabled &&
      !['development', 'test'].includes(snapshot.runtimeConfig.environment)
    ) {
      add(
        'high',
        'demo_funding_enabled_non_dev',
        `Demo funding is enabled in ${snapshot.runtimeConfig.environment}.`,
        'Disable ADS_DEMO_FUNDING_ENABLED outside development/test.',
      );
    }
    const invalidTokenCount =
      snapshot.clickSummary.invalidReasons.invalid_token ?? 0;
    if (
      invalidTokenCount >=
      ADS_MONITORING_DEFAULTS.invalidTokenCountAlertThreshold
    ) {
      add(
        invalidTokenCount >=
          ADS_MONITORING_DEFAULTS.invalidTokenCountAlertThreshold * 2
          ? 'high'
          : 'medium',
        'invalid_token_volume',
        `${invalidTokenCount} invalid sponsored tracking tokens were seen in the selected window.`,
        'Review traffic sources and tracking integration health.',
      );
    }

    const order: Record<Severity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
    };
    return items.sort(
      (left, right) => order[left.severity] - order[right.severity],
    );
  }

  private buildRuntimeConfig() {
    const environment =
      this.configService.get<string>('NODE_ENV')?.trim().toLowerCase() ||
      'development';
    return {
      monitoringEnabled: this.readFlag(ADS_MONITORING_ENABLED_FLAG, true),
      sponsoredRankingEnabled: this.readFlag(SPONSORED_RANKING_FLAG, false),
      sponsoredPreset:
        this.readOptionalString(SPONSORED_PRESET_FLAG) ?? 'balanced',
      sponsoredRollout:
        this.readOptionalString(SPONSORED_ROLLOUT_FLAG) ?? 'internal',
      campaignModerationEnabled: this.readFlag(
        ADS_CAMPAIGN_MODERATION_ENABLED_FLAG,
        true,
      ),
      moderationRequiredForServing: this.readFlag(
        ADS_MODERATION_REQUIRED_FOR_SERVING_FLAG,
        true,
      ),
      invalidClickProtectionEnabled: this.readFlag(
        INVALID_CLICK_PROTECTION_FLAG,
        true,
      ),
      selfClickBlockEnabled: this.readFlag(SELF_CLICK_BLOCK_FLAG, true),
      manualTopUpEnabled: this.readFlag(MANUAL_TOP_UP_FLAG, true),
      demoFundingEnabled: this.readFlag(ADS_DEMO_FUNDING_ENABLED_FLAG, false),
      environment,
      cpcAmount: this.readPositiveNumber(SPONSORED_CPC_AMOUNT_FLAG, 1),
      thresholds: {
        invalidClickRate: this.readRate(
          ADS_INVALID_CLICK_RATE_ALERT_THRESHOLD_FLAG,
          ADS_MONITORING_DEFAULTS.invalidClickRateAlertThreshold,
        ),
        spendSpikeMinor: this.readPositiveNumber(
          ADS_SPEND_SPIKE_ALERT_THRESHOLD_MINOR_FLAG,
          ADS_MONITORING_DEFAULTS.spendSpikeAlertThresholdMinor,
        ),
        spendSpikeMajor: this.readPositiveNumber(
          ADS_SPEND_SPIKE_ALERT_THRESHOLD_MAJOR_FLAG,
          ADS_MONITORING_DEFAULTS.spendSpikeAlertThresholdMajor,
        ),
      },
      privacy: {
        aggregatedOnly: true,
        rawTokensExposed: false,
        rawIpExposed: false,
        rawUserAgentExposed: false,
        secretsExposed: false,
      },
    };
  }

  private resolveSince(window: AdsMonitoringWindow) {
    const durationMs =
      window === '1h'
        ? 60 * 60 * 1000
        : window === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
    return new Date(Date.now() - durationMs);
  }

  private sumDecimals(values: Prisma.Decimal[]) {
    return values.reduce(
      (total, value) => total.plus(value),
      new Prisma.Decimal(0),
    );
  }

  private countBy(values: string[]) {
    return values.reduce<Record<string, number>>((counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
  }

  private assertEnabled() {
    if (!this.readFlag(ADS_MONITORING_ENABLED_FLAG, true)) {
      throw new NotFoundException(
        'Ads monitoring is not enabled for this environment.',
      );
    }
  }

  private readFlag(name: string, fallback: boolean) {
    const raw = this.configService.get<string | boolean | undefined>(name);
    if (raw === undefined || raw === null || raw === '') return fallback;
    if (typeof raw === 'boolean') return raw;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private readPositiveNumber(name: string, fallback: number) {
    const raw = this.configService.get<string | number | undefined>(name);
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private readRate(name: string, fallback: number) {
    const value = this.readPositiveNumber(name, fallback);
    return value > 0 && value <= 1 ? value : fallback;
  }

  private readOptionalString(name: string) {
    return this.configService.get<string | undefined>(name)?.trim() || null;
  }
}
