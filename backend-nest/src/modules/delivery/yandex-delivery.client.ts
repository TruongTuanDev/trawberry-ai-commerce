import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class YandexDeliveryClient {
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
}
