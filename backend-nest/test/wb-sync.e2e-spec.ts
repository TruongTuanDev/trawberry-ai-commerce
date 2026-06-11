import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WbApiClientService } from '../src/modules/wb-sync/wb-api-client.service';
import { WbProductMapperService } from '../src/modules/wb-sync/wb-product-mapper.service';

function responseWithJson(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as Response;
}

function getRequestBody(init: RequestInit | undefined): string {
  if (typeof init?.body !== 'string') {
    throw new Error('Expected request body to be a JSON string.');
  }

  return init.body;
}

type CardsListRequestBody = {
  settings: {
    cursor: {
      limit: number;
      updatedAt?: string;
      nmID?: number;
    };
    filter: { withPhoto: number };
    sort?: { ascending: boolean };
  };
};

function parseRequestBody(init: RequestInit | undefined): CardsListRequestBody {
  return JSON.parse(getRequestBody(init)) as CardsListRequestBody;
}

describe('WB API sync foundation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mock client returns WB cards without a real token', async () => {
    const client = new WbApiClientService({
      get: (key: string) => (key === 'WB_SYNC_MODE' ? 'mock' : undefined),
    } as ConfigService);
    const response = await client.fetchCards({ apiKey: null, limit: 100 });
    expect(response.cards.length).toBeGreaterThanOrEqual(2);
    expect(response.cards[0].vendorCode).toBe('APT-MOCK-HOODIE');
    expect(response.mode).toBe('mock');
  });

  it('mock client filters multiple exact nmIDs without matching vendor codes', async () => {
    const client = new WbApiClientService({
      get: (key: string) => (key === 'WB_SYNC_MODE' ? 'mock' : undefined),
    } as ConfigService);

    const response = await client.fetchCards({
      apiKey: null,
      limit: 100,
      nmIds: ['111000002', '999999999'],
    });

    expect(response.cards.map((card) => card.vendorCode)).toEqual([
      'APT-MOCK-SHIRT',
    ]);
    expect(response.cards.map((card) => card.nmID)).toEqual([111000002]);
  });

  it('real mode does not fall back to mock when token is missing', async () => {
    const client = new WbApiClientService({
      get: (key: string) => {
        if (key === 'WB_SYNC_MODE') return 'real';
        return undefined;
      },
    } as ConfigService);

    await expect(
      client.fetchCards({ apiKey: null, limit: 10 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('real client sends the expected cards list request body', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(responseWithJson({ cards: [], cursor: { total: 0 } }));

    const client = new WbApiClientService({
      get: (key: string) => {
        switch (key) {
          case 'WB_SYNC_MODE':
            return 'real';
          case 'WB_API_BASE_URL':
            return 'https://content-api.wildberries.ru';
          case 'WB_SYNC_PAGE_LIMIT':
            return '100';
          case 'WB_SYNC_MAX_PAGES':
            return '20';
          default:
            return undefined;
        }
      },
    } as ConfigService);

    await client.fetchCards({ apiKey: 'secret-token', limit: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://content-api.wildberries.ru/content/v2/get/cards/list',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'secret-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(getRequestBody(init))).toEqual({
      settings: {
        cursor: { limit: 5 },
        filter: { withPhoto: -1 },
        sort: { ascending: true },
      },
    });
  });

  it('real client paginates with cursor until total is below limit', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        responseWithJson({
          cards: [
            { vendorCode: 'APT-1', nmID: 1 },
            { vendorCode: 'APT-2', nmID: 2 },
          ],
          cursor: { total: 2, nmID: 2, updatedAt: '2026-05-17T00:00:00Z' },
        }),
      )
      .mockResolvedValueOnce(
        responseWithJson({
          cards: [{ vendorCode: 'APT-3', nmID: 3 }],
          cursor: { total: 1, nmID: 3, updatedAt: '2026-05-17T00:01:00Z' },
        }),
      );

    const client = new WbApiClientService({
      get: (key: string) => {
        switch (key) {
          case 'WB_SYNC_MODE':
            return 'real';
          case 'WB_API_BASE_URL':
            return 'https://content-api.wildberries.ru';
          case 'WB_SYNC_PAGE_LIMIT':
            return '2';
          case 'WB_SYNC_MAX_PAGES':
            return '20';
          default:
            return undefined;
        }
      },
    } as ConfigService);

    const response = await client.fetchCards({
      apiKey: 'secret-token',
      limit: 10,
    });

    expect(response.cards).toHaveLength(3);
    expect(response.pagesFetched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    const secondBody = JSON.parse(getRequestBody(secondInit)) as {
      settings: {
        cursor: {
          limit: number;
          updatedAt?: string;
          nmID?: number;
        };
        filter: { withPhoto: number };
      };
    };
    expect(secondBody).toEqual({
      settings: {
        cursor: {
          limit: 2,
          updatedAt: '2026-05-17T00:00:00Z',
          nmID: 2,
        },
        filter: { withPhoto: -1 },
        sort: { ascending: true },
      },
    });
  });

  it('selected nmID sync uses cards list retrieval and local exact nmID filtering', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      responseWithJson({
        cards: [
          { vendorCode: '1013414108', nmID: 777777777 },
          { vendorCode: 'seller-article', nmID: 1013414108 },
        ],
        cursor: { total: 2 },
      }),
    );
    const client = new WbApiClientService({
      get: (key: string) => {
        if (key === 'WB_SYNC_MODE') return 'real';
        if (key === 'WB_API_BASE_URL')
          return 'https://content-api.wildberries.ru';
        return undefined;
      },
    } as ConfigService);

    const response = await client.fetchCards({
      apiKey: 'secret-token',
      limit: 100,
      nmIds: ['1013414108'],
    });

    expect(response.cards).toEqual([
      { vendorCode: 'seller-article', nmID: 1013414108 },
    ]);
    expect(response.scannedCount).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const requestBody = parseRequestBody(init);
    expect(JSON.stringify(requestBody)).not.toContain('1013414108');
    expect(requestBody.settings.sort).toEqual({ ascending: false });
  });

  it('selected nmID pagination keeps a stable page size after an early match', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        responseWithJson({
          cards: [
            { vendorCode: 'first-match', nmID: 1013414108 },
            { vendorCode: 'unrelated', nmID: 777777777 },
          ],
          cursor: {
            total: 2,
            nmID: 777777777,
            updatedAt: '2026-06-11T00:00:00Z',
          },
        }),
      )
      .mockResolvedValueOnce(
        responseWithJson({
          cards: [{ vendorCode: 'second-match', nmID: 123456789 }],
          cursor: { total: 1 },
        }),
      );
    const client = new WbApiClientService({
      get: (key: string) => {
        if (key === 'WB_SYNC_MODE') return 'real';
        if (key === 'WB_SYNC_PAGE_LIMIT') return '2';
        if (key === 'WB_SYNC_MAX_PAGES') return '20';
        return undefined;
      },
    } as ConfigService);

    const response = await client.fetchCards({
      apiKey: 'secret-token',
      limit: 100,
      nmIds: ['1013414108', '123456789'],
    });

    expect(response.cards.map((card) => String(card.nmID))).toEqual([
      '1013414108',
      '123456789',
    ]);
    expect(response.pagesFetched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestBodies = fetchMock.mock.calls.map(([, init]) =>
      parseRequestBody(init),
    );
    expect(requestBodies).toEqual([
      {
        settings: {
          cursor: { limit: 2 },
          filter: { withPhoto: -1 },
          sort: { ascending: false },
        },
      },
      {
        settings: {
          cursor: {
            limit: 2,
            updatedAt: '2026-06-11T00:00:00Z',
            nmID: 777777777,
          },
          filter: { withPhoto: -1 },
          sort: { ascending: false },
        },
      },
    ]);
  });

  it('verify connection maps 401 to a safe failure', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(responseWithJson({}, 401));

    const client = new WbApiClientService({
      get: (key: string) => (key === 'WB_SYNC_MODE' ? 'real' : undefined),
    } as ConfigService);

    await expect(client.verifyConnection('bad-token')).rejects.toThrow(
      'WB_UNAUTHORIZED_401',
    );
  });

  it('verify connection does not pretend to verify in mock mode', async () => {
    const client = new WbApiClientService({
      get: (key: string) => (key === 'WB_SYNC_MODE' ? 'mock' : undefined),
    } as ConfigService);

    await expect(client.verifyConnection('mock-token')).rejects.toThrow(
      'WB_MOCK_MODE_ACTIVE',
    );
  });

  it('real client retries with sort body after a 400 response', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(responseWithJson({ error: 'bad request' }, 400))
      .mockResolvedValueOnce(
        responseWithJson({ error: 'still bad request' }, 400),
      )
      .mockResolvedValueOnce(
        responseWithJson({ cards: [], cursor: { total: 0 } }, 200),
      );

    const client = new WbApiClientService({
      get: (key: string) => {
        switch (key) {
          case 'WB_SYNC_MODE':
            return 'real';
          case 'WB_API_BASE_URL':
            return 'https://content-api.wildberries.ru';
          default:
            return undefined;
        }
      },
    } as ConfigService);

    await client.fetchCards({ apiKey: 'secret-token', limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, secondInit] = fetchMock.mock.calls[1] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    expect(JSON.parse(getRequestBody(secondInit))).toEqual({
      settings: {
        cursor: { limit: 1 },
        filter: { withPhoto: -1 },
      },
    });
    const [, thirdInit] = fetchMock.mock.calls[2] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    expect(JSON.parse(getRequestBody(thirdInit))).toEqual({
      settings: {
        cursor: { limit: 1 },
        filter: { withPhoto: -1 },
        sort: { ascending: false },
      },
    });
  });

  it('mapper maps WB card to product, variants, images, and warnings', () => {
    const mapper = new WbProductMapperService();
    const product = mapper.mapCard({
      nmID: 123,
      imtID: 456,
      nmUUID: 'uuid',
      subjectID: 789,
      subjectName: 'Dresses',
      vendorCode: 'APT-123',
      brand: 'Brand',
      title: 'WB Dress',
      description: 'Description',
      photos: [{ big: 'https://example.com/1.jpg' }],
      characteristics: [
        { name: 'Цвет', value: 'red' },
        { name: 'Состав', value: ['cotton'] },
      ],
      sizes: [
        {
          chrtID: 1001,
          techSize: 'M',
          wbSize: '44',
          skus: ['4600000000001'],
        },
      ],
    });
    expect(product.sellerSku).toBe('APT-123');
    expect(product.externalProductId).toBe('123');
    expect(product.variants[0].wbBarcode).toBe('4600000000001');
    expect(product.images[0].isMain).toBe(true);
    expect(product.characteristics.color).toBe('red');
    expect(product.warnings.map((warning) => warning.code)).toContain(
      'MISSING_PRICE',
    );
  });

  it('mapper supports by-article matching semantics through vendorCode', () => {
    const mapper = new WbProductMapperService();
    const products = [
      mapper.mapCard({ nmID: 1, vendorCode: 'APT-A', title: 'A' }),
      mapper.mapCard({ nmID: 2, vendorCode: 'APT-B', title: 'B' }),
    ];
    expect(
      products.filter(
        (product) => product.sellerSku?.toLowerCase() === 'apt-a',
      ),
    ).toHaveLength(1);
  });
});
