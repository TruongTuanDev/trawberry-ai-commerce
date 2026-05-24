import { expect, test } from "@playwright/test";

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
