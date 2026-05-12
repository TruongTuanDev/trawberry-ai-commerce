import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { OrderResponseDto } from '../src/modules/orders/dto/order-response.dto';
import { PaginatedOrdersResponseDto } from '../src/modules/orders/dto/paginated-orders-response.dto';
import { readBody } from './test-helpers';

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
  sellerProfile: { userId: string };
};

type StoredVariant = {
  id: string;
  stockQuantity: number;
  reservedStock: number;
};

type StoredOrder = {
  id: string;
  customerId: string;
  shopId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: { toString(): string };
  shippingCost: { toString(): string };
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
    priceAtPurchase: { toString(): string };
    productTitleSnapshot: string;
    productSlugSnapshot: string;
    productImageSnapshot: string | null;
  }>;
};

type UserFindUniqueArgs = {
  where: { email?: string; id?: string };
  include?: {
    sellerProfile?: boolean | { select: Record<string, boolean> };
  };
};

type ShopFindUniqueArgs = {
  where: { id: string };
};

type OrderListWhere = {
  id?: string;
  shopId?: string;
  status?: string;
  createdAt?: {
    gte?: Date;
    lt?: Date;
  };
  OR?: SearchCondition[];
};

type SearchCondition = {
  orderNumber?: { contains: string };
  customerName?: { contains: string };
  customerEmail?: { contains: string };
  customerPhone?: { contains: string };
  items?: {
    some?: {
      productTitleSnapshot?: { contains: string };
    };
  };
};

type OrderFindManyArgs = {
  where: OrderListWhere;
  skip?: number;
  take?: number;
};

type OrderFindFirstArgs = {
  where: OrderListWhere;
};

type OrderUpdateArgs = {
  where: { id: string };
  data: Partial<
    Pick<
      StoredOrder,
      | 'status'
      | 'paymentStatus'
      | 'shippingMethodName'
      | 'shippingAddress'
      | 'customerName'
      | 'customerPhone'
      | 'customerEmail'
      | 'customerNote'
      | 'customerCompletedAt'
    >
  >;
};

type VariantUpdateArgs = {
  where: { id: string };
  data: {
    reservedStock?: number;
    stockQuantity?: number;
  };
};

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let orders: StoredOrder[];
  let variants: StoredVariant[];

  const decimal = (value: string) => ({ toString: () => value });

  const prismaMock = {
    user: { findUnique: jest.fn() },
    shop: { findUnique: jest.fn() },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
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
        sellerProfile: { userId: 'user-s1' },
      },
      {
        id: 'shop-2',
        sellerProfileId: 'sp2',
        name: 'Shop Two',
        slug: 'shop-two',
        status: 'ACTIVE',
        sellerProfile: { userId: 'user-s2' },
      },
    ];

    variants = [
      { id: 'var-1', stockQuantity: 10, reservedStock: 2 },
      { id: 'var-2', stockQuantity: 5, reservedStock: 1 },
    ];

    orders = [
      {
        id: 'order-1',
        customerId: 'cust-1',
        shopId: 'shop-1',
        orderNumber: 'ORD-1001',
        status: 'NEW',
        paymentStatus: 'APPROVED',
        totalAmount: decimal('120.00'),
        shippingCost: decimal('10.00'),
        shippingMethodName: 'Courier',
        shippingAddress: '123 Main St',
        customerName: 'Alice',
        customerPhone: '123456',
        customerEmail: 'alice@example.com',
        customerNote: null,
        createdAt: new Date('2025-01-10T10:00:00Z'),
        updatedAt: new Date('2025-01-10T10:00:00Z'),
        customerCompletedAt: null,
        shop: { id: 'shop-1', name: 'Shop One' },
        items: [
          {
            id: 'item-1',
            variantId: 'var-1',
            quantity: 2,
            priceAtPurchase: decimal('55.00'),
            productTitleSnapshot: 'Alpha Shoe',
            productSlugSnapshot: 'alpha-shoe',
            productImageSnapshot: 'https://example.com/a.jpg',
          },
        ],
      },
      {
        id: 'order-2',
        customerId: 'cust-2',
        shopId: 'shop-1',
        orderNumber: 'ORD-1002',
        status: 'ASSEMBLING',
        paymentStatus: 'APPROVED',
        totalAmount: decimal('80.00'),
        shippingCost: decimal('5.00'),
        shippingMethodName: 'Pickup',
        shippingAddress: '456 Side St',
        customerName: 'Bob',
        customerPhone: '987654',
        customerEmail: 'bob@example.com',
        customerNote: 'Call me',
        createdAt: new Date('2025-01-12T10:00:00Z'),
        updatedAt: new Date('2025-01-12T10:00:00Z'),
        customerCompletedAt: null,
        shop: { id: 'shop-1', name: 'Shop One' },
        items: [
          {
            id: 'item-2',
            variantId: 'var-2',
            quantity: 1,
            priceAtPurchase: decimal('75.00'),
            productTitleSnapshot: 'Beta Bag',
            productSlugSnapshot: 'beta-bag',
            productImageSnapshot: 'https://example.com/b.jpg',
          },
        ],
      },
      {
        id: 'order-3',
        customerId: 'cust-3',
        shopId: 'shop-2',
        orderNumber: 'ORD-2001',
        status: 'NEW',
        paymentStatus: 'APPROVED',
        totalAmount: decimal('40.00'),
        shippingCost: decimal('3.00'),
        shippingMethodName: 'Courier',
        shippingAddress: '789 Other St',
        customerName: 'Carol',
        customerPhone: '555123',
        customerEmail: 'carol@example.com',
        customerNote: null,
        createdAt: new Date('2025-01-11T10:00:00Z'),
        updatedAt: new Date('2025-01-11T10:00:00Z'),
        customerCompletedAt: null,
        shop: { id: 'shop-2', name: 'Shop Two' },
        items: [],
      },
    ];

    prismaMock.user.findUnique.mockImplementation(
      ({ where, include }: UserFindUniqueArgs) => {
        const found = users.find((user) =>
          where.email
            ? user.email === where.email.toLowerCase()
            : user.id === where.id,
        );
        if (!found) return Promise.resolve(null);
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
      ({ where }: ShopFindUniqueArgs) =>
        Promise.resolve(shops.find((shop) => shop.id === where.id) ?? null),
    );

    prismaMock.order.findMany.mockImplementation(
      ({ where, skip = 0, take = orders.length }: OrderFindManyArgs) =>
        Promise.resolve(filterOrders(orders, where).slice(skip, skip + take)),
    );
    prismaMock.order.count.mockImplementation(
      ({ where }: { where: OrderListWhere }) =>
        Promise.resolve(filterOrders(orders, where).length),
    );
    prismaMock.order.findFirst.mockImplementation(
      ({ where }: OrderFindFirstArgs) =>
        Promise.resolve(filterOrders(orders, where)[0] ?? null),
    );
    prismaMock.order.update.mockImplementation(
      ({ where, data }: OrderUpdateArgs) => {
        const idx = orders.findIndex((o) => o.id === where.id);
        if (idx === -1) throw new Error('Order not found');
        orders[idx] = {
          ...orders[idx],
          ...Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
          updatedAt: new Date(),
        };
        return Promise.resolve(orders[idx]);
      },
    );

    prismaMock.productVariant.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          variants.find((variant) => variant.id === where.id) ?? null,
        ),
    );
    prismaMock.productVariant.update.mockImplementation(
      ({ where, data }: VariantUpdateArgs) => {
        const variant = variants.find((v) => v.id === where.id);
        if (!variant) throw new Error('Variant not found');
        if (data.reservedStock !== undefined) {
          variant.reservedStock = data.reservedStock;
        }
        if (data.stockQuantity !== undefined) {
          variant.stockQuantity = data.stockQuantity;
        }
        return Promise.resolve(variant);
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

  it('lists shop orders with pagination, search and status filter', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get(
        '/api/shops/shop-1/orders?page=1&size=1&status=ASSEMBLING&search=beta',
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<PaginatedOrdersResponseDto>(response);

    expect(body.items).toHaveLength(1);
    expect(body.items[0].orderNumber).toBe('ORD-1002');
    expect(body.meta.total).toBe(1);
  });

  it('returns order detail for seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const response = await request(app.getHttpServer())
      .get('/api/shops/shop-1/orders/order-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = readBody<OrderResponseDto>(response);

    expect(body.id).toBe('order-1');
    expect(body.customer.name).toBe('Alice');
    expect(body.items[0].productTitleSnapshot).toBe('Alpha Shoe');
  });

  it('updates order status with legacy transition rules', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const assembling = await request(app.getHttpServer())
      .patch('/api/shops/shop-1/orders/order-1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ASSEMBLING' })
      .expect(200);
    expect(readBody<OrderResponseDto>(assembling).status).toBe('ASSEMBLING');

    const shipping = await request(app.getHttpServer())
      .patch('/api/shops/shop-1/orders/order-2/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SHIPPING' })
      .expect(200);
    expect(readBody<OrderResponseDto>(shipping).status).toBe('SHIPPING');
  });

  it('forbids access to another seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    await request(app.getHttpServer())
      .get('/api/shops/shop-2/orders')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

async function loginAndGetToken(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'password123' })
    .expect(200);

  return readBody<AuthResponseDto>(response).accessToken;
}

function filterOrders(orders: StoredOrder[], where: OrderListWhere) {
  return orders
    .filter((order) => {
      if (where.id && order.id !== where.id) {
        return false;
      }
      if (where.shopId && order.shopId !== where.shopId) {
        return false;
      }
      if (where.status && order.status !== where.status) {
        return false;
      }
      if (where.createdAt?.gte && order.createdAt < where.createdAt.gte) {
        return false;
      }
      if (where.createdAt?.lt && order.createdAt >= where.createdAt.lt) {
        return false;
      }
      if (where.OR && Array.isArray(where.OR)) {
        const searchMatch = where.OR.some((condition) => {
          if (condition.orderNumber?.contains) {
            return order.orderNumber
              .toLowerCase()
              .includes(String(condition.orderNumber.contains).toLowerCase());
          }
          if (condition.customerName?.contains) {
            return order.customerName
              .toLowerCase()
              .includes(String(condition.customerName.contains).toLowerCase());
          }
          if (condition.customerEmail?.contains) {
            return (order.customerEmail ?? '')
              .toLowerCase()
              .includes(String(condition.customerEmail.contains).toLowerCase());
          }
          if (condition.customerPhone?.contains) {
            return order.customerPhone
              .toLowerCase()
              .includes(String(condition.customerPhone.contains).toLowerCase());
          }
          if (condition.items?.some?.productTitleSnapshot?.contains) {
            const term = String(
              condition.items.some.productTitleSnapshot.contains,
            ).toLowerCase();
            return order.items.some((item) =>
              item.productTitleSnapshot.toLowerCase().includes(term),
            );
          }
          return false;
        });
        if (!searchMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
