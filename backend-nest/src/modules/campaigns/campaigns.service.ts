import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  SPONSORED_CAMPAIGN_BILLING_MODES,
  SPONSORED_CAMPAIGN_STATUSES,
  type SponsoredCampaignScenarioType,
  type SponsoredCampaignStatus,
  type SponsoredCampaignTargetStatus,
} from './campaigns.constants';
import { CreateSponsoredCampaignDto } from './dto/create-sponsored-campaign.dto';
import { ListSponsoredCampaignsQueryDto } from './dto/list-sponsored-campaigns-query.dto';
import { UpdateSponsoredCampaignDto } from './dto/update-sponsored-campaign.dto';
import { UpsertSponsoredCampaignTargetDto } from './dto/upsert-sponsored-campaign-target.dto';

const ACTIVE_TARGET_STATUSES: SponsoredCampaignTargetStatus[] = [
  'active',
  'paused',
];

type CampaignWithTargets = {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  status: string;
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

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return campaigns.map((campaign) => this.mapCampaign(campaign));
  }

  async create(shopId: string, dto: CreateSponsoredCampaignDto) {
    this.validateDateWindow(dto.startAt, dto.endAt);
    const status = dto.status ?? 'draft';
    if (status === 'active') {
      throw new BadRequestException(
        'Campaigns must be created as draft until product targets are attached.',
      );
    }

    const campaign = await this.prisma.sponsoredCampaign.create({
      data: {
        shopId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status,
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

    return this.mapCampaign(campaign);
  }

  async findOneByShop(shopId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    return this.mapCampaign(campaign);
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
    const nextStatus = (dto.status ?? existing.status) as SponsoredCampaignStatus;
    this.assertValidStatusTransition(existing.status, nextStatus);

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
        },
        include: this.getCampaignInclude(),
      });

      if (nextStatus === 'active') {
        await this.assertCampaignCanBeActivated(nextCampaign, tx);
      }

      return nextCampaign;
    });

    return this.mapCampaign(updated);
  }

  async archive(shopId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(shopId, campaignId);
    this.assertValidStatusTransition(campaign.status, 'archived');

    const archived = await this.prisma.sponsoredCampaign.update({
      where: { id: campaignId },
      data: { status: 'archived' },
      include: this.getCampaignInclude(),
    });

    return this.mapCampaign(archived);
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
      return this.mapCampaign(refreshed);
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
      return this.mapCampaign(refreshed);
    });
  }

  async getActiveRecommendationTargets(
    scenarioType: SponsoredCampaignScenarioType,
    shopId?: string,
  ) {
    const now = new Date();
    const campaigns = await this.prisma.sponsoredCampaign.findMany({
      where: {
        status: 'active',
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

    return campaigns.flatMap((campaign) =>
      campaign.targets.map((target) => ({
        campaignId: campaign.id,
        shopId: campaign.shopId,
        billingMode: this.normalizeBillingMode(campaign.billingMode),
        scenarioTypes: [...campaign.scenarioTypes],
        maxBoost: Number(campaign.maxBoost.toString()),
        productId: target.productId,
        targetId: target.id,
        boost: Number(target.boost.toString()),
        product: {
          id: target.product.id,
          name: target.product.localTitle ?? target.product.wbTitle,
          seoSlug: target.product.seoSlug,
        },
      })),
    );
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

  private mapCampaign(campaign: CampaignWithTargets) {
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
        chargingEnabled: false,
        spendTracked: false,
        notes: [
          'Billing and spend charging are not enabled in Phase 4.1.',
          'Budget limit is stored as a placeholder for future wallet and ledger integration.',
        ],
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
}
