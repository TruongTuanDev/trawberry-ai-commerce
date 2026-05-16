import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WbCardsResponse } from './wb-sync.types';

const MOCK_RESPONSE: WbCardsResponse = {
  cards: [
    {
      nmID: 111000001,
      imtID: 221000001,
      nmUUID: 'mock-card-hoodie',
      subjectID: 1234,
      subjectName: 'Hoodies',
      vendorCode: 'APT-MOCK-HOODIE',
      brand: 'Trawberry Mock',
      title: 'Mock WB Hoodie',
      description: 'Mock Wildberries API hoodie card.',
      photos: [
        {
          big: 'https://example.com/wb-api/hoodie-1.jpg',
          c516x688: 'https://example.com/wb-api/hoodie-1.jpg',
        },
        { big: 'https://example.com/wb-api/hoodie-2.jpg' },
      ],
      dimensions: { width: 30, height: 10, length: 40, weightBrutto: 700 },
      characteristics: [
        { name: 'Пол', value: 'Женский' },
        { name: 'Состав', value: ['хлопок', 'полиэстер'] },
        { name: 'Цвет', value: 'черный' },
      ],
      sizes: [
        {
          chrtID: 331000001,
          techSize: 'S',
          wbSize: '42',
          skus: ['4600000000011'],
        },
        {
          chrtID: 331000002,
          techSize: 'M',
          wbSize: '44',
          skus: ['4600000000012'],
        },
      ],
    },
    {
      nmID: 111000002,
      imtID: 221000002,
      nmUUID: 'mock-card-shirt',
      subjectID: 4321,
      subjectName: 'Shirts',
      vendorCode: 'APT-MOCK-SHIRT',
      brand: 'Trawberry Mock',
      title: 'Mock WB Shirt',
      description: 'Mock Wildberries API shirt card.',
      photos: [{ big: 'https://example.com/wb-api/shirt-1.jpg' }],
      sizes: [
        {
          chrtID: 331000003,
          techSize: 'L',
          wbSize: '46',
          skus: ['4600000000013'],
        },
      ],
    },
  ],
  cursor: { total: 2, nmID: 111000002, updatedAt: new Date().toISOString() },
};

@Injectable()
export class WbApiClientService {
  constructor(private readonly config: ConfigService) {}

  async fetchCards(options: {
    apiKey: string | null;
    limit: number;
    cursor?: string;
  }): Promise<WbCardsResponse> {
    if (this.mode() === 'mock') {
      return {
        ...MOCK_RESPONSE,
        cards: MOCK_RESPONSE.cards.slice(0, options.limit),
      };
    }

    if (!options.apiKey) {
      throw new BadRequestException('Wildberries credentials are required.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      const response = await fetch(
        `${this.baseUrl()}/content/v2/get/cards/list`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: options.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings: {
              sort: { ascending: true },
              cursor: this.cursor(options.limit, options.cursor),
              filter: { withPhoto: -1 },
            },
          }),
        },
      );
      if (!response.ok) {
        throw new BadGatewayException(
          `Wildberries API returned ${response.status}.`,
        );
      }
      return (await response.json()) as WbCardsResponse;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Wildberries API communication failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private cursor(limit: number, encodedCursor?: string) {
    if (!encodedCursor) return { limit };
    try {
      const parsed = JSON.parse(
        Buffer.from(encodedCursor, 'base64url').toString('utf8'),
      ) as { updatedAt?: string; nmID?: number };
      return { limit, ...parsed };
    } catch {
      return { limit };
    }
  }

  private mode() {
    return this.config.get<string>('WB_SYNC_MODE') === 'real' ? 'real' : 'mock';
  }

  private baseUrl() {
    return (
      this.config.get<string>('WB_API_BASE_URL') ??
      'https://content-api.wildberries.ru'
    ).replace(/\/$/, '');
  }

  private timeoutMs() {
    return Number(this.config.get<string>('WB_SYNC_TIMEOUT_MS') ?? 30000);
  }
}
