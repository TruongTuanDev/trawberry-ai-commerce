import { ConfigService } from '@nestjs/config';
import {
  YandexDeliveryClient,
  YandexDeliveryRequestError,
} from '../src/modules/delivery/yandex-delivery.client';

type FetchMock = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>;

function createConfigService(overrides?: Record<string, string>) {
  return {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      if (overrides && key in overrides) return overrides[key];
      return fallback;
    }),
  } as unknown as ConfigService;
}

function createResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('YandexDeliveryClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sets bearer authorization without exposing token in errors', async () => {
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(createResponse({ id: 'claim-1', status: 'new' }));
    global.fetch = fetchMock;

    const client = new YandexDeliveryClient(
      createConfigService({
        YANDEX_DELIVERY_BASE_URL: 'https://b2b.taxi.yandex.net',
        YANDEX_DELIVERY_TOKEN: 'secret-yandex-token',
      }),
    );

    await client.createClaim({ route_points: [], items: [] });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer secret-yandex-token');
  });

  it('maps createClaim request and response', async () => {
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(createResponse({ id: 'claim-1', status: 'new' }));
    global.fetch = fetchMock;
    const client = createClient();

    const response = await client.createClaim({ items: [{ title: 'Order' }] });

    expect(response.id).toBe('claim-1');
    expect(requestUrl(fetchMock)).toBe(
      'https://b2b.taxi.yandex.net/b2b/cargo/integration/v2/claims/create',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ items: [{ title: 'Order' }] }),
    );
  });

  it('maps acceptClaim response', async () => {
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(
        createResponse({ id: 'claim-1', status: 'accepted', version: 2 }),
      );
    global.fetch = fetchMock;
    const client = createClient();

    const response = await client.acceptClaim('claim-1', 2);

    expect(response.status).toBe('accepted');
    expect(requestUrl(fetchMock)).toContain('claims/accept?claim_id=claim-1');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ version: 2 }),
    );
  });

  it('maps tracking links response', async () => {
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(
        createResponse({ tracking_link: 'https://yandex.example/track' }),
      );
    global.fetch = fetchMock;
    const client = createClient();

    const response = await client.getTrackingLinks('claim-1');

    expect(response.tracking_link).toBe('https://yandex.example/track');
    expect(requestUrl(fetchMock)).toContain(
      'claims/tracking-links?claim_id=claim-1',
    );
  });

  it('maps Yandex errors safely', async () => {
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(
        createResponse(
          { code: 'bad_request', message: 'Invalid address' },
          400,
        ),
      );
    global.fetch = fetchMock;
    const client = createClient();

    await expect(client.getClaimInfo('claim-1')).rejects.toEqual(
      expect.objectContaining<Partial<YandexDeliveryRequestError>>({
        message: 'Invalid address',
        statusCode: 400,
        code: 'bad_request',
      }),
    );
  });
});

function createClient() {
  return new YandexDeliveryClient(
    createConfigService({
      YANDEX_DELIVERY_BASE_URL: 'https://b2b.taxi.yandex.net',
      YANDEX_DELIVERY_TOKEN: 'test-token',
      YANDEX_DELIVERY_TIMEOUT_MS: '30000',
    }),
  );
}

function requestUrl(fetchMock: FetchMock) {
  const value = fetchMock.mock.calls[0]?.[0];
  if (typeof value === 'string') return value;
  if (value instanceof URL) return value.toString();
  return value?.url ?? '';
}
