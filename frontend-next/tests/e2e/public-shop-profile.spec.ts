import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl =
  process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

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
  const register = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "Public Shop Profile Seller",
      role: "SELLER",
    },
  });
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Public Shop Profile Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Public Shop Street 1",
      contactName: "Public Shop Seller",
      contactPhone: "+79990000012",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% public shop profile e2e\n"),
      },
    },
  });
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: {
      email: "demo-admin@trawberry.local",
      password: "DemoAdmin123!",
    },
  });
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

async function createShop(request: APIRequestContext, token: string, stamp: number) {
  return backendJson<{ id: string; slug: string; name: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      name: `Public Shop ${stamp}`,
      slug: `public-shop-${stamp}`,
      paymentInstructions: "Manual transfer",
    },
  });
}

async function createProduct(
  request: APIRequestContext,
  token: string,
  shopId: string,
  input: {
    title: string;
    wbNmId: number;
    chrtId: number;
    stockQuantity: number;
    publish?: boolean;
    unpublish?: boolean;
  },
) {
  const product = await backendJson<{
    id: string;
    variants: Array<{ id: string }>;
  }>(request, `/api/shops/${shopId}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: "" },
    data: {
      wbNmId: input.wbNmId,
      wbTitle: input.title,
      localTitle: input.title,
      localDescription: `${input.title} description`,
      categoryName: "Public Shop Category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: input.chrtId,
          techSize: "XL",
          basePrice: 1799,
          stockQuantity: input.stockQuantity,
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
        name: `${input.title}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9oNn14kAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });

  if (input.publish !== false) {
    await backendJson(request, `/api/shops/${shopId}/products/${product.id}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {},
    });
  }

  if (input.unpublish) {
    await backendJson(request, `/api/shops/${shopId}/products/${product.id}/unpublish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Cookie: "" },
      data: {},
    });
  }

  return product;
}

async function switchPublicLocale(page: Page, locale: "ru" | "en") {
  await page.context().addCookies([
    {
      name: "trawberry-locale",
      value: locale,
      url: frontendBaseUrl,
    },
  ]);
  await page.evaluate((nextLocale) => {
    window.localStorage.setItem("trawberry-locale", nextLocale);
  }, locale);
  await page.reload();
}

test("public shop profile exposes shop link, public-only products, and RU/EN labels", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);

  const stamp = Date.now();
  const seller = await approveSeller(request, `public-shop-profile-${stamp}@example.com`);
  const shop = await createShop(request, seller.token, stamp);
  const visibleProduct = await createProduct(request, seller.token, shop.id, {
    title: `Visible Shop Jacket ${stamp}`,
    wbNmId: 7600000 + (stamp % 100000),
    chrtId: 8600000 + (stamp % 100000),
    stockQuantity: 5,
  });
  await createProduct(request, seller.token, shop.id, {
    title: `Hidden Stock Zero ${stamp}`,
    wbNmId: 7601000 + (stamp % 100000),
    chrtId: 8601000 + (stamp % 100000),
    stockQuantity: 0,
    publish: false,
  });
  await createProduct(request, seller.token, shop.id, {
    title: `Hidden Draft ${stamp}`,
    wbNmId: 7602000 + (stamp % 100000),
    chrtId: 8602000 + (stamp % 100000),
    stockQuantity: 4,
    unpublish: true,
  });

  await page.goto(`/products/${visibleProduct.id}`);
  await expect(page.getByTestId("public-product-shop-link")).toBeVisible();
  await page.getByTestId("public-product-shop-link").click();

  await expect(page).toHaveURL(new RegExp(`/shops/${shop.slug}$`));
  await expect(page.getByTestId("public-shop-header")).toContainText(shop.name);
  await expect(page.getByTestId("public-shop-products-grid")).toContainText(`Visible Shop Jacket ${stamp}`);
  await expect(page.getByTestId("public-shop-products-grid")).not.toContainText(`Hidden Stock Zero ${stamp}`);
  await expect(page.getByTestId("public-shop-products-grid")).not.toContainText(`Hidden Draft ${stamp}`);

  await expect(page.getByTestId("public-shop-verified-badge")).toContainText("Проверенный магазин");
  await expect(page.getByTestId("public-shop-message-button")).toContainText("Написать магазину");

  await page.getByTestId("public-shop-message-button").click();
  await expect(page).toHaveURL(
    new RegExp(`/customer/login\\?next=${encodeURIComponent(`/customer/messages/new?shopSlug=${shop.slug}`)}`),
  );
  await page.goBack();

  await expect(page.getByTestId("language-switcher-customer").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\bVI\b/);

  await switchPublicLocale(page, "en");
  await expect(page.getByTestId("public-shop-verified-badge")).toContainText("Verified shop");
  await expect(page.getByTestId("public-shop-message-button")).toContainText("Message shop");
  await expect(page.getByTestId("public-shop-products-section")).toContainText("Products from");

  await page.reload();
  await expect(page.getByTestId("public-shop-message-button")).toContainText("Message shop");
});

test("unknown public shop shows safe not-found UI", async ({ page }) => {
  await page.goto("/shops/non-existent-public-shop");
  await expect(page.getByTestId("public-shop-not-found")).toBeVisible();
});
