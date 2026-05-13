import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { ProductDetailResponseDto } from '../src/modules/products/dto/product-detail-response.dto';
import { ProductInventoryResponseDto } from '../src/modules/products/dto/product-inventory-response.dto';
import { PaginatedProductsResponseDto } from '../src/modules/products/dto/paginated-products-response.dto';
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
  status: string;
  logoUrl: string | null;
  sellerProfile: {
    userId: string;
  };
};

type StoredCategory = {
  id: bigint;
  name: string;
};

type StoredProduct = {
  id: string;
  shopId: string;
  wbNmId: bigint;
  wbImtId: bigint | null;
  wbNmUuid: string | null;
  brand: string | null;
  wbTitle: string;
  wbDescription: string | null;
  categoryName: string | null;
  wbVendorCode: string | null;
  wbVideoUrl: string | null;
  wbCreatedAt: Date | null;
  wbUpdatedAt: Date | null;
  wbNeedKiz: boolean | null;
  subjectId: bigint | null;
  categoryId: bigint | null;
  wholesaleEnabled: boolean | null;
  wholesaleQuantum: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  weightBrutto: number | null;
  dimensionsValid: boolean | null;
  localTitle: string | null;
  localDescription: string | null;
  seoSlug: string | null;
  visibility: string | null;
  localTags: string[] | null;
  averageRating: { toString(): string } | null;
  feedbackCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: StoredCategory | null;
  shop: {
    id: string;
    name: string;
    slug: string;
  };
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean | null;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    chrtId: bigint;
    techSize: string | null;
    wbSize: string | null;
    basePrice: { toString(): string } | null;
    discountPrice: { toString(): string } | null;
    stockQuantity: number;
    reservedStock: number;
    lowStockThreshold: number;
    trackInventory: boolean;
  }>;
};

type ProductCreateInput = {
  shopId: string;
  wbNmId: bigint;
  wbImtId?: bigint | null;
  wbNmUuid?: string | null;
  brand?: string | null;
  wbTitle: string;
  wbDescription?: string | null;
  categoryName?: string | null;
  wbVendorCode?: string | null;
  wbVideoUrl?: string | null;
  wbNeedKiz?: boolean | null;
  subjectId?: bigint | null;
  categoryId?: bigint | null;
  wholesaleEnabled?: boolean | null;
  wholesaleQuantum?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weightBrutto?: number | null;
  dimensionsValid?: boolean | null;
  localTitle?: string | null;
  localDescription?: string | null;
  seoSlug?: string | null;
  visibility?: string | null;
  localTags?: string[] | null;
  images?: {
    create?: Array<{
      wbUrl: string;
      localUrl?: string | null;
      isMain?: boolean | null;
      sortOrder?: number;
    }>;
  };
};

type ProductUpdateInput = Partial<ProductCreateInput>;

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let categories: StoredCategory[];
  let products: StoredProduct[];

  const decimal = (value: string) => ({
    toString: () => value,
  });

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    sellerProfile: {
      create: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
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
        sellerProfile: {
          id: 'sp1',
          userId: 'user-s1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
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
        sellerProfile: {
          id: 'sp2',
          userId: 'user-s2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'sp1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        logoUrl: null,
        sellerProfile: {
          userId: 'user-s1',
        },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        logoUrl: null,
        sellerProfile: {
          userId: 'user-s2',
        },
      },
    ];

    categories = [
      {
        id: 10n,
        name: 'Sneakers',
      },
    ];

    products = [
      {
        id: 'prod-1',
        shopId: 'shop-1',
        wbNmId: 1001n,
        wbImtId: null,
        wbNmUuid: null,
        brand: 'Brand A',
        wbTitle: 'WB Alpha',
        wbDescription: 'Alpha description',
        categoryName: 'Sneakers',
        wbVendorCode: 'A-1',
        wbVideoUrl: null,
        wbCreatedAt: null,
        wbUpdatedAt: null,
        wbNeedKiz: false,
        subjectId: 10n,
        categoryId: 10n,
        wholesaleEnabled: false,
        wholesaleQuantum: null,
        length: null,
        width: null,
        height: null,
        weightBrutto: null,
        dimensionsValid: false,
        localTitle: 'Alpha Local',
        localDescription: 'Seller copy',
        seoSlug: 'alpha-local',
        visibility: 'ACTIVE',
        localTags: ['featured'],
        averageRating: decimal('4.50'),
        feedbackCount: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: categories[0],
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          slug: 'shop-one',
        },
        images: [
          {
            id: 'img-1',
            wbUrl: 'https://example.com/a.jpg',
            localUrl: null,
            isMain: true,
            sortOrder: 0,
          },
        ],
        variants: [
          {
            id: 'var-1',
            chrtId: 2001n,
            techSize: '42',
            wbSize: '42',
            basePrice: decimal('99.99'),
            discountPrice: decimal('89.99'),
            stockQuantity: 5,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
          },
        ],
      },
      {
        id: 'prod-2',
        shopId: 'shop-1',
        wbNmId: 1002n,
        wbImtId: null,
        wbNmUuid: null,
        brand: 'Brand A',
        wbTitle: 'WB Beta',
        wbDescription: 'Beta description',
        categoryName: 'Sneakers',
        wbVendorCode: 'A-2',
        wbVideoUrl: null,
        wbCreatedAt: null,
        wbUpdatedAt: null,
        wbNeedKiz: false,
        subjectId: 10n,
        categoryId: 10n,
        wholesaleEnabled: false,
        wholesaleQuantum: null,
        length: null,
        width: null,
        height: null,
        weightBrutto: null,
        dimensionsValid: false,
        localTitle: null,
        localDescription: null,
        seoSlug: 'wb-beta',
        visibility: 'INACTIVE',
        localTags: null,
        averageRating: decimal('0'),
        feedbackCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: categories[0],
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          slug: 'shop-one',
        },
        images: [],
        variants: [
          {
            id: 'var-2',
            chrtId: 2002n,
            techSize: '43',
            wbSize: '43',
            basePrice: decimal('129.99'),
            discountPrice: null,
            stockQuantity: 0,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
          },
        ],
      },
      {
        id: 'prod-3',
        shopId: 'shop-2',
        wbNmId: 2001n,
        wbImtId: null,
        wbNmUuid: null,
        brand: 'Brand B',
        wbTitle: 'WB Gamma',
        wbDescription: 'Gamma description',
        categoryName: 'Sneakers',
        wbVendorCode: 'B-1',
        wbVideoUrl: null,
        wbCreatedAt: null,
        wbUpdatedAt: null,
        wbNeedKiz: false,
        subjectId: 10n,
        categoryId: 10n,
        wholesaleEnabled: false,
        wholesaleQuantum: null,
        length: null,
        width: null,
        height: null,
        weightBrutto: null,
        dimensionsValid: false,
        localTitle: 'Gamma Local',
        localDescription: null,
        seoSlug: 'gamma-local',
        visibility: 'ACTIVE',
        localTags: null,
        averageRating: decimal('0'),
        feedbackCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: categories[0],
        shop: {
          id: 'shop-2',
          name: 'Shop Two',
          slug: 'shop-two',
        },
        images: [],
        variants: [
          {
            id: 'var-3',
            chrtId: 3001n,
            techSize: '44',
            wbSize: '44',
            basePrice: decimal('79.99'),
            discountPrice: null,
            stockQuantity: 10,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
          },
        ],
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      async ({
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

    prismaMock.shop.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(shops.find((shop) => shop.id === where.id) ?? null),
    );

    prismaMock.category.findUnique.mockImplementation(
      ({ where }: { where: { id: bigint } }) =>
        Promise.resolve(
          categories.find((category) => category.id === where.id) ?? null,
        ),
    );

    prismaMock.product.findMany.mockImplementation(
      ({
        where,
        skip = 0,
        take = products.length,
      }: {
        where: Record<string, unknown>;
        skip?: number;
        take?: number;
      }) =>
        Promise.resolve(
          filterProducts(products, where).slice(skip, skip + take),
        ),
    );

    prismaMock.product.count.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(filterProducts(products, where).length),
    );

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(filterProducts(products, where)[0] ?? null),
    );

    prismaMock.product.create.mockImplementation(
      ({ data }: { data: ProductCreateInput }) => {
        const category = data.categoryId
          ? (categories.find((entry) => entry.id === data.categoryId) ?? null)
          : null;
        const shop = shops.find((entry) => entry.id === data.shopId);
        if (!shop) {
          throw new Error('Shop not found');
        }

        const created: StoredProduct = {
          id: `prod-${products.length + 1}`,
          shopId: data.shopId,
          wbNmId: data.wbNmId,
          wbImtId: data.wbImtId ?? null,
          wbNmUuid: data.wbNmUuid ?? null,
          brand: data.brand ?? null,
          wbTitle: data.wbTitle,
          wbDescription: data.wbDescription ?? null,
          categoryName: data.categoryName ?? null,
          wbVendorCode: data.wbVendorCode ?? null,
          wbVideoUrl: data.wbVideoUrl ?? null,
          wbCreatedAt: null,
          wbUpdatedAt: null,
          wbNeedKiz: data.wbNeedKiz ?? false,
          subjectId: data.subjectId ?? null,
          categoryId: data.categoryId ?? null,
          wholesaleEnabled: data.wholesaleEnabled ?? false,
          wholesaleQuantum: data.wholesaleQuantum ?? null,
          length: data.length ?? null,
          width: data.width ?? null,
          height: data.height ?? null,
          weightBrutto: data.weightBrutto ?? null,
          dimensionsValid: data.dimensionsValid ?? false,
          localTitle: data.localTitle ?? null,
          localDescription: data.localDescription ?? null,
          seoSlug: data.seoSlug ?? null,
          visibility: data.visibility ?? 'ACTIVE',
          localTags: data.localTags ?? null,
          averageRating: decimal('0'),
          feedbackCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          category,
          shop: {
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
          },
          images:
            data.images?.create?.map((image, index: number) => ({
              id: `img-created-${index + 1}`,
              wbUrl: image.wbUrl,
              localUrl: image.localUrl ?? null,
              isMain: image.isMain ?? index === 0,
              sortOrder: image.sortOrder ?? index,
            })) ?? [],
          variants: [],
        };

        products.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.product.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: ProductUpdateInput;
      }) => {
        const index = products.findIndex((product) => product.id === where.id);
        if (index === -1) {
          throw new Error('Product not found');
        }

        const existing = products[index];
        const category =
          data.categoryId === undefined
            ? existing.category
            : (categories.find((entry) => entry.id === data.categoryId) ??
              null);

        const updated: StoredProduct = {
          ...existing,
          ...Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
          categoryId:
            data.categoryId !== undefined
              ? data.categoryId
              : existing.categoryId,
          category,
          updatedAt: new Date(),
        };

        products[index] = updated;
        return Promise.resolve(updated);
      },
    );

    prismaMock.product.delete.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const index = products.findIndex((product) => product.id === where.id);
        if (index === -1) {
          throw new Error('Product not found');
        }

        const [deleted] = products.splice(index, 1);
        return Promise.resolve(deleted);
      },
    );

    prismaMock.productVariant.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: { stockQuantity?: number };
      }) => {
        for (const product of products) {
          const variant = product.variants.find(
            (entry) => entry.id === where.id,
          );
          if (!variant) {
            continue;
          }

          if (data.stockQuantity !== undefined) {
            variant.stockQuantity = data.stockQuantity;
          }

          return Promise.resolve(variant);
        }

        throw new Error('Variant not found');
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

  it('lists products with pagination and status filter', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?page=1&size=1&status=ACTIVE')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<PaginatedProductsResponseDto>(response);

    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('prod-1');
    expect(body.meta.total).toBe(1);
    expect(body.meta.page).toBe(1);
    expect(body.meta.size).toBe(1);
  });

  it('filters products by stock status', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const sellerTwoToken = await loginAndGetToken(app, 'seller2@example.com');

    products.push({
      ...products[0],
      id: 'prod-4',
      wbNmId: 1004n,
      wbTitle: 'WB Delta',
      localTitle: 'Delta Local',
      seoSlug: 'delta-local',
      wbVendorCode: 'A-4',
      variants: [
        {
          id: 'var-4',
          chrtId: 2004n,
          techSize: '45',
          wbSize: '45',
          basePrice: decimal('88.00'),
          discountPrice: null,
          stockQuantity: 2,
          reservedStock: 0,
          lowStockThreshold: 5,
          trackInventory: true,
        },
      ],
    });

    const outOfStockResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?stockStatus=OUT_OF_STOCK')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const outOfStockBody =
      readBody<PaginatedProductsResponseDto>(outOfStockResponse);

    expect(outOfStockBody.items).toHaveLength(1);
    expect(outOfStockBody.items[0].id).toBe('prod-2');
    expect(outOfStockBody.items[0].stockStatus).toBe('OUT_OF_STOCK');

    const lowStockResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?stockStatus=LOW_STOCK')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const lowStockBody =
      readBody<PaginatedProductsResponseDto>(lowStockResponse);

    expect(lowStockBody.items).toHaveLength(2);
    expect(lowStockBody.items.map((item) => item.id).sort()).toEqual([
      'prod-1',
      'prod-4',
    ]);
    expect(
      lowStockBody.items.every((item) => item.stockStatus === 'LOW_STOCK'),
    ).toBe(true);

    const inStockResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-2/products?stockStatus=IN_STOCK')
      .set('Authorization', `Bearer ${sellerTwoToken}`)
      .expect(200);
    const inStockBody = readBody<PaginatedProductsResponseDto>(inStockResponse);

    expect(inStockBody.items).toHaveLength(1);
    expect(inStockBody.items[0].id).toBe('prod-3');
    expect(inStockBody.items[0].stockStatus).toBe('IN_STOCK');
  });

  it('returns product detail for an accessible shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products/prod-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<ProductDetailResponseDto>(response);

    expect(body.id).toBe('prod-1');
    expect(body.shop.id).toBe('shop-1');
    expect(body.title).toBe('Alpha Local');
    expect(body.variants[0].stockStatus).toBe('LOW_STOCK');
  });

  it('creates, updates, and deletes a product in the seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        wbNmId: 3001,
        wbTitle: 'WB Created',
        localTitle: 'Created Local',
        categoryId: 10,
        visibility: 'ACTIVE',
        images: [
          {
            wbUrl: 'https://example.com/new.jpg',
            isMain: true,
          },
        ],
      })
      .expect(201);
    const createdProduct = readBody<ProductDetailResponseDto>(createResponse);

    expect(createdProduct.wbNmId).toBe('3001');
    expect(createdProduct.title).toBe('Created Local');

    const createdId = createdProduct.id;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/shops/shop-1/products/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        localTitle: 'Updated Local',
        visibility: 'INACTIVE',
      })
      .expect(200);
    const updatedProduct = readBody<ProductDetailResponseDto>(updateResponse);

    expect(updatedProduct.title).toBe('Updated Local');
    expect(updatedProduct.visibility).toBe('INACTIVE');

    await request(app.getHttpServer())
      .delete(`/api/shops/shop-1/products/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(
      products.find((product) => product.id === createdId),
    ).toBeUndefined();
  });

  it('forbids access to products in another seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .get('/api/shops/shop-2/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns inventory summary and allows seller stock update', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const inventoryResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products/prod-1/inventory')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const inventoryBody =
      readBody<ProductInventoryResponseDto>(inventoryResponse);

    expect(inventoryBody.productId).toBe('prod-1');
    expect(inventoryBody.totalAvailableQuantity).toBe(5);
    expect(inventoryBody.variants[0].stockQuantity).toBe(5);
    expect(inventoryBody.stockStatus).toBe('LOW_STOCK');
    expect(inventoryBody.variants[0].lowStockThreshold).toBe(5);

    const updateResponse = await request(app.getHttpServer())
      .patch('/api/shops/shop-1/products/prod-1/inventory')
      .set('Authorization', `Bearer ${token}`)
      .send({
        stockQuantity: 8,
      })
      .expect(200);
    const updateBody = readBody<ProductInventoryResponseDto>(updateResponse);

    expect(updateBody.variants[0].stockQuantity).toBe(8);
    expect(updateBody.totalAvailableQuantity).toBe(8);
    expect(updateBody.stockStatus).toBe('IN_STOCK');
    expect(products[0].variants[0].stockQuantity).toBe(8);
  });

  it('forbids cross-shop inventory access', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .get('/api/shops/shop-2/products/prod-3/inventory')
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

function filterProducts(
  products: StoredProduct[],
  where: Record<string, unknown>,
) {
  return products.filter((product) => {
    if (where.id && product.id !== where.id) {
      return false;
    }

    if (where.shopId && product.shopId !== where.shopId) {
      return false;
    }

    if (where.wbNmId && product.wbNmId !== where.wbNmId) {
      return false;
    }

    if (where.visibility && product.visibility !== where.visibility) {
      return false;
    }

    if (where.categoryId && product.categoryId !== where.categoryId) {
      return false;
    }

    if (where.NOT && typeof where.NOT === 'object' && where.NOT !== null) {
      const notFilter = where.NOT as Record<string, unknown>;
      if (notFilter.id && product.id === notFilter.id) {
        return false;
      }
    }

    if (where.OR && Array.isArray(where.OR)) {
      const matchesAny = where.OR.some((condition) =>
        matchesSearchCondition(product, condition as Record<string, unknown>),
      );
      if (!matchesAny) {
        return false;
      }
    }

    if (
      where.variants &&
      typeof where.variants === 'object' &&
      where.variants !== null
    ) {
      const variantsFilter = where.variants as Record<string, unknown>;
      if (variantsFilter.some) {
        const some = variantsFilter.some as {
          stockQuantity?: { gt?: number };
        };
        const gt = some.stockQuantity?.gt;
        if (
          gt !== undefined &&
          !product.variants.some((variant) => variant.stockQuantity > gt)
        ) {
          return false;
        }
      }

      if (variantsFilter.none) {
        const none = variantsFilter.none as {
          stockQuantity?: { gt?: number };
        };
        const gt = none.stockQuantity?.gt;
        if (
          gt !== undefined &&
          product.variants.some((variant) => variant.stockQuantity > gt)
        ) {
          return false;
        }
      }
    }

    if (where.stockStatus) {
      const stockStatus = summarizeStock(product).stockStatus;
      if (stockStatus !== where.stockStatus) {
        return false;
      }
    }

    return true;
  });
}

function summarizeStock(product: StoredProduct) {
  const trackedVariants = product.variants.filter(
    (variant) => variant.trackInventory !== false,
  );
  const hasTrackedVariants = trackedVariants.length > 0;
  const hasUntrackedVariants = product.variants.some(
    (variant) => variant.trackInventory === false,
  );
  const totalStockQuantity = trackedVariants.reduce(
    (sum, variant) => sum + Math.max(0, variant.stockQuantity),
    0,
  );
  const totalLowStockThreshold = trackedVariants.reduce(
    (sum, variant) => sum + Math.max(0, variant.lowStockThreshold),
    0,
  );

  if (!hasTrackedVariants && hasUntrackedVariants) {
    return { stockStatus: 'NOT_TRACKED' };
  }

  if (hasUntrackedVariants) {
    return { stockStatus: 'IN_STOCK' };
  }

  if (totalStockQuantity <= 0) {
    return { stockStatus: 'OUT_OF_STOCK' };
  }

  if (totalStockQuantity <= totalLowStockThreshold) {
    return { stockStatus: 'LOW_STOCK' };
  }

  return { stockStatus: 'IN_STOCK' };
}

function matchesSearchCondition(
  product: StoredProduct,
  condition: Record<string, unknown>,
) {
  if (condition.localTitle && typeof condition.localTitle === 'object') {
    const contains = String(
      (condition.localTitle as { contains: string }).contains,
    ).toLowerCase();
    return (product.localTitle ?? '').toLowerCase().includes(contains);
  }

  if (condition.wbTitle && typeof condition.wbTitle === 'object') {
    const contains = String(
      (condition.wbTitle as { contains: string }).contains,
    ).toLowerCase();
    return product.wbTitle.toLowerCase().includes(contains);
  }

  if (condition.brand && typeof condition.brand === 'object') {
    const contains = String(
      (condition.brand as { contains: string }).contains,
    ).toLowerCase();
    return (product.brand ?? '').toLowerCase().includes(contains);
  }

  if (condition.wbVendorCode && typeof condition.wbVendorCode === 'object') {
    const contains = String(
      (condition.wbVendorCode as { contains: string }).contains,
    ).toLowerCase();
    return (product.wbVendorCode ?? '').toLowerCase().includes(contains);
  }

  if (condition.seoSlug && typeof condition.seoSlug === 'object') {
    const contains = String(
      (condition.seoSlug as { contains: string }).contains,
    ).toLowerCase();
    return (product.seoSlug ?? '').toLowerCase().includes(contains);
  }

  if (condition.wbNmId) {
    return product.wbNmId === condition.wbNmId;
  }

  return false;
}
