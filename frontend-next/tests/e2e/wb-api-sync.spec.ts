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

test("seller syncs selected products by numeric WB nmID without sync-all fallback", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `wb-api-sync-${stamp}@example.com`;
  const password = "password123";
  const sellerToken = await createApprovedSeller(request, email, password);
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: {
      name: `WB API Sync Shop ${stamp}`,
      slug: `wb-api-sync-shop-${stamp}`,
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
    lastVerifiedAt: new Date().toISOString(),
    lastVerificationStatus: "SUCCESS",
    lastVerificationError: null,
    canAttemptRealVerify: true,
    missingConfig: [],
  };
  let selectedRequests = 0;
  let syncAllRequests = 0;
  let selectedPayload: { codes?: string } | null = null;
  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/wb-sync/credentials/status`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(statusPayload) });
  });
  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/wb-sync/products/by-codes`, async (route) => {
    selectedRequests += 1;
    selectedPayload = route.request().postDataJSON() as { codes?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestedCodes: ["1013414108", "123456789"],
        requestedCount: 2,
        normalizedNmIds: ["1013414108", "123456789"],
        matchedNmIds: ["1013414108"],
        syncedCount: 1,
        syncedCodes: ["1013414108"],
        notFound: ["123456789"],
        invalid: [],
        skipped: [],
        errors: [],
        run: {
          syncRunId: "selected-nmid-run",
          status: "COMPLETED",
          mode: "PREVIEW",
          syncType: "BY_CODES",
          article: null,
          sourceMode: "real",
          totalFetched: 1,
          totalProducts: 1,
          totalVariants: 0,
          totalImages: 0,
          createdProducts: 0,
          updatedProducts: 0,
          warnings: [],
          errors: [],
          rawSummary: {
            selectionStrategy: "WB_CARDS_LIST_LOCAL_EXACT_NMID_FILTER",
            normalizedNmIds: ["1013414108", "123456789"],
          },
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      }),
    });
  });
  await page.route(`${backendBaseUrl}/api/shops/${shop.id}/wb-sync/products`, async (route) => {
    syncAllRequests += 1;
    await route.abort();
  });

  await login(page, email, password);
  await page.goto("/seller/import/wildberries-api");
  await expect(page.getByTestId("wb-api-sync-page")).toBeVisible();
  await expect(page.getByTestId("wb-api-codes-identity")).toContainText(/Артикул WB.*nmID/);
  await expect(page.getByTestId("wb-api-import-all")).toBeVisible();

  await page.getByTestId("wb-api-codes").fill("1013414108,123456789");
  await page.getByTestId("wb-api-preview-selected").click();
  await expect(page.getByTestId("wb-api-selected-summary")).toBeVisible();
  await expect(page.getByTestId("wb-api-selected-not-found")).toContainText("123456789");
  expect(selectedPayload).toEqual({ codes: "1013414108,123456789", mode: "PREVIEW", publishMode: "DRAFT", imageMode: "REMOTE_URL" });
  expect(selectedRequests).toBe(1);
  expect(syncAllRequests).toBe(0);

  await page.getByTestId("wb-api-codes").fill("");
  await page.getByTestId("wb-api-preview-selected").click();
  await expect(page.getByTestId("wb-api-error")).toBeVisible();
  expect(selectedRequests).toBe(1);
  expect(syncAllRequests).toBe(0);

  await page.getByTestId("wb-api-codes").fill("234-xanh");
  await page.getByTestId("wb-api-preview-selected").click();
  await expect(page.getByTestId("wb-api-error")).toContainText("nmID");
  expect(selectedRequests).toBe(1);
  expect(syncAllRequests).toBe(0);
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
