import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ADS_CAMPAIGN_MODERATION_ENABLED_FLAG,
  ADS_MODERATION_REQUIRED_FOR_SERVING_FLAG,
  SPONSORED_CAMPAIGN_BILLING_MODES,
  SPONSORED_CAMPAIGN_STATUSES,
  type SponsoredCampaignModerationAction,
  type SponsoredCampaignModerationStatus,
  type SponsoredCampaignScenarioType,
  type SponsoredCampaignStatus,
  type SponsoredCampaignTargetStatus,
} from './campaigns.constants';
import { ListCampaignModerationQueryDto } from './dto/campaign-moderation.dto';
import { CreateSponsoredCampaignDto } from './dto/create-sponsored-campaign.dto';
import {
  type SponsoredCampaignEventResponseDto,
  type SponsoredCampaignPerformanceResponseDto,
} from './dto/campaign-performance-response.dto';
import { ListSponsoredCampaignsQueryDto } from './dto/list-sponsored-campaigns-query.dto';
import { UpdateSponsoredCampaignDto } from './dto/update-sponsored-campaign.dto';
import { UpsertSponsoredCampaignTargetDto } from './dto/upsert-sponsored-campaign-target.dto';

const ACTIVE_TARGET_STATUSES: SponsoredCampaignTargetStatus[] = [
  'active',
  'paused',
];
const DEFAULT_CAMPAIGN_CPC_AMOUNT = new Prisma.Decimal('1.00');

type CampaignWithTargets = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  status: string;
  moderationStatus: string;
  moderationReason: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: Date | null;
  submittedAt: Date;
  scenarioTypes: string[];
  startAt: Date | null;
  endAt: Date | null;
  budgetLimit: Prisma.Decimal | null;
  billingMode: string;
  maxBoost: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  targets: Array<{
    id: string;
    campaignId: string;
    productId: string;
    boost: Prisma.Decimal;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    product: {
      id: string;
      localTitle: string | null;
      wbTitle: string;
      seoSlug: string | null;
      brand: string | null;
      categoryName: string | null;
      catalogStatus: string;
      visibility: string | null;
    };
  }>;
};

type CampaignPerformanceMetrics = {
  spentAmount: Prisma.Decimal;
  budgetLimit: Prisma.Decimal | null;
  remainingBudget: Prisma.Decimal | null;
  billableImpressions: number;
  billableClicks: number;
  chargedClicks: number;
  totalChargedEvents: number;
  totalEvents: number;
  servedAsSponsored: boolean;
  budgetExhausted: boolean;
  walletBlocked: boolean;
  cpcAmount: Prisma.Decimal;
  chargingEnabled: boolean;
  spendTracked: boolean;
  notes: string[];
};

type CampaignRecommendationEvent = {
  id: string;
  type: string;
  placement: string;
  scenarioType: string | null;
  productId: string;
  algorithm: string | null;
  sponsored: boolean;
  charged: boolean;
  chargeStatus: string;
  cost: Prisma.Decimal | null;
  ledgerEntryId: string | null;
  createdAt: Date;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getModerationFlags() {
    return {
      moderationEnabled: this.readFlag(
        ADS_CAMPAIGN_MODERATION_ENABLED_FLAG,
        true,
      ),
      moderationRequiredForServing: this.readFlag(
        ADS_MODERATION_REQUIRED_FOR_SERVING_FLAG,
        true,
      ),
    };
  }

  isModerationApprovedForServing(status: string | null | undefined) {
    return (
      !this.getModerationFlags().moderationRequiredForServing ||
      status === 'approved'
    );
  }

  async listByShop(shopId: string, query: ListSponsoredCampaignsQueryDto) {
    const campaigns = await this.prisma.sponsoredCampaign.findMany({
      where: {
        shopId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.scenarioType
          ? { scenarioTypes: { has: query.scenarioType } }
          : {}),
      },
      include: this.getCampaignInclude(),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return this.mapCampaignCollection(campaigns);
  }

  async listForModeration(query: ListCampaignModerationQueryDto) {
    this.assertModerationWorkflowEnabled();
    const search = query.search?.trim();
    const campaigns = await this.prisma.sponsoredCampaign.findMany({
      where: {
        ...(query.moderationStatus
          ? { moderationStatus: query.moderationStatus }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                {
                  shop: {
                    is: {
                      name: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        ...this.getCampaignInclude(),
        shop: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    const items = await Promise.all(
      campaigns.map(async (campaign) => ({
        ...(await this.mapCampaignWithPerformance(
          campaign as unknown as CampaignWithTargets,
        )),
        shop: campaign.shop,
      })),
    );
    return { flags: this.getModerationFlags(), items };
  }

  async findOneForAdmin(campaignId: string) {
    this.assertModerationWorkflowEnabled();
    const campaign = await this.prisma.sponsoredCampaign.findFirst({
      where: { id: campaignId },
      include: {
        ...this.getCampaignInclude(),
        shop: { select: { id: true, name: true, slug: true } },
        reviewedByAdmin: {
          select: { id: true, email: true, fullName: true },
        },
        moderationAuditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} was not found.`);
    }
    return {
      ...(await this.mapCampaignWithPerformance(campaign)),
      shop: campaign.shop,
      reviewedByAdmin: campaign.reviewedByAdmin,
      moderationAuditLogs: campaign.moderationAuditLogs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async moderateCampaign(
    campaignId: string,
    nextStatus: Exclude<SponsoredCampaignModerationStatus, 'pending_review'>,
    reason: string | undefined,
    adminId: string,
  ) {
    this.assertModerationWorkflowEnabled();
    const existing = await this.prisma.sponsoredCampaign.findFirst({
      where: { id: campaignId },
      include: this.getCampaignInclude(),
    });
    if (!existing) {
      throw new NotFoundException(`Campaign ${campaignId} was not found.`);
    }
    this.assertValidModerationTransition(existing.moderationStatus, nextStatus);
    const normalizedReason = reason?.trim() || null;
    if (
      ['rejected', 'changes_requested', 'suspended'].includes(nextStatus) &&
      !normalizedReason
    ) {
      throw new BadRequestException(
        `A moderation reason is required for ${nextStatus}.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sponsoredCampaign.update({
        where: { id: campaignId },
        data: {
          moderationStatus: nextStatus,
          moderationReason: normalizedReason,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });
      await this.writeModerationAudit(
        campaignId,
        nextStatus,
        existing.moderationStatus,
        nextStatus,
        normalizedReason,
        adminId,
        tx,
      );
    });

    return this.findOneForAdmin(campaignId);
  }

  async create(shopId: string, dto: CreateSponsoredCampaignDto) {
    this.validateDateWindow(dto.startAt, dto.endAt);
    const status = dto.status ?? 'draft';
    if (status === 'active') {
      throw new BadRequestException(
        'Campaigns must be created as draft until product targets are attached.',
      );
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sponsoredCampaign.create({
        data: {
          shopId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          status,
          moderationStatus: 'pending_review',
          submittedAt: new Date(),
          scenarioTypes: this.normalizeScenarioTypes(dto.scenarioTypes),
          startAt: dto.startAt ? new Date(dto.startAt) : null,
          endAt: dto.endAt ? new Date(dto.endAt) : null,
          budgetLimit:
            dto.budgetLimit === undefined || dto.budgetLimit === null
              ? null
              : new Prisma.Decimal(dto.budgetLimit),
          billingMode: dto.billingMode ?? 'none',
          maxBoost: new Prisma.Decimal(dto.maxBoost),
        },
        include: this.getCampaignInclude(),
      });
      await this.writeModerationAudit(
        created.id,
        'submitted',
        null,
        'pending_review',
        null,
        null,
        tx,
      );
      return created;
    });

    return this.mapCampaignWithPerformance(campaign);
  }

  async findOneByShop(shopId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    return this.mapCampaignWithPerformance(campaign);
  }

  async update(
    shopId: string,
    campaignId: string,
    dto: UpdateSponsoredCampaignDto,
  ) {
    const existing = await this.getCampaignOrThrow(shopId, campaignId);
    if (existing.status === 'archived') {
      throw new BadRequestException(
        'Archived campaigns are read-only and cannot be updated.',
      );
    }

    this.validateDateWindow(dto.startAt, dto.endAt);
    const nextStatus = (dto.status ??
      existing.status) as SponsoredCampaignStatus;
    this.assertValidStatusTransition(existing.status, nextStatus);
    const shouldResubmit = this.shouldResubmitAfterUpdate(existing, dto);
    const submittedAt = new Date();

    const startAt =
      dto.startAt === undefined
        ? existing.startAt
        : dto.startAt
          ? new Date(dto.startAt)
          : null;
    const endAt =
      dto.endAt === undefined
        ? existing.endAt
        : dto.endAt
          ? new Date(dto.endAt)
          : null;
    this.validateDateWindow(
      startAt ? startAt.toISOString() : undefined,
      endAt ? endAt.toISOString() : undefined,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextCampaign = await tx.sponsoredCampaign.update({
        where: { id: campaignId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.scenarioTypes !== undefined
            ? { scenarioTypes: this.normalizeScenarioTypes(dto.scenarioTypes) }
            : {}),
          ...(dto.startAt !== undefined ? { startAt } : {}),
          ...(dto.endAt !== undefined ? { endAt } : {}),
          ...(dto.budgetLimit !== undefined
            ? {
                budgetLimit:
                  dto.budgetLimit === null
                    ? null
                    : new Prisma.Decimal(dto.budgetLimit),
              }
            : {}),
          ...(dto.billingMode !== undefined
            ? { billingMode: dto.billingMode }
            : {}),
          ...(dto.maxBoost !== undefined
            ? { maxBoost: new Prisma.Decimal(dto.maxBoost) }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(shouldResubmit
            ? {
                moderationStatus: 'pending_review',
                moderationReason: null,
                reviewedByAdminId: null,
                reviewedAt: null,
                submittedAt,
              }
            : {}),
        },
        include: this.getCampaignInclude(),
      });

      if (shouldResubmit) {
        await this.writeModerationAudit(
          campaignId,
          'resubmitted',
          existing.moderationStatus,
          'pending_review',
          null,
          null,
          tx,
        );
      }

      if (nextStatus === 'active') {
        await this.assertCampaignCanBeActivated(nextCampaign, tx);
      }

      return nextCampaign;
    });

    return this.mapCampaignWithPerformance(updated);
  }

  async archive(shopId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    this.assertValidStatusTransition(campaign.status, 'archived');

    const archived = await this.prisma.sponsoredCampaign.update({
      where: { id: campaignId },
      data: { status: 'archived' },
      include: this.getCampaignInclude(),
    });

    return this.mapCampaignWithPerformance(archived);
  }

  async upsertTarget(
    shopId: string,
    campaignId: string,
    dto: UpsertSponsoredCampaignTargetDto,
  ) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    if (campaign.status === 'archived') {
      throw new BadRequestException(
        'Archived campaigns cannot add or update targets.',
      );
    }

    await this.assertProductBelongsToShop(shopId, dto.productId);
    this.assertBoostWithinCampaign(dto.boost, campaign.maxBoost);

    const existingTarget = campaign.targets.find(
      (target) => target.productId === dto.productId,
    );

    return this.prisma.$transaction(async (tx) => {
      if (existingTarget) {
        await tx.sponsoredCampaignProduct.update({
          where: { id: existingTarget.id },
          data: {
            boost: new Prisma.Decimal(dto.boost),
            status: dto.status ?? existingTarget.status,
          },
        });
      } else {
        await tx.sponsoredCampaignProduct.create({
          data: {
            campaignId,
            productId: dto.productId,
            boost: new Prisma.Decimal(dto.boost),
            status: dto.status ?? 'active',
          },
        });
      }

      await this.resubmitCampaignAfterTargetChange(campaign, tx);
      const refreshed = await tx.sponsoredCampaign.findFirst({
        where: { id: campaignId, shopId },
        include: this.getCampaignInclude(),
      });
      if (!refreshed) {
        throw new NotFoundException(`Campaign ${campaignId} was not found.`);
      }
      if (refreshed.status === 'active') {
        await this.assertCampaignCanBeActivated(refreshed, tx);
      }
      return this.mapCampaignWithPerformance(refreshed);
    });
  }

  async removeTarget(shopId: string, campaignId: string, targetId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    if (campaign.status === 'archived') {
      throw new BadRequestException(
        'Archived campaigns cannot update targets.',
      );
    }

    const target = campaign.targets.find((item) => item.id === targetId);
    if (!target) {
      throw new NotFoundException(`Target ${targetId} was not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.sponsoredCampaignProduct.update({
        where: { id: targetId },
        data: { status: 'removed' },
      });

      await this.resubmitCampaignAfterTargetChange(campaign, tx);
      const refreshed = await tx.sponsoredCampaign.findFirst({
        where: { id: campaignId, shopId },
        include: this.getCampaignInclude(),
      });
      if (!refreshed) {
        throw new NotFoundException(`Campaign ${campaignId} was not found.`);
      }
      if (refreshed.status === 'active') {
        await this.assertCampaignCanBeActivated(refreshed, tx);
      }
      return this.mapCampaignWithPerformance(refreshed);
    });
  }

  async getPerformanceByShop(
    shopId: string,
    campaignId: string,
  ): Promise<SponsoredCampaignPerformanceResponseDto> {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    const [metrics, recentEvents] = await Promise.all([
      this.getCampaignPerformanceMetrics([campaign]),
      this.listCampaignEvents(campaign),
    ]);

    return {
      campaignId: campaign.id,
      shopId: campaign.shopId,
      summary: this.mapPerformanceSummary(metrics.get(campaign.id)!),
      recentEvents,
    };
  }

  async listEventsByShop(shopId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    return this.listCampaignEvents(campaign);
  }

  async getActiveRecommendationTargets(
    scenarioType: SponsoredCampaignScenarioType,
    shopId?: string,
  ) {
    const now = new Date();
    const campaigns = await this.prisma.sponsoredCampaign.findMany({
      where: {
        status: 'active',
        ...(this.getModerationFlags().moderationRequiredForServing
          ? { moderationStatus: 'approved' }
          : {}),
        scenarioTypes: { has: scenarioType },
        ...(shopId ? { shopId } : {}),
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
      },
      include: {
        targets: {
          where: {
            status: 'active',
            product: {
              is: {
                ...(shopId ? { shopId } : {}),
                visibility: 'ACTIVE',
                catalogStatus: 'PUBLISHED',
                archivedAt: null,
                unpublishedAt: null,
              },
            },
          },
          include: {
            product: {
              select: {
                id: true,
                shopId: true,
                localTitle: true,
                wbTitle: true,
                seoSlug: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const metricsByCampaignId = await this.getCampaignPerformanceMetrics(
      campaigns as unknown as CampaignWithTargets[],
    );

    return campaigns
      .filter((campaign) =>
        this.canServeCampaign(
          campaign as unknown as CampaignWithTargets,
          metricsByCampaignId.get(campaign.id),
        ),
      )
      .flatMap((campaign) =>
        campaign.targets.map((target) => ({
          campaignId: campaign.id,
          shopId: campaign.shopId,
          billingMode: this.normalizeBillingMode(campaign.billingMode),
          scenarioTypes: [...campaign.scenarioTypes],
          maxBoost: Number(campaign.maxBoost.toString()),
          productId: target.productId,
          targetId: target.id,
          boost: Number(target.boost.toString()),
          cpcAmount: this.getCampaignCpcAmount(campaign).toNumber(),
          product: {
            id: target.product.id,
            name: target.product.localTitle ?? target.product.wbTitle,
            seoSlug: target.product.seoSlug,
          },
        })),
      )
      .sort((left, right) => right.boost - left.boost);
  }

  private getCampaignInclude() {
    return {
      targets: {
        include: {
          product: {
            select: {
              id: true,
              localTitle: true,
              wbTitle: true,
              seoSlug: true,
              brand: true,
              categoryName: true,
              catalogStatus: true,
              visibility: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' as const }],
      },
    };
  }

  private async getCampaignOrThrow(shopId: string, campaignId: string) {
    const campaign = await this.prisma.sponsoredCampaign.findFirst({
      where: {
        id: campaignId,
        shopId,
      },
      include: this.getCampaignInclude(),
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} was not found.`);
    }

    return campaign;
  }

  private async assertProductBelongsToShop(shopId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        shopId,
      },
      select: {
        id: true,
      },
    });

    if (!product) {
      throw new BadRequestException(
        `Product ${productId} does not belong to shop ${shopId}.`,
      );
    }
  }

  private assertBoostWithinCampaign(
    boost: number,
    campaignMaxBoost: Prisma.Decimal,
  ) {
    if (boost > Number(campaignMaxBoost.toString())) {
      throw new BadRequestException(
        'Target boost cannot exceed the campaign maxBoost.',
      );
    }
  }

  private async assertCampaignCanBeActivated(
    campaign: CampaignWithTargets,
    prisma: Pick<PrismaService, 'product'> = this.prisma,
  ) {
    if (
      campaign.targets.filter((target) => target.status !== 'removed').length <
      1
    ) {
      throw new BadRequestException(
        'Active campaigns require at least one non-removed product target.',
      );
    }

    if (
      campaign.endAt &&
      campaign.startAt &&
      campaign.endAt < campaign.startAt
    ) {
      throw new BadRequestException(
        'Campaign endAt must be later than or equal to startAt.',
      );
    }

    const candidateTargets = campaign.targets.filter((target) =>
      ACTIVE_TARGET_STATUSES.includes(
        target.status as SponsoredCampaignTargetStatus,
      ),
    );

    if (candidateTargets.length < 1) {
      throw new BadRequestException(
        'Active campaigns require at least one active or paused target.',
      );
    }

    const productIds = candidateTargets.map((target) => target.productId);
    const validProducts = productIds.length
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            shopId: campaign.shopId,
            visibility: 'ACTIVE',
            catalogStatus: 'PUBLISHED',
            archivedAt: null,
            unpublishedAt: null,
          },
          select: { id: true },
        })
      : [];

    const validProductIds = new Set(validProducts.map((product) => product.id));
    for (const target of candidateTargets) {
      if (!validProductIds.has(target.productId)) {
        throw new BadRequestException(
          `Campaign target ${target.productId} is not a valid public product for activation.`,
        );
      }
      if (
        Number(target.boost.toString()) > Number(campaign.maxBoost.toString())
      ) {
        throw new BadRequestException(
          `Campaign target ${target.productId} boost exceeds campaign maxBoost.`,
        );
      }
    }
  }

  private assertValidStatusTransition(
    current: string,
    next: SponsoredCampaignStatus,
  ) {
    if (current === next) {
      return;
    }

    const allowedTransitions: Record<
      SponsoredCampaignStatus,
      SponsoredCampaignStatus[]
    > = {
      draft: ['active', 'archived'],
      active: ['paused', 'ended', 'archived'],
      paused: ['active', 'ended', 'archived'],
      ended: ['archived'],
      archived: [],
    };

    const currentStatus = SPONSORED_CAMPAIGN_STATUSES.find(
      (status) => status === current,
    );
    if (!currentStatus) {
      throw new BadRequestException(`Unsupported campaign status ${current}.`);
    }

    if (!allowedTransitions[currentStatus].includes(next)) {
      throw new BadRequestException(
        `Invalid campaign status transition from ${current} to ${next}.`,
      );
    }
  }

  private shouldResubmitAfterUpdate(
    campaign: CampaignWithTargets,
    dto: UpdateSponsoredCampaignDto,
  ) {
    if (campaign.moderationStatus === 'pending_review') {
      return false;
    }
    return [
      'name',
      'description',
      'scenarioTypes',
      'startAt',
      'endAt',
      'budgetLimit',
      'billingMode',
      'maxBoost',
    ].some((field) => Object.prototype.hasOwnProperty.call(dto, field));
  }

  private async resubmitCampaignAfterTargetChange(
    campaign: CampaignWithTargets,
    tx: Prisma.TransactionClient,
  ) {
    if (campaign.moderationStatus === 'pending_review') {
      return;
    }
    await tx.sponsoredCampaign.update({
      where: { id: campaign.id },
      data: {
        moderationStatus: 'pending_review',
        moderationReason: null,
        reviewedByAdminId: null,
        reviewedAt: null,
        submittedAt: new Date(),
      },
    });
    await this.writeModerationAudit(
      campaign.id,
      'resubmitted',
      campaign.moderationStatus,
      'pending_review',
      null,
      null,
      tx,
    );
  }

  private assertValidModerationTransition(
    current: string,
    next: Exclude<SponsoredCampaignModerationStatus, 'pending_review'>,
  ) {
    const allowedTransitions: Record<
      SponsoredCampaignModerationStatus,
      SponsoredCampaignModerationStatus[]
    > = {
      pending_review: ['approved', 'rejected', 'changes_requested'],
      approved: ['suspended'],
      rejected: [],
      changes_requested: [],
      suspended: ['approved'],
    };
    const allowed =
      allowedTransitions[current as SponsoredCampaignModerationStatus];
    if (!allowed || !allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid campaign moderation transition from ${current} to ${next}.`,
      );
    }
  }

  private assertModerationWorkflowEnabled() {
    if (!this.getModerationFlags().moderationEnabled) {
      throw new NotFoundException();
    }
  }

  private async writeModerationAudit(
    campaignId: string,
    action: SponsoredCampaignModerationAction,
    previousStatus: string | null,
    nextStatus: SponsoredCampaignModerationStatus,
    reason: string | null,
    adminId: string | null,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    await client.sponsoredCampaignModerationAuditLog.create({
      data: {
        campaignId,
        action,
        previousStatus,
        nextStatus,
        reason,
        adminId,
      },
    });
  }

  private validateDateWindow(startAt?: string, endAt?: string) {
    if (!startAt || !endAt) {
      return;
    }

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      throw new BadRequestException(
        'Campaign endAt must be later than or equal to startAt.',
      );
    }
  }

  private normalizeScenarioTypes(scenarioTypes: string[]) {
    return [...new Set(scenarioTypes.map((item) => item.trim().toLowerCase()))];
  }

  private normalizeBillingMode(billingMode: string) {
    return (
      SPONSORED_CAMPAIGN_BILLING_MODES.find((mode) => mode === billingMode) ??
      'none'
    );
  }

  private readFlag(name: string, fallback: boolean) {
    const value = this.configService.get<string>(name);
    if (value === undefined) {
      return fallback;
    }
    return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
  }

  private async mapCampaignCollection(campaigns: CampaignWithTargets[]) {
    const metricsByCampaignId =
      await this.getCampaignPerformanceMetrics(campaigns);
    return campaigns.map((campaign) =>
      this.mapCampaign(campaign, metricsByCampaignId.get(campaign.id)!),
    );
  }

  private async mapCampaignWithPerformance(campaign: CampaignWithTargets) {
    const metricsByCampaignId = await this.getCampaignPerformanceMetrics([
      campaign,
    ]);
    return this.mapCampaign(campaign, metricsByCampaignId.get(campaign.id)!);
  }

  private mapCampaign(
    campaign: CampaignWithTargets,
    metrics: CampaignPerformanceMetrics,
  ) {
    const totalTargets = campaign.targets.length;
    const activeTargets = campaign.targets.filter(
      (target) => target.status === 'active',
    ).length;
    const pausedTargets = campaign.targets.filter(
      (target) => target.status === 'paused',
    ).length;
    const removedTargets = campaign.targets.filter(
      (target) => target.status === 'removed',
    ).length;

    return {
      id: campaign.id,
      shopId: campaign.shopId,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      moderationStatus: campaign.moderationStatus,
      moderationReason: campaign.moderationReason,
      reviewedByAdminId: campaign.reviewedByAdminId,
      reviewedAt: campaign.reviewedAt?.toISOString() ?? null,
      submittedAt: campaign.submittedAt.toISOString(),
      moderationRequiredForServing:
        this.getModerationFlags().moderationRequiredForServing,
      moderationServingEligible: this.isModerationApprovedForServing(
        campaign.moderationStatus,
      ),
      scenarioTypes: [...campaign.scenarioTypes],
      startAt: campaign.startAt?.toISOString() ?? null,
      endAt: campaign.endAt?.toISOString() ?? null,
      budgetLimit: campaign.budgetLimit?.toString() ?? null,
      billingMode: this.normalizeBillingMode(campaign.billingMode),
      maxBoost: campaign.maxBoost.toString(),
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      billing: {
        mode: this.normalizeBillingMode(campaign.billingMode),
        budgetLimit: campaign.budgetLimit?.toString() ?? null,
        chargingEnabled: metrics.chargingEnabled,
        spendTracked: metrics.spendTracked,
        spentAmount: metrics.spentAmount.toString(),
        remainingBudget: metrics.remainingBudget?.toString() ?? null,
        billableImpressions: metrics.billableImpressions,
        billableClicks: metrics.billableClicks,
        chargedClicks: metrics.chargedClicks,
        totalChargedEvents: metrics.totalChargedEvents,
        servedAsSponsored: metrics.servedAsSponsored,
        budgetExhausted: metrics.budgetExhausted,
        walletBlocked: metrics.walletBlocked,
        cpcAmount: metrics.cpcAmount.toString(),
        notes: metrics.notes,
      },
      summary: {
        totalTargets,
        activeTargets,
        pausedTargets,
        removedTargets,
      },
      targets: campaign.targets.map((target) => ({
        id: target.id,
        campaignId: target.campaignId,
        productId: target.productId,
        boost: target.boost.toString(),
        status: target.status,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
        product: {
          id: target.product.id,
          name: target.product.localTitle ?? target.product.wbTitle,
          seoSlug: target.product.seoSlug,
          brand: target.product.brand,
          categoryName: target.product.categoryName,
          catalogStatus: target.product.catalogStatus,
          visibility: target.product.visibility,
        },
      })),
    };
  }

  private async getCampaignPerformanceMetrics(
    campaigns: CampaignWithTargets[],
  ) {
    const metricsByCampaignId = new Map<string, CampaignPerformanceMetrics>();
    if (campaigns.length < 1) {
      return metricsByCampaignId;
    }

    const campaignIds = campaigns.map((campaign) => campaign.id);
    const shopIds = [...new Set(campaigns.map((campaign) => campaign.shopId))];

    const [events, wallets] = await Promise.all([
      this.prisma.recommendationEvent.findMany({
        where: {
          campaignId: { in: campaignIds },
        },
        select: {
          campaignId: true,
          type: true,
          billingMode: true,
          sponsored: true,
          charged: true,
          cost: true,
          chargeStatus: true,
        },
      }),
      this.prisma.sellerWallet.findMany({
        where: {
          shopId: { in: shopIds },
        },
        select: {
          shopId: true,
          balance: true,
          reservedBalance: true,
          status: true,
        },
      }),
    ]);

    const walletByShopId = new Map(
      wallets.map((wallet) => [
        wallet.shopId,
        {
          availableBalance: wallet.balance.minus(wallet.reservedBalance),
          status: wallet.status,
        },
      ]),
    );

    for (const campaign of campaigns) {
      const campaignEvents = events.filter(
        (event) => event.campaignId === campaign.id,
      );
      const spentAmount = campaignEvents.reduce(
        (sum, event) =>
          event.charged && event.cost ? sum.plus(event.cost) : sum,
        new Prisma.Decimal(0),
      );
      const budgetLimit = campaign.budgetLimit
        ? new Prisma.Decimal(campaign.budgetLimit.toString())
        : null;
      const remainingBudget = budgetLimit
        ? (() => {
            const delta = budgetLimit.minus(spentAmount);
            return delta.lt(0) ? new Prisma.Decimal(0) : delta;
          })()
        : null;
      const cpcAmount = this.getCampaignCpcAmount(campaign);
      const wallet = walletByShopId.get(campaign.shopId);
      const walletBlocked =
        this.normalizeBillingMode(campaign.billingMode) === 'cpc'
          ? !wallet ||
            wallet.status !== 'active' ||
            wallet.availableBalance.lt(cpcAmount)
          : false;
      const budgetExhausted =
        budgetLimit !== null &&
        (spentAmount.gte(budgetLimit) ||
          (this.normalizeBillingMode(campaign.billingMode) === 'cpc' &&
            (remainingBudget?.lt(cpcAmount) ?? false)));
      const billingMode = this.normalizeBillingMode(campaign.billingMode);

      metricsByCampaignId.set(campaign.id, {
        spentAmount,
        budgetLimit,
        remainingBudget,
        billableImpressions: campaignEvents.filter(
          (event) =>
            event.sponsored &&
            event.type === 'impression' &&
            event.billingMode === 'cpm',
        ).length,
        billableClicks: campaignEvents.filter(
          (event) =>
            event.sponsored &&
            event.type === 'click' &&
            event.billingMode === 'cpc',
        ).length,
        chargedClicks: campaignEvents.filter(
          (event) => event.type === 'click' && event.charged,
        ).length,
        totalChargedEvents: campaignEvents.filter((event) => event.charged)
          .length,
        totalEvents: campaignEvents.length,
        servedAsSponsored: campaignEvents.some((event) => event.sponsored),
        budgetExhausted,
        walletBlocked,
        cpcAmount,
        chargingEnabled: billingMode === 'cpc',
        spendTracked: campaign.status !== 'draft',
        notes: this.buildBillingNotes(
          billingMode,
          budgetExhausted,
          walletBlocked,
        ),
      });
    }

    return metricsByCampaignId;
  }

  private canServeCampaign(
    campaign: CampaignWithTargets,
    metrics?: CampaignPerformanceMetrics,
  ) {
    if (!metrics) {
      return false;
    }
    if (!this.isModerationApprovedForServing(campaign.moderationStatus)) {
      return false;
    }

    const billingMode = this.normalizeBillingMode(campaign.billingMode);
    if (billingMode !== 'cpc') {
      return true;
    }

    return !metrics.walletBlocked && !metrics.budgetExhausted;
  }

  private buildBillingNotes(
    billingMode: string,
    budgetExhausted: boolean,
    walletBlocked: boolean,
  ) {
    const notes: string[] = [];
    if (billingMode === 'cpc') {
      notes.push(
        'CPC click charging is enabled for sponsored recommendation clicks.',
      );
    } else if (billingMode === 'cpm') {
      notes.push(
        'CPM impressions are tracked in V1 but are not auto-charged yet.',
      );
    } else if (billingMode === 'fixed') {
      notes.push(
        'Fixed billing mode is stored for future manual billing workflows.',
      );
    } else {
      notes.push('Automatic charging is disabled for this campaign.');
    }
    if (budgetExhausted) {
      notes.push(
        'Budget limit reached; sponsored serving is blocked until the budget changes.',
      );
    }
    if (walletBlocked) {
      notes.push('Wallet available balance is too low for another CPC charge.');
    }
    return notes;
  }

  private getCampaignCpcAmount(
    campaign: Pick<CampaignWithTargets, 'billingMode'>,
  ) {
    return this.normalizeBillingMode(campaign.billingMode) === 'cpc'
      ? new Prisma.Decimal(DEFAULT_CAMPAIGN_CPC_AMOUNT.toString())
      : new Prisma.Decimal(0);
  }

  private mapPerformanceSummary(metrics: CampaignPerformanceMetrics) {
    return {
      spentAmount: metrics.spentAmount.toString(),
      budgetLimit: metrics.budgetLimit?.toString() ?? null,
      remainingBudget: metrics.remainingBudget?.toString() ?? null,
      billableImpressions: metrics.billableImpressions,
      billableClicks: metrics.billableClicks,
      chargedClicks: metrics.chargedClicks,
      totalChargedEvents: metrics.totalChargedEvents,
      totalEvents: metrics.totalEvents,
      servedAsSponsored: metrics.servedAsSponsored,
      budgetExhausted: metrics.budgetExhausted,
      walletBlocked: metrics.walletBlocked,
      cpcAmount: metrics.cpcAmount.toString(),
    };
  }

  private async listCampaignEvents(
    campaign: CampaignWithTargets,
  ): Promise<SponsoredCampaignEventResponseDto[]> {
    const events = (await this.prisma.recommendationEvent.findMany({
      where: {
        campaignId: campaign.id,
      },
      select: {
        id: true,
        type: true,
        placement: true,
        scenarioType: true,
        productId: true,
        algorithm: true,
        sponsored: true,
        charged: true,
        chargeStatus: true,
        cost: true,
        ledgerEntryId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 25,
    })) as CampaignRecommendationEvent[];

    const productIds = [...new Set(events.map((event) => event.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: {
            id: { in: productIds },
          },
          select: {
            id: true,
            localTitle: true,
            wbTitle: true,
          },
        })
      : [];
    const productNameById = new Map(
      products.map((product) => [
        product.id,
        product.localTitle ?? product.wbTitle,
      ]),
    );

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      placement: event.placement,
      scenarioType: event.scenarioType,
      productId: event.productId,
      productName: productNameById.get(event.productId) ?? event.productId,
      algorithm: event.algorithm,
      sponsored: event.sponsored,
      charged: event.charged,
      chargeStatus: event.chargeStatus,
      cost: event.cost?.toString() ?? null,
      ledgerEntryId: event.ledgerEntryId,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
