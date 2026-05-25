import fs from "fs";
import path from "path";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const enDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/en.json"), "utf-8"),
);
const ruDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/ru.json"), "utf-8"),
);
const viDict = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../src/i18n/dictionaries/vi.json"), "utf-8"),
);

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
    data: { email, password, fullName: "Seller I18N Remaining", role: "SELLER" },
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
      legalName: "Seller I18N Remaining",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, Seller Locale Street 11",
      contactName: "Seller I18N Remaining",
      contactPhone: "+79990000111",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "seller-proof.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%i18n seller remaining\n"),
      },
    },
  });
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
      name: `Seller Locale Shop ${stamp}`,
      slug: `seller-locale-shop-${stamp}`,
    },
  });

  await backendJson(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      wbNmId: 9500000 + (stamp % 100000),
      wbTitle: `Seller Locale Product ${stamp}`,
      localTitle: `Seller Locale Product ${stamp}`,
      categoryName: "Seller locale category",
      visibility: "ACTIVE",
      variants: [
        {
          chrtId: 9600000 + (stamp % 100000),
          techSize: "ONE",
          wbSize: "One size",
          basePrice: 210,
          stockQuantity: 6,
          trackInventory: true,
          isActive: true,
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

async function switchSellerLocale(page: Page, locale: "ru" | "en" | "vi") {
  const responsePromise = page.waitForResponse("**/api/users/locale");
  await page.getByTestId("language-switcher-seller").click();
  await page.getByTestId(`language-option-seller-${locale}`).click();
  await responsePromise;
}

test("seller payment settings and products filters switch RU/VI/EN live without reload", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const seller = await approveSeller(request, `seller-i18n-polish-${stamp}@example.com`);
  const shop = await seedSellerCatalog(request, seller.token, stamp);
  const page = await newSellerPage(browser);

  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(seller.email);
  await page.getByTestId("seller-login-password").fill(seller.password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/dashboard");

  await page.getByRole("combobox").first().selectOption(shop.id);

  await page.goto("/seller/payment-settings");
  await expect(page.getByTestId("seller-payment-settings-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: ruDict.seller.paymentSettings.title, exact: true })).toBeVisible();
  await expect(page.getByText(ruDict.seller.paymentSettings.bankName, { exact: true })).toBeVisible();
  await expect(page.getByText(ruDict.seller.paymentSettings.paymentMethodStrategy, { exact: true })).toBeVisible();

  await switchSellerLocale(page, "vi");
  await expect(page.getByRole("heading", { name: viDict.seller.paymentSettings.title, exact: true })).toBeVisible();
  await expect(page.getByText(viDict.seller.paymentSettings.bankName, { exact: true })).toBeVisible();
  await expect(page.getByText(viDict.seller.paymentSettings.paymentMethodStrategy, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(enDict.seller.paymentSettings.title);
  await expect(page.locator("body")).not.toContainText("BANK NAME");

  await switchSellerLocale(page, "ru");
  await expect(page.getByRole("heading", { name: ruDict.seller.paymentSettings.title, exact: true })).toBeVisible();
  await expect(page.getByText(ruDict.seller.paymentSettings.bankName, { exact: true })).toBeVisible();

  await switchSellerLocale(page, "en");
  await expect(page.getByRole("heading", { name: enDict.seller.paymentSettings.title, exact: true })).toBeVisible();
  await expect(page.getByText(enDict.seller.paymentSettings.bankName, { exact: true })).toBeVisible();
  await expect(page.getByText(enDict.seller.paymentSettings.paymentMethodStrategy, { exact: true })).toBeVisible();

  await page.goto("/seller/products");
  await expect(page.getByTestId("seller-products-page")).toBeVisible();
  await expect(page.getByTestId("seller-products-search-input")).toHaveAttribute(
    "placeholder",
    enDict.seller.products.filters.searchPlaceholder,
  );
  await expect(page.getByTestId("seller-products-status-filter").locator("option").first()).toHaveText(
    enDict.seller.products.filters.allStatuses,
  );
  await expect(page.getByTestId("seller-products-stock-filter").locator("option").first()).toHaveText(
    enDict.seller.products.filters.allStockStates,
  );
  await expect(page.getByTestId("seller-products-apply-filters")).toHaveText(
    enDict.seller.products.filters.apply,
  );

  await switchSellerLocale(page, "vi");
  await expect(page.getByTestId("seller-products-search-input")).toHaveAttribute(
    "placeholder",
    viDict.seller.products.filters.searchPlaceholder,
  );
  await expect(page.getByTestId("seller-products-status-filter").locator("option").first()).toHaveText(
    viDict.seller.products.filters.allStatuses,
  );
  await expect(page.getByTestId("seller-products-stock-filter").locator("option").first()).toHaveText(
    viDict.seller.products.filters.allStockStates,
  );
  await expect(page.getByTestId("seller-products-apply-filters")).toHaveText(
    viDict.seller.products.filters.apply,
  );
  await expect(page.locator("body")).not.toContainText(enDict.seller.products.filters.apply);

  await switchSellerLocale(page, "ru");
  await expect(page.getByTestId("seller-products-search-input")).toHaveAttribute(
    "placeholder",
    ruDict.seller.products.filters.searchPlaceholder,
  );
  await expect(page.getByTestId("seller-products-status-filter").locator("option").first()).toHaveText(
    ruDict.seller.products.filters.allStatuses,
  );
  await expect(page.getByTestId("seller-products-stock-filter").locator("option").first()).toHaveText(
    ruDict.seller.products.filters.allStockStates,
  );
  await expect(page.getByTestId("seller-products-apply-filters")).toHaveText(
    ruDict.seller.products.filters.apply,
  );

  await switchSellerLocale(page, "en");
  await expect(page.getByTestId("seller-products-search-input")).toHaveAttribute(
    "placeholder",
    enDict.seller.products.filters.searchPlaceholder,
  );
  await expect(page.getByTestId("seller-products-status-filter").locator("option").first()).toHaveText(
    enDict.seller.products.filters.allStatuses,
  );
  await expect(page.getByTestId("seller-products-stock-filter").locator("option").first()).toHaveText(
    enDict.seller.products.filters.allStockStates,
  );
  await expect(page.getByTestId("seller-products-apply-filters")).toHaveText(
    enDict.seller.products.filters.apply,
  );
});
