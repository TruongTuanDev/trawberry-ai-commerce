import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ADS_MANUAL_TOP_UP_ENABLED_FLAG } from './ads-wallet-top-ups.constants';
import { BillingService } from './billing.service';
import {
  ConfirmAdsWalletTopUpDto,
  CreateAdsWalletTopUpDto,
  ListAdsWalletTopUpsQueryDto,
  RejectAdsWalletTopUpDto,
  UpdateAdsWalletTopUpDto,
} from './dto/ads-wallet-top-up.dto';

const MANUAL_TOP_UP_REFERENCE_TYPE = 'manual_top_up';
const MANUAL_TOP_UP_DESCRIPTION = 'Manual ads wallet top-up confirmed';

const TOP_UP_INCLUDE = {
  seller: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  reviewedByAdmin: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  confirmedLedger: {
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      balanceBefore: true,
      balanceAfter: true,
      description: true,
      createdAt: true,
    },
  },
} satisfies Prisma.AdsWalletTopUpRequestInclude;

type TopUpRecord = Prisma.AdsWalletTopUpRequestGetPayload<{
  include: typeof TOP_UP_INCLUDE;
}>;

@Injectable()
export class AdsWalletTopUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  async listForSeller(
    shopId: string,
    sellerId: string,
    query: ListAdsWalletTopUpsQueryDto,
  ) {
    this.assertEnabled();
    await this.assertSellerOwnsShop(shopId, sellerId);

    const items = await this.prisma.adsWalletTopUpRequest.findMany({
      where: {
        shopId,
        sellerId,
        status: query.status,
      },
      include: TOP_UP_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const pendingTotal = items
      .filter((item) => item.status === 'pending')
      .reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0));

    return {
      flags: {
        manualTopUpEnabled: true,
      },
      transferInstructions: this.getTransferInstructions(),
      pendingTotal: pendingTotal.toString(),
      items: items.map((item) => this.mapTopUp(item)),
    };
  }

  async createForSeller(
    shopId: string,
    sellerId: string,
    dto: CreateAdsWalletTopUpDto,
  ) {
    this.assertEnabled();
    await this.assertSellerOwnsShop(shopId, sellerId);
    const wallet = await this.billingService.getOrCreateWalletForShop(shopId);
    const currency = (dto.currency ?? wallet.currency).trim().toUpperCase();
    if (currency !== wallet.currency) {
      throw new BadRequestException(
        `Wallet currency ${wallet.currency} does not match requested currency ${currency}.`,
      );
    }

    const topUp = await this.prisma.adsWalletTopUpRequest.create({
      data: {
        sellerId,
        requestedBySellerId: sellerId,
        shopId,
        amount: this.toMoney(dto.amount),
        currency,
        status: 'pending',
        transferReference: this.cleanOptional(dto.transferReference),
        proofUrl: this.cleanOptional(dto.proofUrl),
        sellerNote: this.cleanOptional(dto.sellerNote),
      },
      include: TOP_UP_INCLUDE,
    });

    return this.mapTopUp(topUp);
  }

  async updateForSeller(
    shopId: string,
    sellerId: string,
    id: string,
    dto: UpdateAdsWalletTopUpDto,
  ) {
    this.assertEnabled();
    const existing = await this.findOwnedTopUp(shopId, sellerId, id);
    if (existing.status !== 'pending') {
      throw new BadRequestException(
        'Only pending top-up requests can be edited.',
      );
    }

    const updated = await this.prisma.adsWalletTopUpRequest.updateMany({
      where: { id, shopId, sellerId, status: 'pending' },
      data: {
        transferReference:
          dto.transferReference === undefined
            ? undefined
            : this.cleanOptional(dto.transferReference),
        proofUrl:
          dto.proofUrl === undefined
            ? undefined
            : this.cleanOptional(dto.proofUrl),
        sellerNote:
          dto.sellerNote === undefined
            ? undefined
            : this.cleanOptional(dto.sellerNote),
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        'Only pending top-up requests can be edited.',
      );
    }

    return this.mapTopUp(await this.findOwnedTopUp(shopId, sellerId, id));
  }

  async cancelForSeller(shopId: string, sellerId: string, id: string) {
    this.assertEnabled();
    await this.findOwnedTopUp(shopId, sellerId, id);
    const now = new Date();
    const claimed = await this.prisma.adsWalletTopUpRequest.updateMany({
      where: {
        id,
        shopId,
        sellerId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
      },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Only pending top-up requests can be cancelled.',
      );
    }
    return this.mapTopUp(await this.findOwnedTopUp(shopId, sellerId, id));
  }

  async listForAdmin(query: ListAdsWalletTopUpsQueryDto) {
    this.assertEnabled();
    const search = this.cleanOptional(query.search);
    const items = await this.prisma.adsWalletTopUpRequest.findMany({
      where: {
        status: query.status,
        OR: search
          ? [
              { seller: { email: { contains: search, mode: 'insensitive' } } },
              {
                seller: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
              { shop: { name: { contains: search, mode: 'insensitive' } } },
              { shop: { slug: { contains: search, mode: 'insensitive' } } },
              {
                transferReference: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
      },
      include: TOP_UP_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return {
      flags: {
        manualTopUpEnabled: true,
      },
      items: items.map((item) => this.mapTopUp(item, true)),
    };
  }

  async getForAdmin(id: string) {
    this.assertEnabled();
    return this.mapTopUp(await this.findTopUpOrThrow(id), true);
  }

  async confirmForAdmin(
    id: string,
    adminId: string,
    dto: ConfirmAdsWalletTopUpDto,
  ) {
    this.assertEnabled();
    const adminNote = this.cleanOptional(dto.adminNote);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.adsWalletTopUpRequest.findUnique({
        where: { id },
        include: TOP_UP_INCLUDE,
      });
      if (!before) {
        throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
      }
      if (before.status === 'confirmed') {
        return this.mapTopUp(before, true);
      }
      if (before.status !== 'pending') {
        throw new BadRequestException(
          `Top-up status ${before.status} cannot be confirmed.`,
        );
      }
      this.assertConfirmableAmount(before.amount, before.currency);

      const now = new Date();
      const claimed = await tx.adsWalletTopUpRequest.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'confirmed',
          adminNote,
          rejectionReason: null,
          reviewedByAdminId: adminId,
          reviewedAt: now,
          confirmedAt: now,
          rejectedAt: null,
        },
      });
      if (claimed.count !== 1) {
        const current = await tx.adsWalletTopUpRequest.findUnique({
          where: { id },
          include: TOP_UP_INCLUDE,
        });
        if (current?.status === 'confirmed') {
          return this.mapTopUp(current, true);
        }
        throw new BadRequestException(
          `Top-up status ${current?.status ?? 'unknown'} cannot be confirmed.`,
        );
      }

      const billingResult =
        await this.billingService.applyMutationInTransaction(
          tx,
          before.shopId,
          {
            type: 'credit',
            amount: before.amount,
            currency: before.currency,
            referenceType: MANUAL_TOP_UP_REFERENCE_TYPE,
            referenceId: before.id,
            description: MANUAL_TOP_UP_DESCRIPTION,
            metadata: {
              source: MANUAL_TOP_UP_REFERENCE_TYPE,
              topUpRequestId: before.id,
              confirmedByAdminId: adminId,
            },
          },
        );

      await tx.adsWalletTopUpRequest.update({
        where: { id },
        data: {
          confirmedLedgerId: billingResult.entry.id,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          targetUserId: before.sellerId,
          action: 'ADS_WALLET_TOP_UP_CONFIRMED',
          entityType: 'ADS_WALLET_TOP_UP_REQUEST',
          entityId: id,
          oldValueJson: { status: before.status },
          newValueJson: {
            status: 'confirmed',
            amount: before.amount.toString(),
            currency: before.currency,
            confirmedLedgerId: billingResult.entry.id,
          },
          reason: adminNote,
        },
      });

      const confirmed = await tx.adsWalletTopUpRequest.findUnique({
        where: { id },
        include: TOP_UP_INCLUDE,
      });
      if (!confirmed) {
        throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
      }
      return this.mapTopUp(confirmed, true);
    });
  }

  async rejectForAdmin(
    id: string,
    adminId: string,
    dto: RejectAdsWalletTopUpDto,
  ) {
    this.assertEnabled();
    const reason = dto.reason.trim();
    const adminNote = this.cleanOptional(dto.adminNote);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.adsWalletTopUpRequest.findUnique({
        where: { id },
        include: TOP_UP_INCLUDE,
      });
      if (!before) {
        throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
      }
      if (before.status !== 'pending') {
        throw new BadRequestException(
          `Top-up status ${before.status} cannot be rejected.`,
        );
      }

      const now = new Date();
      const claimed = await tx.adsWalletTopUpRequest.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'rejected',
          adminNote,
          rejectionReason: reason,
          reviewedByAdminId: adminId,
          reviewedAt: now,
          rejectedAt: now,
        },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(
          'Only pending top-up requests can be rejected.',
        );
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          targetUserId: before.sellerId,
          action: 'ADS_WALLET_TOP_UP_REJECTED',
          entityType: 'ADS_WALLET_TOP_UP_REQUEST',
          entityId: id,
          oldValueJson: { status: before.status },
          newValueJson: {
            status: 'rejected',
            rejectionReason: reason,
          },
          reason,
        },
      });

      const rejected = await tx.adsWalletTopUpRequest.findUnique({
        where: { id },
        include: TOP_UP_INCLUDE,
      });
      if (!rejected) {
        throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
      }
      return this.mapTopUp(rejected, true);
    });
  }

  private async findOwnedTopUp(shopId: string, sellerId: string, id: string) {
    const topUp = await this.prisma.adsWalletTopUpRequest.findFirst({
      where: { id, shopId, sellerId },
      include: TOP_UP_INCLUDE,
    });
    if (!topUp) {
      throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
    }
    return topUp;
  }

  private async findTopUpOrThrow(id: string) {
    const topUp = await this.prisma.adsWalletTopUpRequest.findUnique({
      where: { id },
      include: TOP_UP_INCLUDE,
    });
    if (!topUp) {
      throw new NotFoundException(`Ads wallet top-up ${id} was not found.`);
    }
    return topUp;
  }

  private async assertSellerOwnsShop(shopId: string, sellerId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        id: shopId,
        sellerProfile: {
          userId: sellerId,
        },
      },
      select: { id: true },
    });
    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }
  }

  private assertConfirmableAmount(amount: Prisma.Decimal, currency: string) {
    if (amount.lte(0)) {
      throw new BadRequestException(
        'Top-up amount must be greater than zero before confirmation.',
      );
    }
    if (currency !== 'RUB') {
      throw new BadRequestException(
        `Top-up currency ${currency} cannot be confirmed.`,
      );
    }
  }

  private assertEnabled() {
    if (!this.readFlag(ADS_MANUAL_TOP_UP_ENABLED_FLAG, true)) {
      throw new NotFoundException(
        'Manual ads wallet top-up is not enabled for this environment.',
      );
    }
  }

  private getTransferInstructions() {
    const recipient = this.readOptionalConfig('ADS_TOP_UP_TRANSFER_RECIPIENT');
    const bank = this.readOptionalConfig('ADS_TOP_UP_TRANSFER_BANK');
    const account = this.readOptionalConfig('ADS_TOP_UP_TRANSFER_ACCOUNT');
    const instructions = this.readOptionalConfig(
      'ADS_TOP_UP_TRANSFER_INSTRUCTIONS',
    );
    return {
      configured: Boolean(recipient || bank || account || instructions),
      recipient,
      bank,
      account,
      instructions,
    };
  }

  private readOptionalConfig(name: string) {
    return this.cleanOptional(this.configService.get<string | undefined>(name));
  }

  private readFlag(name: string, fallback: boolean) {
    const value = this.configService.get<string | boolean | undefined>(name);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private toMoney(value: number | string | Prisma.Decimal) {
    const decimal =
      value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
    return new Prisma.Decimal(decimal.toDecimalPlaces(2).toString());
  }

  private cleanOptional(value: string | undefined | null) {
    return value?.trim() || null;
  }

  private mapTopUp(topUp: TopUpRecord, includeAdminContext = false) {
    return {
      id: topUp.id,
      sellerId: topUp.sellerId,
      shopId: topUp.shopId,
      amount: topUp.amount.toString(),
      currency: topUp.currency,
      status: topUp.status,
      transferReference: topUp.transferReference,
      proofUrl: topUp.proofUrl,
      sellerNote: topUp.sellerNote,
      adminNote: includeAdminContext ? topUp.adminNote : undefined,
      rejectionReason: topUp.rejectionReason,
      reviewedByAdminId: includeAdminContext
        ? topUp.reviewedByAdminId
        : undefined,
      confirmedLedgerId: topUp.confirmedLedgerId,
      createdAt: topUp.createdAt.toISOString(),
      updatedAt: topUp.updatedAt.toISOString(),
      reviewedAt: topUp.reviewedAt?.toISOString() ?? null,
      confirmedAt: topUp.confirmedAt?.toISOString() ?? null,
      rejectedAt: topUp.rejectedAt?.toISOString() ?? null,
      cancelledAt: topUp.cancelledAt?.toISOString() ?? null,
      seller: includeAdminContext ? topUp.seller : undefined,
      shop: includeAdminContext ? topUp.shop : undefined,
      reviewedByAdmin: includeAdminContext ? topUp.reviewedByAdmin : undefined,
      confirmedLedger: topUp.confirmedLedger
        ? {
            ...topUp.confirmedLedger,
            amount: topUp.confirmedLedger.amount.toString(),
            balanceBefore: topUp.confirmedLedger.balanceBefore.toString(),
            balanceAfter: topUp.confirmedLedger.balanceAfter.toString(),
            createdAt: topUp.confirmedLedger.createdAt.toISOString(),
          }
        : null,
    };
  }
}
