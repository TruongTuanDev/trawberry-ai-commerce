import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WbApiSourceMode,
  WbCardsResponse,
  WbConnectionVerifyResult,
  WbFetchCardsOptions,
  WbFetchCardsResult,
} from './wb-sync.types';

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

type WbCardsPageResult = {
  cards: WbCardsResponse['cards'];
  cursor?: WbCardsResponse['cursor'];
};

@Injectable()
export class WbApiClientService {
  constructor(private readonly config: ConfigService) {}

  async fetchCards(options: WbFetchCardsOptions): Promise<WbFetchCardsResult> {
    const mode = this.mode();
    if (mode === 'mock') {
      const cards = this.filterCards(
        MOCK_RESPONSE.cards,
        options.article,
      ).slice(0, options.limit);
      return {
        cards,
        mode,
        pagesFetched: 1,
        fetchedCount: cards.length,
        cursor: cards.length > 0 ? MOCK_RESPONSE.cursor : { total: 0 },
      };
    }

    if (!options.apiKey) {
      throw new BadRequestException('Real WB sync requires a saved API key.');
    }

    const totalLimit = Math.max(1, options.limit);
    const pageLimit = Math.min(this.pageLimit(), totalLimit);
    const maxPages = this.maxPages();
    const cards: WbCardsResponse['cards'] = [];
    let cursor: WbCardsResponse['cursor'] | undefined;
    let pagesFetched = 0;
    let lastTotal: number | undefined;

    while (pagesFetched < maxPages && cards.length < totalLimit) {
      const page = await this.fetchCardsPage({
        apiKey: options.apiKey,
        limit: Math.min(pageLimit, totalLimit - cards.length),
        cursor,
      });

      pagesFetched += 1;
      lastTotal = page.cursor?.total;
      cursor = page.cursor;

      const filtered = this.filterCards(page.cards, options.article);
      cards.push(...filtered);

      if (options.article && filtered.length > 0) {
        break;
      }

      if (
        !page.cards.length ||
        !page.cursor?.updatedAt ||
        !page.cursor?.nmID ||
        (typeof lastTotal === 'number' && lastTotal < pageLimit)
      ) {
        break;
      }
    }

    return {
      cards: cards.slice(0, totalLimit),
      mode,
      pagesFetched,
      fetchedCount: cards.length,
      cursor,
    };
  }

  async verifyConnection(apiKey: string): Promise<WbConnectionVerifyResult> {
    const response = await this.fetchCards({ apiKey, limit: 1 });
    return {
      success: true,
      mode: response.mode,
      fetched: response.cards.length,
      message:
        response.mode === 'real'
          ? 'WB API connection verified'
          : 'WB API mock connection verified',
    };
  }

  getMode(): WbApiSourceMode {
    return this.mode();
  }

  private async fetchCardsPage(options: {
    apiKey: string;
    limit: number;
    cursor?: WbCardsResponse['cursor'];
  }): Promise<WbCardsPageResult> {
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
              cursor: this.cursor(options.limit, options.cursor),
              filter: { withPhoto: -1 },
            },
          }),
        },
      );

      if (!response.ok) {
        throw this.mapHttpError(response.status);
      }

      const payload = (await response.json()) as WbCardsResponse | null;
      if (!payload || !Array.isArray(payload.cards)) {
        throw new BadGatewayException(
          'Wildberries API returned a malformed cards response.',
        );
      }

      return {
        cards: payload.cards,
        cursor: payload.cursor,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException(
          `Wildberries API timeout after ${this.timeoutMs()} ms.`,
        );
      }
      throw new BadGatewayException('Wildberries API communication failed.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private filterCards(cards: WbCardsResponse['cards'], article?: string) {
    if (!article) {
      return cards;
    }
    const normalized = this.normalizeArticle(article);
    return cards.filter((card) => {
      const vendorCode = this.normalizeArticle(card.vendorCode);
      return vendorCode === normalized;
    });
  }

  private normalizeArticle(value: string | null | undefined) {
    return value?.trim().toLowerCase() ?? '';
  }

  private cursor(limit: number, cursor?: WbCardsResponse['cursor']) {
    return {
      limit,
      ...(cursor?.updatedAt ? { updatedAt: cursor.updatedAt } : {}),
      ...(cursor?.nmID ? { nmID: cursor.nmID } : {}),
    };
  }

  private mapHttpError(status: number) {
    switch (status) {
      case 400:
        return new BadGatewayException(
          'Wildberries API rejected the cards list request.',
        );
      case 401:
      case 403:
        return new BadGatewayException(
          'Wildberries API rejected the token or token scope.',
        );
      case 429:
        return new BadGatewayException(
          'Wildberries API rate limit reached. Please retry later.',
        );
      default:
        return new BadGatewayException(
          `Wildberries API returned HTTP ${status}.`,
        );
    }
  }

  private mode(): WbApiSourceMode {
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

  private pageLimit() {
    return Math.min(
      100,
      Math.max(1, Number(this.config.get<string>('WB_SYNC_PAGE_LIMIT') ?? 100)),
    );
  }

  private maxPages() {
    return Math.max(
      1,
      Number(this.config.get<string>('WB_SYNC_MAX_PAGES') ?? 20),
    );
  }
}
