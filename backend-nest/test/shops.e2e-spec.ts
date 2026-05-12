import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { ShopResponseDto } from '../src/modules/shops/dto/shop-response.dto';
import { readBody } from './test-helpers';

type StoredSellerProfile = {
  id: string;
  userId: string;
  approvalStatus: string;
  currentShopId: string | null;
};

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  status: string;
  createdAt: Date;
  sellerProfile?: StoredSellerProfile | null;
};

type StoredShop = {
  id: string;
  sellerProfileId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactInfo: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolderName: string | null;
  bik: string | null;
  correspondentAccount: string | null;
  paymentInstructions: string | null;
  status: string;
  sellerProfile: {
    userId: string;
  };
  _count: {
    products: number;
  };
};

describe('ShopsController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let sellerProfiles: StoredSellerProfile[];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    sellerProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shop: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const shopOneId = '11111111-1111-1111-1111-111111111111';
  const shopTwoId = '22222222-2222-2222-2222-222222222222';
  const newShopId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    sellerProfiles = [
      {
        id: 'sp1',
        userId: 'user-s1',
        approvalStatus: 'APPROVED',
        currentShopId: shopOneId,
      },
      {
        id: 'sp2',
        userId: 'user-s2',
        approvalStatus: 'APPROVED',
        currentShopId: shopTwoId,
      },
    ];

    users = [
      {
        id: 'user-s1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: sellerProfiles[0],
      },
      {
        id: 'user-s2',
        email: 'seller2@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: sellerProfiles[1],
      },
      {
        id: 'admin-1',
        email: 'admin@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Admin',
        phone: null,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
    ];

    shops = [
      {
        id: shopOneId,
        sellerProfileId: 'sp1',
        name: 'Shop One',
        slug: 'shop-one',
        logoUrl: null,
        contactInfo: 'Telegram: seller1',
        bankName: null,
        accountNumber: null,
        accountHolderName: null,
        bik: null,
        correspondentAccount: null,
        paymentInstructions: null,
        status: 'ACTIVE',
        sellerProfile: {
          userId: 'user-s1',
        },
        _count: {
          products: 3,
        },
      },
      {
        id: shopTwoId,
        sellerProfileId: 'sp2',
        name: 'Shop Two',
        slug: 'shop-two',
        logoUrl: null,
        contactInfo: null,
        bankName: null,
        accountNumber: null,
        accountHolderName: null,
        bik: null,
        correspondentAccount: null,
        paymentInstructions: null,
        status: 'ACTIVE',
        sellerProfile: {
          userId: 'user-s2',
        },
        _count: {
          products: 1,
        },
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        include,
      }: {
        where: { email?: string; id?: string };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
      }) => {
        const found = users.find((user) =>
          where.email
            ? user.email === where.email.toLowerCase()
            : user.id === where.id,
        );
        if (!found) {
          return Promise.resolve(null);
        }
        if (include?.sellerProfile) {
          return Promise.resolve({
            ...found,
            sellerProfile: found.sellerProfile ?? null,
          });
        }
        return Promise.resolve(found);
      },
    );

    prismaMock.sellerProfile.findUnique.mockImplementation(
      ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          sellerProfiles.find((profile) => profile.userId === where.userId) ??
            null,
        ),
    );

    prismaMock.sellerProfile.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: { currentShopId: string };
      }) => {
        const profile = sellerProfiles.find((entry) => entry.id === where.id);
        if (!profile) {
          throw new Error('Seller profile not found');
        }
        profile.currentShopId = data.currentShopId;
        return Promise.resolve(profile);
      },
    );

    prismaMock.shop.findMany.mockImplementation(
      ({ where }: { where?: { sellerProfile?: { userId: string } } }) =>
        Promise.resolve(
          where?.sellerProfile?.userId
            ? shops.filter(
                (shop) =>
                  shop.sellerProfile.userId === where.sellerProfile?.userId,
              )
            : shops,
        ),
    );

    prismaMock.shop.findUnique.mockImplementation(
      ({
        where,
        select,
      }: {
        where: { id?: string; slug?: string };
        select?: {
          id?: true;
          sellerProfile?: {
            select: {
              userId: true;
            };
          };
        };
      }) => {
        const found =
          shops.find((shop) =>
            where.id ? shop.id === where.id : shop.slug === where.slug,
          ) ?? null;

        if (!found) {
          return Promise.resolve(null);
        }

        if (select?.sellerProfile) {
          return Promise.resolve({
            id: found.id,
            sellerProfile: {
              userId: found.sellerProfile.userId,
            },
          });
        }

        if (select?.id) {
          return Promise.resolve({ id: found.id });
        }

        return Promise.resolve(found);
      },
    );

    prismaMock.shop.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          sellerProfileId: string;
          name: string;
          slug: string;
          logoUrl: string | null;
          contactInfo: string | null;
          bankName: string | null;
          accountNumber: string | null;
          accountHolderName: string | null;
          bik: string | null;
          correspondentAccount: string | null;
          paymentInstructions: string | null;
          status: string;
        };
      }) => {
        const sellerProfile = sellerProfiles.find(
          (profile) => profile.id === data.sellerProfileId,
        );
        if (!sellerProfile) {
          throw new Error('Seller profile not found');
        }

        const created: StoredShop = {
          id: newShopId,
          sellerProfileId: data.sellerProfileId,
          name: data.name,
          slug: data.slug,
          logoUrl: data.logoUrl,
          contactInfo: data.contactInfo,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountHolderName: data.accountHolderName,
          bik: data.bik,
          correspondentAccount: data.correspondentAccount,
          paymentInstructions: data.paymentInstructions,
          status: data.status,
          sellerProfile: {
            userId: sellerProfile.userId,
          },
          _count: {
            products: 0,
          },
        };
        shops.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) =>
        Promise.resolve(callback(prismaMock)),
    );

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
    jest.clearAllMocks();
  });

  it('lists shops accessible to the current seller', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/shops')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<ShopResponseDto[]>(response);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(shopOneId);
    expect(body[0].productCount).toBe(3);
  });

  it('returns one accessible shop by id', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get(`/api/shops/${shopOneId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = readBody<ShopResponseDto>(response);
    expect(body.id).toBe(shopOneId);
    expect(body.slug).toBe('shop-one');
    expect(body.contactInfo).toBe('Telegram: seller1');
  });

  it('creates a new shop for an approved seller and activates it', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Shop',
        slug: 'new-shop',
        contactInfo: 'WhatsApp',
      })
      .expect(201);

    const body = readBody<ShopResponseDto>(response);
    expect(body.id).toBe(newShopId);
    expect(body.slug).toBe('new-shop');
    expect(body.status).toBe('ACTIVE');
    expect(
      sellerProfiles.find((profile) => profile.id === 'sp1')?.currentShopId,
    ).toBe(newShopId);
  });

  it('forbids access to another seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .get(`/api/shops/${shopTwoId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password: 'password123',
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
