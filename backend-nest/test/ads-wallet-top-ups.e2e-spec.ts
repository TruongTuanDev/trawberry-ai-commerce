/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AdsWalletTopUpsService } from '../src/modules/billing/ads-wallet-top-ups.service';
import { BillingService } from '../src/modules/billing/billing.service';

type TopUpState = {
  id: string;
  sellerId: string;
  requestedBySellerId: string;
  shopId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: string;
  transferReference: string | null;
  proofUrl: string | null;
  sellerNote: string | null;
  adminNote: string | null;
  rejectionReason: string | null;
  reviewedByAdminId: string | null;
  confirmedLedgerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  confirmedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
};

describe('AdsWalletTopUpsService (e2e contract)', () => {
  let service: AdsWalletTopUpsService;
  let topUps: TopUpState[];
  let auditLogs: unknown[];
  let walletBalance: Prisma.Decimal;

  const prismaMock = {
    shop: { findFirst: jest.fn() },
    adsWalletTopUpRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const billingServiceMock = {
    getOrCreateWalletForShop: jest.fn(),
    applyMutationInTransaction: jest.fn(),
  };
  const configServiceMock = { get: jest.fn() };

  beforeEach(() => {
    topUps = [];
    auditLogs = [];
    walletBalance = new Prisma.Decimal(0);

    prismaMock.shop.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.id === 'shop-1' && where.sellerProfile.userId === 'seller-1'
          ? { id: 'shop-1' }
          : null,
      ),
    );
    prismaMock.adsWalletTopUpRequest.create.mockImplementation(({ data }) => {
      const topUp = makeTopUp({
        id: `top-up-${topUps.length + 1}`,
        ...data,
      });
      topUps.push(topUp);
      return Promise.resolve(enrich(topUp));
    });
    prismaMock.adsWalletTopUpRequest.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        topUps
          .filter(
            (item) =>
              (!where.shopId || item.shopId === where.shopId) &&
              (!where.sellerId || item.sellerId === where.sellerId) &&
              (!where.status || item.status === where.status),
          )
          .map(enrich),
      ),
    );
    prismaMock.adsWalletTopUpRequest.findFirst.mockImplementation(
      ({ where }) => {
        const topUp =
          topUps.find(
            (item) =>
              item.id === where.id &&
              item.shopId === where.shopId &&
              item.sellerId === where.sellerId,
          ) ?? null;
        return Promise.resolve(topUp ? enrich(topUp) : null);
      },
    );
    prismaMock.adsWalletTopUpRequest.findUnique.mockImplementation(
      ({ where }) => {
        const topUp = topUps.find((item) => item.id === where.id) ?? null;
        return Promise.resolve(topUp ? enrich(topUp) : null);
      },
    );
    prismaMock.adsWalletTopUpRequest.update.mockImplementation(
      ({ where, data }) => {
        const topUp = findState(topUps, where.id);
        Object.assign(topUp, removeUndefined(data), { updatedAt: now() });
        return Promise.resolve(enrich(topUp));
      },
    );
    prismaMock.adsWalletTopUpRequest.updateMany.mockImplementation(
      ({ where, data }) => {
        const topUp = topUps.find(
          (item) =>
            item.id === where.id &&
            (!where.shopId || item.shopId === where.shopId) &&
            (!where.sellerId || item.sellerId === where.sellerId) &&
            (!where.status || item.status === where.status),
        );
        if (!topUp) return Promise.resolve({ count: 0 });
        Object.assign(topUp, removeUndefined(data), { updatedAt: now() });
        return Promise.resolve({ count: 1 });
      },
    );
    prismaMock.adminAuditLog.create.mockImplementation(({ data }) => {
      auditLogs.push(data);
      return Promise.resolve(data);
    });
    prismaMock.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prismaMock)),
    );

    billingServiceMock.getOrCreateWalletForShop.mockResolvedValue({
      shopId: 'shop-1',
      currency: 'RUB',
      balance: '0',
    });
    billingServiceMock.applyMutationInTransaction.mockImplementation(
      (_tx, shopId, input) => {
        const amount = new Prisma.Decimal(input.amount);
        const before = walletBalance;
        walletBalance = walletBalance.plus(amount);
        return Promise.resolve({
          wallet: { shopId, balance: walletBalance.toString() },
          entry: {
            id: `ledger-${billingServiceMock.applyMutationInTransaction.mock.calls.length}`,
            type: 'credit',
            amount: amount.toString(),
            currency: input.currency,
            balanceBefore: before.toString(),
            balanceAfter: walletBalance.toString(),
          },
        });
      },
    );
    configServiceMock.get.mockImplementation((name: string) => {
      if (name === 'ADS_MANUAL_TOP_UP_ENABLED') return 'true';
      if (name === 'ADS_TOP_UP_TRANSFER_INSTRUCTIONS') {
        return 'Use the request id as the transfer comment.';
      }
      return undefined;
    });

    service = new AdsWalletTopUpsService(
      prismaMock as never,
      billingServiceMock as unknown as BillingService,
      configServiceMock as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates, lists, updates, and cancels only the seller owned pending request', async () => {
    const created = await service.createForSeller('shop-1', 'seller-1', {
      amount: 2500,
      currency: 'RUB',
      transferReference: ' TRANSFER-1 ',
      sellerNote: ' Company transfer ',
    });
    expect(created).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        sellerId: 'seller-1',
        amount: '2500',
        status: 'pending',
        transferReference: 'TRANSFER-1',
      }),
    );

    const list = await service.listForSeller('shop-1', 'seller-1', {});
    expect(list.pendingTotal).toBe('2500');
    expect(list.transferInstructions.configured).toBe(true);
    expect(list.items).toHaveLength(1);

    await service.updateForSeller('shop-1', 'seller-1', created.id, {
      proofUrl: 'https://example.com/proof/1',
    });
    const cancelled = await service.cancelForSeller(
      'shop-1',
      'seller-1',
      created.id,
    );
    expect(cancelled.status).toBe('cancelled');

    await expect(
      service.cancelForSeller('shop-1', 'seller-1', created.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.listForSeller('shop-1', 'seller-2', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirms once, links one ledger credit, and returns safely on repeated confirm', async () => {
    topUps.push(makeTopUp({ id: 'top-up-1', amount: new Prisma.Decimal(125) }));

    const confirmed = await service.confirmForAdmin('top-up-1', 'admin-1', {
      adminNote: 'Matched',
    });
    const repeated = await service.confirmForAdmin('top-up-1', 'admin-1', {});

    expect(confirmed.status).toBe('confirmed');
    expect(repeated.status).toBe('confirmed');
    expect(walletBalance.toString()).toBe('125');
    expect(billingServiceMock.applyMutationInTransaction).toHaveBeenCalledTimes(
      1,
    );
    expect(topUps[0].confirmedLedgerId).toBe('ledger-1');
    expect(auditLogs).toHaveLength(1);
    await expect(
      service.updateForSeller('shop-1', 'seller-1', 'top-up-1', {
        sellerNote: 'Too late to edit',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects without crediting and never confirms rejected or cancelled requests', async () => {
    topUps.push(makeTopUp({ id: 'top-up-reject' }));
    topUps.push(makeTopUp({ id: 'top-up-cancel', status: 'cancelled' }));

    const rejected = await service.rejectForAdmin('top-up-reject', 'admin-1', {
      reason: 'Transfer could not be matched.',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Transfer could not be matched.');
    expect(walletBalance.toString()).toBe('0');
    expect(
      billingServiceMock.applyMutationInTransaction,
    ).not.toHaveBeenCalled();

    await expect(
      service.confirmForAdmin('top-up-reject', 'admin-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.confirmForAdmin('top-up-cancel', 'admin-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hides the workflow when the manual top-up feature flag is disabled', async () => {
    configServiceMock.get.mockReturnValue('false');
    await expect(service.listForAdmin({})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function makeTopUp(overrides: Partial<TopUpState>): TopUpState {
  return {
    id: 'top-up-1',
    sellerId: 'seller-1',
    requestedBySellerId: 'seller-1',
    shopId: 'shop-1',
    amount: new Prisma.Decimal(100),
    currency: 'RUB',
    status: 'pending',
    transferReference: null,
    proofUrl: null,
    sellerNote: null,
    adminNote: null,
    rejectionReason: null,
    reviewedByAdminId: null,
    confirmedLedgerId: null,
    createdAt: now(),
    updatedAt: now(),
    reviewedAt: null,
    confirmedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

function enrich(topUp: TopUpState) {
  return {
    ...topUp,
    seller: {
      id: topUp.sellerId,
      email: `${topUp.sellerId}@example.com`,
      fullName: 'Seller One',
    },
    shop: {
      id: topUp.shopId,
      name: 'Seller One Shop',
      slug: 'seller-one-shop',
    },
    reviewedByAdmin: topUp.reviewedByAdminId
      ? {
          id: topUp.reviewedByAdminId,
          email: 'admin@example.com',
          fullName: 'Admin',
        }
      : null,
    confirmedLedger: topUp.confirmedLedgerId
      ? {
          id: topUp.confirmedLedgerId,
          type: 'credit',
          amount: topUp.amount,
          currency: topUp.currency,
          balanceBefore: new Prisma.Decimal(0),
          balanceAfter: topUp.amount,
          description: 'Manual ads wallet top-up confirmed',
          createdAt: now(),
        }
      : null,
  };
}

function findState(items: TopUpState[], id: string) {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing top-up ${id}`);
  return item;
}

function removeUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function now() {
  return new Date('2026-06-11T10:00:00.000Z');
}
