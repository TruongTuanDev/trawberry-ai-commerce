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
  await expect(page.getByTestId("wb-api-mode-badge")).toContainText("MOCK");
  await expect(page.getByTestId("wb-api-mode-message")).toBeVisible();

  await page.getByTestId("wb-api-key").fill("mock-api-key-1234");
  await page.getByTestId("wb-api-save-credentials").click();
  await expect(page.getByTestId("wb-api-credentials-status")).toContainText("1234");
  await expect(page.getByTestId("wb-api-save-credentials")).toBeDisabled();
  await expect(page.getByTestId("wb-api-verify-credentials")).toBeDisabled();

  await page.getByTestId("wb-api-key").fill("mock-api-key-5678");
  await expect(page.getByTestId("wb-api-save-credentials")).toBeEnabled();
  await page.getByTestId("wb-api-save-credentials").click();
  await expect(page.getByTestId("wb-api-credentials-status")).toContainText("5678");

  await page.getByTestId("wb-api-delete-credentials").click();
  await expect(page.getByTestId("wb-api-credentials-status")).not.toContainText("5678");
  await expect(page.getByTestId("wb-api-save-credentials")).toBeDisabled();

  await page.getByTestId("wb-api-preview-all").click();
  await expect(page.getByTestId("wb-api-result")).toBeVisible();
  await expect(page.getByTestId("wb-api-product-row").first()).toContainText("APT-MOCK");

  await page.getByTestId("wb-api-import-all").click();
  await expect(page.getByTestId("wb-api-result")).toBeVisible();

  await page.getByTestId("wb-api-codes").fill("APT-MOCK-HOODIE,APT-MISSING");
  await page.getByTestId("wb-api-import-selected").click();
  await expect(page.getByTestId("wb-api-result")).toBeVisible();
  await expect(page.getByTestId("wb-api-selected-summary")).toBeVisible();
  await expect(page.getByTestId("wb-api-selected-not-found")).toContainText("APT-MISSING");

  await page.getByTestId("wb-api-codes").fill("");
  await page.getByTestId("wb-api-import-selected").click();
  await expect(page.getByTestId("wb-api-error")).toBeVisible();

  await page.goto("/seller/products");
  await expect(page.locator("article").filter({ hasText: "Mock WB Hoodie" })).toBeVisible();
});

test("seller sees safe verify failure returned by backend", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `wb-api-sync-failure-${stamp}@example.com`;
  const password = "password123";
  const sellerToken = await createApprovedSeller(request, email, password);
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: {
      name: `WB API Sync Failure Shop ${stamp}`,
      slug: `wb-api-sync-failure-shop-${stamp}`,
      paymentInstructions: "Manual transfer.",
    },
  });

  const statusPayload = {
    shopId: shop.id,
    connected: true,
    hasCredentials: true,
    keyLast4: "1234",
    updatedAt: new Date().toISOString(),
    mode: "real",
    lastVerifiedAt: null,
    lastVerificationStatus: "FAILED",
    lastVerificationError: "WB_UNAUTHORIZED_401: Wildberries API rejected the token.",
    canAttemptRealVerify: true,
    missingConfig: [],
  };

  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/wb-sync/credentials/status`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(statusPayload),
    });
  });
  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/wb-sync/credentials/verify`, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "WB_UNAUTHORIZED_401: Wildberries API rejected the token." }),
    });
  });

  await login(page, email, password);
  await page.goto("/seller/import/wildberries-api");
  await page.getByTestId("wb-api-verify-credentials").click();

  await expect(page.locator("div").filter({ hasText: "WB_UNAUTHORIZED_401: Wildberries API rejected the token." }).last()).toBeVisible();
  await expect(page.getByTestId("wb-api-credentials-status")).toContainText("FAILED");
});
