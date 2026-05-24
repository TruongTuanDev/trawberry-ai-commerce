import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const accounts = {
  admin: {
    email: "demo-admin@trawberry.local",
    password: "DemoAdmin123!",
  },
  seller: {
    email: "demo-seller@trawberry.local",
    password: "DemoSeller123!",
  },
  customer: {
    email: "demo-customer@trawberry.local",
    password: "DemoCustomer123!",
  },
};

async function login(page: Page, path: string, testIdPrefix: string, email: string, password: string) {
  await page.goto(path);
  await page.getByTestId(`${testIdPrefix}-email`).fill(email);
  await page.getByTestId(`${testIdPrefix}-password`).fill(password);
  await page.getByTestId(`${testIdPrefix}-submit`).click();
}

/**
 * Retries admin login if the rate-limiter fires (5-min window, shared demo-admin account).
 */
async function loginAdminWithRetry(page: Page, maxAttempts = 5): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await page.goto("/admin-login");
    await page.getByTestId("admin-login-email").fill(accounts.admin.email);
    await page.getByTestId("admin-login-password").fill(accounts.admin.password);
    await page.getByTestId("admin-login-submit").click();

    const rateLimitMsg = page.locator("text=/quá nhanh|thử lại/i");
    const redirected = page.waitForURL("**/admin/dashboard", { timeout: 8000 }).then(() => "ok").catch(() => "timeout");
    const rateLimited = rateLimitMsg.waitFor({ timeout: 3000 }).then(() => "rate").catch(() => "none");

    const result = await Promise.race([redirected, rateLimited]);
    if (result === "ok") return;

    const backoffMs = 6000 * (attempt + 1);
    await page.waitForTimeout(backoffMs);
  }
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill(accounts.admin.email);
  await page.getByTestId("admin-login-password").fill(accounts.admin.password);
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
}

async function overwriteCookie(context: BrowserContext, name: string, value: string) {
  const cookies = await context.cookies();
  const target = cookies.find((cookie) => cookie.name === name);
  expect(target).toBeTruthy();

  await context.addCookies([
    {
      name,
      value,
      domain: target!.domain,
      path: target!.path,
      httpOnly: target!.httpOnly,
      secure: target!.secure,
      sameSite: target!.sameSite,
      expires: target!.expires,
    },
  ]);
}

test("same browser keeps isolated admin, seller, and customer sessions", async ({ page, context }) => {
  test.setTimeout(120000);

  await loginAdminWithRetry(page);
  await expect(page.getByTestId("admin-shell")).toBeVisible();

  await login(
    page,
    "/seller/login",
    "seller-login",
    accounts.seller.email,
    accounts.seller.password,
  );
  await page.waitForURL(/\/seller\/(dashboard|onboarding|pending)/);
  await expect(page.getByTestId("seller-shell")).toBeVisible();

  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("admin-shell")).toBeVisible();

  await login(
    page,
    "/customer/login",
    "customer-login",
    accounts.customer.email,
    accounts.customer.password,
  );
  await page.waitForURL("**/customer/orders");
  await expect(page.getByTestId("customer-orders-list")).toBeVisible();

  const cookieNames = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookieNames).toContain("admin_access_token");
  expect(cookieNames).toContain("seller_access_token");
  expect(cookieNames).toContain("customer_access_token");
  expect(cookieNames).toContain("admin_refresh_token");
  expect(cookieNames).toContain("seller_refresh_token");
  expect(cookieNames).toContain("customer_refresh_token");

  await page.goto("/products");
  await expect(page.getByTestId("public-customer-link")).toContainText(/demo customer/i);
  await expect(page.getByTestId("public-admin-dashboard-link")).toHaveCount(0);
  await expect(page.getByTestId("public-seller-dashboard-link")).toHaveCount(0);

  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("admin-shell")).toBeVisible();

  await page.goto("/seller/dashboard");
  await expect(page.getByTestId("seller-shell")).toBeVisible();

  await page.getByTestId("logout-button").click();
  await page.waitForURL(/\/seller-login|\/login/);

  const cookiesAfterSellerLogout = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookiesAfterSellerLogout).toContain("admin_access_token");
  expect(cookiesAfterSellerLogout).toContain("customer_access_token");
  expect(cookiesAfterSellerLogout).not.toContain("seller_access_token");
  expect(cookiesAfterSellerLogout).not.toContain("seller_refresh_token");

  await page.goto("/seller/dashboard");
  await page.waitForURL(/\/seller-login|\/login/);

  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("admin-shell")).toBeVisible();

  await page.goto("/customer/orders");
  await expect(page.getByTestId("customer-orders-list")).toBeVisible();
});

test("customer auto refresh does not affect the seller session", async ({ page, context }) => {
  test.setTimeout(120000);

  await login(
    page,
    "/seller/login",
    "seller-login",
    accounts.seller.email,
    accounts.seller.password,
  );
  await page.waitForURL(/\/seller\/(dashboard|onboarding|pending)/);

  await login(
    page,
    "/customer/login",
    "customer-login",
    accounts.customer.email,
    accounts.customer.password,
  );
  await page.waitForURL("**/customer/orders");

  await overwriteCookie(context, "customer_access_token", "invalid-customer-access-token");
  await page.goto("/customer/account/profile");
  await expect(page.getByTestId("customer-profile-name")).toBeVisible();

  const cookieNamesAfterRefresh = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookieNamesAfterRefresh).toContain("seller_access_token");
  expect(cookieNamesAfterRefresh).toContain("seller_refresh_token");

  await page.goto("/seller/dashboard");
  await expect(page.getByTestId("seller-shell")).toBeVisible();
});
