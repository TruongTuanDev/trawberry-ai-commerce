import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH"; token?: string; data?: unknown } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
  });
  if (!response.ok()) {
    expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  }
  return (await response.json()) as T;
}

async function login(page: Page, email: string, password: string, next = "/seller/dashboard") {
  await page.goto("/");
  const user = await page.evaluate(
    async ({ apiUrl, loginEmail, loginPassword }) => {
      const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!loginResponse.ok) {
        throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
      }
      const meResponse = await fetch(`${apiUrl}/api/auth/me`, {
        method: "GET",
        credentials: "include",
      });
      if (!meResponse.ok) {
        throw new Error(`Session check failed: ${meResponse.status} ${await meResponse.text()}`);
      }
      return (await meResponse.json()) as unknown;
    },
    { apiUrl: backendBaseUrl, loginEmail: email, loginPassword: password },
  );
  await page.evaluate((currentUser) => {
    window.localStorage.setItem("strawberry-next-auth", JSON.stringify({ user: currentUser }));
  }, user);
  await page.goto(next);
}

async function createDashboardData(request: APIRequestContext) {
  const stamp = Date.now();
  const password = "password123";
  const sellerEmail = `admin-dashboard-${stamp}@example.com`;
  const pendingEmail = `admin-dashboard-pending-${stamp}@example.com`;
  const adminLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" },
  });
  const pendingSeller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email: pendingEmail, password, fullName: "Dashboard Pending Seller", role: "SELLER" },
  });
  expect(pendingSeller.userId).toBeTruthy();

  const seller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email: sellerEmail, password, fullName: "Dashboard Seller", role: "SELLER" },
  });
  const initialSellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: sellerEmail, password },
  });
  await backendJson(request, "/api/seller/onboarding/profile", {
    method: "PUT",
    token: initialSellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Dashboard Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Dashboard Seller",
      contactPhone: "+79990000009",
      contactEmail: sellerEmail,
    },
  });
  const documentResponse = await request.post(`${backendBaseUrl}/api/seller/onboarding/documents`, {
    headers: { Authorization: `Bearer ${initialSellerLogin.accessToken}` },
    multipart: {
      documentType: "INN",
      file: { name: "admin-dashboard.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
  });
  expect(documentResponse.ok(), `POST /api/seller/onboarding/documents -> ${documentResponse.status()} ${await documentResponse.text()}`).toBeTruthy();
  const document = (await documentResponse.json()) as { id: string };
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
  const sellerLogin = await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email: sellerEmail, password },
  });
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { name: `Dashboard Shop ${stamp}`, slug: `dashboard-shop-${stamp}`, paymentInstructions: "Manual transfer." },
  });
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      wbNmId: 7600000 + (stamp % 100000),
      wbTitle: `Dashboard Product ${stamp}`,
      localTitle: `Dashboard Product ${stamp}`,
      visibility: "ACTIVE",
      variants: [{ chrtId: 8600000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5, lowStockThreshold: 10 }],
      images: [{ wbUrl: "https://example.com/dashboard.jpg", localUrl: "https://example.com/dashboard.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  const checkout = await backendJson<{ orderId: string; orderCode: string; trackingPath: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Dashboard Customer",
        phone: `+7993${String(stamp).slice(-7)}`,
        email: `dashboard-customer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
      },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { note: "Paid for dashboard E2E." },
  });
  const shipment = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/manual`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { provider: "YANDEX", trackingNumber: `DASH-${stamp}`, trackingUrl: `https://track.example/dashboard/${stamp}` },
  });
  await backendJson(request, `/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/shipments/${shipment.id}/mark-failed`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { reasonCode: "CUSTOMER_UNAVAILABLE", customerVisibleMessage: "Courier could not reach you." },
  });

  return { sellerEmail, password };
}

test("admin operations dashboard renders cards and links", async ({ page, request }) => {
  test.setTimeout(120000);
  await createDashboardData(request);

  await login(page, "demo-admin@trawberry.local", "DemoAdmin123!", "/admin/dashboard");
  await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
  await expect(page.getByTestId("admin-dashboard-card-orders-value")).toContainText(/\d+/);
  await expect(page.getByTestId("admin-dashboard-card-payments-value")).toContainText(/\d+/);
  await expect(page.getByTestId("admin-dashboard-card-deliveries-value")).toContainText(/\d+/);
  await expect(page.getByTestId("admin-dashboard-card-inventory-value")).toContainText(/\d+/);
  await expect(page.getByTestId("admin-dashboard-card-sellers-value")).toContainText(/\d+/);
  await expect(page.getByTestId("admin-dashboard-card-exceptions-value")).toContainText(/\d+/);

  await page.getByTestId("admin-dashboard-card-exceptions").click();
  await page.waitForURL("**/admin/queues?tab=deliveries&status=EXCEPTION");
  await expect(page.getByTestId("admin-queues-page")).toBeVisible();
});

test("non-admin cannot view admin operations dashboard", async ({ page, request }) => {
  test.setTimeout(120000);
  const seller = await createDashboardData(request);
  await login(page, seller.sellerEmail, seller.password);
  await page.goto("/admin/dashboard");
  await page.waitForURL("**/seller/dashboard");
});
