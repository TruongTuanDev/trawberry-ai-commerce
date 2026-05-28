import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { CheckoutOrderResponseDto } from '../src/modules/checkout/dto/checkout-order-response.dto';
import { PaginatedPublicProductsResponseDto } from '../src/modules/public-products/dto/paginated-public-products-response.dto';
import { PublicProductResponseDto } from '../src/modules/public-products/dto/public-product-response.dto';
import { readBody } from './test-helpers';

type StoredShop = {
  id: string;
  name: string;
  slug: string;
  paymentInstructions: string | null;
  status: string;
  logoUrl: string | null;
  sellerProfile: {
    approvalStatus: string;
  };
};

type StoredVariant = {
  id: string;
  productId: string;
  sizeName: string | null;
  russianSize: string | null;
  techSize: string | null;
  wbSize: string | null;
  sellerSku: string | null;
  wbBarcode: string | null;
  isActive: boolean;
  basePrice: Prisma.Decimal | null;
  discountPrice: Prisma.Decimal | null;
  stockQuantity: number;
  reservedStock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  createdAt: Date;
};

type StoredProduct = {
  id: string;
  shopId: string;
  wbNmId: bigint;
  wbTitle: string;
  localTitle: string | null;
  wbDescription: string | null;
  localDescription: string | null;
  seoSlug: string | null;
  sellerSku: string | null;
  brand: string | null;
  color: string | null;
  gender: string | null;
  composition: string | null;
  visibility: string | null;
  catalogStatus: string;
  categoryId: bigint | null;
  categoryName: string | null;
  sourceCategoryName: string | null;
  subjectId: bigint | null;
  averageRating: Prisma.Decimal | null;
  feedbackCount: number | null;
  updatedAt: Date;
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: StoredVariant[];
  shop: StoredShop;
  category: {
    id: bigint;
    name: string;
    slug: string | null;
  } | null;
};

type StoredOrder = {
  id: string;
  marketplaceCheckoutId: string | null;
  shopId: string;
  orderNumber: string;
  totalAmount: Prisma.Decimal;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    quantity: number;
    productTitleSnapshot: string;
  }>;
};

type StoredCheckout = {
  id: string;
  checkoutCode: string;
  grandTotal: Prisma.Decimal;
  customerName: string;
  customerPhone: string;
};

type UserFindUniqueArgs = {
  where: {
    email?: string;
  };
};

type UserCreateArgs = {
  data: {
    email: string;
  };
};

type ProductFindManyArgs = {
  where?: Record<string, unknown> & {
    id?: { in?: string[] };
  };
};

type ProductFindFirstArgs = {
  where?: Record<string, unknown>;
};

type TransactionClient = {
  marketplaceCheckout: {
    create: (args: MarketplaceCheckoutCreateArgs) => {
      id: string;
      checkoutCode: string;
    };
  };
  productVariant: {
    updateMany: (args: ProductVariantUpdateManyArgs) => { count: number };
  };
  order: {
    create: (args: OrderCreateArgs) => {
      id: string;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      totalAmount: Prisma.Decimal;
      shop: {
        id: string;
        name: string;
        paymentInstructions: string | null;
      };
    };
  };
};

type TransactionCallback = (tx: TransactionClient) => Promise<unknown>;

type MarketplaceCheckoutCreateArgs = {
  data: {
    id: string;
    checkoutCode: string;
    grandTotal: Prisma.Decimal;
    customerName: string;
    customerPhone: string;
  };
};

type ProductVariantUpdateManyArgs = {
  where: {
    id: string;
    stockQuantity: number;
    reservedStock: number;
  };
  data: {
    stockQuantity: {
      decrement: number;
    };
    reservedStock: {
      increment: number;
    };
  };
};

type OrderCreateArgs = {
  data: {
    id: string;
    marketplaceCheckoutId: string;
    shopId: string;
    orderNumber: string;
    totalAmount: Prisma.Decimal;
    items: {
      create: Array<{
        id: string;
        productId: string;
        variantId: string;
        quantity: number;
        productTitleSnapshot: string;
      }>;
    };
  };
};

const approvedShop: StoredShop = {
  id: 'shop-ready',
  name: 'Ready Shop',
  slug: 'ready-shop',
  paymentInstructions: 'Manual transfer for public products',
  status: 'ACTIVE',
  logoUrl: null,
  sellerProfile: {
    approvalStatus: 'APPROVED',
  },
};

describe('PublicProductsController contract (e2e)', () => {
  let app: INestApplication<App>;
  let products: StoredProduct[];
  let guestUsers: Array<{ id: string; email: string }>;
  let orders: StoredOrder[];
  let checkouts: StoredCheckout[];

  const decimal = (value: number | string) => new Prisma.Decimal(value);
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    productVariant: {
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    marketplaceCheckout: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    guestUsers = [];
    orders = [];
    checkouts = [];
    products = [
      buildProduct({
        id: 'product-ready',
        title: 'Public Contract Jacket',
        brand: 'Berry Atelier',
        color: 'Indigo',
        gender: 'Unisex',
        composition: '86% cotton, 14% polyester',
        categoryName: 'Jackets',
        sourceCategoryName: 'Outerwear',
        variants: [
          buildVariant({
            id: 'variant-in-stock',
            productId: 'product-ready',
            sizeName: 'XL',
            russianSize: '50',
            techSize: 'XL',
            sellerSku: 'READY-XL',
            basePrice: decimal(1788),
            stockQuantity: 3,
            lowStockThreshold: 2,
          }),
          buildVariant({
            id: 'variant-out-of-stock',
            productId: 'product-ready',
            sizeName: '2XL',
            russianSize: '52',
            techSize: '2XL',
            sellerSku: 'READY-2XL',
            basePrice: decimal(1825),
            stockQuantity: 0,
            lowStockThreshold: 1,
          }),
        ],
      }),
      buildProduct({
        id: 'product-ru-shorts',
        title: 'Russian Shorts Public',
        categoryName: 'Шорты',
        sourceCategoryName: 'Шорты',
        category: {
          id: 11n,
          name: 'Шорты',
          slug: 'shorts',
        },
        variants: [
          buildVariant({
            id: 'variant-ru-shorts',
            productId: 'product-ru-shorts',
            sizeName: 'M',
            russianSize: '46',
            techSize: 'M',
            sellerSku: 'RU-SHORTS-M',
            basePrice: decimal(1200),
            stockQuantity: 7,
          }),
        ],
      }),
      buildProduct({
        id: 'product-no-category',
        title: 'No Category Product',
        categoryName: null,
        sourceCategoryName: null,
        category: null,
        variants: [
          buildVariant({
            id: 'variant-no-category',
            productId: 'product-no-category',
            sizeName: 'S',
            russianSize: '44',
            techSize: 'S',
            sellerSku: 'NO-CAT-S',
            basePrice: decimal(1100),
            stockQuantity: 2,
          }),
        ],
      }),
      buildProduct({
        id: 'product-unpublished',
        title: 'Hidden Draft Jacket',
        catalogStatus: 'UNPUBLISHED',
        visibility: 'INACTIVE',
        variants: [
          buildVariant({
            id: 'variant-unpublished',
            productId: 'product-unpublished',
            sizeName: 'L',
            russianSize: '48',
            techSize: 'L',
            sellerSku: 'DRAFT-L',
            basePrice: decimal(1999),
            stockQuantity: 4,
          }),
        ],
      }),
      buildProduct({
        id: 'product-archived',
        title: 'Archived Jacket',
        catalogStatus: 'ARCHIVED',
        visibility: 'ARCHIVED',
        variants: [
          buildVariant({
            id: 'variant-archived',
            productId: 'product-archived',
            sizeName: 'M',
            russianSize: '46',
            techSize: 'M',
            sellerSku: 'ARCH-M',
            basePrice: decimal(1499),
            stockQuantity: 5,
          }),
        ],
      }),
      buildProduct({
        id: 'product-no-stock',
        title: 'Out Of Stock Jacket',
        variants: [
          buildVariant({
            id: 'variant-no-stock-1',
            productId: 'product-no-stock',
            sizeName: 'XL',
            russianSize: '50',
            techSize: 'XL',
            sellerSku: 'OOS-XL',
            basePrice: decimal(1699),
            stockQuantity: 0,
          }),
          buildVariant({
            id: 'variant-no-stock-2',
            productId: 'product-no-stock',
            sizeName: '2XL',
            russianSize: '52',
            techSize: '2XL',
            sellerSku: 'OOS-2XL',
            basePrice: decimal(1799),
            stockQuantity: 0,
          }),
        ],
      }),
      buildProduct({
        id: 'product-missing-price',
        title: 'Price Missing Jacket',
        variants: [
          buildVariant({
            id: 'variant-no-price',
            productId: 'product-missing-price',
            sizeName: 'S',
            russianSize: '44',
            techSize: 'S',
            sellerSku: 'NOPRICE-S',
            basePrice: decimal(0),
            stockQuantity: 4,
          }),
        ],
      }),
      buildProduct({
        id: 'product-price-changed',
        title: 'Price Change Jacket',
        variants: [
          buildVariant({
            id: 'variant-price-changed',
            productId: 'product-price-changed',
            sizeName: 'L',
            russianSize: '48',
            techSize: 'L',
            sellerSku: 'PRICE-L',
            basePrice: decimal(2100),
            stockQuantity: 5,
          }),
        ],
      }),
      buildProduct({
        id: 'product-limited',
        title: 'Limited Stock Jacket',
        variants: [
          buildVariant({
            id: 'variant-limited',
            productId: 'product-limited',
            sizeName: 'M',
            russianSize: '46',
            techSize: 'M',
            sellerSku: 'LIMIT-M',
            basePrice: decimal(900),
            stockQuantity: 1,
          }),
        ],
      }),
    ];

    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.product.findMany.mockReset();
    prismaMock.product.findFirst.mockReset();
    prismaMock.productVariant.updateMany.mockReset();
    prismaMock.order.create.mockReset();
    prismaMock.marketplaceCheckout.create.mockReset();
    prismaMock.$transaction.mockReset();

    prismaMock.user.findUnique.mockImplementation(
      ({ where }: UserFindUniqueArgs) => {
        const email = String(where.email ?? '');
        return guestUsers.find((user) => user.email === email) ?? null;
      },
    );
    prismaMock.user.create.mockImplementation(({ data }: UserCreateArgs) => {
      const created = {
        id: `guest-${guestUsers.length + 1}`,
        email: String(data.email),
      };
      guestUsers.push(created);
      return { id: created.id };
    });
    prismaMock.product.findMany.mockImplementation(
      ({ where }: ProductFindManyArgs) => {
        if (where?.id?.in) {
          return products.filter((product) => where.id.in.includes(product.id));
        }
        return filterProducts(products, where ?? {});
      },
    );
    prismaMock.product.findFirst.mockImplementation(
      ({ where }: ProductFindFirstArgs) => {
        return filterProducts(products, where ?? {})[0] ?? null;
      },
    );
    prismaMock.$transaction.mockImplementation(
      (callback: TransactionCallback) => {
        const tx = {
          marketplaceCheckout: {
            create: prismaMock.marketplaceCheckout.create,
          },
          productVariant: {
            updateMany: prismaMock.productVariant.updateMany,
          },
          order: {
            create: prismaMock.order.create,
          },
        };
        return callback(tx);
      },
    );
    prismaMock.marketplaceCheckout.create.mockImplementation(
      ({ data }: MarketplaceCheckoutCreateArgs) => {
        const created: StoredCheckout = {
          id: String(data.id),
          checkoutCode: String(data.checkoutCode),
          grandTotal: data.grandTotal,
          customerName: String(data.customerName),
          customerPhone: String(data.customerPhone),
        };
        checkouts.push(created);
        return {
          id: created.id,
          checkoutCode: created.checkoutCode,
        };
      },
    );
    prismaMock.productVariant.updateMany.mockImplementation(
      ({ where, data }: ProductVariantUpdateManyArgs) => {
        const variant = products
          .flatMap((product) => product.variants)
          .find((entry) => entry.id === where.id);
        if (!variant) {
          return { count: 0 };
        }
        if (
          variant.stockQuantity !== where.stockQuantity ||
          variant.reservedStock !== where.reservedStock
        ) {
          return { count: 0 };
        }
        variant.stockQuantity -= data.stockQuantity.decrement;
        variant.reservedStock += data.reservedStock.increment;
        return { count: 1 };
      },
    );
    prismaMock.order.create.mockImplementation(({ data }: OrderCreateArgs) => {
      const created: StoredOrder = {
        id: String(data.id),
        marketplaceCheckoutId: String(data.marketplaceCheckoutId),
        shopId: String(data.shopId),
        orderNumber: String(data.orderNumber),
        totalAmount: data.totalAmount,
        items: data.items.create.map((item) => ({
          id: String(item.id),
          productId: String(item.productId),
          variantId: String(item.variantId),
          quantity: Number(item.quantity),
          productTitleSnapshot: String(item.productTitleSnapshot),
        })),
      };
      orders.push(created);
      const shop = products.find(
        (product) => product.shopId === created.shopId,
      )?.shop;
      return {
        id: created.id,
        orderNumber: created.orderNumber,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: created.totalAmount,
        shop: {
          id: created.shopId,
          name: shop?.name ?? 'Unknown shop',
          paymentInstructions: shop?.paymentInstructions ?? null,
        },
      };
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('lists only published readiness-passing public products', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/products')
      .expect(200);

    const body = readBody<PaginatedPublicProductsResponseDto>(response);
    expect(body.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'product-ready',
        'product-price-changed',
        'product-limited',
        'product-ru-shorts',
        'product-no-category',
      ]),
    );
    expect(body.meta.total).toBe(5);
  });

  it('returns public detail fields and variant availability contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/products/product-ready')
      .expect(200);

    const body = readBody<PublicProductResponseDto>(response);
    expect(body.shop).toEqual(
      expect.objectContaining({
        id: 'shop-ready',
        name: 'Ready Shop',
      }),
    );
    expect(body.images).toHaveLength(2);
    expect(body.brand).toBe('Berry Atelier');
    expect(body.categoryName).toBe('Jackets');
    expect(body.color).toBe('Indigo');
    expect(body.gender).toBe('Unisex');
    expect(body.composition).toContain('cotton');
    expect(body.variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'variant-in-stock',
          sizeName: 'XL',
          russianSize: '50',
          price: '1788',
          stockQuantity: 3,
          trackInventory: true,
          inStock: true,
          availableQuantity: 3,
        }),
        expect.objectContaining({
          id: 'variant-out-of-stock',
          sizeName: '2XL',
          russianSize: '52',
          price: '1825',
          stockQuantity: 0,
          trackInventory: true,
          inStock: false,
          availableQuantity: 0,
        }),
      ]),
    );
  });

  it('builds category facets from category relation and filters by category id', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/public/products')
      .query({ q: 'Шорты' })
      .expect(200);

    const listBody = readBody<PaginatedPublicProductsResponseDto>(listResponse);
    expect(listBody.filters.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Шорты',
          slug: 'shorts',
          count: 1,
        }),
      ]),
    );
    expect(
      listBody.filters.categories.find(
        (category) => category.name === 'Outerwear',
      ),
    ).toBeUndefined();
    expect(
      listBody.filters.categories.find((category) => category.name === ''),
    ).toBeUndefined();

    const filteredResponse = await request(app.getHttpServer())
      .get('/api/public/products')
      .query({ categoryId: '11' })
      .expect(200);

    const filteredBody =
      readBody<PaginatedPublicProductsResponseDto>(filteredResponse);
    expect(filteredBody.items.map((item) => item.id)).toContain(
      'product-ru-shorts',
    );
    expect(filteredBody.items.map((item) => item.id)).not.toContain(
      'product-ready',
    );
    expect(filteredBody.items.map((item) => item.id)).not.toContain(
      'product-no-category',
    );
  });

  it('hides products with every variant out of stock from list and detail', async () => {
    await request(app.getHttpServer())
      .get('/api/public/products')
      .query({ q: 'Out Of Stock Jacket' })
      .expect(200)
      .expect((response) => {
        const body = readBody<PaginatedPublicProductsResponseDto>(response);
        expect(body.items).toHaveLength(0);
      });

    await request(app.getHttpServer())
      .get('/api/public/products/product-no-stock')
      .expect(404);
  });

  it('validates public cart items against current server stock, price, and visibility', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/cart/validate')
      .send({
        items: [
          {
            productId: 'product-ready',
            variantId: 'variant-in-stock',
            quantity: 2,
            clientUnitPrice: 1788,
          },
          {
            productId: 'product-price-changed',
            variantId: 'variant-price-changed',
            quantity: 1,
            clientUnitPrice: 1999,
          },
          {
            productId: 'product-ready',
            variantId: 'variant-out-of-stock',
            quantity: 1,
            clientUnitPrice: 1825,
          },
          {
            productId: 'product-limited',
            variantId: 'variant-limited',
            quantity: 2,
            clientUnitPrice: 900,
          },
          {
            productId: 'product-unpublished',
            variantId: 'variant-unpublished',
            quantity: 1,
            clientUnitPrice: 1999,
          },
          {
            productId: 'product-archived',
            variantId: 'variant-archived',
            quantity: 1,
            clientUnitPrice: 1499,
          },
          {
            productId: 'product-missing-price',
            variantId: 'variant-no-price',
            quantity: 1,
            clientUnitPrice: 1,
          },
          {
            productId: 'product-ready',
            variantId: 'variant-does-not-exist',
            quantity: 1,
            clientUnitPrice: 1788,
          },
          {
            productId: 'product-does-not-exist',
            variantId: 'variant-nowhere',
            quantity: 1,
            clientUnitPrice: 123,
          },
        ],
      })
      .expect(200);

    const body = readBody<{
      valid: boolean;
      items: Array<{
        productId: string;
        variantId: string | null;
        status: string;
        available: boolean;
        unitPrice: number | null;
        currentStock: number;
        maxQuantity: number;
        requestedQuantity: number;
        lineTotal: number;
        shopName: string | null;
      }>;
      summary: {
        subtotal: number;
        invalidCount: number;
        changedCount: number;
      };
    }>(response);

    expect(body.valid).toBe(false);
    expect(body.summary.invalidCount).toBe(7);
    expect(body.summary.changedCount).toBe(1);
    expect(body.summary.subtotal).toBe(5676);

    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: 'product-ready',
          variantId: 'variant-in-stock',
          status: 'OK',
          available: true,
          unitPrice: 1788,
          currentStock: 3,
          maxQuantity: 3,
          requestedQuantity: 2,
          lineTotal: 3576,
          shopName: 'Ready Shop',
        }),
        expect.objectContaining({
          productId: 'product-price-changed',
          variantId: 'variant-price-changed',
          status: 'PRICE_CHANGED',
          available: true,
          unitPrice: 2100,
          currentStock: 5,
          maxQuantity: 5,
          requestedQuantity: 1,
          lineTotal: 2100,
        }),
        expect.objectContaining({
          productId: 'product-ready',
          variantId: 'variant-out-of-stock',
          status: 'OUT_OF_STOCK',
          available: false,
          unitPrice: 1825,
          currentStock: 0,
          maxQuantity: 0,
        }),
        expect.objectContaining({
          productId: 'product-limited',
          variantId: 'variant-limited',
          status: 'QUANTITY_EXCEEDS_STOCK',
          available: false,
          unitPrice: 900,
          currentStock: 1,
          maxQuantity: 1,
          requestedQuantity: 2,
          lineTotal: 900,
        }),
        expect.objectContaining({
          productId: 'product-unpublished',
          variantId: 'variant-unpublished',
          status: 'PRODUCT_NOT_PUBLIC',
          available: false,
        }),
        expect.objectContaining({
          productId: 'product-archived',
          variantId: 'variant-archived',
          status: 'PRODUCT_ARCHIVED',
          available: false,
        }),
        expect.objectContaining({
          productId: 'product-missing-price',
          variantId: 'variant-no-price',
          status: 'MISSING_PRICE',
          available: false,
          unitPrice: null,
        }),
        expect.objectContaining({
          productId: 'product-ready',
          variantId: 'variant-does-not-exist',
          status: 'VARIANT_NOT_FOUND',
          available: false,
        }),
        expect.objectContaining({
          productId: 'product-does-not-exist',
          variantId: 'variant-nowhere',
          status: 'PRODUCT_NOT_FOUND',
          available: false,
        }),
      ]),
    );
  });

  it('checks checkout contract for stock, publication, variant, and price guards', async () => {
    const success = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-ready',
            variantId: 'variant-in-stock',
            quantity: 2,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(201);

    expect(readBody<CheckoutOrderResponseDto>(success).orders).toHaveLength(1);
    expect(findVariant('variant-in-stock')?.stockQuantity).toBe(1);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-ready',
            variantId: 'variant-out-of-stock',
            quantity: 1,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-ready',
            variantId: 'variant-in-stock',
            quantity: 5,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-ready',
            variantId: 'variant-does-not-exist',
            quantity: 1,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-unpublished',
            variantId: 'variant-unpublished',
            quantity: 1,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-archived',
            variantId: 'variant-archived',
            quantity: 1,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-ready',
        items: [
          {
            productId: 'product-missing-price',
            variantId: 'variant-no-price',
            quantity: 1,
          },
        ],
        customer: {
          fullName: 'Contract Customer',
          phone: '0123456789',
          address: '123 Contract Street',
        },
        paymentMethod: 'PREPAID_SELLER_QR',
      })
      .expect(400);
  });

  it('hides products from public list and detail after unpublish', async () => {
    const product = products.find((entry) => entry.id === 'product-ready');
    expect(product).toBeDefined();
    product!.visibility = 'INACTIVE';

    await request(app.getHttpServer())
      .get('/api/public/products/product-ready')
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/public/products')
      .query({ q: 'Public Contract Jacket' })
      .expect(200)
      .expect((response) => {
        const body = readBody<PaginatedPublicProductsResponseDto>(response);
        expect(body.items.map((item) => item.id)).toEqual([]);
      });
  });

  function findVariant(variantId: string) {
    return products
      .flatMap((product) => product.variants)
      .find((variant) => variant.id === variantId);
  }
});

function buildProduct(input: {
  id: string;
  title: string;
  brand?: string;
  color?: string;
  gender?: string;
  composition?: string;
  categoryName?: string | null;
  sourceCategoryName?: string | null;
  category?: StoredProduct['category'];
  catalogStatus?: string;
  visibility?: string;
  variants: StoredVariant[];
}): StoredProduct {
  return {
    id: input.id,
    shopId: 'shop-ready',
    wbNmId: BigInt(Math.floor(Math.random() * 1_000_000) + 1),
    wbTitle: input.title,
    localTitle: input.title,
    wbDescription: 'Public contract marketplace product',
    localDescription: 'Public contract marketplace product',
    seoSlug: input.id,
    sellerSku: `${input.id}-sku`,
    brand: input.brand ?? 'Contract Brand',
    color: input.color ?? 'Blue',
    gender: input.gender ?? 'Unisex',
    composition: input.composition ?? '100% cotton',
    visibility: input.visibility ?? 'ACTIVE',
    catalogStatus: input.catalogStatus ?? 'PUBLISHED',
    categoryId: input.category === null ? null : (input.category?.id ?? 10n),
    categoryName: input.categoryName ?? 'Jackets',
    sourceCategoryName: input.sourceCategoryName ?? 'Outerwear',
    subjectId: null,
    averageRating: decimalValue(4.8),
    feedbackCount: 2,
    updatedAt: new Date('2026-05-17T10:00:00Z'),
    images: [
      {
        id: `${input.id}-image-main`,
        wbUrl: `https://example.com/${input.id}-main.jpg`,
        localUrl: null,
        isMain: true,
        sortOrder: 0,
      },
      {
        id: `${input.id}-image-alt`,
        wbUrl: `https://example.com/${input.id}-alt.jpg`,
        localUrl: null,
        isMain: false,
        sortOrder: 1,
      },
    ],
    variants: input.variants,
    shop: approvedShop,
    category:
      input.category === undefined
        ? {
            id: 10n,
            name: input.categoryName ?? 'Jackets',
            slug: 'jackets',
          }
        : input.category,
  };
}

function buildVariant(input: {
  id: string;
  productId: string;
  sizeName: string;
  russianSize: string;
  techSize: string;
  sellerSku: string;
  basePrice: Prisma.Decimal;
  stockQuantity: number;
  lowStockThreshold?: number;
}): StoredVariant {
  return {
    id: input.id,
    productId: input.productId,
    sizeName: input.sizeName,
    russianSize: input.russianSize,
    techSize: input.techSize,
    wbSize: null,
    sellerSku: input.sellerSku,
    wbBarcode: null,
    isActive: true,
    basePrice: input.basePrice,
    discountPrice: null,
    stockQuantity: input.stockQuantity,
    reservedStock: 0,
    lowStockThreshold: input.lowStockThreshold ?? 1,
    trackInventory: true,
    createdAt: new Date('2026-05-17T10:00:00Z'),
  };
}

function decimalValue(value: number | string) {
  return new Prisma.Decimal(value);
}

function filterProducts(
  products: StoredProduct[],
  where: Record<string, unknown>,
) {
  return products.filter((product) => {
    if (where.id && typeof where.id === 'string' && product.id !== where.id) {
      return false;
    }

    if (
      where.id &&
      typeof where.id === 'object' &&
      where.id !== null &&
      'in' in where.id &&
      Array.isArray((where.id as { in: string[] }).in) &&
      !(where.id as { in: string[] }).in.includes(product.id)
    ) {
      return false;
    }

    if (where.visibility && product.visibility !== where.visibility) {
      return false;
    }

    if (where.catalogStatus && product.catalogStatus !== where.catalogStatus) {
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
        product.shop.sellerProfile.approvalStatus !==
          shopFilter.sellerProfile.approvalStatus
      ) {
        return false;
      }
    }

    if (
      where.category &&
      typeof where.category === 'object' &&
      where.category !== null &&
      'slug' in where.category
    ) {
      const slug = (where.category as { slug?: string }).slug;
      if (slug && product.category?.slug !== slug) {
        return false;
      }
    }

    if (where.categoryId && product.categoryId !== where.categoryId) {
      return false;
    }

    if (
      where.brand &&
      typeof where.brand === 'object' &&
      where.brand !== null &&
      'contains' in where.brand &&
      !stringContains(
        product.brand,
        String((where.brand as { contains: string }).contains),
      )
    ) {
      return false;
    }

    if (
      where.color &&
      typeof where.color === 'object' &&
      where.color !== null &&
      'contains' in where.color &&
      !stringContains(
        product.color,
        String((where.color as { contains: string }).contains),
      )
    ) {
      return false;
    }

    if (
      where.gender &&
      typeof where.gender === 'object' &&
      where.gender !== null &&
      'contains' in where.gender &&
      !stringContains(
        product.gender,
        String((where.gender as { contains: string }).contains),
      )
    ) {
      return false;
    }

    if (where.OR && Array.isArray(where.OR)) {
      const matched = where.OR.some((condition) =>
        matchesSearchCondition(product, condition as Record<string, unknown>),
      );
      if (!matched) {
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
        const matched = product.variants.some((variant) => {
          if (
            some.isActive !== undefined &&
            variant.isActive !== some.isActive
          ) {
            return false;
          }

          if (
            some.stockQuantity?.gt !== undefined &&
            variant.stockQuantity <= some.stockQuantity.gt
          ) {
            return false;
          }

          if (some.OR?.length) {
            const priceMatched = some.OR.some((condition) => {
              const discountPrice = Number(
                variant.discountPrice?.toString() ?? '0',
              );
              const basePrice = Number(variant.basePrice?.toString() ?? '0');
              return Boolean(
                (condition.discountPrice?.gt !== undefined &&
                  discountPrice > condition.discountPrice.gt) ||
                (condition.basePrice?.gt !== undefined &&
                  basePrice > condition.basePrice.gt),
              );
            });

            if (!priceMatched) {
              return false;
            }
          }

          return true;
        });

        if (!matched) {
          return false;
        }
      }

      if (variantsFilter.none) {
        const none = variantsFilter.none as {
          isActive?: boolean;
          stockQuantity?: { gt?: number };
        };
        const hasBlockedVariant = product.variants.some((variant) => {
          if (
            none.isActive !== undefined &&
            variant.isActive !== none.isActive
          ) {
            return false;
          }
          if (
            none.stockQuantity?.gt !== undefined &&
            variant.stockQuantity > none.stockQuantity.gt
          ) {
            return true;
          }
          return false;
        });
        if (hasBlockedVariant) {
          return false;
        }
      }
    }

    return true;
  });
}

function matchesSearchCondition(
  product: StoredProduct,
  condition: Record<string, unknown>,
) {
  if (condition.localTitle && typeof condition.localTitle === 'object') {
    return stringContains(
      product.localTitle,
      String((condition.localTitle as { contains: string }).contains),
    );
  }

  if (condition.wbTitle && typeof condition.wbTitle === 'object') {
    return stringContains(
      product.wbTitle,
      String((condition.wbTitle as { contains: string }).contains),
    );
  }

  if (condition.brand && typeof condition.brand === 'object') {
    return stringContains(
      product.brand,
      String((condition.brand as { contains: string }).contains),
    );
  }

  if (condition.categoryName && typeof condition.categoryName === 'object') {
    return stringContains(
      product.categoryName,
      String((condition.categoryName as { contains: string }).contains),
    );
  }

  if (
    condition.category &&
    typeof condition.category === 'object' &&
    condition.category !== null &&
    'name' in condition.category
  ) {
    const categoryNameFilter = (
      condition.category as {
        name?: { contains?: string };
      }
    ).name;
    if (categoryNameFilter?.contains) {
      return stringContains(
        product.category?.name,
        categoryNameFilter.contains,
      );
    }
  }

  if (
    condition.sourceCategoryName &&
    typeof condition.sourceCategoryName === 'object'
  ) {
    return stringContains(
      product.sourceCategoryName,
      String((condition.sourceCategoryName as { contains: string }).contains),
    );
  }

  if (condition.sellerSku && typeof condition.sellerSku === 'object') {
    return stringContains(
      product.sellerSku,
      String((condition.sellerSku as { contains: string }).contains),
    );
  }

  if (
    condition.localDescription &&
    typeof condition.localDescription === 'object'
  ) {
    return stringContains(
      product.localDescription,
      String((condition.localDescription as { contains: string }).contains),
    );
  }

  if (condition.wbDescription && typeof condition.wbDescription === 'object') {
    return stringContains(
      product.wbDescription,
      String((condition.wbDescription as { contains: string }).contains),
    );
  }

  if (condition.color && typeof condition.color === 'object') {
    return stringContains(
      product.color,
      String((condition.color as { contains: string }).contains),
    );
  }

  if (condition.gender && typeof condition.gender === 'object') {
    return stringContains(
      product.gender,
      String((condition.gender as { contains: string }).contains),
    );
  }

  return false;
}

function stringContains(value: string | null | undefined, contains: string) {
  return (value ?? '').toLowerCase().includes(contains.toLowerCase());
}
