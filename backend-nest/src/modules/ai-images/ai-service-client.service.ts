import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AiServiceInputImages = {
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  modelImageUrl?: string | null;
};

export type AiServiceGenerateRequest = {
  taskId: string;
  shopId: string;
  productId: string;
  quantity: number;
  taskType: string;
  stylePreset?: string | null;
  prompt: string;
  inputImages: AiServiceInputImages;
  callbackUrl?: string | null;
};

export type AiServiceGenerateResponse = {
  taskId: string;
  status: 'COMPLETED';
  images: Array<{
    url: string;
    storageKey?: string | null;
    provider: string;
    width?: number | null;
    height?: number | null;
  }>;
};

export class AiServiceRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly refundCredit: boolean,
    readonly statusCode?: number,
    readonly safeErrorCode?: string,
  ) {
    super(message);
  }
}

@Injectable()
export class AiServiceClientService {
  private readonly logger = new Logger(AiServiceClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateImages(
    payload: AiServiceGenerateRequest,
  ): Promise<AiServiceGenerateResponse> {
    const baseUrl = this.configService.get<string>(
      'AI_SERVICE_BASE_URL',
      'http://localhost:8010',
    );
    const timeoutMs = this.configService.get<number>(
      'AI_SERVICE_TIMEOUT_MS',
      45000,
    );
    const maxAttempts = this.configService.get<number>(
      'AI_SERVICE_RETRY_ATTEMPTS',
      3,
    );
    const retryDelayMs = this.configService.get<number>(
      'AI_SERVICE_RETRY_DELAY_MS',
      1000,
    );
    const endpoint = `${baseUrl.replace(/\/$/, '')}/internal/ai-images/generate`;

    let lastError: AiServiceRequestError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.callGenerateEndpoint(endpoint, payload, timeoutMs);
      } catch (error) {
        if (!(error instanceof AiServiceRequestError)) {
          throw error;
        }

        lastError = error;
        this.logger.warn(
          `AI service request failed on attempt ${attempt}/${maxAttempts}: ${error.message}`,
        );

        if (!error.retryable || attempt === maxAttempts) {
          throw error;
        }

        await this.delay(retryDelayMs * attempt);
      }
    }

    throw (
      lastError ??
      new AiServiceRequestError('AI service request failed.', true, true)
    );
  }

  private async callGenerateEndpoint(
    endpoint: string,
    payload: AiServiceGenerateRequest,
    timeoutMs: number,
  ): Promise<AiServiceGenerateResponse> {
    const internalToken = this.configService.get<string>(
      'AI_SERVICE_INTERNAL_TOKEN',
      '',
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalToken,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const { message, safeErrorCode } =
          await this.extractErrorMessage(response);
        const retryable =
          response.status >= 500 ||
          response.status === 429 ||
          response.status === 408;

        throw new AiServiceRequestError(
          message || `AI service responded with status ${response.status}.`,
          retryable,
          true,
          response.status,
          safeErrorCode,
        );
      }

      const body = (await response.json()) as unknown;
      return this.validateGenerateResponse(body);
    } catch (error) {
      if (error instanceof AiServiceRequestError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiServiceRequestError(
          `AI service request timed out after ${timeoutMs}ms.`,
          true,
          true,
        );
      }

      throw new AiServiceRequestError(
        error instanceof Error ? error.message : 'AI service request failed.',
        true,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private validateGenerateResponse(body: unknown): AiServiceGenerateResponse {
    if (!this.isObject(body)) {
      throw new AiServiceRequestError(
        'AI service returned a malformed response body.',
        false,
        true,
      );
    }

    const { taskId, status, images } = body;
    if (
      typeof taskId !== 'string' ||
      taskId.length === 0 ||
      status !== 'COMPLETED' ||
      !Array.isArray(images) ||
      images.length === 0
    ) {
      throw new AiServiceRequestError(
        'AI service returned an invalid response payload.',
        false,
        true,
      );
    }

    const normalizedImages = images.map((image) => {
      if (
        !this.isObject(image) ||
        typeof image.url !== 'string' ||
        image.url.length === 0
      ) {
        throw new AiServiceRequestError(
          'AI service returned an invalid generated image payload.',
          false,
          true,
        );
      }

      if (
        typeof image.storageKey !== 'string' ||
        image.storageKey.length === 0 ||
        typeof image.provider !== 'string' ||
        image.provider.length === 0
      ) {
        throw new AiServiceRequestError(
          'AI service returned a generated image without required metadata.',
          false,
          true,
        );
      }

      if (
        image.width !== undefined &&
        image.width !== null &&
        typeof image.width !== 'number'
      ) {
        throw new AiServiceRequestError(
          'AI service returned an invalid width value.',
          false,
          true,
        );
      }

      if (
        image.height !== undefined &&
        image.height !== null &&
        typeof image.height !== 'number'
      ) {
        throw new AiServiceRequestError(
          'AI service returned an invalid height value.',
          false,
          true,
        );
      }

      return {
        url: image.url,
        storageKey: image.storageKey,
        provider: image.provider,
        width: typeof image.width === 'number' ? image.width : null,
        height: typeof image.height === 'number' ? image.height : null,
      };
    });

    return {
      taskId,
      status,
      images: normalizedImages,
    };
  }

  private async extractErrorMessage(response: Response) {
    try {
      const body = (await response.json()) as {
        detail?: string | { code?: string | null; message?: string };
        message?: string;
      };
      if (typeof body.detail === 'string') {
        return {
          message: body.detail,
          safeErrorCode: undefined,
        };
      }
      if (body.detail && typeof body.detail === 'object') {
        const safeErrorCode =
          typeof body.detail.code === 'string' ? body.detail.code : undefined;
        const message =
          typeof body.detail.message === 'string'
            ? body.detail.message
            : (body.message ?? response.statusText);
        return {
          message: safeErrorCode ? `${safeErrorCode}: ${message}` : message,
          safeErrorCode,
        };
      }
      return {
        message: body.message ?? response.statusText,
        safeErrorCode: undefined,
      };
    } catch {
      return {
        message: response.statusText,
        safeErrorCode: undefined,
      };
    }
  }

  private isObject(
    value: unknown,
  ): value is Record<string, string | number | null | unknown[] | object> {
    return typeof value === 'object' && value !== null;
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
