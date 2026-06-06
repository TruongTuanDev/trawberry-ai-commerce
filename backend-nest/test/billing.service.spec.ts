/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BillingService } from '../src/modules/billing/billing.service';

type WalletState = {
  id: string;
  shopId: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type LedgerState = {
  id: string;
  walletId: string;
  shopId: string;
  campaignId: string | null;
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
  metadata?: Prisma.JsonValue;
  createdAt: Date;
};

describe('BillingService', () => {
  let service: BillingService;
  let wallets: WalletState[];
  let ledger: LedgerState[];

  const shopIds = ['shop-1'];
  let nowIndex = 0;

  const prismaMock = {
    shop: {
      findUnique: jest.fn(),
    },
    sellerWallet: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    billingLedgerEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    sponsoredCampaign: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(() => {
    wallets = [];
    ledger = [];
    nowIndex = 0;

    prismaMock.shop.findUnique.mockImplementation(({ where }) => {
      if (!shopIds.includes(where.id)) {
        return Promise.resolve(null);
      }
      return Promise.resolve({ id: where.id });
    });

    prismaMock.sellerWallet.findUnique.mockImplementation(({ where }) => {
      return Promise.resolve(
        wallets.find((wallet) => wallet.shopId === where.shopId) ?? null,
      );
    });

    prismaMock.sellerWallet.create.mockImplementation(({ data }) => {
      const now = makeDate(nowIndex++);
      const wallet: WalletState = {
        id: `wallet-${wallets.length + 1}`,
        shopId: data.shopId,
        balance: cloneDecimal(data.balance ?? new Prisma.Decimal(0)),
        reservedBalance: cloneDecimal(
          data.reservedBalance ?? new Prisma.Decimal(0),
        ),
        currency: data.currency,
        status: data.status,
        createdAt: now,
        updatedAt: now,
      };
      wallets.push(wallet);
      return Promise.resolve(wallet);
    });

    prismaMock.sellerWallet.update.mockImplementation(({ where, data }) => {
      const wallet = wallets.find((entry) => entry.id === where.id);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      wallet.balance = cloneDecimal(data.balance ?? wallet.balance);
      wallet.reservedBalance = cloneDecimal(
        data.reservedBalance ?? wallet.reservedBalance,
      );
      wallet.currency = data.currency ?? wallet.currency;
      wallet.updatedAt = makeDate(nowIndex++);
      return Promise.resolve(wallet);
    });

    prismaMock.billingLedgerEntry.create.mockImplementation(
      ({ data, include }) => {
        const entry: LedgerState = {
          id: `ledger-${ledger.length + 1}`,
          walletId: data.walletId,
          shopId: data.shopId,
          campaignId: data.campaignId ?? null,
          type: data.type,
          amount: cloneDecimal(data.amount),
          currency: data.currency,
          balanceBefore: cloneDecimal(data.balanceBefore),
          balanceAfter: cloneDecimal(data.balanceAfter),
          reservedBefore: cloneDecimal(data.reservedBefore),
          reservedAfter: cloneDecimal(data.reservedAfter),
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          description: data.description ?? null,
          metadata: data.metadata,
          createdAt: makeDate(nowIndex++),
        };
        ledger.push(entry);
        return Promise.resolve({
          ...entry,
          campaign: include?.campaign ? null : undefined,
        });
      },
    );

    prismaMock.billingLedgerEntry.findMany.mockImplementation(({ where }) => {
      return Promise.resolve(
        ledger
          .filter(
            (entry) =>
              entry.walletId === where.walletId &&
              entry.shopId === where.shopId,
          )
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          )
          .map((entry) => ({
            ...entry,
            campaign: null,
          })),
      );
    });

    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prismaMock)),
    );
    configServiceMock.get.mockImplementation(
      (name: string) =>
        (
          ({
            BILLING_DEV_TOOLS_ENABLED: 'false',
            BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT: '50000',
          }) as Record<string, string | undefined>
        )[name],
    );

    service = new BillingService(
      prismaMock as never,
      configServiceMock as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('auto creates a wallet for a shop', async () => {
    const wallet = await service.getOrCreateWalletForShop('shop-1');

    expect(wallet).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        balance: '0',
        reservedBalance: '0',
        availableBalance: '0',
        currency: 'RUB',
        status: 'active',
      }),
    );
    expect(wallets).toHaveLength(1);
  });

  it('credits a wallet and creates a ledger entry with correct balances', async () => {
    const result = await service.credit('shop-1', {
      amount: '150.25',
      referenceType: 'manual_top_up',
      description: 'Seed funding',
    });

    expect(result.wallet.balance).toBe('150.25');
    expect(result.wallet.reservedBalance).toBe('0');
    expect(result.entry.type).toBe('credit');
    expect(result.entry.balanceBefore).toBe('0');
    expect(result.entry.balanceAfter).toBe('150.25');
    expect(result.entry.reservedBefore).toBe('0');
    expect(result.entry.reservedAfter).toBe('0');
    expect(result.entry.referenceType).toBe('manual_top_up');
  });

  it('debits a wallet and rejects insufficient debit attempts', async () => {
    await service.credit('shop-1', {
      amount: 100,
    });
    const debit = await service.debit('shop-1', {
      amount: 40,
      description: 'Manual adjustment',
    });

    expect(debit.wallet.balance).toBe('60');
    expect(debit.entry.balanceBefore).toBe('100');
    expect(debit.entry.balanceAfter).toBe('60');

    await expect(
      service.debit('shop-1', {
        amount: 61,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reserves funds, rejects insufficient reserve, and releases reserved balance', async () => {
    await service.credit('shop-1', {
      amount: 120,
    });

    const reserved = await service.reserve('shop-1', {
      amount: 45,
      description: 'Campaign hold',
    });

    expect(reserved.wallet.balance).toBe('120');
    expect(reserved.wallet.reservedBalance).toBe('45');
    expect(reserved.entry.balanceBefore).toBe('120');
    expect(reserved.entry.balanceAfter).toBe('120');
    expect(reserved.entry.reservedBefore).toBe('0');
    expect(reserved.entry.reservedAfter).toBe('45');

    await expect(
      service.reserve('shop-1', {
        amount: 90,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const release = await service.releaseReserved('shop-1', {
      amount: 15,
      description: 'Unused hold',
    });

    expect(release.wallet.reservedBalance).toBe('30');
    expect(release.entry.reservedBefore).toBe('45');
    expect(release.entry.reservedAfter).toBe('30');
  });

  it('refunds a wallet and keeps one ledger entry per mutation in descending order', async () => {
    await service.credit('shop-1', {
      amount: 90,
    });
    await service.reserve('shop-1', {
      amount: 30,
    });
    await service.releaseReserved('shop-1', {
      amount: 10,
    });
    const refund = await service.refund('shop-1', {
      amount: 5,
      referenceType: 'refund',
      referenceId: 'return-1',
    });

    expect(refund.wallet.balance).toBe('95');
    expect(refund.entry.balanceBefore).toBe('90');
    expect(refund.entry.balanceAfter).toBe('95');

    const entries = await service.listLedgerForShop('shop-1');
    expect(entries).toHaveLength(4);
    expect(entries[0].type).toBe('refund');
    expect(entries[0].referenceId).toBe('return-1');
    expect(entries[3].type).toBe('credit');
  });

  it('rejects missing shops', async () => {
    await expect(
      service.getOrCreateWalletForShop('shop-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('credits a wallet through dev funding when enabled and caps the amount', async () => {
    configServiceMock.get.mockImplementation(
      (name: string) =>
        (
          ({
            BILLING_DEV_TOOLS_ENABLED: 'true',
            BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT: '250',
          }) as Record<string, string | undefined>
        )[name],
    );
    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      if (!shopIds.includes(where.id)) {
        return Promise.resolve(null);
      }
      if (select?.sellerProfile) {
        return Promise.resolve({
          id: where.id,
          sellerProfile: { userId: 'seller-user-1' },
        });
      }
      return Promise.resolve({ id: where.id });
    });

    const result = await service.devCreditWallet('shop-1', 120, {
      sub: 'seller-user-1',
      userId: 'seller-user-1',
      email: 'seller1@example.com',
      role: 'SELLER',
    });

    expect(result.wallet.balance).toBe('120');
    expect(result.entry.type).toBe('credit');
    expect(result.entry.referenceType).toBe('dev_demo_funding');
    expect(result.entry.description).toBe('Dev/demo funding');

    await expect(
      service.devCreditWallet('shop-1', 251, {
        sub: 'seller-user-1',
        userId: 'seller-user-1',
        email: 'seller1@example.com',
        role: 'SELLER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects dev funding when disabled or when the shop is owned by another seller', async () => {
    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      if (!shopIds.includes(where.id)) {
        return Promise.resolve(null);
      }
      if (select?.sellerProfile) {
        return Promise.resolve({
          id: where.id,
          sellerProfile: { userId: 'seller-user-2' },
        });
      }
      return Promise.resolve({ id: where.id });
    });

    await expect(
      service.devCreditWallet('shop-1', 50, {
        sub: 'seller-user-1',
        userId: 'seller-user-1',
        email: 'seller1@example.com',
        role: 'SELLER',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    configServiceMock.get.mockImplementation(
      (name: string) =>
        (
          ({
            BILLING_DEV_TOOLS_ENABLED: 'true',
            BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT: '50000',
          }) as Record<string, string | undefined>
        )[name],
    );

    await expect(
      service.devCreditWallet('shop-1', 50, {
        sub: 'seller-user-1',
        userId: 'seller-user-1',
        email: 'seller1@example.com',
        role: 'SELLER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function makeDate(offset: number) {
  return new Date(Date.UTC(2026, 5, 7, 10, 0, offset));
}

function cloneDecimal(value: Prisma.Decimal | number | string) {
  const decimal =
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return new Prisma.Decimal(decimal.toString());
}
