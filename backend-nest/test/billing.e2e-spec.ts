/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { readBody } from './test-helpers';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  fullName: string | null;
  createdAt: Date;
  sellerProfile?: {
    id: string;
    userId: string;
    approvalStatus: string;
    currentShopId: string | null;
  } | null;
};

type StoredShop = {
  id: string;
  sellerProfileId: string;
  name: string;
  slug: string;
  status: string;
  sellerProfile: { userId: string };
};

type StoredWallet = {
  id: string;
  shopId: string;
  balance: Prisma.Decimal;
  reservedBalance: Prisma.Decimal;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredLedger = {
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
  createdAt: Date;
};

describe('Billing (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let wallets: StoredWallet[];
  let ledger: StoredLedger[];
  const originalEnv = { ...process.env };

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
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

  beforeEach(async () => {
    process.env.BILLING_DEV_TOOLS_ENABLED = 'false';
    process.env.BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT = '50000';
    const now = new Date('2026-06-07T10:00:00Z');

    users = [
      {
        id: 'seller-user-1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'SELLER',
        status: 'ACTIVE',
        fullName: 'Seller One',
        createdAt: now,
        sellerProfile: {
          id: 'seller-profile-1',
          userId: 'seller-user-1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'seller-user-2',
        email: 'seller2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        role: 'SELLER',
        status: 'ACTIVE',
        fullName: 'Seller Two',
        createdAt: now,
        sellerProfile: {
          id: 'seller-profile-2',
          userId: 'seller-user-2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'seller-profile-1',
        name: 'Seller One Atelier',
        slug: 'seller-one-atelier',
        status: 'ACTIVE',
        sellerProfile: { userId: 'seller-user-1' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'seller-profile-2',
        name: 'Seller Two Studio',
        slug: 'seller-two-studio',
        status: 'ACTIVE',
        sellerProfile: { userId: 'seller-user-2' },
      },
    ];

    wallets = [];
    ledger = [];

    prismaMock.user.findUnique.mockImplementation(({ where, include }) => {
      const user = users.find((entry) =>
        where.email
          ? entry.email === String(where.email).toLowerCase()
          : entry.id === where.id,
      );
      if (!user) return Promise.resolve(null);
      if (include?.sellerProfile) {
        return Promise.resolve({
          ...user,
          sellerProfile: user.sellerProfile ?? null,
        });
      }
      return Promise.resolve(user);
    });

    prismaMock.shop.findUnique.mockImplementation(({ where, select }) => {
      const shop = shops.find((entry) => entry.id === where.id) ?? null;
      if (!shop) return Promise.resolve(null);
      if (select?.sellerProfile) {
        return Promise.resolve({
          id: shop.id,
          sellerProfile: { userId: shop.sellerProfile.userId },
        });
      }
      return Promise.resolve({ id: shop.id });
    });

    prismaMock.sellerWallet.findUnique.mockImplementation(({ where }) => {
      return Promise.resolve(
        wallets.find((wallet) => wallet.shopId === where.shopId) ?? null,
      );
    });

    prismaMock.sellerWallet.create.mockImplementation(({ data }) => {
      const wallet: StoredWallet = {
        id: `wallet-${wallets.length + 1}`,
        shopId: data.shopId,
        balance: cloneDecimal(data.balance ?? 0),
        reservedBalance: cloneDecimal(data.reservedBalance ?? 0),
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
      wallet.updatedAt = now;
      return Promise.resolve(wallet);
    });

    prismaMock.billingLedgerEntry.findMany.mockImplementation(({ where }) => {
      return Promise.resolve(
        ledger
          .filter(
            (entry) =>
              entry.walletId === where.walletId &&
              entry.shopId === where.shopId,
          )
          .map((entry) => ({
            ...entry,
            campaign: null,
          })),
      );
    });
    prismaMock.billingLedgerEntry.create.mockImplementation(({ data }) => {
      const entry: StoredLedger = {
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
        createdAt: now,
      };
      ledger.push(entry);
      return Promise.resolve({
        ...entry,
        campaign: null,
      });
    });

    prismaMock.sponsoredCampaign.findFirst.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prismaMock)),
    );

    app = await buildTestApp(prismaMock);
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('auto creates a wallet for the owning seller shop and keeps the response safe', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const walletResponse = await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/billing/wallet')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<{
      shopId: string;
      balance: string;
      reservedBalance: string;
      currency: string;
      status: string;
    }>(walletResponse);

    expect(body).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        balance: '0',
        reservedBalance: '0',
        currency: 'RUB',
        status: 'active',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('seller-user-1');
    expect(JSON.stringify(body)).not.toContain('passwordHash');
  });

  it('returns ledger entries only for the owning seller and rejects other shop access', async () => {
    const wallet: StoredWallet = {
      id: 'wallet-1',
      shopId: 'shop-1',
      balance: new Prisma.Decimal('100'),
      reservedBalance: new Prisma.Decimal('20'),
      currency: 'RUB',
      status: 'active',
      createdAt: new Date('2026-06-07T09:00:00Z'),
      updatedAt: new Date('2026-06-07T09:00:00Z'),
    };
    wallets.push(wallet);
    ledger.push({
      id: 'ledger-1',
      walletId: wallet.id,
      shopId: 'shop-1',
      campaignId: null,
      type: 'credit',
      amount: new Prisma.Decimal('100'),
      currency: 'RUB',
      balanceBefore: new Prisma.Decimal('0'),
      balanceAfter: new Prisma.Decimal('100'),
      reservedBefore: new Prisma.Decimal('0'),
      reservedAfter: new Prisma.Decimal('0'),
      referenceType: 'seed',
      referenceId: 'seed-1',
      description: 'Seed wallet',
      createdAt: new Date('2026-06-07T09:05:00Z'),
    });

    const ownerToken = await loginAndGetToken(app, 'seller1@example.com');
    const otherSellerToken = await loginAndGetToken(app, 'seller2@example.com');

    const ledgerResponse = await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/billing/ledger')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body =
      readBody<Array<{ type: string; amount: string; campaign: null }>>(
        ledgerResponse,
      );
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(
      expect.objectContaining({
        type: 'credit',
        amount: '100',
        campaign: null,
      }),
    );
    expect(JSON.stringify(body)).not.toContain('seller-user-1');
    expect(JSON.stringify(body)).not.toContain('metadata');

    await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/billing/wallet')
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .expect(403);
  });

  it('keeps dev credit disabled by default', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/billing/wallet/dev-credit')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100 })
      .expect(404);
  });

  it('credits the owning seller wallet in dev mode and keeps the ledger response safe', async () => {
    process.env.BILLING_DEV_TOOLS_ENABLED = 'true';
    process.env.BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT = '250';
    await app.close();
    app = await buildTestApp(prismaMock);

    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/billing/wallet/dev-credit')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 125.5 })
      .expect(201);

    const body = readBody<{
      wallet: { shopId: string; balance: string; availableBalance: string };
      entry: { type: string; amount: string; description: string | null };
    }>(response);

    expect(body.wallet).toEqual(
      expect.objectContaining({
        shopId: 'shop-1',
        balance: '125.5',
        availableBalance: '125.5',
      }),
    );
    expect(body.entry).toEqual(
      expect.objectContaining({
        type: 'credit',
        amount: '125.5',
        description: 'Dev/demo funding',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('seller-user-1');
    expect(JSON.stringify(body)).not.toContain('metadata');
  });

  it('rejects invalid or oversized dev credit amounts and cannot fund another seller shop', async () => {
    process.env.BILLING_DEV_TOOLS_ENABLED = 'true';
    process.env.BILLING_DEV_TOOLS_MAX_CREDIT_AMOUNT = '100';
    await app.close();
    app = await buildTestApp(prismaMock);

    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/billing/wallet/dev-credit')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/billing/wallet/dev-credit')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 101 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/seller/shops/shop-2/billing/wallet/dev-credit')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50 })
      .expect(403);
  });
});

async function buildTestApp(prismaMock: Record<string, unknown>) {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();

  const nextApp = moduleFixture.createNestApplication();
  nextApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await nextApp.init();
  return nextApp;
}

async function loginAndGetToken(
  app: INestApplication<App>,
  email: string,
  password = 'password123',
) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}

function cloneDecimal(value: Prisma.Decimal | number | string) {
  const decimal =
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return new Prisma.Decimal(decimal.toString());
}
