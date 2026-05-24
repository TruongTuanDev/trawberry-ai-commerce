import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function login(page: Page, path: string, prefix: string, email: string, password: string) {
  await page.goto(path);
  await page.getByTestId(`${prefix}-email`).fill(email);
  await page.getByTestId(`${prefix}-password`).fill(password);
  await page.getByTestId(`${prefix}-submit`).click();
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

test("auth role separation keeps admin hidden from public marketplace", async ({ page }) => {
  await page.goto("/products");

  const publicNav = page.getByTestId("public-nav");

  await expect(page.getByTestId("public-cart-link")).toBeVisible();
  await expect(page.getByTestId("public-customer-link")).toBeVisible();
  await expect(page.getByTestId("public-customer-register-link")).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Sell with trawberry" })).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Seller login" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Admin login/i })).toHaveCount(0);
});

test("customer registration supports email/password and redirects to customer login", async ({ page }) => {
  const stamp = Date.now();
  const email = `auth-role-customer-${stamp}@example.com`;
  const password = "password123";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Auth Role Customer");
  await page.getByTestId("customer-register-email").fill(email);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();

  await expect(page.getByTestId("toast-success").filter({ hasText: "Đăng ký thành công. Vui lòng đăng nhập." })).toBeVisible();
  await page.waitForURL("**/customer/login?registered=1");
  await expect(page.getByText("Tài khoản đã được tạo. Vui lòng đăng nhập.")).toBeVisible();
  await expect(page.getByText("Unauthorized")).toHaveCount(0);
  await expect(page.getByText("Phiên đăng nhập đã hết hạn")).toHaveCount(0);

  await page.getByTestId("customer-login-email").fill(email);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");
  await expect(page.getByTestId("public-customer-link")).toContainText("Auth Role Customer");
});

test("customer registration supports phone/password and customer login by phone works", async ({ page, context }) => {
  const stamp = Date.now();
  const phone = `+7999${String(stamp).slice(-7)}`;
  const password = "password123";

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Phone Customer");
  await page.getByTestId("customer-register-phone").fill(phone);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await expect(page.getByTestId("toast-success").filter({ hasText: "Đăng ký thành công. Vui lòng đăng nhập." })).toBeVisible();
  await page.waitForURL("**/customer/login?registered=1");

  await context.clearCookies();
  await page.goto("/customer/login");
  await page.getByTestId("customer-login-email").fill(phone);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");
});

test("seller registration and login stay separate from admin flow", async ({ page, context }) => {
  const stamp = Date.now();
  const email = `auth-role-seller-${stamp}@example.com`;
  const password = "password123";

  await page.goto("/seller/register");
  await page.getByTestId("seller-register-name").fill("Auth Role Seller");
  await page.getByTestId("seller-register-email").fill(email);
  await page.getByTestId("seller-register-password").fill(password);
  await page.getByTestId("seller-register-confirm-password").fill(password);
  await page.getByTestId("seller-register-submit").click();
  await expect(page.getByTestId("toast-success").filter({ hasText: "Đăng ký thành công. Vui lòng đăng nhập." })).toBeVisible();
  await page.waitForURL("**/seller/login?registered=1");
  await expect(page.getByText("Tài khoản đã được tạo. Vui lòng đăng nhập.")).toBeVisible();
  await expect(page.getByText("Unauthorized")).toHaveCount(0);
  await expect(page.getByText("Phiên đăng nhập đã hết hạn")).toHaveCount(0);

  await context.clearCookies();
  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(email);
  await page.getByTestId("seller-login-password").fill(password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/onboarding");
});

test("customer auto refresh keeps the session active", async ({ page, context }) => {
  await login(page, "/customer/login", "customer-login", "demo-customer@trawberry.local", "DemoCustomer123!");
  await page.waitForURL("**/customer/orders");

  await overwriteCookie(context, "customer_access_token", "invalid-customer-access-token");
  await page.goto("/customer/account/profile");

  await expect(page.getByTestId("customer-profile-name")).toBeVisible();
  await expect(page.getByTestId("toast-error").filter({ hasText: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." })).toHaveCount(0);
});

test("seller auto refresh keeps the session active", async ({ page, context }) => {
  await login(page, "/seller/login", "seller-login", "demo-seller@trawberry.local", "DemoSeller123!");
  await page.waitForURL(/\/seller\/(dashboard|onboarding|pending)/);

  await overwriteCookie(context, "seller_access_token", "invalid-seller-access-token");
  await page.goto("/seller/dashboard");

  await expect(page.getByTestId("seller-shell")).toBeVisible();
  await expect(page.getByTestId("toast-error").filter({ hasText: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." })).toHaveCount(0);
});

test("admin auto refresh keeps the session active", async ({ page, context }) => {
  await login(page, "/admin-login", "admin-login", "demo-admin@trawberry.local", "DemoAdmin123!");
  await page.waitForURL("**/admin/dashboard");

  await overwriteCookie(context, "admin_access_token", "invalid-admin-access-token");
  await page.goto("/admin/dashboard");

  await expect(page.getByTestId("admin-shell")).toBeVisible();
  await expect(page.getByTestId("toast-error").filter({ hasText: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." })).toHaveCount(0);
});

test("refresh failure redirects to login and shows session expired toast", async ({ page, context }) => {
  await login(page, "/customer/login", "customer-login", "demo-customer@trawberry.local", "DemoCustomer123!");
  await page.waitForURL("**/customer/orders");

  await overwriteCookie(context, "customer_access_token", "invalid-customer-access-token");
  await overwriteCookie(context, "customer_refresh_token", "invalid-customer-refresh-token");

  await page.goto("/customer/account/profile");

  await page.waitForURL(/\/customer\/login\?next=/);
  await expect(page.getByTestId("toast-error").filter({ hasText: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." })).toBeVisible();
});

test("admin login route works, has no register link, and customer or seller cannot access admin dashboard", async ({ browser, page }) => {
  await page.goto("/admin-login");
  await expect(page.getByRole("link", { name: /register/i })).toHaveCount(0);
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const customerStamp = Date.now() + 1;
  const customerEmail = `auth-role-guard-${customerStamp}@example.com`;
  const customerPassword = "password123";
  await customerPage.goto("/customer/register");
  await customerPage.getByTestId("customer-register-name").fill("Guard Customer");
  await customerPage.getByTestId("customer-register-email").fill(customerEmail);
  await customerPage.getByTestId("customer-register-password").fill(customerPassword);
  await customerPage.getByTestId("customer-register-confirm-password").fill(customerPassword);
  await customerPage.getByTestId("customer-register-submit").click();
  await customerPage.waitForURL("**/customer/login?registered=1");
  await customerPage.getByTestId("customer-login-email").fill(customerEmail);
  await customerPage.getByTestId("customer-login-password").fill(customerPassword);
  await customerPage.getByTestId("customer-login-submit").click();
  await customerPage.waitForURL("**/customer/orders");
  await customerPage.goto("/admin/dashboard");
  await customerPage.waitForURL(/\/admin-login\?next=/);

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  const sellerStamp = Date.now() + 2;
  const sellerEmail = `auth-role-guard-seller-${sellerStamp}@example.com`;
  const sellerPassword = "password123";
  await sellerPage.goto("/seller/register");
  await sellerPage.getByTestId("seller-register-name").fill("Guard Seller");
  await sellerPage.getByTestId("seller-register-email").fill(sellerEmail);
  await sellerPage.getByTestId("seller-register-password").fill(sellerPassword);
  await sellerPage.getByTestId("seller-register-confirm-password").fill(sellerPassword);
  await sellerPage.getByTestId("seller-register-submit").click();
  await sellerPage.waitForURL("**/seller/login?registered=1");
  await sellerPage.getByTestId("seller-login-email").fill(sellerEmail);
  await sellerPage.getByTestId("seller-login-password").fill(sellerPassword);
  await sellerPage.getByTestId("seller-login-submit").click();
  await sellerPage.waitForURL("**/seller/onboarding");
  await sellerPage.goto("/admin/dashboard");
  await sellerPage.waitForURL(/\/admin-login\?next=/);
});
