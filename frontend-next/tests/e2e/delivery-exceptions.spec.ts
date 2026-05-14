import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT"; token?: string; data?: unknown; multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } = {},
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
    data: { email, password, fullName: "Delivery Exception Seller", role: "SELLER" },
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
      legalName: "Delivery Exception Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Delivery Exception Seller",
      contactPhone: "+79990000008",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "delivery-exception.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
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

async function createPaidOrder(request: APIRequestContext, sellerToken: string, stamp: number, phone: string) {
  const shop = await backendJson<{ id: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Delivery Exception Shop ${stamp}`, slug: `delivery-exception-shop-${stamp}`, paymentInstructions: "Manual transfer." },
  });
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerToken,
    data: {
      wbNmId: 7400000 + (stamp % 100000),
      wbTitle: `Delivery Exception Product ${stamp}`,
      localTitle: `Delivery Exception Product ${stamp}`,
      localDescription: "Delivery exception E2E product",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8400000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/delivery-exception.jpg", localUrl: "https://example.com/delivery-exception.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  const checkout = await backendJson<{ orderId: string; orderCode: string; trackingPath: string }>(request, "/api/checkout/orders", {
    method: "POST",
    data: {
      shopId: shop.id,
      items: [{ productId: product.id, quantity: 1 }],
      customer: {
        fullName: "Delivery Exception Customer",
        phone,
        email: `delivery-exception-customer-${stamp}@example.com`,
        address: "Lenina 10, Moscow",
        note: `Delivery exception E2E ${stamp}`,
      },
      paymentMethod: "MANUAL_TRANSFER",
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/payments/${checkout.orderId}/mark-paid`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Paid for delivery exception E2E." },
  });
  return { shop, checkout };
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/seller/dashboard");
}

test("seller and admin handle delivery exception without leaking internal notes", async ({ page, request }) => {
  test.setTimeout(150000);
  const stamp = Date.now();
  const email = `delivery-exception-${stamp}@example.com`;
  const password = "password123";
  const phone = `+7994${String(stamp).slice(-7)}`;
  const sellerToken = await createApprovedSeller(request, email, password);
  const { checkout } = await createPaidOrder(request, sellerToken, stamp, phone);

  await login(page, email, password);
  await page.goto(`/seller/orders/${checkout.orderId}`);
  await page.getByTestId("manual-delivery-provider").selectOption("YANDEX");
  await page.getByTestId("manual-delivery-tracking-number").fill(`YANDEX-EXC-${stamp}`);
  await page.getByTestId("manual-delivery-tracking-url").fill(`https://track.example/yandex-exc/${stamp}`);
  await page.getByTestId("manual-delivery-save").click();
  await expect(page.getByTestId("delivery-action-message")).toHaveText("Manual delivery saved.");
  await page.getByTestId("manual-delivery-mark-in-transit").click();
  await page.getByTestId("delivery-exception-reason").selectOption("CUSTOMER_UNAVAILABLE");
  await page.getByTestId("delivery-exception-customer-message").fill("Courier could not reach you.");
  await page.getByTestId("delivery-exception-note").fill("Customer did not answer courier calls.");
  await page.getByTestId("delivery-report-problem").click();
  await expect(page.getByTestId("seller-delivery-status")).toHaveText("FAILED");

  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-status")).toHaveText("FAILED");
  await expect(page.getByTestId("tracked-delivery-message")).toContainText("Courier could not reach you.");

  await login(page, "demo-admin@trawberry.local", "DemoAdmin123!");
  await page.goto("/admin/deliveries");
  await page.getByTestId("admin-delivery-filter-EXCEPTIONS").click();
  await expect(page.getByTestId("admin-delivery-row").first()).toBeVisible();
  const exceptionRow = page.getByTestId("admin-delivery-row").filter({ hasText: checkout.orderCode });
  await expect(exceptionRow).toBeVisible();
  await exceptionRow.click();
  await page.getByTestId("admin-delivery-internal-comment").fill("Internal admin note hidden from customer.");
  await page.getByTestId("admin-delivery-add-comment").click();
  await expect(page.getByTestId("admin-delivery-message")).toHaveText("Internal admin comment added.");
  await page.getByTestId("admin-delivery-customer-message").fill("Admin updated delivery message.");
  await page.getByTestId("admin-delivery-update-customer-message").click();
  await expect(page.getByTestId("admin-delivery-message")).toHaveText("Customer message updated.");

  await page.goto(`${checkout.trackingPath}?phone=${encodeURIComponent(phone)}`);
  await expect(page.getByTestId("tracked-delivery-message")).toContainText("Admin updated delivery message.");
  await expect(page.getByTestId("tracked-order-page")).not.toContainText("Internal admin note hidden from customer.");
});
