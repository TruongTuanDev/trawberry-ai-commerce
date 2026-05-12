import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
        db: this.configService.get<number>('REDIS_DB', 0),
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
    }

    return this.client;
  }

  async ping(): Promise<string> {
    const client = this.getClient();
    await client.connect();
    return client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch (error) {
      this.logger.warn(`Failed to close Redis cleanly: ${String(error)}`);
    }
  }
}
