import { rewriteUrlForAiService } from '../src/modules/ai-images/ai-service-url.util';

describe('rewriteUrlForAiService', () => {
  const options = {
    backendInternalBaseUrl: 'http://backend-nest:3001',
    backendPublicBaseUrl: 'http://127.0.0.1:3001',
  };

  it('rewrites localhost upload URLs to the docker-safe backend host', () => {
    expect(
      rewriteUrlForAiService(
        'http://127.0.0.1:3001/uploads/products/shop-1/prod-1/front.jpg',
        options,
      ),
    ).toBe('http://backend-nest:3001/uploads/products/shop-1/prod-1/front.jpg');
  });

  it('resolves relative upload URLs against the internal backend base url', () => {
    expect(
      rewriteUrlForAiService(
        '/uploads/products/shop-1/prod-1/front.jpg',
        options,
      ),
    ).toBe('http://backend-nest:3001/uploads/products/shop-1/prod-1/front.jpg');
  });

  it('keeps remote URLs unchanged', () => {
    expect(
      rewriteUrlForAiService(
        'https://images.example.com/product/front.jpg',
        options,
      ),
    ).toBe('https://images.example.com/product/front.jpg');
  });

  it('returns the original URL when no internal base url is configured', () => {
    expect(
      rewriteUrlForAiService(
        'http://127.0.0.1:3001/uploads/products/shop-1/prod-1/front.jpg',
      ),
    ).toBe('http://127.0.0.1:3001/uploads/products/shop-1/prod-1/front.jpg');
  });
});
