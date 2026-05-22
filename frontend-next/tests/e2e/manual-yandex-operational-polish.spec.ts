import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? "http://127.0.0.1:3001";

async function backendJson<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH";
    token?: string;
    data?: unknown;
    multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
  } = {},
) {
  let response = await request.fetch(`${backendBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
    data: options.data,
    multipart: options.multipart,
  });
  for (let attempt = 0; response.status() === 429 && attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    response = await request.fetch(`${backendBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: options.token ? { Authorization: `Bearer ${options.token}`, Cookie: "" } : undefined,
      data: options.data,
      multipart: options.multipart,
    });
  }
  if (!response.ok()) {
    expect(response.ok(), `${options.method ?? "GET"} ${path} -> ${response.status()} ${await response.text()}`).toBeTruthy();
  }
  return (await response.json()) as T;
}

async function createApprovedSeller(request: APIRequestContext, email: string, password: string) {
  const seller = await backendJson<{ userId: string }>(request, "/api/auth/register", {
    method: "POST",
    data: { email, password, fullName: "Yandex Polish Seller", role: "SELLER" },
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
      legalName: "Yandex Polish Seller IP",
      inn: "123456789012",
      ogrn: "1234567890123",
      legalAddress: "Moscow",
      contactName: "Yandex Polish Seller",
      contactPhone: "+79990000018",
      contactEmail: email,
    },
  });
  const document = await backendJson<{ id: string }>(request, "/api/seller/onboarding/documents", {
    method: "POST",
    token: sellerLogin.accessToken,
    multipart: {
      documentType: "INN",
      file: { name: "yandex-polish.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
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
  return {
    sellerUserId: seller.userId,
    sellerToken: (await backendJson<{ accessToken: string }>(request, "/api/auth/login", {
      method: "POST",
      data: { email, password },
    })).accessToken,
  };
}

async function createShopProduct(request: APIRequestContext, sellerToken: string, stamp: number) {
  const shop = await backendJson<{ id: string; name: string }>(request, "/api/shops", {
    method: "POST",
    token: sellerToken,
    data: { name: `Yandex Polish Shop ${stamp}`, slug: `yandex-polish-shop-${stamp}`, paymentInstructions: "Pay seller directly." },
  });
  await backendJson(request, `/api/shops/${shop.id}/payment-settings`, {
    method: "PATCH",
    token: sellerToken,
    data: {
      paymentMode: "STATIC_QR",
      status: "READY",
      bankName: "T-Bank",
      recipientName: "Yandex Polish Seller",
      recipientPhone: "+79990000018",
      recipientAccount: "40817810000000000118",
      sbpPhone: "+79990000018",
      paymentInstruction: "Pay the seller directly by QR.",
      allowPrepaidQr: true,
      allowPayOnDeliverySellerQr: true,
      allowDepositPayment: false,
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/delivery/settings`, {
    method: "PATCH",
    token: sellerToken,
    data: {
      pickupAddress: "Tverskaya 1, Moscow",
      pickupCity: "Moscow",
      pickupPostalCode: "101000",
      pickupContactPhone: "+74950000000",
      pickupContactName: "Seller Ops",
      pickupLatitude: 55.7558,
      pickupLongitude: 37.6176,
      enabledCarriers: ["CDEK", "YANDEX"],
      defaultCarrier: "YANDEX",
      sameCityPreferredCarrier: "YANDEX",
      interCityPreferredCarrier: "CDEK",
      fallbackCarrier: "CDEK",
      defaultWeightGram: 1200,
      defaultLengthCm: 36,
      defaultWidthCm: 24,
      defaultHeightCm: 12,
    },
  });
  const product = await backendJson<{ id: string }>(request, `/api/shops/${shop.id}/products`, {
    method: "POST",
    token: sellerToken,
    data: {
      wbNmId: 7900000 + (stamp % 100000),
      wbTitle: `Yandex Polish Product ${stamp}`,
      localTitle: `Yandex Polish Product ${stamp}`,
      localDescription: "Manual Yandex polish product",
      categoryName: "Workbench Category",
      visibility: "ACTIVE",
      variants: [{ chrtId: 8900000 + (stamp % 100000), basePrice: 199, discountPrice: 199, stockQuantity: 5 }],
      images: [{ wbUrl: "https://example.com/yandex-polish.jpg", localUrl: "https://example.com/yandex-polish.jpg", isMain: true, sortOrder: 0 }],
    },
  });
  await backendJson(request, `/api/shops/${shop.id}/products/${product.id}/publish`, {
    method: "POST",
    token: sellerToken,
    data: {},
  });
  return { shop, product };
}

async function loginAdmin(browser: Browser) {
  const page = await browser.newPage();
  await page.goto("/admin-login");
  await page.getByTestId("admin-login-email").fill("demo-admin@trawberry.local");
  await page.getByTestId("admin-login-password").fill("DemoAdmin123!");
  await page.getByTestId("admin-login-submit").click();
  await page.waitForURL("**/admin/dashboard");
  return page;
}

test("manual yandex operational polish keeps customer, seller, and admin aligned", async ({ page, request, browser }) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const sellerEmail = `yandex-polish-seller-${stamp}@example.com`;
  const customerEmail = `yandex-polish-customer-${stamp}@example.com`;
  const password = "password123";
  const customerPhone = `+7996${String(stamp).slice(-7)}`;
  const { sellerToken } = await createApprovedSeller(request, sellerEmail, password);
  const { shop, product } = await createShopProduct(request, sellerToken, stamp);

  await page.goto("/customer/register");
  await page.getByTestId("customer-register-name").fill("Yandex Polish Customer");
  await page.getByTestId("customer-register-email").fill(customerEmail);
  await page.getByTestId("customer-register-password").fill(password);
  await page.getByTestId("customer-register-confirm-password").fill(password);
  await page.getByTestId("customer-register-submit").click();
  await page.waitForURL("**/customer/orders");

  await page.goto("/customer/account/addresses");
  await page.getByTestId("customer-address-fullName").fill("Yandex Polish Customer");
  await page.getByTestId("customer-address-phone").fill(customerPhone);
  await page.getByTestId("customer-address-city").fill("Moscow");
  await page.getByTestId("customer-address-street").fill("Tverskaya");
  await page.getByTestId("customer-address-building").fill("18");
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByText(/entranceDecision/i)).toBeVisible();

  await page.locator('[data-testid^="customer-address-edit-"]').first().click();
  await page.getByTestId("customer-address-no-entrance").check();
  await page.getByTestId("customer-address-no-floor").check();
  await page.getByTestId("customer-address-no-apartment").check();
  await page.getByTestId("customer-address-intercom").fill("45");
  await page.getByRole("button", { name: "Use manual coordinates" }).click();
  await page.getByTestId("customer-address-latitude").fill("55.765369");
  await page.getByTestId("customer-address-longitude").fill("37.605192");
  await page.getByRole("button", { name: "Mark as manual pin" }).click();
  await page.getByTestId("customer-address-save").click();
  await expect(page.getByTestId("customer-address-card")).toContainText("Yandex-ready");

  await page.goto(`/products/${product.id}`);
  await page.getByTestId("continue-to-checkout").click();
  await page.waitForURL(/\/checkout/);
  await expect(page.getByTestId("checkout-address-geo-status")).toContainText(/Yandex-ready|Manual-ready|Manual pin/i);
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-confirmation")).toBeVisible();
  const confirmationText = await page.getByTestId("checkout-confirmation").innerText();
  const orderId =
    confirmationText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0] ?? "";
  const trackingHref = await page.getByTestId("confirmation-track-link").getAttribute("href");
  expect(orderId).toBeTruthy();
  expect(trackingHref).toBeTruthy();

  const sellerOrders = await backendJson<{ items: Array<{ id: string; orderNumber: string }> }>(
    request,
    `/api/shops/${shop.id}/orders?page=1&size=10`,
    { method: "GET", token: sellerToken },
  );
  const sellerOrder = sellerOrders.items.find((item) => item.id === orderId) ?? sellerOrders.items[0] ?? null;
  expect(sellerOrder?.orderNumber).toBeTruthy();

  await backendJson(request, `/api/shops/${shop.id}/payments/${orderId}/mark-paid`, {
    method: "POST",
    token: sellerToken,
    data: { note: "Paid for operational polish flow." },
  });

  const adminPage = await loginAdmin(browser);
  await adminPage.goto("/admin/deliveries?status=MISSING_YANDEX_ORDER_ID");
  await adminPage.getByTestId("admin-delivery-search").fill(sellerOrder?.orderNumber ?? "");
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  const adminRow = adminPage.getByTestId("admin-delivery-row").filter({ hasText: sellerOrder?.orderNumber ?? "" });
  await expect(adminRow).toBeVisible();
  await adminRow.click();
  await adminPage.getByTestId("admin-remind-seller-yandex").click();
  await expect(adminPage.getByText(/Reminder sent|Reminder already sent/i)).toBeVisible();

  const sellerPage = await browser.newPage();
  await sellerPage.goto("/login");
  await sellerPage.getByTestId("login-email").fill(sellerEmail);
  await sellerPage.getByTestId("login-password").fill(password);
  await sellerPage.getByTestId("login-submit").click();
  await sellerPage.waitForURL("**/seller/dashboard");
  await sellerPage.goto(`/seller/orders/${orderId}`);
  await expect(sellerPage.getByRole("heading", { name: "Yandex Delivery Handoff" })).toBeVisible();
  await expect(sellerPage.getByTestId("seller-yandex-reminder-banner")).toContainText("Admin reminded you");
  await sellerPage.getByTestId("manual-yandex-order-id").fill(`YANDEX-${stamp}`);
  await sellerPage.getByTestId("manual-delivery-tracking-url").fill(`https://track.example/yandex/${stamp}`);
  await sellerPage.getByTestId("manual-delivery-price").fill("450");
  await sellerPage.getByTestId("manual-delivery-save").click();
  await expect(sellerPage.getByTestId("delivery-action-message")).toContainText(/saved|updated/i);

  if (trackingHref) {
    await page.goto(trackingHref);
  }
  await expect(page.getByTestId("tracked-yandex-order-id")).toContainText(`YANDEX-${stamp}`);

  await adminPage.goto("/admin/deliveries?status=MISSING_YANDEX_ORDER_ID");
  await adminPage.getByTestId("admin-delivery-search").fill(sellerOrder?.orderNumber ?? "");
  await adminPage.getByRole("button", { name: "Refresh" }).click();
  await expect(
    adminPage.getByTestId("admin-delivery-row").filter({ hasText: sellerOrder?.orderNumber ?? "" }),
  ).toHaveCount(0);

  await sellerPage.close();
  await adminPage.close();
});
