import { ConfigService } from '@nestjs/config';
import { WbApiClientService } from '../src/modules/wb-sync/wb-api-client.service';
import { WbProductMapperService } from '../src/modules/wb-sync/wb-product-mapper.service';

describe('WB API sync foundation', () => {
  it('mock client returns WB cards without a real token', async () => {
    const client = new WbApiClientService({
      get: (key: string) => (key === 'WB_SYNC_MODE' ? 'mock' : undefined),
    } as ConfigService);
    const response = await client.fetchCards({ apiKey: null, limit: 100 });
    expect(response.cards.length).toBeGreaterThanOrEqual(2);
    expect(response.cards[0].vendorCode).toBe('APT-MOCK-HOODIE');
  });

  it('mapper maps WB card to product, variants, images, and warnings', () => {
    const mapper = new WbProductMapperService();
    const product = mapper.mapCard({
      nmID: 123,
      imtID: 456,
      nmUUID: 'uuid',
      subjectID: 789,
      subjectName: 'Dresses',
      vendorCode: 'APT-123',
      brand: 'Brand',
      title: 'WB Dress',
      description: 'Description',
      photos: [{ big: 'https://example.com/1.jpg' }],
      characteristics: [
        { name: 'Цвет', value: 'red' },
        { name: 'Состав', value: ['cotton'] },
      ],
      sizes: [
        {
          chrtID: 1001,
          techSize: 'M',
          wbSize: '44',
          skus: ['4600000000001'],
        },
      ],
    });
    expect(product.sellerSku).toBe('APT-123');
    expect(product.externalProductId).toBe('123');
    expect(product.variants[0].wbBarcode).toBe('4600000000001');
    expect(product.images[0].isMain).toBe(true);
    expect(product.warnings.map((warning) => warning.code)).toContain(
      'MISSING_PRICE',
    );
  });

  it('mapper supports by-article matching semantics through vendorCode', () => {
    const mapper = new WbProductMapperService();
    const products = [
      mapper.mapCard({ nmID: 1, vendorCode: 'APT-A', title: 'A' }),
      mapper.mapCard({ nmID: 2, vendorCode: 'APT-B', title: 'B' }),
    ];
    expect(
      products.filter(
        (product) => product.sellerSku?.toLowerCase() === 'apt-a',
      ),
    ).toHaveLength(1);
  });
});
