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
        fullName: "Public Marketplace Contract Seller",
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
      legalName: "Public Marketplace Contract Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Contract Street 1",
      contactName: "Marketplace Contract Seller",
      contactPhone: "+79990000011",
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
          buffer: Buffer.from("%PDF-1.4\n% public marketplace contract e2e\n"),
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

async function createProduct(request: APIRequestContext, token: string, stamp: number) {
  const shop = await backendJson<{ id: string; name: string }>(
    request,
    "/api/shops",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {
        name: `Marketplace Contract Shop ${stamp}`,
        slug: `marketplace-contract-shop-${stamp}`,
        paymentInstructions: "Manual transfer for public marketplace contract",
      },
    },
  );
  const wbNmId = 7500000 + (stamp % 100000);
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId,
      wbTitle: `Marketplace Contract Jacket ${stamp}`,
      localTitle: `Marketplace Contract Jacket ${stamp}`,
      localDescription: "Public marketplace contract test product",
      categoryName: "Marketplace Contract Category",
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
          name: `public-marketplace-contract-${suffix}-${stamp}.png`,
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

test.describe("public marketplace contract hardening", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("header search, cart badge, variant availability, and buy now stay in contract", async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(
      request,
      `public-marketplace-contract-${stamp}@example.com`,
    );
    const created = await createProduct(request, seller.token, stamp);

    await page.goto("/products");
    await expect(page.getByTestId("products-grid")).toBeVisible();
    await expect(page.getByTestId("public-cart-count")).toHaveCount(0);

    await page
      .getByTestId("public-header-search")
      .fill(`Marketplace Contract Jacket ${stamp}`);
    await page.getByTestId("public-header-search").press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`\\/products\\?q=Marketplace(\\+|%20)Contract(\\+|%20)Jacket(\\+|%20)${stamp}`),
    );

    const productCard = page.getByTestId("product-card").filter({
      hasText: `Marketplace Contract Jacket ${stamp}`,
    });
    await expect(productCard).toContainText(`Marketplace Contract Shop ${stamp}`);
    await expect(productCard.getByTestId(`product-primary-action-${created.product.id}`)).toBeVisible();

    await productCard.getByTestId(`product-view-${created.product.id}`).click();
    await expect(page.getByTestId("product-gallery")).toBeVisible();
    await expect(page.getByTestId("product-detail-title")).toContainText(
      `Marketplace Contract Jacket ${stamp}`,
    );
    await expect(page.getByTestId(`product-size-${created.product.variants[1].id}`)).toBeDisabled();
    await expect(page.getByTestId("product-selected-size")).toContainText("XL");

    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("public-cart-count")).toHaveText("1");

    await page
      .getByTestId("product-quantity-stepper")
      .getByLabel("Increase quantity")
      .click();
    await expect(page.getByTestId("public-cart-count")).toHaveText("2");

    await page
      .getByTestId("product-quantity-stepper")
      .getByLabel("Decrease quantity")
      .click();
    await expect(page.getByTestId("public-cart-count")).toHaveText("1");

    await page.getByTestId("continue-to-checkout").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId("checkout-order-items")).toContainText(
      `Marketplace Contract Jacket ${stamp}`,
    );
  });

  test("mobile sticky CTA stays accessible for in-stock variants", async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);

    const stamp = Date.now();
    const seller = await approveSeller(
      request,
      `public-marketplace-mobile-${stamp}@example.com`,
    );
    const created = await createProduct(request, seller.token, stamp);
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => window.localStorage.clear());

    await mobilePage.goto(`/products/${created.product.id}`);
    await expect(mobilePage.getByTestId("mobile-product-cta")).toBeVisible();
    await expect(
      mobilePage.getByTestId(`product-size-${created.product.variants[1].id}`),
    ).toBeDisabled();

    await mobilePage.getByTestId("mobile-add-to-cart").click();
    await expect(mobilePage.getByTestId("public-cart-count")).toHaveText("1");

    await mobilePage
      .getByTestId("mobile-product-quantity-stepper")
      .getByLabel("Increase quantity")
      .click();
    await expect(mobilePage.getByTestId("public-cart-count")).toHaveText("2");

    await mobileContext.close();
  });
});
