import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { CheckoutOrderResponseDto } from '../src/modules/checkout/dto/checkout-order-response.dto';
import { OrderResponseDto } from '../src/modules/orders/dto/order-response.dto';
import { PaginatedOrdersResponseDto } from '../src/modules/orders/dto/paginated-orders-response.dto';
import { readBody } from './test-helpers';

type DecimalLike = {
  plus(value: DecimalLike): DecimalLike;
  mul(value: DecimalLike): DecimalLike;
  gt(value: number): boolean;
  lte(value: number): boolean;
  toString(): string;
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
  paymentInstructions: string | null;
  sellerProfile: { userId: string; approvalStatus: string };
};

type StoredVariant = {
  id: string;
  productId: string;
  chrtId: bigint;
  sellerSku?: string | null;
  wbBarcode?: string | null;
  sizeName?: string | null;
  russianSize?: string | null;
  techSize?: string | null;
  wbSize?: string | null;
  isActive: boolean;
  basePrice: DecimalLike | null;
  discountPrice: DecimalLike | null;
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
  localDescription: string | null;
  wbDescription: string | null;
  seoSlug: string | null;
  brand: string | null;
  visibility: string | null;
  catalogStatus: string;
  categoryId: bigint | null;
  categoryName?: string | null;
  source?: string | null;
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: StoredVariant[];
  shop: {
    id: string;
    name: string;
    paymentInstructions: string | null;
    status: string;
    sellerProfile: {
      approvalStatus: string;
    };
  };
};

type StoredOrder = {
  id: string;
  marketplaceCheckoutId: string | null;
  customerId: string;
  shopId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: DecimalLike;
  shippingCost: DecimalLike;
  shippingMethodName: string | null;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  customerCompletedAt: Date | null;
  shop: { id: string; name: string; paymentInstructions: string | null };
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: DecimalLike;
    unitPrice: DecimalLike | null;
    lineTotal: DecimalLike | null;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
    variantNameSnapshot: string | null;
  }>;
};

type StoredMarketplaceCheckout = {
  id: string;
  checkoutCode: string;
  customerUserId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  grandTotal: DecimalLike;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('CheckoutController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let products: StoredProduct[];
  let orders: StoredOrder[];
  let marketplaceCheckouts: StoredMarketplaceCheckout[];
  let customerAddresses: Array<{
    id: string;
    customerId: string;
    fullName: string;
    phone: string;
    country: string;
    city: string;
    region: string;
    street: string;
    apartment: string | null;
    postalCode: string | null;
    comment: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;

  const decimal = (value: string): DecimalLike => {
    const numeric = Number(value);

    return {
      plus(other: DecimalLike) {
        return decimal(String(numeric + Number(other.toString())));
      },
      mul(other: DecimalLike) {
        return decimal(String(numeric * Number(other.toString())));
      },
      gt(other: number) {
        return numeric > other;
      },
      lte(other: number) {
        return numeric <= other;
      },
      toString() {
        return numeric.toFixed(2).replace(/\.?0+$/, '');
      },
    };
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    productVariant: {
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    marketplaceCheckout: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    customerAddress: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'seller-user-1',
        email: 'seller@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'seller-profile-1',
          userId: 'seller-user-1',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-1',
        },
      },
      {
        id: 'seller-user-2',
        email: 'seller-two@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller Two',
        phone: null,
        role: 'SELLER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: {
          id: 'seller-profile-2',
          userId: 'seller-user-2',
          approvalStatus: 'APPROVED',
          currentShopId: 'shop-2',
        },
      },
      {
        id: 'customer-user-1',
        email: 'customer@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Customer One',
        phone: '0123456789',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        createdAt: new Date(),
        sellerProfile: null,
      },
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'seller-profile-1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to bank account 123.',
        sellerProfile: { userId: 'seller-user-1', approvalStatus: 'APPROVED' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'seller-profile-2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to bank account 456.',
        sellerProfile: { userId: 'seller-user-2', approvalStatus: 'APPROVED' },
      },
    ];

    products = [
      {
        id: 'product-1',
        shopId: 'shop-1',
        wbNmId: BigInt(101),
        wbTitle: 'Checkout Product',
        localTitle: 'Checkout Product Local',
        localDescription: 'Public description',
        wbDescription: 'Public description',
        seoSlug: 'checkout-product',
        brand: 'Strawberry',
        visibility: 'ACTIVE',
        catalogStatus: 'PUBLISHED',
        categoryId: BigInt(10),
        categoryName: 'Sneakers',
        source: 'MANUAL',
        images: [
          {
            id: 'image-1',
            wbUrl: 'https://example.com/product.jpg',
            localUrl: null,
            isMain: true,
            sortOrder: 0,
          },
        ],
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          paymentInstructions: 'Transfer to bank account 123.',
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        variants: [
          {
            id: 'variant-1',
            productId: 'product-1',
            chrtId: BigInt(1001),
            sellerSku: 'SKU-1-S',
            wbBarcode: 'BARCODE-1-S',
            sizeName: 'S',
            russianSize: '42',
            isActive: true,
            basePrice: decimal('120.00'),
            discountPrice: decimal('99.00'),
            stockQuantity: 10,
            reservedStock: 1,
            lowStockThreshold: 5,
            trackInventory: true,
            createdAt: new Date(),
          },
          {
            id: 'variant-1-m',
            productId: 'product-1',
            chrtId: BigInt(1002),
            sellerSku: 'SKU-1-M',
            wbBarcode: 'BARCODE-1-M',
            sizeName: 'M',
            russianSize: '44',
            isActive: true,
            basePrice: decimal('140.00'),
            discountPrice: decimal('110.00'),
            stockQuantity: 7,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
            createdAt: new Date(),
          },
        ],
      },
      {
        id: 'product-2',
        shopId: 'shop-2',
        wbNmId: BigInt(202),
        wbTitle: 'Other Shop Product',
        localTitle: null,
        localDescription: null,
        wbDescription: 'Other product',
        seoSlug: null,
        brand: null,
        visibility: 'ACTIVE',
        catalogStatus: 'PUBLISHED',
        categoryId: BigInt(10),
        categoryName: 'Sneakers',
        source: 'MANUAL',
        images: [
          {
            id: 'image-2',
            wbUrl: 'https://example.com/product-2.jpg',
            localUrl: null,
            isMain: true,
            sortOrder: 0,
          },
        ],
        shop: {
          id: 'shop-2',
          name: 'Shop Two',
          paymentInstructions: 'Transfer to bank account 456.',
          status: 'ACTIVE',
          sellerProfile: {
            approvalStatus: 'APPROVED',
          },
        },
        variants: [
          {
            id: 'variant-2',
            productId: 'product-2',
            chrtId: BigInt(2002),
            isActive: true,
            basePrice: decimal('200.00'),
            discountPrice: null,
            stockQuantity: 7,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
            createdAt: new Date(),
          },
        ],
      },
    ];

    orders = [];
    marketplaceCheckouts = [];
    customerAddresses = [
      {
        id: 'address-1',
        customerId: 'customer-user-1',
        fullName: 'Address Book Customer',
        phone: '+79990000055',
        country: 'RU',
        city: 'Moscow',
        region: 'Moscow',
        street: 'Arbat 10',
        apartment: '9',
        postalCode: '101000',
        comment: 'Use intercom 55',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({
        where,
        select,
        include,
      }: {
        where: { email?: string; id?: string };
        select?: { id?: boolean };
        include?: {
          sellerProfile?: boolean | { select: Record<string, boolean> };
        };
      }) => {
        const user = users.find((entry) =>
          where.email
            ? entry.email === where.email.toLowerCase()
            : entry.id === where.id,
        );
        if (!user) {
          return null;
        }

        if (select?.id) {
          return { id: user.id };
        }

        if (include?.sellerProfile) {
          return {
            ...user,
            sellerProfile: user.sellerProfile ?? null,
          };
        }

        return user;
      },
    );

    prismaMock.user.create.mockImplementation(
      ({
        data,
        select,
      }: {
        data: {
          email: string;
          passwordHash: string;
          fullName: string;
          phone: string;
          role: string;
          status: string;
        };
        select?: { id?: boolean };
      }) => {
        const created: StoredUser = {
          id: `guest-user-${users.length + 1}`,
          email: data.email,
          passwordHash: data.passwordHash,
          fullName: data.fullName,
          phone: data.phone,
          role: data.role,
          status: data.status,
          createdAt: new Date(),
          sellerProfile: null,
        };
        users.push(created);
        return select?.id ? { id: created.id } : created;
      },
    );

    prismaMock.shop.findUnique.mockImplementation(
      ({
        where,
        select,
      }: {
        where: { id: string };
        select?: Record<string, unknown>;
      }) => {
        const shop = shops.find((entry) => entry.id === where.id);
        if (!shop) {
          return null;
        }

        if (select?.sellerProfile) {
          return {
            id: shop.id,
            name: shop.name,
            paymentInstructions: shop.paymentInstructions,
            status: shop.status,
            sellerProfile: shop.sellerProfile,
          };
        }

        return {
          id: shop.id,
          name: shop.name,
          paymentInstructions: shop.paymentInstructions,
          status: shop.status,
        };
      },
    );

    prismaMock.product.findMany.mockImplementation(
      ({ where }: { where: { id?: { in?: string[] } } }) =>
        products.filter((product) =>
          where.id?.in ? where.id.in.includes(product.id) : true,
        ),
    );

    prismaMock.productVariant.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string; stockQuantity?: number; reservedStock?: number };
        data: {
          stockQuantity?: { decrement: number };
          reservedStock?: { increment: number };
        };
      }) => {
        const variant = products
          .flatMap((product) => product.variants)
          .find((entry) => entry.id === where.id);
        if (!variant) {
          throw new Error('Variant not found');
        }

        if (
          where.stockQuantity !== undefined &&
          variant.stockQuantity !== where.stockQuantity
        ) {
          return { count: 0 };
        }

        if (
          where.reservedStock !== undefined &&
          variant.reservedStock !== where.reservedStock
        ) {
          return { count: 0 };
        }

        if (data.stockQuantity?.decrement !== undefined) {
          variant.stockQuantity -= data.stockQuantity.decrement;
        }
        if (data.reservedStock?.increment !== undefined) {
          variant.reservedStock += data.reservedStock.increment;
        }
        return { count: 1 };
      },
    );

    prismaMock.order.create.mockImplementation(
      ({
        data,
        select,
      }: {
        data: {
          id: string;
          marketplaceCheckoutId?: string | null;
          customerId: string;
          shopId: string;
          orderNumber: string;
          status: string;
          paymentStatus: string;
          totalAmount: DecimalLike;
          shippingAddress: string;
          customerName: string;
          customerPhone: string;
          customerEmail: string | null;
          customerNote: string | null;
          shippingCost: DecimalLike;
          shippingMethodName: string;
          items: {
            create: Array<{
              id: string;
              productId?: string | null;
              variantId: string | null;
              quantity: number;
              priceAtPurchase: DecimalLike;
              unitPrice?: DecimalLike | null;
              lineTotal?: DecimalLike | null;
              productTitleSnapshot: string;
              productSlugSnapshot: string;
              productImageSnapshot: string | null;
              variantNameSnapshot?: string | null;
              wbNmIdSnapshot: bigint | null;
            }>;
          };
        };
        select?: Record<string, unknown>;
      }) => {
        const shop = shops.find((entry) => entry.id === data.shopId);
        if (!shop) {
          throw new Error('Shop not found');
        }

        const created: StoredOrder = {
          id: data.id,
          marketplaceCheckoutId: data.marketplaceCheckoutId ?? null,
          customerId: data.customerId,
          shopId: data.shopId,
          orderNumber: data.orderNumber,
          status: data.status,
          paymentStatus: data.paymentStatus,
          totalAmount: data.totalAmount,
          shippingCost: data.shippingCost,
          shippingMethodName: data.shippingMethodName,
          shippingAddress: data.shippingAddress,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          customerNote: data.customerNote,
          createdAt: new Date(),
          updatedAt: new Date(),
          customerCompletedAt: null,
          shop: {
            id: shop.id,
            name: shop.name,
            paymentInstructions: shop.paymentInstructions,
          },
          items: data.items.create.map((item) => ({
            id: item.id,
            productId: item.productId ?? null,
            variantId: item.variantId,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
            unitPrice: item.unitPrice ?? item.priceAtPurchase,
            lineTotal:
              item.lineTotal ??
              item.priceAtPurchase.mul(item.quantity as unknown as DecimalLike),
            productTitleSnapshot: item.productTitleSnapshot,
            productSlugSnapshot: item.productSlugSnapshot,
            productImageSnapshot: item.productImageSnapshot,
            variantNameSnapshot: item.variantNameSnapshot ?? null,
          })),
        };
        orders.push(created);

        if (select) {
          return {
            id: created.id,
            orderNumber: created.orderNumber,
            status: created.status,
            paymentStatus: created.paymentStatus,
            totalAmount: created.totalAmount,
            shop: {
              id: shop.id,
              name: shop.name,
              paymentInstructions: shop.paymentInstructions,
            },
          };
        }

        return created;
      },
    );

    prismaMock.marketplaceCheckout.create.mockImplementation(
      ({
        data,
        select,
      }: {
        data: {
          id: string;
          checkoutCode: string;
          customerUserId: string | null;
          customerName: string;
          customerPhone: string;
          customerEmail: string | null;
          grandTotal: DecimalLike;
          status: string;
        };
        select?: Record<string, unknown>;
      }) => {
        const created: StoredMarketplaceCheckout = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        marketplaceCheckouts.push(created);
        if (select) {
          return {
            id: created.id,
            checkoutCode: created.checkoutCode,
          };
        }
        return created;
      },
    );

    const attachCheckoutOrders = (checkout: StoredMarketplaceCheckout) => ({
      ...checkout,
      orders: orders
        .filter((order) => order.marketplaceCheckoutId === checkout.id)
        .map((order) => ({
          ...order,
          deliveryShipments: [],
        })),
    });

    prismaMock.marketplaceCheckout.findMany.mockImplementation(
      ({ where }: { where: { customerUserId?: string } }) =>
        marketplaceCheckouts
          .filter((checkout) =>
            where.customerUserId
              ? checkout.customerUserId === where.customerUserId
              : true,
          )
          .map(attachCheckoutOrders),
    );

    prismaMock.marketplaceCheckout.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: {
          checkoutCode?: string;
          customerUserId?: string;
          customerPhone?: string;
        };
      }) => {
        const checkout = marketplaceCheckouts.find(
          (entry) =>
            (!where.checkoutCode ||
              entry.checkoutCode === where.checkoutCode) &&
            (!where.customerUserId ||
              entry.customerUserId === where.customerUserId) &&
            (!where.customerPhone ||
              entry.customerPhone === where.customerPhone),
        );
        return checkout ? attachCheckoutOrders(checkout) : null;
      },
    );

    prismaMock.customerAddress.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; customerId?: string } }) =>
        customerAddresses.find(
          (address) =>
            (!where.id || address.id === where.id) &&
            (!where.customerId || address.customerId === where.customerId),
        ) ?? null,
    );

    prismaMock.order.findMany.mockImplementation(
      ({ where }: { where: { shopId?: string } }) =>
        orders.filter((order) =>
          where.shopId ? order.shopId === where.shopId : true,
        ),
    );

    prismaMock.order.count.mockImplementation(
      ({ where }: { where: { shopId?: string } }) =>
        orders.filter((order) =>
          where.shopId ? order.shopId === where.shopId : true,
        ).length,
    );

    prismaMock.order.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; shopId?: string } }) =>
        orders.find(
          (order) =>
            (!where.id || order.id === where.id) &&
            (!where.shopId || order.shopId === where.shopId),
        ) ?? null,
    );

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock),
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
    if (app) {
      await app.close();
    }
    jest.clearAllMocks();
  });

  it('creates an anonymous order and seller can see it in orders list', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-1', quantity: 2 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          email: 'alice@example.com',
          address: '123 Main St',
          note: 'Ring the bell',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(201);

    const createBody = readBody<CheckoutOrderResponseDto>(createResponse);
    expect(createBody.checkoutCode).toMatch(/^CHK-/);
    expect(createBody.orderId).toBeTruthy();
    expect(createBody.status).toBe('PENDING');
    expect(createBody.paymentStatus).toBe('PENDING');
    expect(createBody.totalAmount).toBe('198');
    expect(createBody.paymentInstructions).toBe(
      'Transfer to bank account 123.',
    );
    expect(products[0].variants[0].stockQuantity).toBe(8);
    expect(products[0].variants[0].reservedStock).toBe(3);

    const token = await loginAndGetToken(app);
    const listResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/orders?page=1&size=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listBody = readBody<PaginatedOrdersResponseDto>(listResponse);

    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].id).toBe(createBody.orderId);
    expect(listBody.items[0].customer.name).toBe('Alice Checkout');

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/shops/shop-1/orders/${createBody.orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const detailBody = readBody<OrderResponseDto>(detailResponse);

    expect(detailBody.items).toHaveLength(1);
    expect(detailBody.items[0].quantity).toBe(2);
    expect(detailBody.customer.phone).toBe('+0123456789');
  });

  it('creates a multi-variant order, sums trusted line totals, and deducts each variant', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [
          {
            productId: 'product-1',
            variantId: 'variant-1',
            quantity: 2,
          },
          {
            productId: 'product-1',
            variantId: 'variant-1-m',
            quantity: 3,
          },
        ],
        customer: {
          fullName: 'Multi Item Customer',
          phone: '0123456789',
          email: 'multi@example.com',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(201);

    const createBody = readBody<CheckoutOrderResponseDto>(createResponse);
    expect(createBody.checkoutCode).toMatch(/^CHK-/);
    expect(createBody.totalAmount).toBe('528');
    expect(products[0].variants[0].stockQuantity).toBe(8);
    expect(products[0].variants[0].reservedStock).toBe(3);
    expect(products[0].variants[1].stockQuantity).toBe(4);
    expect(products[0].variants[1].reservedStock).toBe(3);

    const token = await loginAndGetToken(app);
    const detailResponse = await request(app.getHttpServer())
      .get(`/api/shops/shop-1/orders/${createBody.orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const detailBody = readBody<OrderResponseDto>(detailResponse);

    expect(detailBody.items).toHaveLength(2);
    expect(detailBody.items.map((item) => item.variantId).sort()).toEqual([
      'variant-1',
      'variant-1-m',
    ]);
    expect(detailBody.items.map((item) => item.lineTotal).sort()).toEqual([
      '198',
      '330',
    ]);
  });

  it('splits multi-shop checkout into one order per shop', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', variantId: 'variant-1', quantity: 2 },
          { productId: 'product-2', variantId: 'variant-2', quantity: 3 },
        ],
        customer: {
          fullName: 'Multi Shop Customer',
          phone: '0123456789',
          email: 'multi-shop@example.com',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(201);

    const createBody = readBody<CheckoutOrderResponseDto>(createResponse);
    expect(createBody.checkoutCode).toMatch(/^CHK-/);
    expect(createBody.orders).toHaveLength(2);
    expect(createBody.grandTotal).toBe('798');
    expect(createBody.orderCodes).toHaveLength(2);
    expect(createBody.orderId).toBe(createBody.orders[0].orderId);

    const shopOneOrder = createBody.orders.find(
      (order) => order.shopId === 'shop-1',
    );
    const shopTwoOrder = createBody.orders.find(
      (order) => order.shopId === 'shop-2',
    );
    expect(shopOneOrder?.totalAmount).toBe('198');
    expect(shopOneOrder?.itemsCount).toBe(2);
    expect(shopTwoOrder?.totalAmount).toBe('600');
    expect(shopTwoOrder?.itemsCount).toBe(3);
    expect(products[0].variants[0].stockQuantity).toBe(8);
    expect(products[1].variants[0].stockQuantity).toBe(4);

    const sellerOneToken = await loginAndGetToken(app);
    const sellerTwoToken = await loginAndGetToken(
      app,
      'seller-two@example.com',
    );

    const shopOneDetail = await request(app.getHttpServer())
      .get(`/api/shops/shop-1/orders/${shopOneOrder!.orderId}`)
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .expect(200);
    expect(readBody<OrderResponseDto>(shopOneDetail).items).toHaveLength(1);

    const shopTwoDetail = await request(app.getHttpServer())
      .get(`/api/shops/shop-2/orders/${shopTwoOrder!.orderId}`)
      .set('Authorization', `Bearer ${sellerTwoToken}`)
      .expect(200);
    expect(readBody<OrderResponseDto>(shopTwoDetail).items).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/shops/shop-1/orders/${shopTwoOrder!.orderId}`)
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .expect(404);
  });

  it('attaches logged-in customer checkout to order history and public receipt lookup', async () => {
    const customerToken = await loginAndGetToken(app, 'customer@example.com');
    const createResponse = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', variantId: 'variant-1', quantity: 2 },
          { productId: 'product-2', variantId: 'variant-2', quantity: 3 },
        ],
        customer: {
          fullName: 'Customer One',
          phone: '0123456789',
          email: 'customer@example.com',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(201);

    const createBody = readBody<CheckoutOrderResponseDto>(createResponse);
    expect(createBody.checkoutCode).toMatch(/^CHK-/);
    expect(createBody.orderCode).toBe(createBody.orders[0].orderCode);

    const historyResponse = await request(app.getHttpServer())
      .get('/api/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const historyBody = readBody<{ items: Array<{ checkoutCode: string }> }>(
      historyResponse,
    );
    expect(historyBody.items.map((item) => item.checkoutCode)).toContain(
      createBody.checkoutCode,
    );

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/customer/orders/${createBody.checkoutCode}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const detailBody = readBody<{ orders: unknown[]; grandTotal: string }>(
      detailResponse,
    );
    expect(detailBody.orders).toHaveLength(2);
    expect(detailBody.grandTotal).toBe('798');

    const publicResponse = await request(app.getHttpServer())
      .get(
        `/api/public/checkouts/${createBody.checkoutCode}?phone=%2B0123456789`,
      )
      .expect(200);
    expect(readBody<{ orders: unknown[] }>(publicResponse).orders).toHaveLength(
      2,
    );

    await request(app.getHttpServer())
      .get(`/api/public/checkouts/${createBody.checkoutCode}?phone=wrong`)
      .expect(404);
  });

  it('uses a saved customer address snapshot when addressId is provided', async () => {
    const customerToken = await loginAndGetToken(app, 'customer@example.com');

    const createResponse = await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', variantId: 'variant-1', quantity: 1 },
        ],
        customer: {
          fullName: '',
          phone: '',
          email: 'customer@example.com',
          address: '',
        },
        addressId: 'address-1',
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(201);

    const createBody = readBody<CheckoutOrderResponseDto>(createResponse);
    expect(createBody.customerPhone).toBe('+79990000055');
    expect(orders[0].shippingAddress).toBe(
      'Arbat 10, 9, Moscow, Moscow, 101000, RU',
    );
    expect(orders[0].customerName).toBe('Address Book Customer');
    expect(orders[0].customerPhone).toBe('+79990000055');
    expect(orders[0].customerNote).toBe('Use intercom 55');
  });

  it('fails entire checkout when one variant has insufficient stock', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', variantId: 'variant-1', quantity: 2 },
          { productId: 'product-1', variantId: 'variant-1-m', quantity: 8 },
        ],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);

    expect(orders).toHaveLength(0);
    expect(products[0].variants[0].stockQuantity).toBe(10);
    expect(products[0].variants[1].stockQuantity).toBe(7);
  });

  it('fails when requested variant does not belong to the product', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', variantId: 'variant-2', quantity: 1 },
        ],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);
  });

  it('fails when one product does not exist and does not create partial orders', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [
          { productId: 'product-1', quantity: 1 },
          { productId: 'missing-product', quantity: 1 },
        ],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(404);

    expect(orders).toHaveLength(0);
    expect(products[0].variants[0].stockQuantity).toBe(10);
  });

  it('fails when quantity is invalid', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-1', quantity: 0 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);
  });

  it('fails when customer required fields are missing', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-1', quantity: 1 }],
        customer: {
          fullName: '',
          phone: '',
          address: '',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);
  });

  it('fails when requested quantity exceeds available stock', async () => {
    products[0].variants[0].stockQuantity = 1;
    products[0].variants[0].reservedStock = 1;

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-1', quantity: 2 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);
  });

  it('rejects checkout for unpublished products', async () => {
    products[0].catalogStatus = 'UNPUBLISHED';

    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-1', quantity: 1 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(400);
  });
});

async function loginAndGetToken(
  app: INestApplication<App>,
  email = 'seller@example.com',
) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email,
      password: 'password123',
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
