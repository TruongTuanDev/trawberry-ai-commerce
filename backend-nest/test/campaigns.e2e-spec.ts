/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
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

type StoredProduct = {
  id: string;
  shopId: string;
  wbNmId: bigint;
  wbTitle: string;
  localTitle: string | null;
  brand: string | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  visibility: string | null;
  catalogStatus: string;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  archivedAt: Date | null;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number;
  createdAt: Date;
  updatedAt: Date;
  seoSlug: string | null;
  color: string | null;
  gender: string | null;
  composition: string | null;
  sellerSku: string | null;
  localDescription: string | null;
  wbDescription: string | null;
  categoryId: bigint | null;
  aiTryOnEnabled: boolean;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: { approvalStatus: string };
  };
  category: { id: bigint; name: string; slug: string | null } | null;
  images: Array<{
    id: string;
    localUrl: string | null;
    wbUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sizeName: string | null;
    russianSize: string | null;
    techSize: string | null;
    wbSize: string | null;
    sellerSku: string | null;
    basePrice: Prisma.Decimal | null;
    discountPrice: Prisma.Decimal | null;
    stockQuantity: number;
    lowStockThreshold: number;
    trackInventory: boolean;
    isActive: boolean;
    createdAt: Date;
  }>;
};

type StoredCampaign = {
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
};

type StoredCampaignTarget = {
  id: string;
  campaignId: string;
  productId: string;
  boost: Prisma.Decimal;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('Campaigns (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let products: StoredProduct[];
  let campaigns: StoredCampaign[];
  let targets: StoredCampaignTarget[];

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    product: { findFirst: jest.fn(), findMany: jest.fn() },
    sponsoredCampaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sponsoredCampaignProduct: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
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

    products = [
      buildProduct({
        id: 'product-1',
        shopId: 'shop-1',
        title: 'Summer Dress',
        seoSlug: 'summer-dress',
        catalogStatus: 'PUBLISHED',
        visibility: 'ACTIVE',
      }),
      buildProduct({
        id: 'product-2',
        shopId: 'shop-1',
        title: 'Hidden Draft Dress',
        seoSlug: 'hidden-draft-dress',
        catalogStatus: 'DRAFT',
        visibility: 'ACTIVE',
      }),
      buildProduct({
        id: 'product-3',
        shopId: 'shop-2',
        title: 'Other Shop Coat',
        seoSlug: 'other-shop-coat',
        catalogStatus: 'PUBLISHED',
        visibility: 'ACTIVE',
      }),
    ];

    campaigns = [];
    targets = [];

    prismaMock.user.findUnique.mockImplementation(({ where, include }) => {
      const user = users.find((entry) =>
        where.email
          ? entry.email === String(where.email).toLowerCase()
          : entry.id === where.id,
      );
      if (!user) {
        return Promise.resolve(null);
      }
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
      if (!shop) {
        return Promise.resolve(null);
      }
      if (select?.sellerProfile) {
        return Promise.resolve({
          id: shop.id,
          sellerProfile: { userId: shop.sellerProfile.userId },
        });
      }
      return Promise.resolve(shop);
    });

    prismaMock.product.findFirst.mockImplementation(({ where, select }) => {
      const product =
        products.find(
          (entry) =>
            (!where.id || entry.id === where.id) &&
            (!where.shopId || entry.shopId === where.shopId),
        ) ?? null;
      if (!product) {
        return Promise.resolve(null);
      }
      if (select?.id) {
        return Promise.resolve({ id: product.id });
      }
      return Promise.resolve(product);
    });

    prismaMock.product.findMany.mockImplementation(({ where }) => {
      let rows = [...products];

      if (where?.id?.in) {
        rows = rows.filter((product) => where.id.in.includes(product.id));
      }
      if (where?.shopId) {
        rows = rows.filter((product) => product.shopId === where.shopId);
      }
      if (where?.visibility) {
        rows = rows.filter(
          (product) => product.visibility === where.visibility,
        );
      }
      if (where?.catalogStatus) {
        rows = rows.filter(
          (product) => product.catalogStatus === where.catalogStatus,
        );
      }
      if (where?.archivedAt === null) {
        rows = rows.filter((product) => product.archivedAt === null);
      }
      if (where?.unpublishedAt === null) {
        rows = rows.filter((product) => product.unpublishedAt === null);
      }

      return Promise.resolve(rows);
    });

    prismaMock.sponsoredCampaign.findMany.mockImplementation(({ where }) => {
      return Promise.resolve(
        campaigns
          .filter((campaign) => campaign.shopId === where.shopId)
          .filter(
            (campaign) => !where.status || campaign.status === where.status,
          )
          .filter((campaign) =>
            !where.scenarioTypes?.has
              ? true
              : campaign.scenarioTypes.includes(where.scenarioTypes.has),
          )
          .sort(
            (left, right) =>
              right.updatedAt.getTime() - left.updatedAt.getTime(),
          )
          .map((campaign) => mapCampaignRecord(campaign, products, targets)),
      );
    });

    prismaMock.sponsoredCampaign.findFirst.mockImplementation(({ where }) => {
      const campaign =
        campaigns.find(
          (entry) =>
            (!where.id || entry.id === where.id) &&
            (!where.shopId || entry.shopId === where.shopId) &&
            (!where.status || entry.status === where.status),
        ) ?? null;

      if (!campaign) {
        return Promise.resolve(null);
      }
      return Promise.resolve(mapCampaignRecord(campaign, products, targets));
    });

    prismaMock.sponsoredCampaign.create.mockImplementation(({ data }) => {
      const campaign: StoredCampaign = {
        id: `campaign-${campaigns.length + 1}`,
        shopId: data.shopId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        scenarioTypes: [...data.scenarioTypes],
        startAt: data.startAt ?? null,
        endAt: data.endAt ?? null,
        budgetLimit:
          data.budgetLimit instanceof Prisma.Decimal
            ? data.budgetLimit
            : (data.budgetLimit ?? null),
        billingMode: data.billingMode,
        maxBoost:
          data.maxBoost instanceof Prisma.Decimal
            ? data.maxBoost
            : new Prisma.Decimal(data.maxBoost),
        createdAt: now,
        updatedAt: now,
      };
      campaigns.push(campaign);
      return Promise.resolve(mapCampaignRecord(campaign, products, targets));
    });

    prismaMock.sponsoredCampaign.update.mockImplementation(
      ({ where, data }) => {
        const campaign = campaigns.find((entry) => entry.id === where.id);
        if (!campaign) {
          throw new Error('Campaign not found');
        }
        if (data.name !== undefined) campaign.name = data.name;
        if (data.description !== undefined)
          campaign.description = data.description;
        if (data.status !== undefined) campaign.status = data.status;
        if (data.scenarioTypes !== undefined)
          campaign.scenarioTypes = [...data.scenarioTypes];
        if (data.startAt !== undefined) campaign.startAt = data.startAt;
        if (data.endAt !== undefined) campaign.endAt = data.endAt;
        if (data.budgetLimit !== undefined) {
          campaign.budgetLimit =
            data.budgetLimit instanceof Prisma.Decimal
              ? data.budgetLimit
              : (data.budgetLimit ?? null);
        }
        if (data.billingMode !== undefined)
          campaign.billingMode = data.billingMode;
        if (data.maxBoost !== undefined) {
          campaign.maxBoost =
            data.maxBoost instanceof Prisma.Decimal
              ? data.maxBoost
              : new Prisma.Decimal(data.maxBoost);
        }
        campaign.updatedAt = new Date(now.getTime() + 1000);
        return Promise.resolve(mapCampaignRecord(campaign, products, targets));
      },
    );

    prismaMock.sponsoredCampaignProduct.create.mockImplementation(
      ({ data }) => {
        const target: StoredCampaignTarget = {
          id: `target-${targets.length + 1}`,
          campaignId: data.campaignId,
          productId: data.productId,
          boost:
            data.boost instanceof Prisma.Decimal
              ? data.boost
              : new Prisma.Decimal(data.boost),
          status: data.status,
          createdAt: new Date(now.getTime() + 2000),
          updatedAt: new Date(now.getTime() + 2000),
        };
        targets.push(target);
        return Promise.resolve(target);
      },
    );

    prismaMock.sponsoredCampaignProduct.update.mockImplementation(
      ({ where, data }) => {
        const target = targets.find((entry) => entry.id === where.id);
        if (!target) {
          throw new Error('Target not found');
        }
        if (data.status !== undefined) target.status = data.status;
        if (data.boost !== undefined) {
          target.boost =
            data.boost instanceof Prisma.Decimal
              ? data.boost
              : new Prisma.Decimal(data.boost);
        }
        target.updatedAt = new Date(now.getTime() + 3000);
        return Promise.resolve(target);
      },
    );

    prismaMock.$transaction.mockImplementation(async (callback) => {
      const campaignsSnapshot = campaigns.map(cloneCampaign);
      const targetsSnapshot = targets.map(cloneTarget);
      try {
        return await callback(prismaMock);
      } catch (error) {
        campaigns = campaignsSnapshot;
        targets = targetsSnapshot;
        throw error;
      }
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates, lists, and restricts seller campaigns by shop ownership', async () => {
    const sellerOneToken = await loginAndGetToken(app, 'seller1@example.com');
    const sellerTwoToken = await loginAndGetToken(app, 'seller2@example.com');

    const createdResponse = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .send({
        name: 'Summer visibility push',
        scenarioTypes: ['home', 'similar'],
        maxBoost: 4,
        billingMode: 'none',
      })
      .expect(201);

    const created = readBody<{ id: string; status: string }>(createdResponse);
    expect(created.status).toBe('draft');

    const listResponse = await request(app.getHttpServer())
      .get('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .expect(200);

    const campaignsBody =
      readBody<Array<{ id: string; name: string }>>(listResponse);
    expect(campaignsBody).toHaveLength(1);
    expect(campaignsBody[0]).toEqual(
      expect.objectContaining({
        id: created.id,
        name: 'Summer visibility push',
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${sellerTwoToken}`)
      .expect(403);
  });

  it('adds targets, activates a valid campaign, and keeps billing placeholders non-charging', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Launch dresses',
        scenarioTypes: ['home', 'search'],
        maxBoost: 5,
        budgetLimit: 12000,
        billingMode: 'cpc',
      })
      .expect(201);

    const created = readBody<{ id: string }>(createResponse);

    const targetResponse = await request(app.getHttpServer())
      .post(`/api/seller/shops/shop-1/campaigns/${created.id}/targets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'product-1',
        boost: 3,
      })
      .expect(200);

    expect(
      readBody<{ summary: { activeTargets: number } }>(targetResponse).summary
        .activeTargets,
    ).toBe(1);

    const activatedResponse = await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
      .expect(200);

    const activated = readBody<{
      status: string;
      targets: Array<{ productId: string }>;
      billing: {
        chargingEnabled: boolean;
        spendTracked: boolean;
        notes: string[];
      };
    }>(activatedResponse);

    expect(activated.status).toBe('active');
    expect(activated.targets[0].productId).toBe('product-1');
    expect(activated.billing.chargingEnabled).toBe(false);
    expect(activated.billing.spendTracked).toBe(false);
    expect(activated.billing.notes.join(' ')).toContain('Phase 4.1');
    expect(JSON.stringify(activated)).not.toContain('sellerProfile');
    expect(JSON.stringify(activated)).not.toContain('seller-user-1');
  });

  it('rejects activation without targets and keeps campaign in draft', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'No targets yet',
        scenarioTypes: ['home'],
        maxBoost: 2,
      })
      .expect(201);

    const created = readBody<{ id: string }>(createResponse);

    await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
      .expect(400);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(readBody<{ status: string }>(detailResponse).status).toBe('draft');
  });

  it('rejects invalid dates, invalid product ownership, and invalid boost values', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Broken schedule',
        scenarioTypes: ['home'],
        maxBoost: 4,
        startAt: '2026-06-20T00:00:00.000Z',
        endAt: '2026-06-10T00:00:00.000Z',
      })
      .expect(400);

    const createResponse = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Boost validation',
        scenarioTypes: ['home'],
        maxBoost: 3,
      })
      .expect(201);

    const created = readBody<{ id: string }>(createResponse);

    await request(app.getHttpServer())
      .post(`/api/seller/shops/shop-1/campaigns/${created.id}/targets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'product-3',
        boost: 2,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/seller/shops/shop-1/campaigns/${created.id}/targets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'product-1',
        boost: 4,
      })
      .expect(400);
  });

  it('supports remove/archive flows and rejects invalid status transitions', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/seller/shops/shop-1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Lifecycle test',
        scenarioTypes: ['home'],
        maxBoost: 5,
      })
      .expect(201);

    const created = readBody<{ id: string }>(createResponse);

    await request(app.getHttpServer())
      .post(`/api/seller/shops/shop-1/campaigns/${created.id}/targets`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 'product-1',
        boost: 2,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'paused' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'draft' })
      .expect(400);

    const current = campaigns.find((campaign) => campaign.id === created.id)!;
    const target = targets.find((entry) => entry.campaignId === current.id)!;

    const removeResponse = await request(app.getHttpServer())
      .delete(
        `/api/seller/shops/shop-1/campaigns/${created.id}/targets/${target.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      readBody<{ summary: { removedTargets: number } }>(removeResponse).summary
        .removedTargets,
    ).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/seller/shops/shop-1/campaigns/${created.id}/archive`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/seller/shops/shop-1/campaigns/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should fail' })
      .expect(400);
  });

  it('keeps public recommendation responses backward compatible without campaign leakage', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/recommendations/home?limit=4')
      .expect(200);

    const body = readBody<{
      algorithm: string;
      items: Array<{ product: { id: string; name: string } }>;
      products: Array<{ id: string; name: string }>;
    }>(response);

    expect(body.algorithm).toBe('rule_based_v2');
    expect(body.items[0].product).toEqual(
      expect.objectContaining({
        id: 'product-1',
        name: 'Summer Dress',
      }),
    );
    expect(JSON.stringify(body)).not.toContain('billingMode');
    expect(JSON.stringify(body)).not.toContain('campaignId');
  });
});

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

function buildProduct(input: {
  id: string;
  shopId: string;
  title: string;
  seoSlug: string;
  catalogStatus: string;
  visibility: string;
}): StoredProduct {
  const createdAt = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: input.id,
    shopId: input.shopId,
    wbNmId: BigInt(1000 + Number(input.id.replace(/\D/g, '') || '0')),
    wbTitle: input.title,
    localTitle: input.title,
    brand: 'Trawberry',
    categoryName: 'Dresses',
    sourceCategoryName: 'Dresses',
    visibility: input.visibility,
    catalogStatus: input.catalogStatus,
    publishedAt: input.catalogStatus === 'PUBLISHED' ? createdAt : null,
    unpublishedAt: null,
    archivedAt: null,
    averageRating: new Prisma.Decimal('4.7'),
    feedbackCount: 12,
    createdAt,
    updatedAt: createdAt,
    seoSlug: input.seoSlug,
    color: 'Red',
    gender: 'Women',
    composition: 'Cotton',
    sellerSku: `SKU-${input.id}`,
    localDescription: `${input.title} description`,
    wbDescription: `${input.title} description`,
    categoryId: BigInt(10),
    aiTryOnEnabled: false,
    shop: {
      id: input.shopId,
      name:
        input.shopId === 'shop-1' ? 'Seller One Atelier' : 'Seller Two Studio',
      slug:
        input.shopId === 'shop-1' ? 'seller-one-atelier' : 'seller-two-studio',
      logoUrl: null,
      paymentInstructions: null,
      status: 'ACTIVE',
      sellerProfile: { approvalStatus: 'APPROVED' },
    },
    category: { id: BigInt(10), name: 'Dresses', slug: 'dresses' },
    images: [
      {
        id: `${input.id}-image-1`,
        localUrl: `https://cdn.example.com/${input.id}.jpg`,
        wbUrl: null,
        isMain: true,
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: `${input.id}-variant-1`,
        sizeName: 'M',
        russianSize: '46',
        techSize: 'M',
        wbSize: 'M',
        sellerSku: `SKU-${input.id}-M`,
        basePrice: new Prisma.Decimal('120'),
        discountPrice: new Prisma.Decimal('99'),
        stockQuantity: 8,
        lowStockThreshold: 2,
        trackInventory: true,
        isActive: true,
        createdAt,
      },
    ],
  };
}

function mapCampaignRecord(
  campaign: StoredCampaign,
  products: StoredProduct[],
  targets: StoredCampaignTarget[],
) {
  return {
    ...cloneCampaign(campaign),
    targets: targets
      .filter((target) => target.campaignId === campaign.id)
      .map((target) => ({
        ...cloneTarget(target),
        product: mapCampaignProduct(
          products.find((product) => product.id === target.productId)!,
        ),
      })),
  };
}

function mapCampaignProduct(product: StoredProduct) {
  return {
    id: product.id,
    localTitle: product.localTitle,
    wbTitle: product.wbTitle,
    seoSlug: product.seoSlug,
    brand: product.brand,
    categoryName: product.categoryName,
    catalogStatus: product.catalogStatus,
    visibility: product.visibility,
  };
}

function cloneCampaign(campaign: StoredCampaign): StoredCampaign {
  return {
    ...campaign,
    scenarioTypes: [...campaign.scenarioTypes],
    startAt: campaign.startAt ? new Date(campaign.startAt) : null,
    endAt: campaign.endAt ? new Date(campaign.endAt) : null,
    budgetLimit: campaign.budgetLimit
      ? new Prisma.Decimal(campaign.budgetLimit.toString())
      : null,
    maxBoost: new Prisma.Decimal(campaign.maxBoost.toString()),
    createdAt: new Date(campaign.createdAt),
    updatedAt: new Date(campaign.updatedAt),
  };
}

function cloneTarget(target: StoredCampaignTarget): StoredCampaignTarget {
  return {
    ...target,
    boost: new Prisma.Decimal(target.boost.toString()),
    createdAt: new Date(target.createdAt),
    updatedAt: new Date(target.updatedAt),
  };
}
