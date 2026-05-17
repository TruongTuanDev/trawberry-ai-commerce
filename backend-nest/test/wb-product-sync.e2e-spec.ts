import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES } from '../src/common/constants/roles.constant';
import { WbProductSyncService } from '../src/modules/wb-sync/wb-product-sync.service';

jest.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {},
  Prisma: {},
}));

type CredentialRecord = {
  encryptedApiKey: string;
  keyLast4: string | null;
  lastVerifiedAt: Date | null;
  lastVerificationStatus: string;
  lastVerificationError: string | null;
  updatedAt: Date;
};

type VerifyResult = {
  success: true;
  mode: 'mock' | 'real';
  fetched: number;
  message: string;
};

type UpsertArgs = {
  create: Partial<CredentialRecord>;
  update: Partial<CredentialRecord>;
};

type UpdateArgs = {
  data: Partial<CredentialRecord>;
};

type WbSyncRunCreateArgs = {
  data: Record<string, unknown>;
};

type WbSyncRunUpdateArgs = {
  data: {
    status?: string;
    totalFetched?: number;
    totalProducts?: number;
    totalVariants?: number;
    totalImages?: number;
    createdProducts?: number;
    updatedProducts?: number;
    createdVariants?: number;
    updatedVariants?: number;
    warningsJson?: unknown[];
    errorsJson?: unknown[];
    rawSummaryJson?: Record<string, unknown> | null;
  };
};

type ProductCreateArgs = {
  data: {
    id: string;
    shopId?: string;
    [key: string]: unknown;
  };
};

type ProductUpdateArgs = {
  where: { id: string };
  data: Record<string, unknown>;
};

describe('WbProductSyncService credentials', () => {
  const user = {
    userId: 'seller-user-1',
    email: 'seller@example.com',
    role: USER_ROLES.SELLER,
  };
  const adminUser = {
    userId: 'admin-user-1',
    email: 'admin@example.com',
    role: USER_ROLES.ADMIN,
  };

  function createService(options?: {
    mode?: 'mock' | 'real';
    encryptionKey?: string | null;
    verifyImpl?: (apiKey: string) => Promise<VerifyResult>;
    shopOwnerUserId?: string;
  }) {
    let credentialStore: CredentialRecord | null = null;

    const shop = {
      findFirst: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { id: string; sellerProfile?: { userId: string } };
          }) =>
            Promise.resolve(
              !where.sellerProfile ||
                where.sellerProfile.userId ===
                  (options?.shopOwnerUserId ?? user.userId)
                ? {
                    id: 'shop-1',
                    sellerProfile: { approvalStatus: 'APPROVED' },
                  }
                : null,
            ),
        ),
    };

    const shopWbCredential = {
      upsert: jest.fn().mockImplementation(({ create, update }: UpsertArgs) => {
        const now = new Date();
        credentialStore = {
          encryptedApiKey:
            create.encryptedApiKey ?? update.encryptedApiKey ?? '',
          keyLast4: create.keyLast4 ?? update.keyLast4 ?? null,
          lastVerifiedAt:
            update.lastVerifiedAt ?? create.lastVerifiedAt ?? null,
          lastVerificationStatus:
            update.lastVerificationStatus ??
            create.lastVerificationStatus ??
            'NOT_VERIFIED',
          lastVerificationError:
            update.lastVerificationError ??
            create.lastVerificationError ??
            null,
          updatedAt: now,
        };
        return Promise.resolve(credentialStore);
      }),
      findUnique: jest
        .fn()
        .mockImplementation(() => Promise.resolve(credentialStore)),
      deleteMany: jest.fn().mockImplementation(() => {
        credentialStore = null;
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn().mockImplementation(({ data }: UpdateArgs) => {
        if (!credentialStore) {
          throw new Error('No credential store present');
        }
        credentialStore = {
          ...credentialStore,
          ...data,
          updatedAt: new Date(),
        };
        return Promise.resolve(credentialStore);
      }),
    };

    const prisma = {
      shop,
      shopWbCredential,
      $transaction: jest
        .fn()
        .mockImplementation(
          async (
            callback: (tx: Record<string, unknown>) => Promise<unknown>,
            transactionOptions?: { maxWait?: number; timeout?: number },
          ) => {
            void transactionOptions;
            const tx = {
              product: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest
                  .fn()
                  .mockImplementation(({ data }: ProductCreateArgs) =>
                    Promise.resolve({ id: data.id, ...data }),
                  ),
                update: jest
                  .fn()
                  .mockImplementation(({ where, data }: ProductUpdateArgs) =>
                    Promise.resolve({ id: where.id, ...data }),
                  ),
              },
              productVariant: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'variant-1' }),
                update: jest.fn().mockResolvedValue({ id: 'variant-1' }),
              },
              productImage: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'image-1' }),
              },
            };
            return callback(tx);
          },
        ),
      wbSyncRun: {
        create: jest.fn().mockImplementation(({ data }: WbSyncRunCreateArgs) =>
          Promise.resolve({
            id: 'run-1',
            ...data,
          }),
        ),
        update: jest.fn().mockImplementation(({ data }: WbSyncRunUpdateArgs) =>
          Promise.resolve({
            id: 'run-1',
            status: data.status ?? 'COMPLETED',
            mode: 'PREVIEW',
            syncType: 'ALL_PRODUCTS',
            article: null,
            totalFetched: data.totalFetched ?? 0,
            totalProducts: data.totalProducts ?? 0,
            totalVariants: data.totalVariants ?? 0,
            totalImages: data.totalImages ?? 0,
            createdProducts: data.createdProducts ?? 0,
            updatedProducts: data.updatedProducts ?? 0,
            createdVariants: data.createdVariants ?? 0,
            updatedVariants: data.updatedVariants ?? 0,
            warningsJson: data.warningsJson ?? [],
            errorsJson: data.errorsJson ?? [],
            rawSummaryJson: data.rawSummaryJson ?? null,
            createdAt: new Date(),
            startedAt: new Date(),
            completedAt: new Date(),
          }),
        ),
      },
    };

    const apiClient = {
      getMode: jest.fn().mockReturnValue(options?.mode ?? 'real'),
      fetchCards: jest.fn().mockResolvedValue({
        cards: [],
        mode: options?.mode ?? 'real',
        pagesFetched: 1,
        fetchedCount: 0,
        cursor: { total: 0 },
      }),
      verifyConnection: jest.fn().mockImplementation(
        options?.verifyImpl ??
          ((apiKey: string) =>
            Promise.resolve({
              success: true as const,
              mode: 'real' as const,
              fetched: apiKey ? 1 : 0,
              message: 'WB API connection verified',
            })),
      ),
    };

    const config = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'WB_CREDENTIAL_ENCRYPTION_KEY':
            return options && 'encryptionKey' in options
              ? options.encryptionKey
              : 'test-encryption-key';
          case 'WB_CREDENTIALS_ENCRYPTION_KEY':
            return null;
          case 'WB_SYNC_PAGE_LIMIT':
            return '100';
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService;

    const service = new WbProductSyncService(
      prisma as never,
      apiClient as never,
      {
        mapCard: jest.fn().mockImplementation(() => ({
          source: 'WILDBERRIES_API',
          externalProductId: '123',
          sellerSku: 'WB-ARTICLE-1',
          wbNmId: BigInt(123),
          wbImtId: BigInt(456),
          wbNmUuid: 'nm-uuid-1',
          name: 'Imported product',
          description: 'Imported from Wildberries',
          brand: 'WB Brand',
          categoryName: 'T-Shirts',
          categoryId: null,
          mappedCategoryName: null,
          sourceCategoryName: null,
          subjectId: BigInt(789),
          videoUrl: null,
          needKiz: null,
          dimensions: {
            width: 10,
            height: 20,
            length: 30,
            weightBrutto: 400,
            isValid: true,
          },
          characteristics: {
            gender: null,
            composition: null,
            color: null,
          },
          variants: [
            {
              chrtId: BigInt(987),
              sellerSku: 'WB-ARTICLE-1',
              wbBarcode: 'barcode-1',
              sizeName: 'M',
              russianSize: '46',
            },
          ],
          images: [
            {
              url: 'https://images.example.com/1.jpg',
              isMain: true,
              sortOrder: 0,
            },
          ],
          warnings: [],
          errors: [],
        })),
      } as never,
      {
        mapSourceCategory: jest.fn().mockResolvedValue({
          sourceCategoryName: null,
          categoryId: null,
          categoryName: null,
          warning: null,
        }),
      } as never,
      config,
    );

    return {
      service,
      apiClient,
      credentialStore: () => credentialStore,
      setCredentialStore: (next: CredentialRecord | null) => {
        credentialStore = next;
      },
      prisma,
    };
  }

  it('saves encrypted credentials and reports keyLast4 only', async () => {
    const { service, credentialStore } = createService();

    const result = await service.saveCredentials(
      'shop-1',
      user,
      '  secret-api-key-1234  ',
    );

    expect(result.connected).toBe(true);
    expect(result.keyLast4).toBe('1234');
    expect(result.mode).toBe('real');
    expect(result.lastVerificationStatus).toBe('NOT_VERIFIED');
    expect(credentialStore()?.encryptedApiKey).toBeDefined();
    expect(credentialStore()?.encryptedApiKey).not.toContain(
      'secret-api-key-1234',
    );
    expect('apiKey' in result).toBe(false);
  });

  it('updates credentials and changes keyLast4 immediately', async () => {
    const { service, credentialStore } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const result = await service.saveCredentials(
      'shop-1',
      user,
      'secret-api-key-9999',
    );

    expect(result.keyLast4).toBe('9999');
    expect(result.lastVerificationStatus).toBe('NOT_VERIFIED');
    expect(credentialStore()?.encryptedApiKey).not.toContain(
      'secret-api-key-9999',
    );
  });

  it('deletes credentials and returns disconnected status', async () => {
    const { service } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const deleted = await service.deleteCredentials('shop-1', user);
    const status = await service.credentialsStatus('shop-1', user);

    expect(deleted.connected).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.keyLast4).toBeNull();
  });

  it('verifies stored credentials and persists success metadata', async () => {
    const { service, apiClient, credentialStore } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const result = await service.verifyCredentials('shop-1', user);

    expect(result.success).toBe(true);
    expect(apiClient.verifyConnection).toHaveBeenCalledTimes(1);
    expect(apiClient.verifyConnection).toHaveBeenCalledWith(
      'secret-api-key-1234',
    );
    expect(credentialStore()?.lastVerificationStatus).toBe('SUCCESS');
    expect(credentialStore()?.lastVerifiedAt).toBeInstanceOf(Date);
    expect(credentialStore()?.lastVerificationError).toBeNull();
  });

  it('fails clearly when verify is requested in mock mode', async () => {
    const { service, credentialStore } = createService({ mode: 'mock' });

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');

    await expect(service.verifyCredentials('shop-1', user)).rejects.toThrow(
      'WB_MOCK_MODE_ACTIVE',
    );
    expect(credentialStore()?.lastVerificationStatus).toBe('NOT_VERIFIED');
  });

  it('stores a sanitized failure when verification fails', async () => {
    const { service, credentialStore } = createService({
      verifyImpl: (apiKey: string) =>
        Promise.reject(
          new BadGatewayException(
            `Wildberries API rejected the token or token scope. Bearer ${apiKey}abcdefghijklmnopqrstuvwxyz123456`,
          ),
        ),
    });

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');

    await expect(service.verifyCredentials('shop-1', user)).rejects.toThrow(
      BadRequestException,
    );
    expect(credentialStore()?.lastVerificationStatus).toBe('FAILED');
    expect(credentialStore()?.lastVerificationError).toContain('Bearer ***');
    expect(credentialStore()?.lastVerificationError).not.toContain(
      'abcdefghijklmnopqrstuvwxyz123456',
    );
  });

  it('fails clearly when stored credentials cannot be decrypted', async () => {
    const { service, credentialStore, setCredentialStore } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    setCredentialStore({
      ...(credentialStore() as CredentialRecord),
      encryptedApiKey: 'v1:broken:payload',
    });

    await expect(service.verifyCredentials('shop-1', user)).rejects.toThrow(
      'WB_CREDENTIAL_DECRYPT_FAILED',
    );
  });

  it('fails clearly in real mode when the shop has no credential', async () => {
    const { service } = createService();

    await expect(
      service.syncAll('shop-1', user, {
        mode: 'PREVIEW',
        limit: 5,
        publishMode: 'DRAFT',
        imageMode: 'REMOTE_URL',
      }),
    ).rejects.toThrow('WB_CREDENTIAL_MISSING');
  });

  it('uses the current shop credential for sync and records only keyLast4', async () => {
    const { service, apiClient, prisma } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const result = await service.syncAll('shop-1', user, {
      mode: 'PREVIEW',
      limit: 5,
      publishMode: 'DRAFT',
      imageMode: 'REMOTE_URL',
    });

    expect(apiClient.fetchCards).toHaveBeenCalledWith({
      apiKey: 'secret-api-key-1234',
      limit: 5,
      article: undefined,
    });
    expect(prisma.wbSyncRun.create).toHaveBeenCalled();
    expect(prisma.wbSyncRun.update).toHaveBeenCalled();
    expect(result.sourceMode).toBe('real');
    expect(result.rawSummary?.credentialKeyLast4).toBe('1234');
    expect(JSON.stringify(result)).not.toContain('secret-api-key-1234');
  });

  it('runs import sync inside a longer-lived Prisma transaction', async () => {
    const { service, apiClient, prisma } = createService();
    apiClient.fetchCards.mockResolvedValue({
      cards: [
        {
          nmID: 123,
          imtID: 456,
          nmUUID: 'nm-uuid-1',
          subjectName: 'T-Shirts',
          vendorCode: 'WB-ARTICLE-1',
          brand: 'WB Brand',
          title: 'Imported product',
          description: 'Imported from Wildberries',
          dimensions: {
            width: 10,
            height: 20,
            length: 30,
            weightBrutto: 400,
            isValid: true,
          },
          photos: [{ big: 'https://images.example.com/1.jpg' }],
          video: '',
          characteristics: [],
          sizes: [
            {
              chrtID: 987,
              techSize: 'M',
              wbSize: '46',
              skus: ['barcode-1'],
            },
          ],
        },
      ],
      mode: 'real',
      pagesFetched: 1,
      fetchedCount: 1,
      cursor: { total: 1 },
    });

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    await service.syncAll('shop-1', user, {
      mode: 'IMPORT',
      limit: 5,
      publishMode: 'DRAFT',
      imageMode: 'REMOTE_URL',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxWait: 10_000,
        timeout: 60_000,
      }),
    );
  });

  it('forbids cross-shop seller credential access', async () => {
    const { service } = createService({ shopOwnerUserId: 'seller-user-2' });

    await expect(
      service.saveCredentials('shop-1', user, 'secret-api-key-1234'),
    ).rejects.toThrow('You do not have access to this shop.');
  });

  it('allows admin to read shop credential status without exposing the raw key', async () => {
    const { service } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const status = await service.credentialsStatus('shop-1', adminUser);

    expect(status.connected).toBe(true);
    expect(status.keyLast4).toBe('1234');
    expect('apiKey' in status).toBe(false);
  });

  it('returns diagnostics with config and verify readiness', async () => {
    const { service } = createService({ mode: 'real' });

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    const diagnostics = await service.diagnostics('shop-1', user);

    expect(diagnostics.connected).toBe(true);
    expect(diagnostics.keyLast4).toBe('1234');
    expect(diagnostics.canAttemptRealVerify).toBe(true);
    expect(diagnostics.missingConfig).toEqual([]);
  });

  it('fails clearly when encryption key is missing', async () => {
    const { service } = createService({ encryptionKey: null });

    await expect(
      service.saveCredentials('shop-1', user, 'secret-api-key-1234'),
    ).rejects.toThrow(
      'WB_CREDENTIAL_ENCRYPTION_KEY is required to store WB credentials.',
    );
  });
});
