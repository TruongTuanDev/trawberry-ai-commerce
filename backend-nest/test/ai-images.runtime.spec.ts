import { ConfigService } from '@nestjs/config';
import { AiImagesService } from '../src/modules/ai-images/ai-images.service';

function createService(
  workerMode: 'internal-mock' | 'ai-service',
  fetchImpl?: typeof global.fetch,
) {
  const configService = {
    get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'AI_WORKER_MODE') {
        return workerMode;
      }
      if (key === 'AI_SERVICE_BASE_URL') {
        return 'http://127.0.0.1:8000';
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  const service = new AiImagesService(
    {} as never,
    {} as never,
    {} as never,
    configService,
  );

  const originalFetch = global.fetch;
  if (fetchImpl) {
    global.fetch = fetchImpl;
  }

  return {
    service,
    restore: () => {
      global.fetch = originalFetch;
    },
  };
}

function createJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('AiImagesService runtime status', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports OPENAI blocked when ai-service is on openai provider without a configured key', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      createJsonResponse({
        aiImageProvider: 'openai',
        storageDriver: 'local',
        openaiConfigured: false,
        openaiSmokeEnabled: false,
        safeErrorCode: 'OPENAI_UNAUTHORIZED',
      }),
    );
    const context = createService(
      'ai-service',
      fetchMock as typeof global.fetch,
    );

    const status = await context.service.getRuntimeStatus('shop-1');

    expect(status.workerMode).toBe('ai-service');
    expect(status.sellerFlowEffectiveMode).toBe('AI_SERVICE_OPENAI_BLOCKED');
    expect(status.aiServiceReachable).toBe(true);
    expect(status.aiServiceProvider).toBe('openai');
    expect(status.openAiConfigured).toBe(false);
    expect(status.openAiSmokeEnabled).toBe(false);
    expect(status.safeErrorCode).toBe('OPENAI_UNAUTHORIZED');
    expect(status.openAiRealEnabled).toBe(false);

    context.restore();
  });

  it('reports OFFLINE when ai-service health is unreachable', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED'));
    const context = createService(
      'ai-service',
      fetchMock as typeof global.fetch,
    );

    const status = await context.service.getRuntimeStatus('shop-1');

    expect(status.sellerFlowEffectiveMode).toBe('OFFLINE');
    expect(status.aiServiceReachable).toBe(false);
    expect(status.safeErrorCode).toBeNull();

    context.restore();
  });
});
