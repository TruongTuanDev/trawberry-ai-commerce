import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class YandexDeliveryRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | null,
    readonly code: string | null,
    readonly responseBody: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class YandexDeliveryClient {
  private readonly logger = new Logger(YandexDeliveryClient.name);
  readonly baseUrl: string;
  readonly token: string;
  readonly clientId: string;
  readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'YANDEX_DELIVERY_BASE_URL',
      'https://b2b.taxi.yandex.net',
    );
    this.token = this.configService.get<string>('YANDEX_DELIVERY_TOKEN', '');
    this.clientId = this.configService.get<string>(
      'YANDEX_DELIVERY_CLIENT_ID',
      '',
    );
    this.timeoutMs = Number(
      this.configService.get<string>('YANDEX_DELIVERY_TIMEOUT_MS', '30000'),
    );
  }

  assertConfigured() {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'Yandex real mode requires YANDEX_DELIVERY_TOKEN.',
      );
    }
  }

  createClaim(payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/create',
      payload,
    );
  }

  calculateOffers(payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/offers/calculate',
      payload,
    );
  }

  acceptClaim(claimId: string, version: number) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/accept',
      { version },
      { claim_id: claimId },
    );
  }

  getClaimInfo(claimId: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/info',
      null,
      { claim_id: claimId },
    );
  }

  getTrackingLinks(claimId: string) {
    return this.request<Record<string, unknown>>(
      'GET',
      '/b2b/cargo/integration/v2/claims/tracking-links',
      null,
      { claim_id: claimId },
    );
  }

  getCancelInfo(claimId: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/cancel-info',
      null,
      { claim_id: claimId },
    );
  }

  cancelClaim(claimId: string, version: number) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/cancel',
      { version },
      { claim_id: claimId },
    );
  }

  journal(claimId: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/journal',
      null,
      { claim_id: claimId },
    );
  }

  performerPosition(claimId: string) {
    return this.request<Record<string, unknown>>(
      'GET',
      '/b2b/cargo/integration/v2/claims/performer-position',
      null,
      { claim_id: claimId },
    );
  }

  pointsEta(claimId: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/points-eta',
      null,
      { claim_id: claimId },
    );
  }

  proofOfDeliveryInfo(claimId: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      '/b2b/cargo/integration/v2/claims/proof-of-delivery/info',
      null,
      { claim_id: claimId },
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown> | null,
    query?: Record<string, string | number>,
  ): Promise<T> {
    this.assertConfigured();
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
        },
        body:
          method === 'POST' && body !== null
            ? JSON.stringify(body ?? {})
            : undefined,
        signal: controller.signal,
      });
      this.logger.log(
        `Yandex Delivery ${method} ${path} -> ${response.status}`,
      );
      const responseBody = await this.readResponseBody(response);
      if (!response.ok) {
        throw this.toRequestError(response, responseBody);
      }
      return responseBody as T;
    } catch (error) {
      if (error instanceof YandexDeliveryRequestError) {
        throw error;
      }
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Yandex Delivery request timed out.'
          : 'Yandex Delivery request failed.';
      throw new YandexDeliveryRequestError(message, null, null, null);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponseBody(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text };
    }
  }

  private toRequestError(response: Response, body: unknown) {
    const safe = this.extractError(body);
    return new YandexDeliveryRequestError(
      safe.message,
      response.status,
      safe.code,
      body,
    );
  }

  private extractError(body: unknown) {
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message =
        this.asString(record.message) ??
        this.asString(record.error_description) ??
        this.asString(record.error) ??
        'Yandex Delivery API returned an error.';
      return {
        code: this.asString(record.code) ?? this.asString(record.error) ?? null,
        message,
      };
    }
    return { code: null, message: 'Yandex Delivery API returned an error.' };
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }
}
