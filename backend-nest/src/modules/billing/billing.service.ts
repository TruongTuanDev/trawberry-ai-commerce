import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;
type BillingPrismaExecutor = PrismaExecutor & {
  shop: PrismaService['shop'];
  sellerWallet: PrismaService['sellerWallet'];
  billingLedgerEntry: PrismaService['billingLedgerEntry'];
  sponsoredCampaign: PrismaService['sponsoredCampaign'];
};

type BillingMutationType =
  | 'credit'
  | 'debit'
  | 'reserve'
  | 'release'
  | 'refund'
  | 'adjustment';

type BillingMutationInput = {
  type: BillingMutationType;
  amount: number | string | Prisma.Decimal;
  currency?: string;
  campaignId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
  allowNegativeBalance?: boolean;
};

type WalletRecord = {
  id: string;
  shopId: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type LedgerRecord = {
  id: string;
  walletId: string;
  shopId: string;
  type: string;
  amount: Prisma.Decimal;
  currency: string;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  reservedBefore: Prisma.Decimal;
  reservedAfter: Prisma.Decimal;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
  campaign: {
    id: string;
    name: string;
  } | null;
};

const DEFAULT_CURRENCY = 'RUB';
const MUTABLE_WALLET_STATUSES = new Set(['active']);

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private asBillingExecutor(prisma: PrismaExecutor): BillingPrismaExecutor {
    return prisma;
  }

  async getOrCreateWalletForShop(shopId: string) {
    const wallet = await this.prisma.$transaction(async (tx) => {
      return this.getOrCreateWalletRecord(shopId, tx);
    });

    return this.mapWallet(wallet);
  }

  async listLedgerForShop(shopId: string) {
    const wallet = await this.prisma.$transaction(async (tx) => {
      return this.getOrCreateWalletRecord(shopId, tx);
    });

    const ledger = await this.prisma.billingLedgerEntry.findMany({
      where: {
        walletId: wallet.id,
        shopId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return ledger.map((entry) => this.mapLedgerEntry(entry));
  }

  async credit(shopId: string, input: Omit<BillingMutationInput, 'type'>) {
    return this.applyMutation(shopId, {
      ...input,
      type: 'credit',
    });
  }

  async debit(shopId: string, input: Omit<BillingMutationInput, 'type'>) {
    return this.applyMutation(shopId, {
      ...input,
      type: 'debit',
    });
  }

  async reserve(shopId: string, input: Omit<BillingMutationInput, 'type'>) {
    return this.applyMutation(shopId, {
      ...input,
      type: 'reserve',
    });
  }

  async releaseReserved(
    shopId: string,
    input: Omit<BillingMutationInput, 'type'>,
  ) {
    return this.applyMutation(shopId, {
      ...input,
      type: 'release',
    });
  }

  async refund(shopId: string, input: Omit<BillingMutationInput, 'type'>) {
    return this.applyMutation(shopId, {
      ...input,
      type: 'refund',
    });
  }

  async applyMutationInTransaction(
    prisma: PrismaExecutor,
    shopId: string,
    input: BillingMutationInput,
  ) {
    const amount = this.toMoney(input.amount);
    if (amount.lte(0)) {
      throw new BadRequestException(
        'Billing amount must be greater than zero.',
      );
    }

    const tx = this.asBillingExecutor(prisma);
    const wallet = await this.getOrCreateWalletRecord(shopId, tx);
    this.assertWalletMutable(wallet.status);

    if (
      input.campaignId &&
      !(await this.belongsToShopCampaign(shopId, input.campaignId, tx))
    ) {
      throw new BadRequestException(
        `Campaign ${input.campaignId} does not belong to shop ${shopId}.`,
      );
    }

    const currency = (input.currency ?? wallet.currency).trim().toUpperCase();
    if (currency !== wallet.currency) {
      throw new BadRequestException(
        `Wallet currency ${wallet.currency} does not match requested currency ${currency}.`,
      );
    }

    const balanceBefore = new Prisma.Decimal(wallet.balance.toString());
    const reservedBefore = new Prisma.Decimal(
      wallet.reservedBalance.toString(),
    );
    const availableBefore = balanceBefore.minus(reservedBefore);

    let balanceAfter = balanceBefore;
    let reservedAfter = reservedBefore;

    switch (input.type) {
      case 'credit':
      case 'refund':
      case 'adjustment':
        balanceAfter = balanceBefore.plus(amount);
        break;
      case 'debit':
        if (!input.allowNegativeBalance && availableBefore.lt(amount)) {
          throw new BadRequestException('Insufficient available balance.');
        }
        balanceAfter = balanceBefore.minus(amount);
        break;
      case 'reserve':
        if (availableBefore.lt(amount)) {
          throw new BadRequestException(
            'Insufficient available balance to reserve funds.',
          );
        }
        reservedAfter = reservedBefore.plus(amount);
        break;
      case 'release':
        if (reservedBefore.lt(amount)) {
          throw new BadRequestException(
            'Cannot release more than the reserved balance.',
          );
        }
        reservedAfter = reservedBefore.minus(amount);
        break;
      default:
        throw new BadRequestException('Unsupported billing mutation type.');
    }

    if (!input.allowNegativeBalance && balanceAfter.lt(0)) {
      throw new BadRequestException('Wallet balance cannot be negative.');
    }
    if (reservedAfter.lt(0)) {
      throw new BadRequestException(
        'Reserved wallet balance cannot be negative.',
      );
    }
    if (balanceAfter.minus(reservedAfter).lt(0)) {
      throw new BadRequestException(
        'Reserved balance cannot exceed total wallet balance.',
      );
    }

    const nextWallet = await tx.sellerWallet.update({
      where: { id: wallet.id },
      data: {
        balance: balanceAfter,
        reservedBalance: reservedAfter,
        currency,
      },
    });

    const entry = await tx.billingLedgerEntry.create({
      data: {
        walletId: wallet.id,
        shopId,
        campaignId: input.campaignId ?? null,
        type: input.type,
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        reservedBefore,
        reservedAfter,
        referenceType: input.referenceType?.trim() || null,
        referenceId: input.referenceId?.trim() || null,
        description: input.description?.trim() || null,
        metadata: input.metadata,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      wallet: this.mapWallet(nextWallet),
      entry: this.mapLedgerEntry(entry),
    };
  }

  private async applyMutation(shopId: string, input: BillingMutationInput) {
    return this.prisma.$transaction((tx) =>
      this.applyMutationInTransaction(tx, shopId, input),
    );
  }

  private async belongsToShopCampaign(
    shopId: string,
    campaignId: string,
    prisma: PrismaExecutor,
  ) {
    const billingPrisma = this.asBillingExecutor(prisma);
    const campaign = await billingPrisma.sponsoredCampaign.findFirst({
      where: {
        id: campaignId,
        shopId,
      },
      select: {
        id: true,
      },
    });

    return Boolean(campaign);
  }

  private async getOrCreateWalletRecord(
    shopId: string,
    prisma: PrismaExecutor,
  ): Promise<WalletRecord> {
    const billingPrisma = this.asBillingExecutor(prisma);
    const existing = await billingPrisma.sellerWallet.findUnique({
      where: { shopId },
    });
    if (existing) {
      return existing;
    }

    const shop = await billingPrisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      throw new NotFoundException(`Shop ${shopId} was not found.`);
    }

    return billingPrisma.sellerWallet.create({
      data: {
        shopId,
        balance: new Prisma.Decimal(0),
        reservedBalance: new Prisma.Decimal(0),
        currency: DEFAULT_CURRENCY,
        status: 'active',
      },
    });
  }

  private assertWalletMutable(status: string) {
    if (!MUTABLE_WALLET_STATUSES.has(status)) {
      throw new BadRequestException(
        `Wallet status ${status} does not allow billing mutations.`,
      );
    }
  }

  private toMoney(value: number | string | Prisma.Decimal) {
    const decimal =
      value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
    return new Prisma.Decimal(decimal.toDecimalPlaces(2).toString());
  }

  private mapWallet(wallet: WalletRecord) {
    return {
      id: wallet.id,
      shopId: wallet.shopId,
      balance: wallet.balance.toString(),
      reservedBalance: wallet.reservedBalance.toString(),
      availableBalance: wallet.balance.minus(wallet.reservedBalance).toString(),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  private mapLedgerEntry(entry: LedgerRecord) {
    return {
      id: entry.id,
      walletId: entry.walletId,
      shopId: entry.shopId,
      type: entry.type,
      amount: entry.amount.toString(),
      currency: entry.currency,
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      reservedBefore: entry.reservedBefore.toString(),
      reservedAfter: entry.reservedAfter.toString(),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      campaign: entry.campaign
        ? {
            id: entry.campaign.id,
            name: entry.campaign.name,
          }
        : null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
