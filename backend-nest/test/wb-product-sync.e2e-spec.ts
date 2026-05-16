import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES } from '../src/common/constants/roles.constant';
import { WbProductSyncService } from '../src/modules/wb-sync/wb-product-sync.service';

type CredentialRecord = {
  encryptedApiKey: string;
  keyLast4: string | null;
  lastVerifiedAt: Date | null;
  lastVerificationStatus: string;
  lastError: string | null;
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

describe('WbProductSyncService credentials', () => {
  const user = {
    userId: 'seller-user-1',
    email: 'seller@example.com',
    role: USER_ROLES.SELLER,
  };

  function createService(options?: {
    mode?: 'mock' | 'real';
    encryptionKey?: string | null;
    verifyImpl?: (apiKey: string) => Promise<VerifyResult>;
  }) {
    let credentialStore: CredentialRecord | null = null;

    const shop = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'shop-1',
        sellerProfile: { approvalStatus: 'APPROVED' },
      }),
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
          lastError: update.lastError ?? create.lastError ?? null,
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
    };

    const apiClient = {
      getMode: jest.fn().mockReturnValue(options?.mode ?? 'real'),
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
      {} as never,
      {} as never,
      config,
    );

    return {
      service,
      apiClient,
      credentialStore: () => credentialStore,
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
  });

  it('deletes credentials and returns disconnected status', async () => {
    const { service } = createService();

    await service.saveCredentials('shop-1', user, 'secret-api-key-1234');
    await service.deleteCredentials('shop-1', user);
    const status = await service.credentialsStatus('shop-1', user);

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
    expect(credentialStore()?.lastError).toBeNull();
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
    expect(credentialStore()?.lastError).toContain('Bearer ***');
    expect(credentialStore()?.lastError).not.toContain(
      'abcdefghijklmnopqrstuvwxyz123456',
    );
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
