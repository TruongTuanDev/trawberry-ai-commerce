import {
  resolveFrontendAssetUrlForAiService,
  rewriteUrlForAiService,
} from '../src/modules/ai-images/ai-service-url.util';

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

describe('resolveFrontendAssetUrlForAiService', () => {
  it('resolves relative model assets against the internal frontend base url', () => {
    expect(
      resolveFrontendAssetUrlForAiService('/ai-try-on/models/model2.png', {
        frontendInternalBaseUrl: 'http://frontend-next:3000',
        frontendPublicBaseUrl: 'https://skidkaberry.com',
      }),
    ).toBe('http://frontend-next:3000/ai-try-on/models/model2.png');
  });

  it('falls back to the public site url for relative model assets when no internal frontend url is configured', () => {
    expect(
      resolveFrontendAssetUrlForAiService('/ai-try-on/models/model2.png', {
        frontendPublicBaseUrl: 'https://skidkaberry.com',
      }),
    ).toBe('https://skidkaberry.com/ai-try-on/models/model2.png');
  });

  it('rewrites localhost frontend asset urls to the internal frontend host', () => {
    expect(
      resolveFrontendAssetUrlForAiService(
        'http://127.0.0.1:3000/ai-try-on/models/model2.png',
        {
          frontendInternalBaseUrl: 'http://frontend-next:3000',
          frontendPublicBaseUrl: 'https://skidkaberry.com',
        },
      ),
    ).toBe('http://frontend-next:3000/ai-try-on/models/model2.png');
  });

  it('returns null for relative frontend assets when no frontend base url is configured', () => {
    expect(
      resolveFrontendAssetUrlForAiService('/ai-try-on/models/model2.png'),
    ).toBeNull();
  });
});
