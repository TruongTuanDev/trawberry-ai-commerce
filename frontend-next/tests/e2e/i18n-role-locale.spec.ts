import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";

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

async function registerSeller(request: APIRequestContext, email: string) {
  const password = "password123";

  await backendJson<{ userId: string }>(request, "/api/auth/seller/register", {
    method: "POST",
    data: {
      email,
      password,
      fullName: "I18N Seller",
      role: "SELLER",
    },
  });

  return { email, password };
}

async function newCleanPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: frontendBaseUrl,
  });
  await context.clearCookies();
  return context.newPage();
}

async function expectVisibleFlags(
  page: Page,
  role: "customer" | "seller",
  locales: Array<"ru" | "en" | "vi">,
  missing: Array<"ru" | "en" | "vi"> = [],
) {
  await page.locator(`[data-testid="language-switcher-${role}"]:visible`).first().click();
  await expect(page.getByTestId("language-switcher-dropdown")).toBeVisible();
  for (const locale of locales) {
    await expect(page.getByTestId(`locale-flag-${locale}`)).toBeVisible();
  }
  for (const locale of missing) {
    await expect(page.getByTestId(`locale-flag-${locale}`)).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
}

async function chooseLocale(
  page: Page,
  role: "customer" | "seller",
  locale: "ru" | "en" | "vi",
) {
  await page.locator(`[data-testid="language-switcher-${role}"]:visible`).first().click();
  await expect(page.getByTestId("language-switcher-dropdown")).toBeVisible();
  await expect(page.getByTestId(`locale-flag-${locale}`)).toBeVisible();
  await page.getByTestId(`language-option-${role}-${locale}`).click();
}

test("role-based locale defaults and switching persist by surface", async ({
  browser,
  request,
}) => {
  const stamp = Date.now();
  const seller = await registerSeller(
    request,
    `i18n-seller-${stamp}@example.com`,
  );

  const publicPage = await newCleanPage(browser);
  const publicNav = publicPage.getByRole("navigation", {
    name: "Public navigation",
  }).first();

  await publicPage.goto("/products");
  await expectVisibleFlags(publicPage, "customer", ["ru", "en"], ["vi"]);
  await expect(publicNav).toContainText(/Каталог|ÐšÐ°Ñ‚Ð°Ð»Ð¾Ð³/);
  await chooseLocale(publicPage, "customer", "en");
  await expect(publicNav).toContainText("Shop");
  await publicPage.reload();
  await expect(publicNav).toContainText("Shop");
  await publicPage.context().close();

  const sellerPage = await newCleanPage(browser);

  await sellerPage.goto("/seller/login");
  await sellerPage.getByTestId("seller-login-email").fill(seller.email);
  await sellerPage.getByTestId("seller-login-password").fill(seller.password);
  await sellerPage.getByTestId("seller-login-submit").click();
  await sellerPage.waitForURL(/\/seller\/(pending|onboarding)$/);
  const sellerStatus = sellerPage.url().includes("/seller/pending")
    ? sellerPage.getByTestId("seller-pending-status").first()
    : sellerPage.getByTestId("seller-onboarding-status").first();
  await expectVisibleFlags(sellerPage, "seller", ["ru", "en", "vi"]);
  await expect(sellerStatus).toContainText("На");
  await chooseLocale(sellerPage, "seller", "vi");
  await expect(sellerStatus).toContainText("Đang chờ duyệt");
  await chooseLocale(sellerPage, "seller", "en");
  await expect(sellerStatus).toContainText("Pending review");
  await sellerPage.reload();
  await expect(sellerStatus).toContainText("Pending review");
  await sellerPage.context().close();

  const adminPage = await newCleanPage(browser);
  await adminPage.goto("/admin-login");
  await expect(adminPage.getByTestId("language-switcher-admin")).toHaveCount(0);
  await adminPage.context().close();
});
