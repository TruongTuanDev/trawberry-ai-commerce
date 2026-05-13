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
  sellerProfile: { userId: string };
};

type StoredVariant = {
  id: string;
  productId: string;
  chrtId: bigint;
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
  images: Array<{
    id: string;
    wbUrl: string;
    localUrl: string | null;
    isMain: boolean;
    sortOrder: number;
  }>;
  variants: StoredVariant[];
};

type StoredOrder = {
  id: string;
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
  shop: { id: string; name: string };
  items: Array<{
    id: string;
    variantId: string | null;
    quantity: number;
    priceAtPurchase: DecimalLike;
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
};

describe('CheckoutController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let products: StoredProduct[];
  let orders: StoredOrder[];

  const decimal = (value: string): DecimalLike => {
    const numeric = Number(value);

    return {
      plus(other: DecimalLike) {
        return decimal(String(numeric + Number(other.toString())));
      },
      mul(other: DecimalLike) {
        return decimal(String(numeric * Number(other.toString())));
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
    ];

    shops = [
      {
        id: 'shop-1',
        sellerProfileId: 'seller-profile-1',
        name: 'Shop One',
        slug: 'shop-one',
        status: 'ACTIVE',
        paymentInstructions: 'Transfer to bank account 123.',
        sellerProfile: { userId: 'seller-user-1' },
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
        images: [
          {
            id: 'image-1',
            wbUrl: 'https://example.com/product.jpg',
            localUrl: null,
            isMain: true,
            sortOrder: 0,
          },
        ],
        variants: [
          {
            id: 'variant-1',
            productId: 'product-1',
            chrtId: BigInt(1001),
            isActive: true,
            basePrice: decimal('120.00'),
            discountPrice: decimal('99.00'),
            stockQuantity: 10,
            reservedStock: 1,
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
        images: [],
        variants: [
          {
            id: 'variant-2',
            productId: 'product-2',
            chrtId: BigInt(2002),
            isActive: true,
            basePrice: decimal('50.00'),
            discountPrice: null,
            stockQuantity: 5,
            reservedStock: 0,
            lowStockThreshold: 5,
            trackInventory: true,
            createdAt: new Date(),
          },
        ],
      },
    ];

    orders = [];

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
              variantId: string | null;
              quantity: number;
              priceAtPurchase: DecimalLike;
              productTitleSnapshot: string;
              productSlugSnapshot: string;
              productImageSnapshot: string | null;
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
          },
          items: data.items.create.map((item) => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
            productTitleSnapshot: item.productTitleSnapshot,
            productSlugSnapshot: item.productSlugSnapshot,
            productImageSnapshot: item.productImageSnapshot,
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
              paymentInstructions: shop.paymentInstructions,
            },
          };
        }

        return created;
      },
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
    expect(detailBody.customer.phone).toBe('0123456789');
  });

  it('fails when shop does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: '41c7fc54-9600-4ba1-bac3-2f98cf2aaf01',
        items: [{ productId: 'product-1', quantity: 1 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'MANUAL_TRANSFER',
      })
      .expect(404);
  });

  it('fails when product does not belong to shop', async () => {
    await request(app.getHttpServer())
      .post('/api/checkout/orders')
      .send({
        shopId: 'shop-1',
        items: [{ productId: 'product-2', quantity: 1 }],
        customer: {
          fullName: 'Alice Checkout',
          phone: '0123456789',
          address: '123 Main St',
        },
        paymentMethod: 'CASH_ON_DELIVERY',
      })
      .expect(400);
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
});

async function loginAndGetToken(app: INestApplication<App>) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: 'seller@example.com',
      password: 'password123',
    })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}
