import { ConfigService } from '@nestjs/config';
import {
  AiServiceClientService,
  AiServiceRequestError,
} from '../src/modules/ai-images/ai-service-client.service';

type FetchMock = jest.Mock<
  Promise<Response>,
  [RequestInfo | URL, RequestInit?]
>;

function createFetchMock(response: Response): FetchMock {
  return jest
    .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
    .mockResolvedValue(response);
}

function createConfigService(overrides?: Record<string, string | number>) {
  return {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      if (overrides && key in overrides) {
        return overrides[key];
      }
      return fallback;
    }),
  } as unknown as ConfigService;
}

function createJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('AiServiceClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('calls the ai-service endpoint with the internal token and payload', async () => {
    const fetchMock = createFetchMock(
      createJsonResponse({
        taskId: 'task-1',
        status: 'COMPLETED',
        images: [
          {
            url: 'https://ai.example.com/generated-1.png',
            storageKey: 'generated/generated-1.png',
            provider: 'MOCK',
            width: 1024,
            height: 1024,
          },
        ],
      }),
    );
    global.fetch = fetchMock;

    const client = new AiServiceClientService(
      createConfigService({
        AI_SERVICE_BASE_URL: 'http://127.0.0.1:8010',
        AI_SERVICE_INTERNAL_TOKEN: 'dev-internal-token',
      }),
    );

    const response = await client.generateImages({
      taskId: 'task-1',
      shopId: 'shop-1',
      productId: 'prod-1',
      quantity: 1,
      taskType: 'PRODUCT_MODEL_IMAGE',
      stylePreset: 'STUDIO',
      prompt: 'Create a clean marketplace hero image.',
      inputImages: {
        frontImageUrl: 'https://cdn.example.com/front.png',
        backImageUrl: null,
        modelImageUrl: null,
      },
    });

    expect(response.images).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8010/internal/ai-images/generate',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const firstRequestInit = fetchMock.mock.calls[0]?.[1];
    expect(firstRequestInit?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Internal-Token': 'dev-internal-token',
    });
    expect(firstRequestInit?.body).toBe(
      JSON.stringify({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        stylePreset: 'STUDIO',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {
          frontImageUrl: 'https://cdn.example.com/front.png',
          backImageUrl: null,
          modelImageUrl: null,
        },
      }),
    );
  });

  it('does not retry 401 responses', async () => {
    const fetchMock = createFetchMock(
      createJsonResponse(
        {
          detail: {
            code: 'OPENAI_UNAUTHORIZED',
            message: 'OpenAI authentication failed.',
          },
        },
        401,
      ),
    );
    global.fetch = fetchMock;

    const client = new AiServiceClientService(createConfigService());

    await expect(
      client.generateImages({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceRequestError>>({
        message: 'OPENAI_UNAUTHORIZED: OpenAI authentication failed.',
        safeErrorCode: 'OPENAI_UNAUTHORIZED',
        retryable: false,
        refundCredit: true,
        statusCode: 401,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries timeout failures and then throws a retryable error', async () => {
    const abortError = new Error('Request timed out');
    abortError.name = 'AbortError';
    const fetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockRejectedValue(abortError);
    global.fetch = fetchMock;

    const client = new AiServiceClientService(
      createConfigService({
        AI_SERVICE_RETRY_ATTEMPTS: 2,
        AI_SERVICE_RETRY_DELAY_MS: 1,
        AI_SERVICE_TIMEOUT_MS: 10,
      }),
    );

    await expect(
      client.generateImages({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceRequestError>>({
        retryable: true,
        refundCredit: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails on malformed responses and marks them non-retryable', async () => {
    const fetchMock = createFetchMock(
      createJsonResponse({
        taskId: 'task-1',
        status: 'COMPLETED',
        images: [{ provider: 'MOCK' }],
      }),
    );
    global.fetch = fetchMock;

    const client = new AiServiceClientService(createConfigService());

    await expect(
      client.generateImages({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceRequestError>>({
        retryable: false,
        refundCredit: true,
      }),
    );
  });

  it('fails when generated images are missing required metadata', async () => {
    const fetchMock = createFetchMock(
      createJsonResponse({
        taskId: 'task-1',
        status: 'COMPLETED',
        images: [
          {
            url: 'https://ai.example.com/generated-1.png',
            provider: 'OPENAI',
          },
        ],
      }),
    );
    global.fetch = fetchMock;

    const client = new AiServiceClientService(createConfigService());

    await expect(
      client.generateImages({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceRequestError>>({
        message:
          'AI service returned a generated image without required metadata.',
        retryable: false,
        refundCredit: true,
      }),
    );
  });

  it('maps ai-service quality guard errors without retrying', async () => {
    const fetchMock = createFetchMock(
      createJsonResponse(
        {
          detail: {
            code: 'AI_SERVICE_INVALID_RESPONSE',
            message:
              'Generated image failed quality validation because the binary is not a readable image.',
          },
        },
        502,
      ),
    );
    global.fetch = fetchMock;

    const client = new AiServiceClientService(createConfigService());

    await expect(
      client.generateImages({
        taskId: 'task-1',
        shopId: 'shop-1',
        productId: 'prod-1',
        quantity: 1,
        taskType: 'PRODUCT_MODEL_IMAGE',
        prompt: 'Create a clean marketplace hero image.',
        inputImages: {},
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AiServiceRequestError>>({
        message:
          'AI_SERVICE_INVALID_RESPONSE: Generated image failed quality validation because the binary is not a readable image.',
        safeErrorCode: 'AI_SERVICE_INVALID_RESPONSE',
        retryable: true,
        refundCredit: true,
        statusCode: 502,
      }),
    );
  });
});
