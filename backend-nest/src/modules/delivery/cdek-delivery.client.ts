import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CdekDeliveryClient {
  readonly baseUrl: string;
  readonly account: string;
  readonly securePassword: string;
  readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('CDEK_API_BASE_URL', '');
    this.account = this.configService.get<string>('CDEK_ACCOUNT', '');
    this.securePassword = this.configService.get<string>(
      'CDEK_SECURE_PASSWORD',
      '',
    );
    this.timeoutMs = Number(
      this.configService.get<string>('CDEK_TIMEOUT_MS', '30000'),
    );
  }

  assertConfigured() {
    if (!this.account || !this.securePassword || !this.baseUrl) {
      throw new ServiceUnavailableException(
        'CDEK real mode requires CDEK_API_BASE_URL, CDEK_ACCOUNT, and CDEK_SECURE_PASSWORD.',
      );
    }
  }
}
