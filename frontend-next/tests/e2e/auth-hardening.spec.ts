import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001";

async function registerSellerWithCompletedOnboarding(
  request: APIRequestContext,
  stamp: number,
) {
  const phone = `+7999${String(stamp).slice(-7)}`;
  const password = "password123";

  const registerResponse = await request.post(`${backendBaseUrl}/api/auth/seller/register`, {
    data: {
      phone,
      password,
      fullName: "Pending Seller",
    },
  });
  expect(registerResponse.ok()).toBeTruthy();

  const loginResponse = await request.post(`${backendBaseUrl}/api/auth/seller/login`, {
    data: {
      identifier: phone,
      password,
    },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = (await loginResponse.json()) as { accessToken: string };

  const profileResponse = await request.put(`${backendBaseUrl}/api/seller/onboarding/profile`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "Pending Seller LLC",
      inn: "123456789012",
      legalAddress: "1 Market Street",
      contactName: "Pending Seller",
      contactPhone: phone,
      contactEmail: `pending-${stamp}@example.com`,
      bankName: "Test Bank",
      bankAccount: "1234567890",
      bik: "044525225",
    },
  });
  expect(profileResponse.ok()).toBeTruthy();

  const documentResponse = await request.post(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    multipart: {
      documentType: "INN",
      file: {
        name: "inn.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% auth hardening e2e\n"),
      },
    },
  });
  expect(documentResponse.ok()).toBeTruthy();

  return { phone, password };
}

test("auth hardening keeps admin hidden and supports normalized phone login", async ({ page, context }) => {
  const stamp = Date.now();
  const phoneDigits = String(stamp).slice(-7);
  const registerPhone = `8 (999) ${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 5)}-${phoneDigits.slice(5, 7)}`;
  const loginPhone = `+7 999 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 5)} ${phoneDigits.slice(5, 7)}`;
  const password = "password123";

  await page.goto("/products");
  await expect(page.getByRole("link", { name: /Admin login/i })).toHaveCount(0);

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Normalized Customer");
  await page.getByTestId("customer-register-phone").fill(registerPhone);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/orders");

  await context.clearCookies();
  await page.goto("/customer/login");
  await page.getByTestId("customer-login-email").fill(loginPhone);
  await page.getByTestId("customer-login-password").fill(password);
  await page.getByTestId("customer-login-submit").click();
  await page.waitForURL("**/customer/orders");

  await context.clearCookies();
  await page.goto("/customer/register");
  await page.getByTestId("customer-register-phone").fill(`8 999 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 5)} ${phoneDigits.slice(5, 7)}`);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await expect(page.locator("text=Phone is already registered.")).toBeVisible();
});

test("seller pending UX and admin guard remain intact", async ({ browser, page, request }) => {
  const stamp = Date.now() + 10;
  const pendingSeller = await registerSellerWithCompletedOnboarding(request, stamp);

  await page.goto("/seller/login");
  await page.getByTestId("seller-login-email").fill(pendingSeller.phone.replace("+7", "8"));
  await page.getByTestId("seller-login-password").fill(pendingSeller.password);
  await page.getByTestId("seller-login-submit").click();
  await page.waitForURL("**/seller/pending");
  await expect(page.getByTestId("seller-pending-page")).toBeVisible();
  await expect(page.getByTestId("seller-pending-status")).toContainText("PENDING");

  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const customerStamp = Date.now() + 11;
  const customerEmail = `hardening-guard-${customerStamp}@example.com`;
  const customerPassword = "password123";
  await customerPage.goto("/customer/register");
  await customerPage.getByTestId("customer-register-email").fill(customerEmail);
  await customerPage.getByTestId("customer-register-password").fill(customerPassword);
  await customerPage.getByTestId("customer-register-confirm-password").fill(customerPassword);
  await customerPage.getByTestId("customer-register-submit").click();
  await customerPage.waitForURL("**/customer/orders");
  await customerPage.goto("/admin/dashboard");
  await customerPage.waitForURL("**/customer/orders");
  await customerContext.close();

  await page.context().clearCookies();
  await page.goto("/admin-login");
  await expect(page.getByRole("link", { name: /register/i })).toHaveCount(0);
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
});
