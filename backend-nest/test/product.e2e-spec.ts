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
  catalogStatus?: string | null;
  source?: string | null;
  publishedAt?: Date | null;
  unpublishedAt?: Date | null;
  archivedAt?: Date | null;
  reviewWarningsJson?: string[] | null;
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
    status?: string;
    sellerProfile?: {
      approvalStatus: string;
    };
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
    createdAt?: Date;
    isActive?: boolean;
    sellerSku?: string | null;
    wbBarcode?: string | null;
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

type PublishErrorResponse = {
  message: string;
  blockingReasons: string[];
};

type BulkActionResponse = {
  successCount: number;
  failureCount: number;
  results: Array<{
    productId: string;
    success: boolean;
  }>;
};

type BulkUpdateResponse = {
  updated: number;
  failed: number;
  items: Array<{
    productId: string;
    success: boolean;
    error: string | null;
    readiness: {
      ready: boolean;
      blockingReasons: string[];
      catalogStatus: string;
    } | null;
  }>;
};

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let categories: StoredCategory[];
  let products: StoredProduct[];

  const decimal = (value: string) => {
    const numeric = Number(value);

    return {
      toString: () => value,
      comparedTo: (other: { toString(): string }) =>
        numeric === Number(other.toString())
          ? 0
          : numeric > Number(other.toString())
            ? 1
            : -1,
      lessThan: (other: { toString(): string }) =>
        numeric < Number(other.toString()),
      greaterThan: (other: { toString(): string }) =>
        numeric > Number(other.toString()),
    };
  };

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
      updateMany: jest.fn(),
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
        catalogStatus: 'PUBLISHED',
        source: 'MANUAL',
        publishedAt: new Date(),
        unpublishedAt: null,
        archivedAt: null,
        reviewWarningsJson: [],
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
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
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
            sellerSku: 'VENDOR-ALPHA-42',
            wbBarcode: 'BARCODE-ALPHA-42',
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
        catalogStatus: 'DRAFT',
        source: 'MANUAL',
        publishedAt: null,
        unpublishedAt: null,
        archivedAt: null,
        reviewWarningsJson: ['MISSING_IMAGE', 'MISSING_STOCK'],
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
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        images: [],
        variants: [
          {
            id: 'var-2',
            chrtId: 2002n,
            sellerSku: 'VENDOR-BETA-43',
            wbBarcode: 'BARCODE-BETA-43',
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
        catalogStatus: 'PUBLISHED',
        source: 'MANUAL',
        publishedAt: new Date(),
        unpublishedAt: null,
        archivedAt: null,
        reviewWarningsJson: ['MISSING_IMAGE'],
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
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        images: [],
        variants: [
          {
            id: 'var-3',
            chrtId: 3001n,
            sellerSku: 'VENDOR-GAMMA-44',
            wbBarcode: 'BARCODE-GAMMA-44',
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
          catalogStatus: 'PUBLISHED',
          source: 'MANUAL',
          publishedAt: new Date(),
          unpublishedAt: null,
          archivedAt: null,
          reviewWarningsJson: [],
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
            status: shop.status,
            sellerProfile: {
              approvalStatus: 'APPROVED',
            },
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
        data: {
          stockQuantity?: number;
          trackInventory?: boolean;
          basePrice?: { toString(): string };
          discountPrice?: { toString(): string };
        };
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
          if (data.trackInventory !== undefined) {
            variant.trackInventory = data.trackInventory;
          }
          if (data.basePrice !== undefined) {
            variant.basePrice = data.basePrice;
          }
          if (data.discountPrice !== undefined) {
            variant.discountPrice = data.discountPrice;
          }

          return Promise.resolve(variant);
        }

        throw new Error('Variant not found');
      },
    );

    prismaMock.productVariant.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { productId: string; chrtId: bigint };
        data: {
          isActive?: boolean;
          basePrice?: { toString(): string };
          discountPrice?: { toString(): string };
          stockQuantity?: number;
          lowStockThreshold?: number;
          trackInventory?: boolean;
        };
      }) => {
        const product = products.find((entry) => entry.id === where.productId);
        const variant = product?.variants.find(
          (entry) => entry.chrtId === where.chrtId,
        );
        if (!variant) {
          return Promise.resolve({ count: 0 });
        }

        if (data.isActive !== undefined) {
          variant.isActive = data.isActive;
        }
        if (data.basePrice !== undefined) {
          variant.basePrice = data.basePrice;
        }
        if (data.discountPrice !== undefined) {
          variant.discountPrice = data.discountPrice;
        }
        if (data.stockQuantity !== undefined) {
          variant.stockQuantity = data.stockQuantity;
        }
        if (data.lowStockThreshold !== undefined) {
          variant.lowStockThreshold = data.lowStockThreshold;
        }
        if (data.trackInventory !== undefined) {
          variant.trackInventory = data.trackInventory;
        }

        return Promise.resolve({ count: 1 });
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

  it('searches products by WB ID, vendor code, and variant seller sku', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const byWbIdResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?search=1001')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byWbIdBody = readBody<PaginatedProductsResponseDto>(byWbIdResponse);
    expect(byWbIdBody.items.map((item) => item.id)).toEqual(['prod-1']);

    const byVendorResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?search=A-2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byVendorBody =
      readBody<PaginatedProductsResponseDto>(byVendorResponse);
    expect(byVendorBody.items.map((item) => item.id)).toEqual(['prod-2']);

    products[1].wbVendorCode = null;

    const byVariantSkuResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products?search=VENDOR-BETA-43')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byVariantSkuBody =
      readBody<PaginatedProductsResponseDto>(byVariantSkuResponse);
    expect(byVariantSkuBody.items.map((item) => item.id)).toEqual(['prod-2']);
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

  it('publishes a ready product and exposes it on the public marketplace', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    products[1] = {
      ...products[1],
      visibility: 'INACTIVE',
      catalogStatus: 'IMPORTED',
      localTitle: 'Ready Beta',
      images: [
        {
          id: 'img-ready-beta',
          wbUrl: 'https://example.com/ready-beta.jpg',
          localUrl: null,
          isMain: true,
          sortOrder: 0,
        },
      ],
      variants: [
        {
          ...products[1].variants[0],
          basePrice: decimal('129.99'),
          stockQuantity: 6,
          isActive: true,
        },
      ],
      reviewWarningsJson: [],
    };

    const readinessResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products/prod-2/readiness')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(readBody<{ ready: boolean }>(readinessResponse).ready).toBe(true);

    const publishResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-2/publish')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const published = readBody<ProductDetailResponseDto>(publishResponse);

    expect(published.catalogStatus).toBe('PUBLISHED');

    const publicListResponse = await request(app.getHttpServer())
      .get('/api/public/products?search=Ready%20Beta')
      .expect(200);
    const publicList = readBody<{ items: Array<{ id: string }> }>(
      publicListResponse,
    );
    expect(publicList.items.map((item) => item.id)).toContain('prod-2');
  });

  it('rejects publishing when readiness has blocking reasons', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-2/publish')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    const body = readBody<PublishErrorResponse>(response);

    expect(body.message).toBe('Product is not ready to publish.');
    expect(body.blockingReasons).toEqual(
      expect.arrayContaining(['MISSING_IMAGE', 'MISSING_STOCK']),
    );
  });

  it('unpublishes and archives a product so it disappears from public listing', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const unpublishResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/unpublish')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(
      readBody<ProductDetailResponseDto>(unpublishResponse).catalogStatus,
    ).toBe('UNPUBLISHED');

    await request(app.getHttpServer())
      .get('/api/public/products/prod-1')
      .expect(404);

    const archiveResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/archive')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(
      readBody<ProductDetailResponseDto>(archiveResponse).catalogStatus,
    ).toBe('ARCHIVED');
  });

  it('bulk publishes only ready products and returns per-product results', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    products[1] = {
      ...products[1],
      visibility: 'INACTIVE',
      catalogStatus: 'IMPORTED',
      localTitle: 'Bulk Ready Beta',
      images: [
        {
          id: 'img-bulk-beta',
          wbUrl: 'https://example.com/bulk-beta.jpg',
          localUrl: null,
          isMain: true,
          sortOrder: 0,
        },
      ],
      variants: [
        {
          ...products[1].variants[0],
          basePrice: decimal('130.00'),
          stockQuantity: 4,
          isActive: true,
        },
      ],
      reviewWarningsJson: [],
    };

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-1', 'prod-2'],
        action: 'PUBLISH',
      })
      .expect(201);
    const body = readBody<BulkActionResponse>(response);

    expect(body.successCount).toBe(2);
    expect(body.failureCount).toBe(0);
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: 'prod-1', success: true }),
        expect.objectContaining({ productId: 'prod-2', success: true }),
      ]),
    );
  });

  it('bulk updates category, price, and stock and returns per-product readiness', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    products[1] = {
      ...products[1],
      categoryId: null,
      categoryName: null,
      localTitle: 'Bulk Edit Beta',
      images: [
        {
          id: 'img-bulk-edit-beta',
          wbUrl: 'https://example.com/bulk-edit-beta.jpg',
          localUrl: null,
          isMain: true,
          sortOrder: 0,
        },
      ],
      variants: [
        {
          ...products[1].variants[0],
          basePrice: decimal('0'),
          discountPrice: null,
          stockQuantity: 0,
          isActive: true,
        },
      ],
      reviewWarningsJson: [
        'MISSING_PRICE',
        'MISSING_STOCK',
        'MISSING_CATEGORY',
      ],
    };

    const categoryResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-2'],
        updates: {
          categoryId: 10,
        },
      })
      .expect(201);
    const categoryBody = readBody<BulkUpdateResponse>(categoryResponse);
    expect(categoryBody.updated).toBe(1);
    expect(products[1].categoryId).toBe(10n);
    expect(categoryBody.items[0].readiness?.blockingReasons).toEqual(
      expect.arrayContaining(['MISSING_PRICE', 'MISSING_STOCK']),
    );

    const priceResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-2'],
        updates: {
          price: 1990,
        },
        scope: {
          variantMode: 'ALL_VARIANTS',
        },
      })
      .expect(201);
    const priceBody = readBody<BulkUpdateResponse>(priceResponse);
    expect(priceBody.updated).toBe(1);
    expect(products[1].variants[0].basePrice?.toString()).toBe('1990');
    expect(products[1].variants[0].discountPrice?.toString()).toBe('1990');

    const stockResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-2'],
        updates: {
          stockQuantity: 7,
        },
        scope: {
          variantMode: 'ALL_VARIANTS',
        },
      })
      .expect(201);
    const stockBody = readBody<BulkUpdateResponse>(stockResponse);
    expect(stockBody.updated).toBe(1);
    expect(products[1].variants[0].stockQuantity).toBe(7);
    expect(stockBody.items[0].readiness).toEqual({
      ready: true,
      blockingReasons: [],
      catalogStatus: 'READY',
    });
  });

  it('bulk update rejects invalid category and invalid price', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-1'],
        updates: {
          categoryId: 999,
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-1'],
        updates: {
          price: 0,
        },
      })
      .expect(400);
  });

  it('bulk update does not allow cross-shop access', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/shops/shop-2/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-3'],
        updates: {
          stockQuantity: 5,
        },
      })
      .expect(403);
  });

  it('bulk update skips archived products with per-product failure result', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    products[0] = {
      ...products[0],
      catalogStatus: 'ARCHIVED',
      archivedAt: new Date(),
      visibility: 'ARCHIVED',
    };

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-1'],
        updates: {
          stockQuantity: 9,
        },
      })
      .expect(201);
    const body = readBody<BulkUpdateResponse>(response);

    expect(body.updated).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        productId: 'prod-1',
        success: false,
      }),
    );
    expect(body.items[0].error).toContain('cannot be bulk edited');
    expect(products[0].variants[0].stockQuantity).toBe(5);
  });

  it('bulk update can publish only ready products when publishIfReady is enabled', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    products[0] = {
      ...products[0],
      catalogStatus: 'IMPORTED',
      publishedAt: null,
      unpublishedAt: null,
      reviewWarningsJson: ['MISSING_PRICE'],
      variants: [
        {
          ...products[0].variants[0],
          basePrice: decimal('0'),
          discountPrice: null,
          stockQuantity: 5,
          isActive: true,
        },
      ],
    };

    products[1] = {
      ...products[1],
      catalogStatus: 'IMPORTED',
      categoryId: 10n,
      categoryName: 'Sneakers',
      localTitle: 'Publishable Beta',
      images: [],
      variants: [
        {
          ...products[1].variants[0],
          basePrice: decimal('0'),
          discountPrice: null,
          stockQuantity: 0,
          isActive: true,
        },
      ],
      reviewWarningsJson: ['MISSING_IMAGE', 'MISSING_PRICE', 'MISSING_STOCK'],
    };

    const response = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/bulk-update')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productIds: ['prod-1', 'prod-2'],
        updates: {
          price: 2500,
          stockQuantity: 8,
        },
        scope: {
          variantMode: 'ALL_VARIANTS',
        },
        publishIfReady: true,
      })
      .expect(201);
    const body = readBody<BulkUpdateResponse>(response);

    expect(body.updated).toBe(2);
    expect(products[0].catalogStatus).toBe('PUBLISHED');
    expect(products[1].catalogStatus).not.toBe('PUBLISHED');
    const firstResult = body.items.find((item) => item.productId === 'prod-1');
    const secondResult = body.items.find((item) => item.productId === 'prod-2');
    expect(firstResult).toEqual({
      productId: 'prod-1',
      success: true,
      error: null,
      readiness: {
        ready: true,
        blockingReasons: [],
        catalogStatus: 'PUBLISHED',
      },
    });
    expect(secondResult?.success).toBe(true);
    expect(secondResult?.readiness?.ready).toBe(false);

    await request(app.getHttpServer())
      .get('/api/public/products/prod-1')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/public/products/prod-2')
      .expect(404);
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

    if (
      typeof where.catalogStatus === 'string' &&
      product.catalogStatus !== where.catalogStatus
    ) {
      return false;
    }

    if (where.categoryId && product.categoryId !== where.categoryId) {
      return false;
    }

    if (
      where.images &&
      typeof where.images === 'object' &&
      where.images !== null &&
      'some' in where.images &&
      product.images.length < 1
    ) {
      return false;
    }

    if (where.shop && typeof where.shop === 'object' && where.shop !== null) {
      const shopFilter = where.shop as {
        status?: string;
        sellerProfile?: { approvalStatus?: string };
      };
      if (shopFilter.status && product.shop.status !== shopFilter.status) {
        return false;
      }
      if (
        shopFilter.sellerProfile?.approvalStatus &&
        product.shop.sellerProfile?.approvalStatus !==
          shopFilter.sellerProfile.approvalStatus
      ) {
        return false;
      }
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
          isActive?: boolean;
          stockQuantity?: { gt?: number };
          OR?: Array<{
            discountPrice?: { gt?: number };
            basePrice?: { gt?: number };
          }>;
        };
        const gt = some.stockQuantity?.gt;
        const matchesSome = product.variants.some((variant) => {
          if (
            some.isActive !== undefined &&
            (variant.isActive ?? true) !== some.isActive
          ) {
            return false;
          }
          if (gt !== undefined && !(variant.stockQuantity > gt)) {
            return false;
          }
          if (some.OR?.length) {
            const matchesPrice = some.OR.some((condition) => {
              const discountPrice = Number(
                variant.discountPrice?.toString() ?? '0',
              );
              const basePrice = Number(variant.basePrice?.toString() ?? '0');
              if (
                condition.discountPrice?.gt !== undefined &&
                discountPrice > condition.discountPrice.gt
              ) {
                return true;
              }
              if (
                condition.basePrice?.gt !== undefined &&
                basePrice > condition.basePrice.gt
              ) {
                return true;
              }
              return false;
            });
            if (!matchesPrice) {
              return false;
            }
          }
          return true;
        });
        if (!matchesSome) {
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

  if (
    condition.variants &&
    typeof condition.variants === 'object' &&
    condition.variants !== null
  ) {
    const variantsCondition = condition.variants as {
      some?: {
        sellerSku?: { contains: string };
        wbBarcode?: { contains: string };
      };
    };
    const some = variantsCondition.some;
    if (some?.sellerSku && typeof some.sellerSku === 'object') {
      const contains = String(some.sellerSku.contains).toLowerCase();
      return product.variants.some((variant) =>
        (variant.sellerSku ?? '').toLowerCase().includes(contains),
      );
    }

    if (some?.wbBarcode && typeof some.wbBarcode === 'object') {
      const contains = String(some.wbBarcode.contains).toLowerCase();
      return product.variants.some((variant) =>
        (variant.wbBarcode ?? '').toLowerCase().includes(contains),
      );
    }
  }

  if (condition.wbNmId) {
    return product.wbNmId === condition.wbNmId;
  }

  return false;
}
