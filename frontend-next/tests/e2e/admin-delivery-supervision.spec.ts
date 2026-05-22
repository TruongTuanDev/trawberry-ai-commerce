import { expect, test } from "@playwright/test";

test("admin supervises paid orders without delivery and overrides status", async ({ page, request }) => {
  test.setTimeout(120000);
  const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";
  const stamp = Date.now();
  const email = `admin-delivery-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7994${String(stamp).slice(-7)}`;

  async function backendJson<T>(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH"; token?: string; data?: unknown; multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } = {}) {
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

  const seller = await backendJson<{ userId: string }>("/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "Admin Delivery Seller", role: "SELLER" },
  });
  let sellerLogin = await backendJson<{ accessToken: string }>("/api/auth/login", { method: "POST", data: { email, password } });
  await backendJson("/api/seller/onboarding/profile", {
    method: "PUT",
    token: sellerLogin.accessToken,
    data: {
      legalType: "IP",
      legalName: "Admin Delivery Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Admin Delivery Seller",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>("/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "admin-delivery.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
    },
  });
  const adminLogin = await backendJson<{ accessToken: string }>("/api/auth/login", { method: "POST", data: { email: "demo-admin@trawberry.local", password: "DemoAdmin123!" } });
  await backendJson(`/api/admin/sellers/${seller.userId}/documents/${document.id}/approve`, { method: "POST", token: adminLogin.accessToken, data: {} });
  await backendJson(`/api/admin/sellers/${seller.userId}/approve`, { method: "POST", token: adminLogin.accessToken, data: {} });
  sellerLogin = await backendJson<{ accessToken: string }>("/api/auth/login", { method: "POST", data: { email, password } });

  const shop = await backendJson<{ id: string }>("/api/shops", {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { name: `Admin Delivery Shop ${stamp}`, slug: `admin-delivery-shop-${stamp}`, paymentInstructions: "Manual transfer." },
  });
  const product = await backendJson<{ id: string }>(`/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: {
      wbNmId: 7400000 + (stamp % 100000),
      wbTitle: `Admin Delivery Product ${stamp}`,
      localTitle: `Admin Delivery Product ${stamp}`,
      localDescription: "Admin delivery E2E product",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8400000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/admin-delivery.jpg", localUrl: "https://example.com/admin-delivery.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  const checkout = await backendJson<{ orderId: string; orderCode: string; trackingPath: string }>("/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: { fullName: "Admin Delivery Customer", phone, email: `admin-delivery-customer-${stamp}@example.com`, address: "Lenina 10, Moscow" },
      paymentMethod: "PREPAID_SELLER_QR",
    },
  });
  await backendJson(`/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, { method: "POST", token: sellerLogin.accessToken, data: { note: "Paid." } });

  await page.goto("/login");
  await page.getByTestId("login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("login-password").fill("DemoAdmin123!");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
  await page.goto("/admin/deliveries");
  await expect(page.getByTestId("admin-deliveries-page")).toBeVisible();
  await page.getByTestId("admin-delivery-filter-PAID_WITHOUT_DELIVERY").click();
  await page.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode })).toBeVisible();

  const shipment = await backendJson<{ id: string }>(`/api/shops/${shop.id}/orders/${checkout.orderId}/delivery/manual`, {
    method: "POST",
    token: sellerLogin.accessToken,
    data: { provider: "YANDEX", trackingNumber: `ADMIN-E2E-${stamp}`, trackingUrl: `https://track.example/admin/${stamp}` },
  });

  await page.getByTestId("admin-delivery-filter-CREATED_MANUALLY").click();
  await page.getByTestId("admin-delivery-search").fill(checkout.orderCode);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode })).toBeVisible();
  await page.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode }).click();
  await page.getByTestId("admin-delivery-mark-in-transit").click();
  await expect(page.getByTestId("admin-delivery-message")).toHaveText("Delivery marked in transit.");

  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-status")).toHaveText("IN_TRANSIT");
  expect(shipment.id).toBeTruthy();
});
