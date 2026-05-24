import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

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
    data: { email, password, fullName: "Seller I18N Ops", role: "SELLER" },
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
      legalName: "Seller I18N Ops",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, I18N Street 11",
      contactName: "Seller I18N Ops",
      contactPhone: "+79990000111",
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
          name: "seller-proof.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n%i18n seller ops\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
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
  return { email, password, token: sellerLogin.accessToken };
}

async function seedSellerCatalog(
  request: APIRequestContext,
  token: string,
  stamp: number,
) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: `I18N Seller Shop ${stamp}`,
      slug: `i18n-seller-shop-${stamp}`,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      wbNmId: 9100000 + (stamp % 100000),
      wbTitle: `I18N Seller Product ${stamp}`,
      localTitle: `I18N Seller Product ${stamp}`,
      categoryName: "Seller i18n category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: 9200000 + (stamp % 100000),
          techSize: "ONE",
          wbSize: "One size",
          basePrice: 150,
          stockQuantity: 0,
          trackInventory: true,
          isActive: true,
        },
      ],
      images: [
        {
          wbUrl: "https://placehold.co/160x160?text=I18N",
          localUrl: "https://placehold.co/160x160?text=I18N",
          isMain: true,
          sortOrder: 0,
        },
      ],
    },
  });

  return shop;
}

async function newSellerPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: frontendBaseUrl });
  await context.clearCookies();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  return page;
}

test("seller operations surface follows RU/VI/EN locale switching", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const seller = await approveSeller(request, `seller-i18n-ops-${stamp}@example.com`);
  const shop = await seedSellerCatalog(request, seller.token, stamp);

  const page = await newSellerPage(browser);

  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(seller.email);
  await page.getByTestId("seller-login-password").fill(seller.password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto("/seller/products");
  await page.getByRole("combobox").first().selectOption(shop.id);
  await expect(page.getByTestId("seller-product-row").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Товары" }).first()).toBeVisible();
  await expect(page.getByText("Нет в наличии").first()).toBeVisible();

  await expect(page.getByTestId("language-option-seller-ru")).toBeVisible();
  await expect(page.getByTestId("language-option-seller-en")).toBeVisible();
  await expect(page.getByTestId("language-option-seller-vi")).toBeVisible();

  await page.getByTestId("action-menu-trigger").first().click();
  await expect(page.getByRole("menuitem", { name: "Изменить товар" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Сгенерировать AI-фото" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("language-option-seller-vi").click();
  await expect(page.getByRole("link", { name: "Sản phẩm" }).first()).toBeVisible();
  await expect(page.getByText("Hết hàng").first()).toBeVisible();
  await page.getByTestId("action-menu-trigger").first().click();
  await expect(page.getByRole("menuitem", { name: "Sửa sản phẩm" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Tạo ảnh AI" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/seller/orders");
  await expect(page.getByTestId("seller-order-tab-NEW").first()).toContainText("Mới");

  await page.goto("/seller/payments");
  await expect(page.getByRole("button", { name: "Tải lại queue" })).toBeVisible();

  await page.goto("/seller/notifications");
  await expect(page.getByRole("heading", { name: "Việc cần xử lý", exact: true })).toBeVisible();
  await expect(page.getByTestId("empty-state-title")).toContainText(
    "Bạn chưa có việc cần xử lý",
  );

  await page.getByTestId("language-option-seller-en").click();
  await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible();
  await page.goto("/seller/orders");
  await expect(page.getByTestId("seller-order-tab-NEW").first()).toContainText("New");
  await page.goto("/seller/payments");
  await expect(page.getByRole("button", { name: "Reload queue" })).toBeVisible();
  await page.goto("/seller/products");
  await expect(page.getByText("Out of stock").first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Products" }).first()).toBeVisible();

  await page.context().close();
});
