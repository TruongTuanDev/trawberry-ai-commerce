import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiTryOnAiServiceRequest = {
  taskId: string;
  providerMode: string;
  product: {
    id: string;
    name: string;
    imageUrl: string;
    category?: string | null;
    selectedSize?: string | null;
    selectedRussianSize?: string | null;
  };
  person: {
    customerImageUrl?: string | null;
    selectedModelImageUrl?: string | null;
    selectedModelId?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    gender?: string | null;
    bodyType?: string | null;
    bodyTraits?: string[];
  };
  prompt: string;
  locale: 'ru' | 'en';
};

export type AiTryOnAiServiceResponse = {
  images: Array<{
    url: string;
    storageKey?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
  provider: string;
  metadata?: Record<string, unknown>;
};

export class AiTryOnAiServiceError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly safeErrorCode?: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AiTryOnAiServiceClientService {
  constructor(private readonly configService: ConfigService) {}

  async generateTryOn(
    payload: AiTryOnAiServiceRequest,
  ): Promise<AiTryOnAiServiceResponse> {
    const baseUrl = this.configService.get<string>(
      'AI_SERVICE_BASE_URL',
      'http://localhost:8000',
    );
    const internalToken = this.configService.get<string>(
      'AI_SERVICE_INTERNAL_TOKEN',
      '',
    );
    const timeoutMs = this.configService.get<number>(
      'AI_SERVICE_TIMEOUT_MS',
      45000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/internal/ai-try-on/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': internalToken,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const { message, safeErrorCode } = await this.extractError(response);
        throw new AiTryOnAiServiceError(
          message,
          response.status >= 500 || response.status === 429,
          safeErrorCode,
          response.status,
        );
      }

      const body = (await response.json()) as AiTryOnAiServiceResponse;
      if (!Array.isArray(body.images) || body.images.length === 0) {
        throw new AiTryOnAiServiceError(
          'AI try-on service returned no images.',
          false,
        );
      }

      return body;
    } catch (error) {
      if (error instanceof AiTryOnAiServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiTryOnAiServiceError(
          `AI try-on service timed out after ${timeoutMs}ms.`,
          true,
          'AI_TIMEOUT',
        );
      }

      throw new AiTryOnAiServiceError(
        error instanceof Error
          ? error.message
          : 'AI try-on service request failed.',
        true,
        'AI_PROVIDER_ERROR',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractError(response: Response) {
    try {
      const body = (await response.json()) as {
        detail?: string | { code?: string; message?: string };
      };
      if (typeof body.detail === 'string') {
        return { message: body.detail, safeErrorCode: undefined };
      }
      if (body.detail && typeof body.detail === 'object') {
        return {
          message: body.detail.message ?? response.statusText,
          safeErrorCode: body.detail.code,
        };
      }
    } catch {
      return {
        message: response.statusText,
        safeErrorCode: undefined,
      };
    }

    return {
      message: response.statusText,
      safeErrorCode: undefined,
    };
  }
}
