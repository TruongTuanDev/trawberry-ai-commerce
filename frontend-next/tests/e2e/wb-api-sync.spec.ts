import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; token?: string; data?: unknown; multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
    multipart: options.multipart,
  });
  expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

async function createApprovedSeller(request: APIRequestContext, email: string, password: string) {
  const seller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "WB API Sync Seller", role: "SELLER" },
  });
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  });
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "WB API Sync Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "WB API Sync Seller",
      contactPhone: "+79990000018",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "wb-api-sync.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
  });
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });
  await backendJson(request, `/api/admin/sellers/${seller.userId}/documents/${document.id}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });
  await backendJson(request, `/api/admin/sellers/${seller.userId}/approve`, {
    method: "POST",
    token: adminLogin.accessToken,
    data: {},
  });
  return sellerLogin.accessToken;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

test("seller previews and imports Wildberries API products in mock mode", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `wb-api-sync-${stamp}@example.com`;
  const password = "password123";
  const sellerToken = await createApprovedSeller(request, email, password);
  await backendJson(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: {
      name: `WB API Sync Shop ${stamp}`,
      slug: `wb-api-sync-shop-${stamp}`,
      paymentInstructions: "Manual transfer.",
    },
  });

  await login(page, email, password);
  await page.goto("/seller/import/wildberries-api");
  await expect(page.getByTestId("wb-api-sync-page")).toBeVisible();
  await expect(page.getByTestId("wb-api-credentials-status")).toContainText(/mock|connected|not connected/i);

  await page.getByTestId("wb-api-preview-all").click();
  await expect(page.getByTestId("wb-api-result")).toContainText("Products");
  await expect(page.getByTestId("wb-api-product-row").first()).toContainText("APT-MOCK");

  await page.getByTestId("wb-api-import-all").click();
  await expect(page.getByTestId("wb-api-result")).toContainText("Created");

  await page.getByTestId("wb-api-article").fill("APT-MOCK-HOODIE");
  await page.getByTestId("wb-api-import-article").click();
  await expect(page.getByTestId("wb-api-result")).toContainText("Updated");

  await page.goto("/seller/products");
  await expect(page.locator("article").filter({ hasText: "Mock WB Hoodie" })).toBeVisible();
});
