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
    data: { email, password, fullName: "Seller I18N Polish", role: "SELLER" },
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
      legalName: "Seller I18N Polish",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, I18N Street 11",
      contactName: "Seller I18N Polish",
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
          buffer: Buffer.from("%PDF-1.4\n%i18n seller polish\n"),
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
      name: `I18N Polish Shop ${stamp}`,
      slug: `i18n-polish-shop-${stamp}`,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      wbNmId: 9300000 + (stamp % 100000),
      wbTitle: `I18N Polish Product ${stamp}`,
      localTitle: `I18N Polish Product ${stamp}`,
      categoryName: "Seller i18n category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: 9400000 + (stamp % 100000),
          techSize: "ONE",
          wbSize: "One size",
          basePrice: 200,
          stockQuantity: 10,
          trackInventory: true,
          isActive: true,
        },
      ],
      images: [
        {
          wbUrl: "https://placehold.co/160x160?text=AI",
          localUrl: "https://placehold.co/160x160?text=AI",
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

test("seller remaining screens (Finance, Returns, AI Images) localize properly", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const seller = await approveSeller(request, `seller-i18n-rem-${stamp}@example.com`);
  const shop = await seedSellerCatalog(request, seller.token, stamp);

  const page = await newSellerPage(browser);

  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(seller.email);
  await page.getByTestId("seller-login-password").fill(seller.password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  // --- RU locale checks (Default) ---
  await page.goto("/seller/finance");
  await expect(page.getByRole("heading", { name: "Финансы продавца", exact: true })).toBeVisible();

  await page.goto("/seller/returns");
  await expect(page.getByRole("heading", { name: "Случаи возврата и возмещения", exact: true })).toBeVisible();

  await page.goto("/seller/ai-images");
  await page.getByRole("combobox").first().selectOption(shop.id);
  await expect(page.getByRole("heading", { name: "AI-изображения", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сгенерировать AI-изображение", exact: true })).toBeVisible();

  // --- VI locale switches ---
  const viLocalePromise = page.waitForResponse("**/api/users/locale");
  await page.getByTestId("language-option-seller-vi").click();
  await viLocalePromise;
  await expect(page.getByRole("heading", { name: "AI Images", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo ảnh AI", exact: true })).toBeVisible();

  await page.goto("/seller/finance");
  await expect(page.getByRole("heading", { name: "Tài chính seller", exact: true })).toBeVisible();

  await page.goto("/seller/returns");
  await expect(page.getByRole("heading", { name: "Case trả hàng và hoàn tiền", exact: true })).toBeVisible();

  // --- EN locale switches ---
  const enLocalePromise = page.waitForResponse("**/api/users/locale");
  await page.getByTestId("language-option-seller-en").click();
  await enLocalePromise;
  await expect(page.getByRole("heading", { name: "Return and refund cases", exact: true })).toBeVisible();

  await page.goto("/seller/finance");
  await expect(page.getByRole("heading", { name: "Seller finance", exact: true })).toBeVisible();

  await page.goto("/seller/ai-images");
  await expect(page.getByRole("heading", { name: "AI Images", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate AI image", exact: true })).toBeVisible();

  // --- Persistence checks (reload page, should stay EN) ---
  await page.reload();
  await expect(page.getByRole("heading", { name: "AI Images", exact: true })).toBeVisible();

  await page.context().close();
});
