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
        fullName: "Recommendation Seller",
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
      legalName: "Recommendation Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Recommendation Street 1",
      contactName: "Recommendation Seller",
      contactPhone: "+79990000013",
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
          buffer: Buffer.from("%PDF-1.4\n% recommendations e2e\n"),
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

async function createShop(
  request: APIRequestContext,
  token: string,
  stamp: number,
) {
  return backendJson<{ id: string; slug: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        name: `Recommendation Shop ${stamp}`,
        slug: `recommendation-shop-${stamp}`,
        paymentInstructions: "Manual transfer for recommendations tests",
      },
    },
  );
}

async function createPublishedProduct(
  request: APIRequestContext,
  token: string,
  shopId: string,
  stamp: number,
  suffix: string,
) {
  const wbNmId = 7800000 + (stamp % 100000) + Number(suffix);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shopId}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `Recommendation Jacket ${suffix} ${stamp}`,
      localTitle: `Recommendation Jacket ${suffix} ${stamp}`,
      localDescription: "Recommendation E2E product",
      categoryName: "Recommendation Jackets",
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
      ],
    },
  });

  await backendJson(request, `/api/shops/${shopId}/products/${product.id}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    multipart: {
      files: {
        name: `recommendation-${suffix}-${stamp}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });

  await backendJson(request, `/api/shops/${shopId}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {},
  });

  return product;
}

test.describe("public recommendations", () => {
  test("product detail hides the recommendation section on empty and error responses", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(request, `recommendations-empty-${stamp}@example.com`);
    const shop = await createShop(request, seller.token, stamp);
    const product = await createPublishedProduct(request, seller.token, shop.id, stamp, "1");

    await page.route(`**/api/public/recommendations/products/${product.id}/similar**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ algorithm: "rule_based_v1", items: [] }),
      });
    });

    await page.goto(`/products/${product.id}`);
    await expect(page.getByTestId("product-detail-title")).toContainText(`Recommendation Jacket 1 ${stamp}`);
    await expect(page.getByTestId("recommendation-section-product_detail")).toHaveCount(0);

    await page.unroute(`**/api/public/recommendations/products/${product.id}/similar**`);
    await page.route(`**/api/public/recommendations/products/${product.id}/similar**`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "boom" }),
      });
    });

    await page.reload();
    await expect(page.getByTestId("recommendation-section-product_detail")).toHaveCount(0);
  });

  test("clicking a recommended product still navigates to the target product page", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(request, `recommendations-click-${stamp}@example.com`);
    const shop = await createShop(request, seller.token, stamp);
    const productOne = await createPublishedProduct(request, seller.token, shop.id, stamp, "1");
    const productTwo = await createPublishedProduct(request, seller.token, shop.id, stamp, "2");

    await page.goto(`/products/${productOne.id}`);
    await expect(page.getByTestId("recommendation-section-product_detail")).toBeVisible();
    await page
      .getByTestId("recommendation-grid-product_detail")
      .getByTestId(`product-view-${productTwo.id}`)
      .click();

    await expect(page).toHaveURL(new RegExp(`/products/${productTwo.id}$`));
    await expect(page.getByTestId("product-detail-title")).toContainText(`Recommendation Jacket 2 ${stamp}`);
  });
});
