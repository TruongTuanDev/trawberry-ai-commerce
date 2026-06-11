import fs from "fs";
import path from "path";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
const frontendBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const enDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/en.json"), "utf-8"),
);
const ruDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/ru.json"), "utf-8"),
);
const viDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/vi.json"), "utf-8"),
);

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

async function createPaidOrder(
  request: APIRequestContext,
  token: string,
  stamp: number,
  phone: string,
) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: `Seller Order Detail Shop ${stamp}`,
      slug: `seller-order-detail-shop-${stamp}`,
      paymentInstructions: "Manual transfer.",
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      pickupAddress: "Tverskaya 1, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "101000",
      pickupContactPhone: "+74950000000",
      pickupContactName: "Seller Ops",
      pickupLatitude: 55.7558,
      pickupLongitude: 37.6176,
      enabledCarriers: ["CDEK", "YANDEX"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 1200,
      defaultLengthCm: 36,
      defaultWidthCm: 24,
      defaultHeightCm: 12,
    },
  });

  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      wbNmId: 9300000 + (stamp % 100000),
      wbTitle: `Seller Order Detail Product ${stamp}`,
      localTitle: `Seller Order Detail Product ${stamp}`,
      localDescription: "Seller order detail i18n product",
      categoryName: "Seller order detail",
      visibility: "ACTIVE",
      variants: [{ chrtId: 9400000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/seller-order-detail.jpg", localUrl: "https://example.com/seller-order-detail.jpg", isMain: true, sortOrder: 0 }],
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });

  const checkout = await backendJson<{ orderId: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Seller Order Detail Buyer",
        phone,
        email: `seller-order-detail-buyer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
        latitude: 55.751244,
        longitude: 37.618423,
        note: `Seller order detail note ${stamp}`,
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: { note: "Paid for seller order detail i18n." },
  });

  return checkout;
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

async function chooseSellerLocale(page: Page, locale: "ru" | "en" | "vi") {
  await page.getByTestId("language-switcher-seller").click();
  await page.getByTestId(`language-option-seller-${locale}`).click();
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
  await chooseSellerLocale(page, "ru");
  await expect(page.getByPlaceholder("Поиск раздела...")).toHaveCount(0);
  await expect(page.getByTestId("seller-navigation-desktop")).toBeVisible();
  await page.getByRole("combobox").first().selectOption(shop.id);
  await expect(page.getByTestId("seller-product-row").first()).toBeVisible();
  await expect(page.getByRole("link", { name: ruDict.sellerShell.products }).first()).toBeVisible();
  await expect(page.getByText(ruDict.seller.products.statusBadges.outOfStock).first()).toBeVisible();

  await page.getByTestId("language-switcher-seller").click();
  await expect(page.getByTestId("language-option-seller-ru")).toBeVisible();
  await expect(page.getByTestId("language-option-seller-en")).toBeVisible();
  await expect(page.getByTestId("language-option-seller-vi")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("action-menu-trigger").first().click();
  await expect(page.getByRole("menu").last()).toBeVisible();
  await expect(page.getByRole("menu").last()).toContainText(
    ruDict.seller.products.actions.editProduct,
  );
  await expect(page.getByRole("menu").last()).toContainText(
    ruDict.seller.products.actions.generateAiImages,
  );
  await page.keyboard.press("Escape");

  await chooseSellerLocale(page, "vi");
  await expect(page.getByPlaceholder("Tìm chức năng...")).toHaveCount(0);
  await expect(page.getByRole("link", { name: viDict.sellerShell.products }).first()).toBeVisible();
  await expect(page.getByText(viDict.seller.products.statusBadges.outOfStock).first()).toBeVisible();
  await page.getByTestId("action-menu-trigger").first().click();
  await expect(page.getByRole("menu").last()).toBeVisible();
  await expect(page.getByRole("menu").last()).toContainText(
    viDict.seller.products.actions.editProduct,
  );
  await expect(page.getByRole("menu").last()).toContainText(
    viDict.seller.products.actions.generateAiImages,
  );
  await page.keyboard.press("Escape");

  await page.goto("/seller/orders");
  await expect(page.getByTestId("seller-order-tab-NEW").first()).toContainText(
    viDict.sellerOrders.new,
  );

  await page.goto("/seller/payments");
  await expect(
    page.getByRole("button", { name: viDict.seller.payments.reloadQueue }),
  ).toBeVisible();

  await page.goto("/seller/import/wildberries-api");
  await expect(page.getByText(viDict.seller.wbSync.title, { exact: true })).toBeVisible();
  await expect(page.getByText(viDict.seller.wbSync.integrationUnavailable, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/mock|demo|dev mode/i);

  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/ai-images/runtime`, async (route) => {
    await route.fulfill({
      json: {
        shopId: shop.id,
        workerMode: "ai-service",
        effectiveMode: "AI_SERVICE_MOCK",
        sellerFlowEffectiveMode: "AI_SERVICE_MOCK",
        supportsTaskGeneration: true,
        supportsTaskAttach: true,
        supportsCredits: true,
        supportsTaskRetry: true,
        supportsVirtualTryOn: false,
        tryOnReady: false,
        aiServiceConfigured: true,
        aiServiceReachable: true,
        aiServiceProvider: "mock",
        aiServiceStorageDriver: "mock",
        openAiConfigured: false,
        openAiSmokeEnabled: false,
        openAiRealEnabled: false,
      },
    });
  });
  await page.goto("/seller/ai-images");
  await expect(page.getByRole("heading", { name: viDict.seller.aiImages.title, exact: true })).toBeVisible();
  await expect(page.getByTestId("ai-runtime-badge")).toContainText(
    viDict.seller.aiImages.runtime.integrationUnavailable,
  );
  await expect(page.locator("body")).not.toContainText(/mock|runtime mode|backend/i);

  await page.goto("/seller/billing");
  await expect(page.getByText(viDict.seller.billing.title, { exact: true })).toBeVisible();

  await page.goto("/seller/campaigns");
  await expect(page.getByText(viDict.seller.campaigns.title, { exact: true })).toBeVisible();

  await page.goto("/seller/notifications");
  await expect(
    page.getByRole("heading", {
      name: viDict.seller.notifications.heading,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("empty-state-title")).toContainText(
    viDict.seller.notifications.emptyTitle,
  );

  await chooseSellerLocale(page, "en");
  await expect(page.getByPlaceholder("Find a section...")).toHaveCount(0);
  await expect(page.getByRole("link", { name: enDict.sellerShell.products }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: enDict.seller.notifications.heading,
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/seller/orders");
  await expect(page.getByTestId("seller-order-tab-NEW").first()).toContainText(
    enDict.sellerOrders.new,
  );
  await page.goto("/seller/payments");
  await expect(
    page.getByRole("button", { name: enDict.seller.payments.reloadQueue }),
  ).toBeVisible();
  await page.goto("/seller/products");
  await expect(page.getByText(enDict.seller.products.statusBadges.outOfStock).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: enDict.sellerShell.products }).first()).toBeVisible();
});

test("seller order detail switches RU/VI/EN labels live", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const seller = await approveSeller(request, `seller-order-detail-i18n-${stamp}@example.com`);
  const checkout = await createPaidOrder(request, seller.token, stamp, `+7996${String(stamp).slice(-7)}`);

  const page = await newSellerPage(browser);
  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(seller.email);
  await page.getByTestId("seller-login-password").fill(seller.password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByTestId("seller-order-delivery-section")).toBeVisible();
  await chooseSellerLocale(page, "ru");
  await expect(page.getByText(ruDict.seller.orderDetail.yandexHandoffTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(ruDict.seller.orderDetail.paymentMethod, { exact: true })).toBeVisible();
  await expect(page.getByText(ruDict.seller.orderDetail.shippingAddress, { exact: true })).toBeVisible();

  await chooseSellerLocale(page, "vi");
  await expect(page.getByText(viDict.seller.orderDetail.yandexHandoffTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(viDict.seller.orderDetail.paymentMethod, { exact: true })).toBeVisible();
  await expect(page.getByText(viDict.seller.orderDetail.shippingAddress, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(ruDict.seller.orderDetail.yandexHandoffTitle);

  await chooseSellerLocale(page, "en");
  await expect(page.getByText(enDict.seller.orderDetail.yandexHandoffTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(enDict.seller.orderDetail.paymentMethod, { exact: true })).toBeVisible();
  await expect(page.getByText(enDict.seller.orderDetail.shippingAddress, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(viDict.seller.orderDetail.yandexHandoffTitle);
});
