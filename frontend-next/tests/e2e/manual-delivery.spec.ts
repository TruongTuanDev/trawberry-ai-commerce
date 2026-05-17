import { expect, test, type APIRequestContext } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH"; token?: string; data?: unknown; multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } = {},
) {
  const response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
    multipart: options.multipart,
  });
  if (!response.ok()) {
    expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  }
  return (await response.json()) as T;
}

async function createApprovedSeller(request: APIRequestContext, email: string, password: string) {
  const seller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "Manual Delivery Seller", role: "SELLER" },
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
      legalName: "Manual Delivery Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Manual Delivery Seller",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "manual-delivery.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
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
  return (await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
    method: "POST",
    data: { email, password },
  })).accessToken;
}

async function createPaidOrder(request: APIRequestContext, sellerToken: string, stamp: number, phone: string) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Manual Delivery Shop ${stamp}`, slug: `manual-delivery-shop-${stamp}`, paymentInstructions: "Manual transfer." },
  });
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerToken,
    data: {
      wbNmId: 7300000 + (stamp % 100000),
      wbTitle: `Manual Delivery Product ${stamp}`,
      localTitle: `Manual Delivery Product ${stamp}`,
      localDescription: "Manual delivery E2E product",
      categoryName: "Manual Delivery Category",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8300000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/manual-delivery.jpg", localUrl: "https://example.com/manual-delivery.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerToken,
    data: {},
  });
  const checkout = await backendJson<{ orderId: string; orderCode: string; trackingPath: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Manual Delivery Customer",
        phone,
        email: `manual-delivery-customer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
        note: `Manual delivery E2E ${stamp}`,
      },
      paymentMethod: "MANUAL_TRANSFER",
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Paid for manual delivery E2E." },
  });
  return { shop, checkout };
}

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

test("seller enters manual Yandex delivery and customer sees updates", async ({ page, request }) => {
  test.setTimeout(120000);
  const stamp = Date.now();
  const email = `manual-delivery-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7995${String(stamp).slice(-7)}`;
  const sellerToken = await createApprovedSeller(request, email, password);
  const { shop, checkout } = await createPaidOrder(request, sellerToken, stamp, phone);

  await login(page, email, password);
  await page.goto(`/seller/orders/${checkout.orderId}`);
  await expect(page.getByTestId("seller-order-delivery-section")).toBeVisible();
  await page.getByTestId("manual-delivery-provider").selectOption("YANDEX");
  await page.getByTestId("manual-delivery-tracking-number").fill(`YANDEX-E2E-${stamp}`);
  await page.getByTestId("manual-delivery-tracking-url").fill(`https://track.example/yandex/${stamp}`);
  await page.getByTestId("manual-delivery-courier-phone").fill("+79991112233");
  await page.getByTestId("manual-delivery-note").fill("Seller created shipment in Yandex dashboard.");
  await page.getByTestId("manual-delivery-save").click();
  await expect(page.getByTestId("delivery-action-message")).toHaveText("Manual delivery saved.");
  await page.getByTestId("manual-delivery-mark-in-transit").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("IN_TRANSIT");

  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-provider")).toHaveText("YANDEX");
  await expect(page.getByTestId("tracked-delivery-status")).toHaveText("IN_TRANSIT");
  await expect(page.getByTestId("tracked-delivery-note")).toContainText("Yandex dashboard");

  await page.goto(`/seller/orders/${checkout.orderId}`);
  await page.getByTestId("manual-delivery-mark-delivered").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("DELIVERED");
  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-status")).toHaveText("DELIVERED");

  expect(shop.id).toBeTruthy();
});
