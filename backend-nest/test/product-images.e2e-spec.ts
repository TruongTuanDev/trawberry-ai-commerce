import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuthResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { FilesService } from '../src/modules/files/files.service';
import { ProductImageResponseDto } from '../src/modules/product-images/dto/product-image-response.dto';
import { readBody } from './test-helpers';

type StoredUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: string;
  status: string;
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
  sellerProfile: {
    userId: string;
  };
};

type StoredProduct = {
  id: string;
  shopId: string;
};

type StoredProductImage = {
  id: string;
  productId: string;
  wbUrl: string;
  localUrl: string | null;
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  imageType: string;
  isMain: boolean | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

describe('ProductImagesController (e2e)', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  let shops: StoredShop[];
  let products: StoredProduct[];
  let productImages: StoredProductImage[];

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    shop: {
      findUnique: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    productImage: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const filesServiceMock = {
    storeProductImage: jest.fn(),
    deleteProductImageFile: jest.fn(),
    createUploadDescriptor: jest.fn(),
  };

  beforeEach(async () => {
    users = [
      {
        id: 'user-s1',
        email: 'seller1@example.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        fullName: 'Seller One',
        role: 'SELLER',
        status: 'ACTIVE',
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
        role: 'SELLER',
        status: 'ACTIVE',
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
        sellerProfile: {
          userId: 'user-s2',
        },
      },
    ];

    products = [
      {
        id: 'prod-1',
        shopId: 'shop-1',
      },
      {
        id: 'prod-2',
        shopId: 'shop-2',
      },
    ];

    productImages = [
      {
        id: 'img-1',
        productId: 'prod-1',
        wbUrl:
          'http://localhost:3001/uploads/products/shop-1/prod-1/existing.jpg',
        localUrl:
          'http://localhost:3001/uploads/products/shop-1/prod-1/existing.jpg',
        storageKey: 'products/shop-1/prod-1/existing.jpg',
        originalName: 'existing.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
        imageType: 'FRONT',
        isMain: true,
        sortOrder: 0,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
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

    prismaMock.product.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; shopId?: string } }) =>
        Promise.resolve(
          products.find(
            (product) =>
              (where.id === undefined || product.id === where.id) &&
              (where.shopId === undefined || product.shopId === where.shopId),
          ) ?? null,
        ),
    );

    prismaMock.productImage.findMany.mockImplementation(
      ({ where }: { where: { productId: string } }) =>
        Promise.resolve(
          productImages
            .filter((image) => image.productId === where.productId)
            .sort((left, right) => {
              if ((left.isMain ?? false) !== (right.isMain ?? false)) {
                return left.isMain ? -1 : 1;
              }

              if (left.sortOrder !== right.sortOrder) {
                return left.sortOrder - right.sortOrder;
              }

              return left.createdAt.getTime() - right.createdAt.getTime();
            }),
        ),
    );

    prismaMock.productImage.count.mockImplementation(
      ({ where }: { where: { productId: string; isMain?: boolean } }) =>
        Promise.resolve(
          productImages.filter(
            (image) =>
              image.productId === where.productId &&
              (where.isMain === undefined || image.isMain === where.isMain),
          ).length,
        ),
    );

    prismaMock.productImage.create.mockImplementation(
      ({
        data,
      }: {
        data: Omit<StoredProductImage, 'createdAt' | 'updatedAt'>;
      }) => {
        const created: StoredProductImage = {
          ...data,
          localUrl: data.localUrl ?? null,
          storageKey: data.storageKey ?? null,
          originalName: data.originalName ?? null,
          mimeType: data.mimeType ?? null,
          size: data.size ?? null,
          imageType: data.imageType ?? 'ORIGINAL',
          isMain: data.isMain ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        productImages.push(created);
        return Promise.resolve(created);
      },
    );

    prismaMock.productImage.findFirst.mockImplementation(
      ({
        where,
        orderBy,
      }: {
        where: {
          id?: string | { not: string };
          productId?: string;
          isMain?: boolean;
        };
        orderBy?: Array<{
          sortOrder?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }>;
      }) =>
        Promise.resolve(
          [...productImages]
            .filter((image) => {
              const idFilter = where.id;
              const idMatches =
                idFilter === undefined
                  ? true
                  : typeof idFilter === 'string'
                    ? image.id === idFilter
                    : image.id !== idFilter.not;

              return (
                idMatches &&
                (where.productId === undefined ||
                  image.productId === where.productId) &&
                (where.isMain === undefined || image.isMain === where.isMain)
              );
            })
            .sort((left, right) => {
              if (!orderBy?.length) {
                return 0;
              }

              for (const order of orderBy) {
                if (order.sortOrder && left.sortOrder !== right.sortOrder) {
                  return order.sortOrder === 'asc'
                    ? left.sortOrder - right.sortOrder
                    : right.sortOrder - left.sortOrder;
                }

                if (
                  order.createdAt &&
                  left.createdAt.getTime() !== right.createdAt.getTime()
                ) {
                  return order.createdAt === 'asc'
                    ? left.createdAt.getTime() - right.createdAt.getTime()
                    : right.createdAt.getTime() - left.createdAt.getTime();
                }
              }

              return 0;
            })[0] ?? null,
        ),
    );

    prismaMock.productImage.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { productId: string; id?: { not: string } };
        data: Partial<StoredProductImage>;
      }) => {
        let count = 0;
        for (const image of productImages) {
          if (image.productId !== where.productId) {
            continue;
          }

          if (where.id?.not && image.id === where.id.not) {
            continue;
          }

          Object.assign(image, data, { updatedAt: new Date() });
          count += 1;
        }

        return Promise.resolve({ count });
      },
    );

    prismaMock.productImage.update.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<StoredProductImage>;
      }) => {
        const image = productImages.find((entry) => entry.id === where.id);
        if (!image) {
          throw new Error('Image not found');
        }

        Object.assign(image, data, { updatedAt: new Date() });
        return Promise.resolve(image);
      },
    );

    prismaMock.productImage.delete.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        const index = productImages.findIndex((image) => image.id === where.id);
        if (index === -1) {
          throw new Error('Image not found');
        }

        const [deleted] = productImages.splice(index, 1);
        return Promise.resolve(deleted);
      },
    );

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
        callback(prismaMock),
    );

    filesServiceMock.storeProductImage.mockImplementation(
      (
        file: { originalname: string; mimetype: string; size?: number },
        context: { shopId: string; productId: string },
      ) => ({
        publicUrl: `http://localhost:3001/uploads/products/${context.shopId}/${context.productId}/${file.originalname}`,
        storageKey: `products/${context.shopId}/${context.productId}/${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size ?? 7,
      }),
    );
    filesServiceMock.deleteProductImageFile.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(FilesService)
      .useValue(filesServiceMock)
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

  it('uploads images, lists them, updates metadata, and deletes one image', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('image-a'), {
        filename: 'new-a.jpg',
        contentType: 'image/jpeg',
      })
      .attach('files', Buffer.from('image-b'), {
        filename: 'new-b.png',
        contentType: 'image/png',
      })
      .expect(201);
    const uploadedImages = readBody<ProductImageResponseDto[]>(uploadResponse);

    expect(uploadedImages).toHaveLength(2);
    expect(uploadedImages[0].localUrl).toContain(
      '/uploads/products/shop-1/prod-1/new-a.jpg',
    );
    expect(uploadedImages[0].shopId).toBe('shop-1');
    expect(uploadedImages[0].imageType).toBe('ORIGINAL');

    const listResponse = await request(app.getHttpServer())
      .get('/api/shops/shop-1/products/prod-1/images')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const listedImages = readBody<ProductImageResponseDto[]>(listResponse);

    expect(listedImages).toHaveLength(3);
    expect(listedImages[0].id).toBe('img-1');

    const secondUploadedImageId = uploadedImages[1].id;
    const updateResponse = await request(app.getHttpServer())
      .patch(
        `/api/shops/shop-1/products/prod-1/images/${secondUploadedImageId}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .send({
        isMain: true,
        imageType: 'DETAIL',
        sortOrder: 5,
      })
      .expect(200);
    const updatedImage = readBody<ProductImageResponseDto>(updateResponse);

    expect(updatedImage.isMain).toBe(true);
    expect(updatedImage.imageType).toBe('DETAIL');
    expect(updatedImage.sortOrder).toBe(5);
    expect(productImages.find((image) => image.id === 'img-1')?.isMain).toBe(
      false,
    );

    const uploadedImageId = uploadedImages[0].id;
    await request(app.getHttpServer())
      .delete(`/api/shops/shop-1/products/prod-1/images/${uploadedImageId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(
      productImages.find((image) => image.id === uploadedImageId),
    ).toBeUndefined();
    expect(filesServiceMock.deleteProductImageFile).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported upload mime types', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', Buffer.from('not-an-image'), {
        filename: 'bad.gif',
        contentType: 'image/gif',
      })
      .expect(400);
  });

  it('rejects files larger than the configured max size', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 1);

    await request(app.getHttpServer())
      .post('/api/shops/shop-1/products/prod-1/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('files', largeBuffer, {
        filename: 'too-large.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });

  it('forbids access to images in another seller shop', async () => {
    const token = await loginAndGetToken(app, 'seller1@example.com');

    await request(app.getHttpServer())
      .get('/api/shops/shop-2/products/prod-2/images')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/shops/shop-2/products/prod-2/images/img-1')
      .set('Authorization', `Bearer ${token}`)
      .send({
        imageType: 'BACK',
      })
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
