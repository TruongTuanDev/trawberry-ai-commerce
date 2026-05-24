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

async function approveSeller(request: APIRequestContext, email: string) {
  const password = "password123";
  const register = await backendJson<{ userId: string }>(
    request,
    "/api/auth/register",
    {
      method: "POST",
      data: {
        email,
        password,
        fullName: "I18N Seller",
        role: "SELLER",
      },
    },
  );
  const sellerLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: { email, password },
    },
  );
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${sellerLogin.accessToken}` },
    data: {
      legalType: "IP",
      legalName: "I18N Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow, I18N Street 1",
      contactName: "I18N Seller",
      contactPhone: "+79990000077",
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
          name: "seller-inn.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% i18n seller e2e\n"),
        },
      },
    },
  );
  const adminLogin = await backendJson<{ accessToken: string }>(
    request,
    "/api/auth/login",
    {
      method: "POST",
      data: {
        email: "demo-admin@trawberry.local",
        password: "DemoAdmin123!",
      },
    },
  );
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

  return { email, password };
}

async function newCleanPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: frontendBaseUrl,
  });
  await context.clearCookies();
  return context.newPage();
}

test("role-based locale defaults and switching persist by surface", async ({
  browser,
  request,
}) => {
  const stamp = Date.now();
  const seller = await approveSeller(request, `i18n-seller-${stamp}@example.com`);

  const publicPage = await newCleanPage(browser);
  const publicNav = publicPage.getByRole("navigation", {
    name: "Public navigation",
  }).first();
  const publicEnglishOption = publicPage
    .getByTestId("language-option-customer-en")
    .first();

  await publicPage.goto("/products");
  await expect(publicNav).toContainText("Каталог");
  await publicEnglishOption.click();
  await expect(publicNav).toContainText("Shop");
  await publicPage.reload();
  await expect(publicNav).toContainText("Shop");
  await publicPage.context().close();

  const sellerPage = await newCleanPage(browser);
  const sellerNewTab = sellerPage.getByTestId("seller-order-tab-NEW").first();
  const sellerVietnameseOption = sellerPage
    .getByTestId("language-option-seller-vi")
    .first();
  const sellerEnglishOption = sellerPage
    .getByTestId("language-option-seller-en")
    .first();

  await sellerPage.goto("/seller/login");
  await sellerPage.getByTestId("seller-login-email").fill(seller.email);
  await sellerPage.getByTestId("seller-login-password").fill(seller.password);
  await sellerPage.getByTestId("seller-login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto("/seller/orders");
  await expect(sellerNewTab).toContainText("Новые");
  await sellerVietnameseOption.click();
  await expect(sellerNewTab).toContainText("Mới");
  await sellerEnglishOption.click();
  await expect(sellerNewTab).toContainText("New");
  await sellerPage.reload();
  await expect(sellerNewTab).toContainText("New");
  await sellerPage.context().close();

  const adminPage = await newCleanPage(browser);

  await adminPage.goto("/admin-login");
  await adminPage.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await adminPage.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await adminPage.getByTestId("admin-login-submit").click();
  await adminPage.waitForURL("**/admin/dashboard");
  await expect(
    adminPage.getByRole("heading", { name: "Marketplace Ops" }),
  ).toBeVisible();
  await expect(adminPage.getByTestId("language-switcher-admin")).toHaveCount(0);
  await adminPage.context().close();
});
