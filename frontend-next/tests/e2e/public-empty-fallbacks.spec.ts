import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  url: string,
  options?: Parameters<APIRequestContext["fetch"]>[1],
) {
  const response = await request.fetch(`${backendBaseUrl}${url}`, options);
  expect(
    response.ok(),
    `${options?.method ?? "GET"} ${url} -> ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

async function approveSeller(request: APIRequestContext, email: string) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName: "Public Empty State Seller",
        role: "SELLER",
      },
    },
  );
  const sellerLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: { email, password },
    },
  );
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Public Empty State Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Empty State Street 1",
      contactName: "Public Empty State Seller",
      contactPhone: "+79990000012",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(
    request,
    "/api/seller/onboarding/documents",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
      multipart: {
        documentType: "INN",
        file: {
          name: "seller-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% public empty states e2e\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: {
        email: "demo-admin@trawberry.local",
        password: "DemoAdmin123!",
      },
    },
  );
  await backendJson(
    request,
    `/api/admin/sellers/${register.userId}/documents/${document.id}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
      data: {},
    },
  );
  await backendJson(request, `/api/admin/sellers/${register.userId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminLogin.accessToken}` },
    data: {},
  });

  return { token: sellerLogin.accessToken };
}

async function createPublishedProduct(
  request: APIRequestContext,
  token: string,
  stamp: number,
  imageNamePrefix: string,
) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        name: `Marketplace Fallback Shop ${stamp}`,
        slug: `marketplace-fallback-shop-${stamp}`,
        paymentInstructions: "Manual transfer for empty fallback tests",
      },
    },
  );

  const wbNmId = 7700000 + (stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `Marketplace Fallback Jacket ${stamp}`,
      localTitle: `Marketplace Fallback Jacket ${stamp}`,
      localDescription: "Public marketplace empty and fallback state product",
      categoryName: "Marketplace Fallback Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: wbNmId + 10,
          techSize: "XL",
          basePrice: 1788,
          stockQuantity: 3,
          trackInventory: true,
          isActive: true,
        },
        {
          chrtId: wbNmId + 20,
          techSize: "2XL",
          basePrice: 1825,
          stockQuantity: 0,
          trackInventory: true,
          isActive: true,
        },
      ],
    },
  });

  for (const suffix of ["front", "detail"]) {
    await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      multipart: {
        files: {
          name: `${imageNamePrefix}-${suffix}-${stamp}.png`,
          mimeType: "image/png",
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
            "base64",
          ),
        },
      },
    });
  }

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return { shop, product };
}

test.describe("public marketplace empty, fallback, and unavailable states", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("products no-result and cart empty states are clear", async ({ page }) => {
    await page.goto("/products?q=definitely-no-result-xyz");
    await expect(page.getByTestId("products-no-results-state")).toBeVisible();
    await expect(page.getByTestId("products-filter-summary")).toContainText(
      "definitely-no-result-xyz",
    );

    await page.getByTestId("products-empty-clear").click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByTestId("products-grid")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByTestId("cart-empty-state")).toBeVisible();
    await expect(page.getByTestId("cart-checkout")).toHaveCount(0);
    await page.getByTestId("cart-empty-continue-shopping").click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("image fallbacks and unavailable state render safely", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(
      request,
      `public-empty-fallbacks-${stamp}@example.com`,
    );
    const created = await createPublishedProduct(
      request,
      seller.token,
      stamp,
      "broken-marketplace-image",
    );

    await page.route(`**/uploads/products/${created.shop.id}/${created.product.id}/**`, async (route) => {
      await route.abort();
    });

    await page.goto(`/products?q=Marketplace Fallback Jacket ${stamp}`);
    const productCard = page.getByTestId("product-card").filter({
      hasText: `Marketplace Fallback Jacket ${stamp}`,
    });
    await expect(
      productCard.getByTestId(`product-card-image-${created.product.id}`),
    ).toHaveAttribute("data-fallback-active", "true");

    await productCard.getByTestId(`product-view-${created.product.id}`).click();
    await expect(page.getByTestId("product-gallery-main-image")).toHaveAttribute(
      "data-fallback-active",
      "true",
    );

    await backendJson(
      request,
      `/api/shops/${created.shop.id}/products/${created.product.id}/unpublish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${seller.token}`, Cookie: "" },
        data: {},
      },
    );

    await page.goto(`/products/${created.product.id}`);
    await expect(page.getByTestId("product-unavailable-state")).toBeVisible();
  });

  test("mobile no-result and sticky CTA remain usable", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(
      request,
      `public-empty-mobile-${stamp}@example.com`,
    );
    const created = await createPublishedProduct(
      request,
      seller.token,
      stamp,
      "mobile-fallback-image",
    );

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => window.localStorage.clear());

    await mobilePage.goto("/products?q=definitely-no-result-xyz");
    await expect(mobilePage.getByTestId("products-no-results-state")).toBeVisible();

    await mobilePage.goto(`/products/${created.product.id}`);
    await expect(mobilePage.getByTestId("mobile-product-cta")).toBeVisible();
    await mobilePage.getByTestId("mobile-add-to-cart").click();
    await expect(mobilePage.getByTestId("public-cart-count")).toHaveText("1");

    await mobileContext.close();
  });
});
